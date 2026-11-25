import ShopAvailability from "../models/shopAvailabilityModel.js";
import { getActiveBookingAvailabilityFilter } from "../utils/bookingPaymentDeadline.js";
import AppError from "../utils/AppError.js";
import mongoose from "mongoose";
import ShopRules from "../models/ShopRules.js";
import Booking from "../models/bookingModel.js";

const createShopAvailabilityService = async (date, type, startTime, endTime, reason) => {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new AppError("Invalid appointment date", 400);
    }   
        const [year, month, day] = date.split("-").map(Number);
        const selectedDate = new Date(year, month - 1, day);
    if (selectedDate.getFullYear() !== year ||selectedDate.getMonth() !== month - 1 ||selectedDate.getDate() !== day) {
        throw new AppError("Invalid appointment date", 400);
    }
    if (!["FULL_DAY", "TIME_RANGE"].includes(type)) {
        throw new AppError("Invalid shop availability type", 400);
    }
    if (reason !== undefined && reason !== null && typeof reason !== "string") {
        throw new AppError("Closure reason must be text", 400);
    }
    if (type === "FULL_DAY" && (startTime || endTime)) {
        throw new AppError("Full-day closure cannot have specific times", 400);
    }
    if (type === "TIME_RANGE" && (typeof startTime !== "string" || typeof endTime !== "string" || !startTime || !endTime)) {
        throw new AppError("Start time and end time are required", 400);
    }
        const start = type === "TIME_RANGE" ? new Date(startTime) : null;
        const end = type === "TIME_RANGE" ? new Date(endTime) : null;

    if (type === "TIME_RANGE" && (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))) {
        throw new AppError("Invalid closure start or end time", 400);
    }
    if (type === "TIME_RANGE" && end <= start) {
        throw new AppError("End time must be later than start time", 400);
    }
    
        const dayStart = new Date(selectedDate);
        const dayEnd = new Date(selectedDate);
        dayEnd.setDate(dayEnd.getDate() + 1);

    const session = await mongoose.startSession();
    let closure;
    try {
        await session.withTransaction(async () => {
            const shopRules = await ShopRules.findOne().session(session);
            if (!shopRules) throw new AppError("Shop rules are not configured", 500);
            const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
            if (!timePattern.test(shopRules.openingTime) || !timePattern.test(shopRules.closingTime)) throw new AppError("Shop working hours are invalid", 500);
            const shopStart = new Date(dayStart);
            const [openHour, openMinute] = shopRules.openingTime.split(":").map(Number);
            shopStart.setHours(openHour, openMinute, 0, 0);
            const shopEnd = new Date(dayStart);
            const [closeHour, closeMinute] = shopRules.closingTime.split(":").map(Number);
            shopEnd.setHours(closeHour, closeMinute, 0, 0);
            if (shopEnd <= shopStart) shopEnd.setDate(shopEnd.getDate() + 1);
            if (type === "TIME_RANGE" && (start < shopStart || end > shopEnd)) throw new AppError("Closure must fall within shop working hours", 400);
            await ShopRules.updateOne({ _id: shopRules._id }, { $inc: { bookingLockVersion: 1 } }, { session });
            const existingClosures = await ShopAvailability.find({ date: { $gte: dayStart, $lt: dayEnd }, isActive: true }).session(session);
            const conflicts = existingClosures.some(item => type === "FULL_DAY" || item.type === "FULL_DAY" || (start < item.endTime && end > item.startTime));
            if (conflicts) throw new AppError("Closure overlaps an existing active closure", 409);
            const closureStart = type === "FULL_DAY" ? shopStart : start;
            const closureEnd = type === "FULL_DAY" ? shopEnd : end;
            const now = new Date();
            const bookingConflict = await Booking.exists({ appointmentStart: { $lt: closureEnd }, appointmentEnd: { $gt: closureStart }, ...getActiveBookingAvailabilityFilter(now) }).session(session);
            if (bookingConflict) throw new AppError("Closure overlaps an active booking", 409);
            [closure] = await ShopAvailability.create([{ date: dayStart, type, startTime: start, endTime: end, reason }], { session });
        });
        return closure;
    } finally {
        await session.endSession();
    }

};


const parseLocalDateOnly = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(year, month - 1, day);
    if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
    return parsed;
};

const getShopAvailabilityService = async (startDate, endDate) => {
    const start = parseLocalDateOnly(startDate);
    const end = parseLocalDateOnly(endDate);
    if (!start || !end) {
        throw new AppError("Invalid date range", 400);
    }
    if (end <= start) {
        throw new AppError("End date must be later than start date", 400);
    }

        const closures = await ShopAvailability.find({
        date: { $gte: start, $lt: end },
        isActive: true
    }).sort({ date: 1, startTime: 1 });

        return closures;
};

const reopenShopAvailabilityService = async (closureId) => {
    if (!mongoose.isValidObjectId(closureId)) {
        throw new AppError("Invalid closure ID", 400);
    }
    const session = await mongoose.startSession();
    let closure;
    try {
        await session.withTransaction(async () => {
            const shopRules = await ShopRules.findOne().session(session);
            if (!shopRules) throw new AppError("Shop rules are not configured", 500);
            await ShopRules.updateOne({ _id: shopRules._id }, { $inc: { bookingLockVersion: 1 } }, { session });
            closure = await ShopAvailability.findOneAndUpdate(
                { _id: closureId, isActive: true }, { $set: { isActive: false } }, { new: true, session }
            );
            if (!closure) throw new AppError("Active closure not found", 404);
        });
        return closure;
    } finally {
        await session.endSession();
    }
};


export{createShopAvailabilityService,
        getShopAvailabilityService,
        reopenShopAvailabilityService

}
