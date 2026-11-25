import Booking from "../models/bookingModel.js";
import AppError from "../utils/AppError.js";
import User from "../models/userModel.js";
import Service from "../models/Service.js";
import Barber from "../models/barberModel.js";
import Payment from "../models/PaymentModel.js";
import mongoose from "mongoose";
import { getAvailableSlotsService } from "./BookingService.js";
import ShopRules from "../models/ShopRules.js";
import { creditWalletService } from "./WalletService.js";
import { rewardReferralOnFirstBookingService } from "./ReferralService.js";

const getAdminBookingsService = async ({ page = 1, limit = 10, status = '', search = '' } = {}) => {
    const filter = {};
    if (status) filter.status = status;

    const term = search.trim();
    if (term) {
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(escapedTerm, 'i');
        const [users, services, barbers] = await Promise.all([
            User.find({ $or: [{ name: searchRegex }, { email: searchRegex }] }).select('_id'),
            Service.find({ name: searchRegex }).select('_id'),
            Barber.find({ name: searchRegex }).select('_id')
        ]);

        filter.$or = [
            { bookingToken: searchRegex },
            { userId: { $in: users.map(user => user._id) } },
            { serviceId: { $in: services.map(service => service._id) } },
            { serviceIds: { $in: services.map(service => service._id) } },
            { barberId: { $in: barbers.map(barber => barber._id) } }
        ];
    }

    const [totalBookings, allBookingsCount, statusCounts] = await Promise.all([
        Booking.countDocuments(filter),
        Booking.countDocuments({}),
        Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    ]);
    const totalPages = Math.ceil(totalBookings / limit);
    const currentPage = totalPages ? Math.min(page, totalPages) : 1;
    const bookings = await Booking.find(filter)
        .populate('userId', 'name email phone')
        .populate('serviceId', 'name')
        .populate('serviceIds', 'name')
        .populate('barberId', 'name')
        .sort({ appointmentStart: -1 })
        .skip((currentPage - 1) * limit)
        .limit(limit);

    const bookingStats = Object.fromEntries(statusCounts.map(item => [item._id, item.count]));
    return { bookings, totalBookings, allBookingsCount, totalPages, page: currentPage, limit, bookingStats };
};


const getAdminBookingDetailsService = async(bookingId)=>{
    if (!/^[a-f\d]{24}$/i.test(String(bookingId || ''))) {
        throw new AppError('Invalid booking ID', 400);
    }
    const booking = await Booking.findById(bookingId)
    .populate('userId','name email phone')
    .populate('serviceId')
    .populate('serviceIds')
    .populate('barberId')

    if(!booking){
        throw new AppError("Booking Not found",404)
    }

    const payment = await Payment.findOne({ bookingId })
    .select('-razorpaySignature');
    

    return{...booking.toObject(),payment}
}



const updateBookingStatusService = async (bookingId, newStatus) => {
    const session = await mongoose.startSession();
    let updatedBooking;

    try {
        await session.withTransaction(async () => {
            const booking = await Booking.findById(bookingId).session(session);

            if (!booking) {
                throw new AppError("Booking Not Found", 404);
            }
            const allowedStatuses = ["PENDING","CONFIRMED","ACCEPTED","DECLINED","COMPLETED","CANCELLED"];

            if (!allowedStatuses.includes(newStatus)) {
                throw new AppError("Invalid booking status", 400);
            }

            const allowedTransitions = {
                PENDING: ["CONFIRMED", "ACCEPTED", "DECLINED"],
                CONFIRMED: ["COMPLETED"],
                ACCEPTED: ["CONFIRMED", "COMPLETED", "DECLINED"],
                DECLINED: [],
                COMPLETED: [],
                CANCELLED: []
            };

            const nextStatuses = allowedTransitions[booking.status] ?? [];

            if (!nextStatuses.includes(newStatus)) {
                throw new AppError("Invalid booking status transition", 400);
            }

            // Worked by Codex: online bookings cannot be confirmed or completed before payment succeeds.
            if (booking.userId && ['CONFIRMED', 'ACCEPTED', 'COMPLETED'].includes(newStatus)) {
                const successfulPayment = await Payment.findOne({
                    bookingId: booking._id,
                    userId: booking.userId,
                    status: 'SUCCESS'
                }).session(session);
                if (!successfulPayment) {
                    throw new AppError('A successful payment is required before confirming this booking', 409);
                }
            }

            updatedBooking = await Booking.findOneAndUpdate(
                { _id: bookingId, status: booking.status },
                { $set: { status: newStatus } },
                { new: true, runValidators: true, session }
            );

            if (!updatedBooking) {
                throw new AppError("Booking status changed before the update could be applied", 409);
            }

            if (newStatus === 'COMPLETED' && booking.userId) {
                await rewardReferralOnFirstBookingService(booking.userId, session);
            }
        });

        return updatedBooking;
    } finally {
        await session.endSession();
    }
};

// Worked by Codex: reschedule within shop availability while preserving the combined service duration.
const rescheduleAdminBookingService = async (bookingId, date, startTime) => {
    if (!/^[a-f\d]{24}$/i.test(String(bookingId || ''))) throw new AppError('Invalid booking ID', 400);
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError('Choose a valid appointment date', 400);
    const requestedStart = new Date(startTime);
    if (Number.isNaN(requestedStart.getTime())) throw new AppError('Choose a valid appointment time', 400);
    const [year, month, day] = date.split('-').map(Number);
    const dateParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(requestedStart);
    if (dateParts !== date) {
        throw new AppError('Appointment date and time do not match', 400);
    }
    const bookingDate = new Date(Date.UTC(year, month - 1, day));
    if (bookingDate.getUTCFullYear() !== year || bookingDate.getUTCMonth() !== month - 1 || bookingDate.getUTCDate() !== day) {
        throw new AppError('Choose a valid appointment date', 400);
    }

    const session = await mongoose.startSession();
    let updatedBooking;
    try {
        await session.withTransaction(async () => {
            const booking = await Booking.findById(bookingId).session(session);
            if (!booking) throw new AppError('Booking Not Found', 404);
            if (!['PENDING', 'CONFIRMED', 'ACCEPTED'].includes(booking.status)) {
                throw new AppError('This booking cannot be rescheduled from its current status', 400);
            }
            const rules = await ShopRules.findOne().session(session);
            if (!rules) throw new AppError('Shop rules are not configured', 500);
            await ShopRules.updateOne({ _id: rules._id }, { $inc: { bookingLockVersion: 1 } }, { session });

            const primaryServiceId = booking.serviceIds?.[0] || booking.serviceId;
            const slots = await getAvailableSlotsService(
                primaryServiceId,
                date,
                session,
                booking.serviceDuration,
                booking._id
            );
            const matchingSlots = slots.filter((slot) => slot.startTime.getTime() === requestedStart.getTime());
            if (!matchingSlots.length) throw new AppError('That time is no longer available', 409);
            const selectedSlot = matchingSlots.find((slot) => String(slot.barberId) === String(booking.barberId)) || matchingSlots[0];
            booking.appointmentDate = bookingDate;
            booking.appointmentStart = selectedSlot.startTime;
            booking.appointmentEnd = selectedSlot.endTime;
            booking.barberId = selectedSlot.barberId;
            await booking.save({ session });
            updatedBooking = booking;
        });
    } finally {
        await session.endSession();
    }
    return updatedBooking;
};

const cancelAdminBookingService = async (bookingId) => {
    if (!/^[a-f\d]{24}$/i.test(String(bookingId || ""))) {
        throw new AppError("Invalid booking ID", 400);
    }

    const session = await mongoose.startSession();
    let cancelledBooking;

    try {
        await session.withTransaction(async () => {
            const booking = await Booking.findById(bookingId).session(session);

            if (!booking) {
                throw new AppError("Booking Not Found", 404);
            }

            if (!["PENDING", "CONFIRMED", "ACCEPTED"].includes(booking.status)) {
                throw new AppError(
                    "This booking cannot be cancelled from its current status",
                    400
                );
            }

            const appointmentTime = new Date(booking.appointmentStart);
            const timeDifference = appointmentTime.getTime() - Date.now();

            if (
                Number.isNaN(appointmentTime.getTime()) ||
                timeDifference <= 3 * 60 * 60 * 1000
            ) {
                throw new AppError(
                    "Cancellation is not allowed within 3 hours of the appointment",
                    400
                );
            }

            const payment = await Payment.findOne({
                bookingId: booking._id,
                status: "SUCCESS"
            }).session(session);

            if (payment) {
                if (!booking.userId) {
                    throw new AppError("Booking customer not found for refund", 500);
                }

                const refundAmount = Number(payment.amount);

                if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
                    throw new AppError("Invalid successful payment amount", 500);
                }

                await creditWalletService(
                    booking.userId,
                    refundAmount,
                    "BOOKING_REFUND",
                    booking._id,
                    session
                );
            }

            booking.status = "CANCELLED";
            await booking.save({ session });

            cancelledBooking = booking;
        });

        return cancelledBooking;
    } finally {
        await session.endSession();
    }
};
export { getAdminBookingsService, updateBookingStatusService, getAdminBookingDetailsService, cancelAdminBookingService, rescheduleAdminBookingService };
