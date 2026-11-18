import Booking from "../models/bookingModel.js";
import AppError from "../utils/AppError.js";
import User from "../models/userModel.js";
import Service from "../models/Service.js";
import Barber from "../models/barberModel.js";
import Payment from "../models/PaymentModel.js";

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
        .populate('barberId', 'name')
        .sort({ appointmentStart: -1 })
        .skip((currentPage - 1) * limit)
        .limit(limit);

    const bookingStats = Object.fromEntries(statusCounts.map(item => [item._id, item.count]));
    return { bookings, totalBookings, allBookingsCount, totalPages, page: currentPage, limit, bookingStats };
};


const getAdminBookingDetailsService = async(bookingId)=>{
    const booking = await Booking.findById(bookingId)
    .populate('userId','name email phone')
    .populate('serviceId')
    .populate('barberId')

    if(!booking){
        throw new AppError("Booking Not found",400)
    }

    const payment = await Payment.findOne({ bookingId })
    .select('-razorpaySignature');
    

    return{...booking.toObject(),payment}
}



const updateBookingStatusService = async (bookingId, newStatus) => {
    const booking = await Booking.findById(bookingId);  

    if (!booking) {
     throw new AppError("Booking Not Found", 404);
    }
    const allowedStatuses = ["PENDING","CONFIRMED","ACCEPTED","DECLINED","COMPLETED","CANCELLED"];

    if (!allowedStatuses.includes(newStatus)) {
        throw new AppError("Invalid booking status", 400);
    }

    const allowedTransitions = {
        PENDING: [],
        CONFIRMED: ["COMPLETED"],
        ACCEPTED: [],
        DECLINED: [],
        COMPLETED: [],
        CANCELLED: []
    };

    const nextStatuses = allowedTransitions[booking.status] ?? [];

    if (!nextStatuses.includes(newStatus)) {
        throw new AppError("Invalid booking status transition", 400);
    }

    booking.status = newStatus;

    await booking.save();

    return booking;
};

const cancelAdminBookingService = async (bookingId) => {
    if (!/^[a-f\d]{24}$/i.test(String(bookingId || ''))) {
        throw new AppError('Invalid booking ID', 400);
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
        throw new AppError('Booking Not Found', 404);
    }

    const cancellableStatuses = ['PENDING', 'CONFIRMED', 'ACCEPTED'];
    if (!cancellableStatuses.includes(booking.status)) {
        throw new AppError('This booking cannot be cancelled from its current status', 400);
    }

    booking.status = 'CANCELLED';
    await booking.save();

    return booking;
};

export { getAdminBookingsService, updateBookingStatusService, getAdminBookingDetailsService, cancelAdminBookingService };
