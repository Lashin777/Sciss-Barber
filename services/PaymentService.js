import razorpay from "../config/razorpay.js";
import Service from "../models/Service.js";
import ShopRules from "../models/ShopRules.js";
import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";

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

export { createPaymentOrderService };