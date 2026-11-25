import mongoose from 'mongoose';
import Booking from '../models/bookingModel.js';
import Payment from '../models/PaymentModel.js';
import { reconcileCapturedPaymentBeforeExpiry } from './PaymentService.js';
import { RAZORPAY_ORDER_RESERVATION_TIMEOUT_MS } from '../config/paymentReservation.js';
import { getBookingPaymentDeadline, getExpiredPendingBookingFilter } from '../utils/bookingPaymentDeadline.js';

const BOOKING_EXPIRY_INTERVAL_MS = 15 * 1000;
const EXPIRY_BATCH_SIZE = 100;
let expiryTimer;
let expirySweepRunning = false;

const expireBookingIfUnpaid = async (bookingId, now) => {
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const expiryFilter = {
                _id: bookingId,
                status: 'PENDING',
                ...getExpiredPendingBookingFilter(now)
            };
            const booking = await Booking.findOne(expiryFilter).session(session);
            if (!booking) return;

            const payment = await Payment.findOne({ bookingId: booking._id }).session(session);
            if (payment?.status === 'SUCCESS') return;
            const activeReservation = payment?.status === 'CREATING'
                && payment.creationToken
                && payment.creationStartedAt
                && payment.creationStartedAt.getTime() + RAZORPAY_ORDER_RESERVATION_TIMEOUT_MS > now.getTime();
            if (activeReservation) return;

            const expiredBooking = await Booking.findOneAndUpdate(
                expiryFilter,
                { $set: { status: 'FAILED' } },
                { new: true, session, runValidators: true }
            );
            if (!expiredBooking) return;

            if (payment && ['CREATING', 'PENDING'].includes(payment.status)) {
                const failedPayment = await Payment.updateOne(
                    { _id: payment._id, status: payment.status },
                    { $set: { status: 'FAILED', creationToken: null, creationStartedAt: null } },
                    { session, runValidators: true }
                );
                if (failedPayment.matchedCount !== 1) {
                    throw new Error('Payment status changed while the booking was expiring');
                }
            }
        });
    } finally {
        await session.endSession();
    }
};

const runBookingExpirySweep = async () => {
    if (expirySweepRunning) return;
    expirySweepRunning = true;
    try {
        const now = new Date();
        const expiredBookings = await Booking.find({ status: 'PENDING', ...getExpiredPendingBookingFilter(now) })
            .select('_id')
            .sort({ paymentDeadline: 1, createdAt: 1 })
            .limit(EXPIRY_BATCH_SIZE)
            .lean();
        for (const booking of expiredBookings) {
            try {
                await reconcileCapturedPaymentBeforeExpiry(booking._id);
            } catch (error) {
                console.error('Unable to reconcile Razorpay capture before booking expiry:', error.message);
            }
            await expireBookingIfUnpaid(booking._id, now);
        }

        const captureRecheckCutoff = new Date(now.getTime() - 60 * 1000);
        const failedPayments = await Payment.find({
            method: 'RAZORPAY',
            status: 'FAILED',
            razorpayOrderId: { $type: 'string', $gt: '' },
            $or: [
                { lastCaptureCheckAt: null },
                { lastCaptureCheckAt: { $lte: captureRecheckCutoff } }
            ]
        }).select('_id bookingId').sort({ lastCaptureCheckAt: 1 }).limit(EXPIRY_BATCH_SIZE).lean();
        for (const payment of failedPayments) {
            const booking = await Booking.findById(payment.bookingId).select('status paymentDeadline createdAt').lean();
            const deadline = getBookingPaymentDeadline(booking);
            if (!deadline || deadline > now) {
                await Payment.updateOne({ _id: payment._id, status: 'FAILED' }, { $set: { lastCaptureCheckAt: now } });
                continue;
            }
            try {
                await reconcileCapturedPaymentBeforeExpiry(payment.bookingId);
            } catch (error) {
                console.error('Unable to reconcile delayed Razorpay capture:', error.message);
            }
        }
    } catch (error) {
        console.error('Booking expiry sweep failed:', error.message);
    } finally {
        expirySweepRunning = false;
    }
};

const startBookingExpiryScheduler = () => {
    if (expiryTimer) return;
    void runBookingExpirySweep();
    expiryTimer = setInterval(() => void runBookingExpirySweep(), BOOKING_EXPIRY_INTERVAL_MS);
    expiryTimer.unref?.();
};

export { startBookingExpiryScheduler };
