import mongoose from "mongoose";
import BarberUnavailability from "../models/barberUnavailabilityModel.js";
import { getActiveBookingAvailabilityFilter } from "../utils/bookingPaymentDeadline.js";
import Barber from "../models/barberModel.js";
import Booking from "../models/bookingModel.js";
import ShopRules from "../models/ShopRules.js";
import AppError from "../utils/AppError.js";

const addBarberUnavailabilityService = async (barberId, startTime, endTime, reason) => {
    if (!mongoose.isValidObjectId(barberId)) throw new AppError("Barber ID is invalid", 400);
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new AppError("Choose a valid start and end time", 400);
    const session = await mongoose.startSession();
    let unavailability;
    try {
        await session.withTransaction(async () => {
            const barber = await Barber.findOne({ _id: barberId, isActive: true }).session(session);
            if (!barber) throw new AppError("Active barber not found", 404);
            const rules = await ShopRules.findOne().session(session);
            if (!rules) throw new AppError("Shop rules are not configured", 500);
            await ShopRules.updateOne({ _id: rules._id }, { $inc: { bookingLockVersion: 1 } }, { session });
            const overlap = await BarberUnavailability.exists({ barberId, startTime: { $lt: end }, endTime: { $gt: start } }).session(session);
            if (overlap) throw new AppError("Barber already has an overlapping unavailability", 409);
            const now = new Date();
            const bookingConflict = await Booking.exists({ barberId, appointmentStart: { $lt: end }, appointmentEnd: { $gt: start }, ...getActiveBookingAvailabilityFilter(now) }).session(session);
            if (bookingConflict) throw new AppError("Unavailability overlaps an active booking", 409);
            [unavailability] = await BarberUnavailability.create([{ barberId, startTime: start, endTime: end, reason }], { session });
        });
        return unavailability;
    } finally {
        await session.endSession();
    }
};

const getBarberUnavailabilityService = async (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new AppError("Choose a valid start and end time", 400);
    return BarberUnavailability.find({ startTime: { $lt: end }, endTime: { $gt: start } });
};

export { addBarberUnavailabilityService, getBarberUnavailabilityService };
