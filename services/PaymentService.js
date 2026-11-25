import razorpay from "../config/razorpay.js";
import Booking from "../models/bookingModel.js";
import Payment from "../models/PaymentModel.js";
import { debitWalletService } from './WalletService.js';
import crypto from "node:crypto";
import AppError from "../utils/AppError.js";
import mongoose from "mongoose";
import { randomUUID } from 'node:crypto';
import {
    RAZORPAY_ORDER_RESERVATION_TIMEOUT_MS,
    RAZORPAY_ORDER_RESERVATION_RENEWAL_INTERVAL_MS,
    RAZORPAY_ORDER_RESERVATION_MAX_RENEWAL_DURATION_MS
} from '../config/paymentReservation.js';
import { getBookingPaymentDeadline } from '../utils/bookingPaymentDeadline.js';

const releasePaymentCreationReservation = async (paymentId, creationToken) => Payment.updateOne(
    { _id: paymentId, status: 'CREATING', creationToken },
    {
        $set: { creationToken: null, creationStartedAt: new Date(0) }
    }
);

const releaseReservationAndPreserveError = async (paymentId, creationToken, originalError) => {
    try {
        await releasePaymentCreationReservation(paymentId, creationToken);
    } catch (cleanupError) {
        console.error('Unable to release failed Razorpay payment reservation', cleanupError);
    }
};

const hasRazorpayOrderId = (orderId) => typeof orderId === 'string' && orderId.trim().length > 0;

const getBookingReceipt = (bookingId) => `booking_${bookingId}`;

const buildCheckoutResponse = (order) => ({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID
});

const validateRazorpayOrder = (order, receipt, amountInPaise) => {
    if (!hasRazorpayOrderId(order?.id) || order.receipt !== receipt || order.amount !== amountInPaise || order.currency !== 'INR') {
        throw new AppError('Razorpay order does not match this booking', 409);
    }
    return order;
};

const findOrderByReceipt = async (receipt, amountInPaise) => {
    const result = await razorpay.orders.all({ receipt, count: 100 });
    const orders = Array.isArray(result?.items) ? result.items : [];
    const matchingOrder = orders
        .filter((order) => order.receipt === receipt)
        .sort((left, right) => Number(right.created_at || 0) - Number(left.created_at || 0))[0];
    return matchingOrder ? validateRazorpayOrder(matchingOrder, receipt, amountInPaise) : null;
};

const reconcilePaidRazorpayOrder = async (order, userId) => {
    const orderPayments = await razorpay.orders.fetchPayments(order.id);
    const capturedPayment = orderPayments?.items?.find((payment) => payment.status === 'captured');
    if (!capturedPayment) throw new AppError('Razorpay reports this order paid, but its captured payment could not be retrieved', 502);
    const providerPayment = await razorpay.payments.fetch(capturedPayment.id);
    await settleCapturedRazorpayPayment({ orderId: order.id, paymentId: capturedPayment.id, razorpayPayment: providerPayment, userId });
};

const claimPaymentCreationReservation = async ({ booking, userId, amount, receipt }) => {
    const creationToken = randomUUID();
    const now = new Date();
    const staleBefore = new Date(now.getTime() - RAZORPAY_ORDER_RESERVATION_TIMEOUT_MS);

    for (let attempt = 0; attempt < 3; attempt += 1) {
        const existing = await Payment.findOne({ bookingId: booking._id });
        if (existing && String(existing.userId) !== String(userId)) {
            throw new AppError('Payment record does not belong to this customer', 409);
        }
        if (existing?.status === 'SUCCESS') {
            throw new AppError('This booking has already been paid', 409);
        }
        if (existing?.status === 'PENDING' && hasRazorpayOrderId(existing.razorpayOrderId)) {
            if (existing.method !== 'RAZORPAY' || Math.round(Number(existing.amount) * 100) !== Math.round(amount * 100) || existing.currency !== 'INR') {
                throw new AppError('Existing payment does not match this booking', 409);
            }
            let providerOrder;
            try {
                providerOrder = await razorpay.orders.fetch(existing.razorpayOrderId);
            } catch {
                const recoveredOrder = await findOrderByReceipt(receipt, Math.round(amount * 100));
                if (recoveredOrder) return { kind: 'ready', order: recoveredOrder, reservation: existing };
                const stalePending = await Payment.findOneAndUpdate(
                    { _id: existing._id, bookingId: booking._id, userId, status: 'PENDING', razorpayOrderId: existing.razorpayOrderId },
                    { $set: { status: 'CREATING', creationToken, creationStartedAt: now, razorpayPaymentId: null, razorpaySignature: null } },
                    { new: true, runValidators: true }
                );
                if (stalePending) return { kind: 'claimed', reservation: stalePending, creationToken, recoverByReceipt: true };
                continue;
            }
            const order = validateRazorpayOrder(providerOrder, receipt, Math.round(amount * 100));
            return { kind: 'ready', order, reservation: existing };
        }

        let filter;
        if (!existing) {
            try {
                const [reservation] = await Payment.create([{
                    bookingId: booking._id, userId, method: 'RAZORPAY', status: 'CREATING',
                    creationToken, creationStartedAt: now, amount, currency: 'INR'
                }]);
                return { kind: 'claimed', reservation, creationToken, recoverByReceipt: false };
            } catch (error) {
                if (error.code === 11000 && error.keyPattern?.bookingId) continue;
                throw error;
            }
        }

        if (existing.status === 'FAILED') {
            filter = { _id: existing._id, bookingId: booking._id, userId, status: 'FAILED' };
        } else if (existing.status === 'CREATING') {
            const leaseStartedAt = existing.creationStartedAt?.getTime?.() || 0;
            if (leaseStartedAt > staleBefore.getTime()) {
                throw new AppError('Payment order is still being created. Please retry shortly.', 409);
            }
            filter = {
                _id: existing._id, bookingId: booking._id, userId, status: 'CREATING',
                $or: [
                    { creationStartedAt: { $lte: staleBefore } },
                    { creationStartedAt: null },
                    { creationStartedAt: { $exists: false } }
                ]
            };
        } else if (existing.status === 'PENDING' && !hasRazorpayOrderId(existing.razorpayOrderId)) {
            filter = { _id: existing._id, bookingId: booking._id, userId, status: 'PENDING', $or: [{ razorpayOrderId: null }, { razorpayOrderId: { $exists: false } }] };
        } else {
            throw new AppError('This booking already has a payment that must be resolved first', 409);
        }

        const reservation = await Payment.findOneAndUpdate(filter, {
            $set: {
                method: 'RAZORPAY', status: 'CREATING', creationToken, creationStartedAt: now,
                amount, currency: 'INR', razorpayPaymentId: null, razorpaySignature: null
            }
        }, { new: true, runValidators: true });
        if (reservation) {
            return {
                kind: 'claimed', reservation, creationToken,
                recoverByReceipt: true,
                existingOrderId: existing.razorpayOrderId
            };
        }
    }

    const current = await Payment.findOne({ bookingId: booking._id, userId });
    if (current?.status === 'PENDING' && hasRazorpayOrderId(current.razorpayOrderId)) {
        const order = validateRazorpayOrder(await razorpay.orders.fetch(current.razorpayOrderId), receipt, Math.round(amount * 100));
        return { kind: 'ready', order, reservation: current };
    }
    throw new AppError('Payment order is being created by another request. Please retry shortly.', 409);
};

const startReservationLeaseRenewal = (paymentId, creationToken) => {
    let timer;
    let stopped = false;
    let renewalError;
    let pendingRenewal = Promise.resolve();
    const renewalDeadline = Date.now() + RAZORPAY_ORDER_RESERVATION_MAX_RENEWAL_DURATION_MS;

    const scheduleRenewal = () => {
        if (stopped || renewalError || Date.now() >= renewalDeadline) return;
        timer = setTimeout(() => {
            if (stopped || Date.now() >= renewalDeadline) return;
            pendingRenewal = (async () => {
                try {
                    const renewed = await Payment.updateOne(
                        { _id: paymentId, status: 'CREATING', creationToken },
                        { $set: { creationStartedAt: new Date() } }
                    );
                    if (renewed.matchedCount !== 1) {
                        throw new AppError('Razorpay payment reservation is no longer active', 409);
                    }
                } catch (error) {
                    renewalError = error;
                    return;
                }
                scheduleRenewal();
            })();
        }, RAZORPAY_ORDER_RESERVATION_RENEWAL_INTERVAL_MS);
    };

    scheduleRenewal();
    return async () => {
        stopped = true;
        clearTimeout(timer);
        await pendingRenewal;
        if (renewalError) throw renewalError;
    };
};


// Worked by Codex: create payment from the booking's persisted combined total and advance amount.
const createPaymentOrderService = async (bookingId, requestedServiceIds, userId) => {
    const booking = await Booking.findOne({ _id: bookingId, userId, status: { $in: ['PENDING', 'FAILED'] } });

    if (!booking) {
        throw new AppError("Pending booking not found", 404);
    }
    const paymentDeadline = getBookingPaymentDeadline(booking);
    if (!paymentDeadline || paymentDeadline <= new Date()) {
        throw new AppError('The five-minute payment window for this booking has expired', 410);
    }

    const bookingServiceIds = booking.serviceIds?.length
        ? booking.serviceIds.map((id) => String(id))
        : [String(booking.serviceId)];
    if (requestedServiceIds) {
        const requestedIds = [...new Set((Array.isArray(requestedServiceIds) ? requestedServiceIds : [requestedServiceIds]).map(String))].sort();
        if (JSON.stringify(requestedIds) !== JSON.stringify([...bookingServiceIds].sort())) {
            throw new AppError('Selected services do not match this booking', 400);
        }
    }

    const totalPrice = Number(booking.servicePrice);
    const advanceAmount = Number(booking.advanceAmount);

    if (
        !Number.isFinite(totalPrice) ||
        totalPrice <= 0 ||
        !Number.isFinite(advanceAmount) ||
        advanceAmount <= 0 ||
        advanceAmount > totalPrice
    ) {
        throw new AppError("Invalid booking payment configuration", 400);
    }

    const amountInPaise = Math.round(advanceAmount * 100);
    const receipt = getBookingReceipt(booking._id);
    const reservationClaim = await claimPaymentCreationReservation({ booking, userId, amount: advanceAmount, receipt });
    if (reservationClaim.kind === 'ready') {
        if (reservationClaim.order.status === 'paid') {
            await reconcilePaidRazorpayOrder(reservationClaim.order, userId);
            throw new AppError('Payment was already completed. Refresh your bookings.', 409);
        }
        return buildCheckoutResponse(reservationClaim.order);
    }

    const { reservation, creationToken, recoverByReceipt, existingOrderId } = reservationClaim;
    const stopLeaseRenewal = startReservationLeaseRenewal(reservation._id, creationToken);
    let order;
    let orderCreationError;
    let reservationRenewalError;
    try {
        if (existingOrderId) {
            order = validateRazorpayOrder(await razorpay.orders.fetch(existingOrderId), receipt, amountInPaise);
        } else if (recoverByReceipt) {
            order = await findOrderByReceipt(receipt, amountInPaise);
        }
        if (!order) {
            order = validateRazorpayOrder(await razorpay.orders.create({
                amount: amountInPaise,
                currency: 'INR',
                receipt
            }), receipt, amountInPaise);
        }
    } catch (error) {
        orderCreationError = error;
        try {
            order = await findOrderByReceipt(receipt, amountInPaise);
            if (order) orderCreationError = null;
        } catch (recoveryError) {
            console.error('Unable to recover a Razorpay order by its booking receipt', recoveryError);
        }
    }
    try {
        await stopLeaseRenewal();
    } catch (error) {
        reservationRenewalError = error;
    }
    if (orderCreationError || reservationRenewalError) {
        const originalError = orderCreationError || reservationRenewalError;
        if (orderCreationError && reservationRenewalError) console.error('Razorpay reservation renewal also failed during order creation failure', reservationRenewalError);
        await releaseReservationAndPreserveError(reservation._id, creationToken, originalError);
        throw originalError;
    }

    const storedOrder = await Payment.updateOne(
        { _id: reservation._id, bookingId: booking._id, userId, status: 'CREATING', creationToken },
        { $set: { razorpayOrderId: order.id, amount: advanceAmount, currency: 'INR' } }
    );
    if (storedOrder.matchedCount !== 1) {
        throw new AppError('Payment reservation was replaced. Please retry shortly.', 409);
    }

    let finalizationSession;
    let finalizationError;
    try {
        finalizationSession = await mongoose.startSession();
        await finalizationSession.withTransaction(async () => {
            const finalizedPayment = await Payment.findOneAndUpdate(
                { _id: reservation._id, bookingId: booking._id, userId, method: 'RAZORPAY', status: 'CREATING', creationToken, razorpayOrderId: order.id },
                { $set: { status: 'PENDING', creationToken: null, creationStartedAt: null } },
                { new: true, session: finalizationSession, runValidators: true }
            );
            if (!finalizedPayment) throw new AppError('The payment reservation expired or was replaced. Please retry.', 409);
            const currentBooking = await Booking.findOne({ _id: booking._id, userId }).session(finalizationSession);
            if (!currentBooking) throw new AppError('Booking no longer belongs to this customer', 404);
            const currentPaymentDeadline = getBookingPaymentDeadline(currentBooking);
            if (!currentPaymentDeadline || currentPaymentDeadline <= new Date()) {
                throw new AppError('The five-minute payment window for this booking has expired', 410);
            }
            if (currentBooking.status === 'FAILED') {
                const restoredBooking = await Booking.findOneAndUpdate(
                    { _id: currentBooking._id, userId, status: 'FAILED' },
                    { $set: { status: 'PENDING' } },
                    { new: true, session: finalizationSession, runValidators: true }
                );
                if (!restoredBooking) throw new AppError('Booking status changed while payment was being finalized', 409);
            } else if (currentBooking.status !== 'PENDING') {
                throw new AppError('Booking is no longer eligible for payment', 409);
            }
        });
    } catch (error) {
        finalizationError = error;
        await Payment.updateOne(
            { _id: reservation._id, status: 'CREATING', creationToken, razorpayOrderId: order.id },
            { $set: { creationToken: null, creationStartedAt: new Date(0) } }
        ).catch((cleanupError) => console.error('Unable to expire failed Razorpay finalization reservation', cleanupError));
        if (error.code === 11000) {
            const conflict = new AppError('Razorpay order conflicts with an existing payment record', 409);
            conflict.cause = error;
            finalizationError = conflict;
            throw conflict;
        }
        throw error;
    } finally {
        if (finalizationSession) {
            try {
                await finalizationSession.endSession();
            } catch (cleanupError) {
                if (finalizationError) {
                    finalizationError.sessionCleanupError = cleanupError;
                    console.error('Unable to close failed Razorpay finalization session', cleanupError);
                } else {
                    throw cleanupError;
                }
            }
        }
    }

    if (order.status === 'paid') {
        await reconcilePaidRazorpayOrder(order, userId);
        throw new AppError('Payment was already completed. Refresh your bookings.', 409);
    }
    return buildCheckoutResponse(order);
};


const payWithWalletService = async (bookingId, userId) => {
    const session = await mongoose.startSession();
    let result;

    try {
        await session.withTransaction(async () => {
            const booking = await Booking.findOne({
                _id: bookingId,
                userId,
                status: { $in: ['PENDING', 'FAILED'] }
            }).session(session);

            if (!booking) {
                throw new AppError('Pending booking not found', 404);
            }

            const paymentDeadline = getBookingPaymentDeadline(booking);
            if (!paymentDeadline || paymentDeadline <= new Date()) {
                throw new AppError('The five-minute payment window for this booking has expired', 410);
            }

            const amount = Number(booking.advanceAmount);
            const servicePrice = Number(booking.servicePrice);

            if (
                !Number.isFinite(amount) ||
                amount <= 0 ||
                !Number.isFinite(servicePrice) ||
                servicePrice <= 0 ||
                amount > servicePrice
            ) {
                throw new AppError('Invalid booking payment configuration', 400);
            }

            const existingPayment = await Payment.findOne({
                bookingId,
                userId
            }).session(session);

            if (existingPayment?.status === 'SUCCESS') {
                throw new AppError('Booking has already been paid', 409);
            }

            if (existingPayment?.status === 'CREATING') {
                throw new AppError('A Razorpay order is currently being created for this booking', 409);
            }

            if (existingPayment?.status === 'PENDING') {
                throw new AppError(
                    'An existing payment is still pending. Complete or resolve it first.',
                    409
                );
            }

            const transaction = await debitWalletService(
                userId,
                amount,
                'BOOKING_PAYMENT',
                booking._id,
                session
            );

            const finalPaymentDeadline = getBookingPaymentDeadline(booking);
            if (!finalPaymentDeadline || finalPaymentDeadline <= new Date()) {
                throw new AppError('The five-minute payment window for this booking has expired', 410);
            }

            let payment;

            if (existingPayment) {
                payment = await Payment.findOneAndUpdate(
                    {
                        _id: existingPayment._id,
                        bookingId: booking._id,
                        userId,
                        status: 'FAILED'
                    },
                    {
                        $set: {
                            method: 'WALLET',
                            razorpayPaymentId: null,
                            razorpaySignature: null,
                            amount,
                            currency: 'INR',
                            status: 'SUCCESS',
                            creationToken: null,
                            creationStartedAt: null
                        },
                        $unset: { razorpayOrderId: 1 }
                    },
                    { new: true, session, runValidators: true }
                );
                if (!payment) {
                    throw new AppError('Payment changed while wallet payment was being processed', 409);
                }
            } else {
                const createdPayments = await Payment.create([{
                    bookingId: booking._id,
                    userId,
                    method: 'WALLET',
                    amount,
                    currency: 'INR',
                    status: 'SUCCESS'
                }], { session });

                payment = createdPayments[0];
            }

            booking.status = 'CONFIRMED';
            await booking.save({ session });

            result = {
                booking,
                payment,
                transaction
            };
        });

        return result;
    } catch (error) {
        if (error.code === 11000 && error.keyPattern?.bookingId) {
            throw new AppError('Another payment request owns this booking', 409);
        }
        throw error;
    } finally {
        await session.endSession();
    }
};



const markPaymentFailedService = async (orderId, paymentId, userId) => {
    if (typeof paymentId !== 'string' || !paymentId) throw new AppError('Payment failure could not be verified', 400);
    const payment = await Payment.findOne({
        razorpayOrderId: orderId,
        userId,
        status: 'PENDING'
    });

    if (!payment) {
        const previouslyFailed = await Payment.findOne({ razorpayOrderId: orderId, userId, razorpayPaymentId: paymentId, status: 'FAILED' });
        if (previouslyFailed) return previouslyFailed;
        throw new AppError('Pending payment record not found', 404);
    }

    const razorpayPayment = await razorpay.payments.fetch(paymentId);

    if (
        razorpayPayment.order_id !== orderId ||
        razorpayPayment.status !== 'failed'
    ) {
        throw new AppError('Payment failure could not be verified', 400);
    }

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const currentPayment = await Payment.findOne({
                _id: payment._id,
                userId,
                status: 'PENDING'
            }).session(session);

            if (!currentPayment) {
                throw new AppError('Payment is no longer pending', 409);
            }

            const booking = await Booking.findOne({
                _id: currentPayment.bookingId,
                userId,
                status: 'PENDING'
            }).session(session);

            if (!booking) {
                throw new AppError('Booking is no longer pending', 409);
            }

            currentPayment.razorpayPaymentId = paymentId;
            currentPayment.status = 'FAILED';

            booking.status = 'FAILED';

            await currentPayment.save({ session });
            await booking.save({ session });
        });

        return await Payment.findById(payment._id);
    } finally {
        await session.endSession();
    }
};

const settleCapturedRazorpayPayment = async ({ orderId, paymentId, signature = null, razorpayPayment, userId = null }) => {
    if (
        !hasRazorpayOrderId(orderId) ||
        typeof paymentId !== 'string' ||
        !paymentId ||
        razorpayPayment?.id !== paymentId ||
        razorpayPayment?.order_id !== orderId ||
        razorpayPayment?.status !== 'captured'
    ) {
        throw new AppError('Payment verification failed', 400);
    }

    const paymentFilter = { razorpayOrderId: orderId, method: 'RAZORPAY' };
    if (userId) paymentFilter.userId = userId;
    const ownedPayment = await Payment.findOne(paymentFilter);
    if (!ownedPayment) throw new AppError('Payment record not found', 404);

    const ownerId = ownedPayment.userId;
    const validateCapturedPayment = (record) => {
        const expectedAmount = Math.round(Number(record.amount) * 100);
        if (
            record.method !== 'RAZORPAY' ||
            record.razorpayOrderId !== orderId ||
            !Number.isSafeInteger(expectedAmount) ||
            razorpayPayment.amount !== expectedAmount ||
            razorpayPayment.currency !== record.currency
        ) {
            throw new AppError('Payment verification failed', 400);
        }
    };
    validateCapturedPayment(ownedPayment);

    if (ownedPayment.status === 'SUCCESS') {
        if (ownedPayment.razorpayPaymentId !== paymentId) {
            throw new AppError('Payment does not match this order', 409);
        }
        const booking = await Booking.findOne({ _id: ownedPayment.bookingId, userId: ownerId });
        if (!booking) throw new AppError('Booking not found for verified payment', 404);
        return { booking, payment: ownedPayment };
    }
    if (!['CREATING', 'PENDING', 'FAILED'].includes(ownedPayment.status)) throw new AppError('Payment is no longer pending', 409);

    const session = await mongoose.startSession();
    let settledBooking;
    let settledPayment;

    try {
        await session.withTransaction(async () => {
            const currentPayment = await Payment.findOne({
                _id: ownedPayment._id,
                userId: ownerId,
                method: 'RAZORPAY',
                razorpayOrderId: orderId
            }).session(session);

            if (!currentPayment) throw new AppError('Payment record not found', 404);
            validateCapturedPayment(currentPayment);

            const booking = await Booking.findOne({
                _id: currentPayment.bookingId,
                userId: ownerId
            }).session(session);
            if (!booking) throw new AppError('Booking not found for verified payment', 404);

            if (currentPayment.status === 'SUCCESS') {
                if (currentPayment.razorpayPaymentId !== paymentId) {
                    throw new AppError('Payment does not match this order', 409);
                }
                settledPayment = currentPayment;
                settledBooking = booking;
                return;
            }
            if (!['CREATING', 'PENDING', 'FAILED'].includes(currentPayment.status)) {
                throw new AppError('Payment is no longer pending', 409);
            }

            currentPayment.razorpayPaymentId = paymentId;
            currentPayment.razorpaySignature = signature;
            currentPayment.status = 'SUCCESS';
            await currentPayment.save({ session });

            const paymentDeadline = getBookingPaymentDeadline(booking);
            const bookingExpired = !paymentDeadline || paymentDeadline <= new Date();
            if (booking.status === 'PENDING' && !bookingExpired) {
                booking.status = 'CONFIRMED';
                await booking.save({ session });
            } else {
                if (booking.status === 'PENDING') {
                    booking.status = 'FAILED';
                    await booking.save({ session });
                }
                const refundAmount = Number(currentPayment.amount);
                if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
                    throw new AppError('Invalid successful payment amount', 500);
                }

                // Captured payments for expired or otherwise ineligible bookings are refunded atomically.
                await creditWalletService(
                    ownerId,
                    refundAmount,
                    'BOOKING_REFUND',
                    booking._id,
                    session
                );
            }

            settledPayment = currentPayment;
            settledBooking = booking;
        });
    } finally {
        await session.endSession();
    }

    return { booking: settledBooking, payment: settledPayment };
};

const verifyPaymentService = async (orderId, paymentId, signature, userId) => {
    const payment = await Payment.findOne({ razorpayOrderId: orderId, userId });
    if (!payment) throw new AppError('Payment record not found', 404);

    if (!verifyPaymentSignature(orderId, paymentId, signature)) {
        throw new AppError('Invalid payment signature', 400);
    }

    const razorpayPayment = await razorpay.payments.fetch(paymentId);
    return settleCapturedRazorpayPayment({
        orderId,
        paymentId,
        signature,
        razorpayPayment,
        userId
    });
};

const reconcileCapturedPaymentBeforeExpiry = async (bookingId) => {
    const payment = await Payment.findOne({
        bookingId,
        method: 'RAZORPAY',
        status: { $in: ['CREATING', 'PENDING', 'FAILED'] }
    });
    if (!payment || !hasRazorpayOrderId(payment.razorpayOrderId)) return false;
    const checkedRecently = payment.lastCaptureCheckAt
        && payment.lastCaptureCheckAt.getTime() > Date.now() - 60 * 1000;
    if (checkedRecently) return false;

    const orderPayments = await razorpay.orders.fetchPayments(payment.razorpayOrderId);
    const capturedPayment = orderPayments?.items?.find((item) => item.status === 'captured');
    if (!capturedPayment) {
        await Payment.updateOne(
            { _id: payment._id, status: payment.status, razorpayOrderId: payment.razorpayOrderId },
            { $set: { lastCaptureCheckAt: new Date() } }
        );
        return false;
    }

    const providerPayment = await razorpay.payments.fetch(capturedPayment.id);
    await settleCapturedRazorpayPayment({
        orderId: payment.razorpayOrderId,
        paymentId: capturedPayment.id,
        razorpayPayment: providerPayment,
        userId: payment.userId
    });
    return true;
};

const verifyPaymentSignature = (orderId, paymentId, signature) => {
    if (
        typeof signature !== "string" ||
        !/^[a-f0-9]{64}$/i.test(signature) ||
        !process.env.RAZORPAY_KEY_SECRET
    ) {
        return false;
    }

    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

    return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, "hex"),
        Buffer.from(signature, "hex")
    );
};

export { createPaymentOrderService,
         verifyPaymentService,
         settleCapturedRazorpayPayment,
         reconcileCapturedPaymentBeforeExpiry,
         markPaymentFailedService,
         payWithWalletService
};
