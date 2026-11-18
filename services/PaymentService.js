import razorpay from "../config/razorpay.js";
import Service from "../models/Service.js";
import ShopRules from "../models/ShopRules.js";
import Booking from "../models/bookingModel.js";
import Payment from "../models/PaymentModel.js";
import crypto from "node:crypto";
import AppError from "../utils/AppError.js";
import mongoose from "mongoose";



const createPaymentOrderService = async (bookingId, serviceId, userId) => {

    const booking = await Booking.findOne({
        _id: bookingId,
        serviceId,
        userId,
        status: 'PENDING'
    });

    if (!booking) {
        throw new Error("Pending booking not found");
    }

    const existingPayment = await Payment.findOne({ bookingId });

    if (existingPayment) {
        throw new Error("Payment already exists for this booking");
    }

    const service = await Service.findOne({
        _id: serviceId,
        isActive: true
    });

    if (!service) {
        throw new Error("Service not found or inactive");
    }

    if (!Number.isFinite(service.price) || service.price <= 0) {
        throw new Error("Invalid service price");
    }

    const shopRules = await ShopRules.findOne();

    if (!shopRules) {
        throw new Error("Shop rules not configured");
    }

    const advanceAmount = shopRules.advancePayment;

    if (
        !Number.isFinite(advanceAmount) ||
        advanceAmount <= 0 ||
        advanceAmount > service.price
    ) {
        throw new Error("Invalid advance payment configuration");
    }

    const amountInPaise = Math.round(advanceAmount * 100);

    const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt: `booking_${booking._id}`
    });

    await Payment.create({
        bookingId: booking._id,
        userId,
        razorpayOrderId: order.id,
        amount: advanceAmount,
        currency: order.currency,
        status: 'PENDING'
    });

    return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID
    };
};
const verifyPaymentService = async (orderId, paymentId, signature, userId) => {
    const payment = await Payment.findOne({
        razorpayOrderId: orderId,
        userId
    });

    if (!payment) {
        throw new AppError("Payment record not found", 404);
    }
    if (payment.status !== "PENDING") {
        throw new AppError("Payment is not pending", 400);
    }
    const isValidSignature = verifyPaymentSignature(orderId,paymentId,signature);

    if (!isValidSignature) {
        throw new AppError("Invalid payment signature", 400);
    }

        const razorpayPayment = await razorpay.payments.fetch(paymentId);

    if (
        razorpayPayment.order_id !== orderId ||
        razorpayPayment.status !== "captured" ||
        razorpayPayment.amount !== Math.round(payment.amount * 100) ||
        razorpayPayment.currency !== payment.currency
    ) {
        throw new AppError("Payment verification failed", 400);
    }

    const session = await mongoose.startSession();
    let confirmedBooking;
    let verifiedPayment;

    try {
        await session.withTransaction(async () => {
        const currentPayment = await Payment.findOne({
            _id: payment._id,
            userId,
            status: "PENDING"
        }).session(session);

        if (!currentPayment) {
            throw new AppError("Payment is no longer pending", 400);
        }

        const booking = await Booking.findOne({
        _id: currentPayment.bookingId,
        userId,
        status: "PENDING"
    }).session(session);

    if (!booking) {
        throw new AppError("Pending booking not found", 404);
    }

        currentPayment.razorpayPaymentId = paymentId;
        currentPayment.razorpaySignature = signature;
        currentPayment.status = "SUCCESS";

        booking.status = "CONFIRMED";

        await currentPayment.save({ session });
        await booking.save({ session });

        verifiedPayment = currentPayment;
        confirmedBooking = booking

      });
    }finally {
    await session.endSession();
}
    return {
        booking:confirmedBooking,
        payment:verifiedPayment 
    };
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

export { createPaymentOrderService,verifyPaymentService};