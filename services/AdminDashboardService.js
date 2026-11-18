import Booking from '../models/bookingModel.js';

const getIndiaDayRange = (date = new Date()) => {
    const indiaOffset = 330 * 60 * 1000;
    const indiaDate = new Date(date.getTime() + indiaOffset);
    const start = Date.UTC(indiaDate.getUTCFullYear(), indiaDate.getUTCMonth(), indiaDate.getUTCDate()) - indiaOffset;
    return { start: new Date(start), end: new Date(start + 24 * 60 * 60 * 1000) };
};

const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
}).format(amount);

const getAdminDashboardData = async () => {
    const { start, end } = getIndiaDayRange();
    const bookings = await Booking.find({ appointmentStart: { $gte: start, $lt: end } })
        .populate('userId', 'name')
        .populate('walkInCustomerId', 'name')
        .populate('serviceId', 'name')
        .sort({ appointmentStart: 1 });

    const completedToday = bookings.filter((booking) => booking.status === 'COMPLETED');
    const cancelledToday = bookings.filter((booking) => booking.status === 'CANCELLED');
    const completedGross = completedToday
        .reduce((total, booking) => total + (Number(booking.servicePrice) || 0), 0);

    const appointments = bookings.map((booking) => {
        const appointmentStart = new Date(booking.appointmentStart);
        const time = appointmentStart.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        });
        const [appointmentTime, period] = time.split(' ');

        return {
            time: appointmentTime,
            period,
            customer: booking.userId?.name || booking.walkInCustomerId?.name || 'Customer unavailable',
            service: booking.serviceId?.name || 'Service unavailable',
            amount: formatCurrency(Number(booking.servicePrice) || 0),
            status: booking.status
        };
    });

    return {
        dailyGross: completedToday.length ? formatCurrency(completedGross) : '—',
        totalBookings: bookings.length,
        completedBookings: completedToday.length,
        cancelledBookings: cancelledToday.length,
        appointments
    };
};

export { getAdminDashboardData };
