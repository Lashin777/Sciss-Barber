const BOOKING_PAYMENT_WINDOW_MS = 5 * 60 * 1000;

const getBookingPaymentDeadline = (booking) => {
    if (booking?.paymentDeadline) {
        const deadline = new Date(booking.paymentDeadline);
        return Number.isNaN(deadline.getTime()) ? null : deadline;
    }
    if (!booking?.createdAt) return null;
    const createdAt = new Date(booking.createdAt);
    return Number.isNaN(createdAt.getTime()) ? null : new Date(createdAt.getTime() + BOOKING_PAYMENT_WINDOW_MS);
};

const getExpiredPendingBookingFilter = (now) => ({
    $or: [
        { paymentDeadline: { $lte: now } },
        { paymentDeadline: null, createdAt: { $lte: new Date(now.getTime() - BOOKING_PAYMENT_WINDOW_MS) } }
    ]
});

const getActiveBookingAvailabilityFilter = (now) => ({
    $or: [
        { status: { $in: ['CONFIRMED', 'ACCEPTED'] } },
        {
            status: 'PENDING',
            $or: [
                { paymentDeadline: { $gt: now } },
                { paymentDeadline: null, createdAt: { $gt: new Date(now.getTime() - BOOKING_PAYMENT_WINDOW_MS) } }
            ]
        },
        { bookingType: 'WALK_IN', status: 'COMPLETED', appointmentEnd: { $gt: now } }
    ]
});

export {
    BOOKING_PAYMENT_WINDOW_MS,
    getActiveBookingAvailabilityFilter,
    getBookingPaymentDeadline,
    getExpiredPendingBookingFilter
};
