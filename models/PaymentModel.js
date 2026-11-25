import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true,
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    method: {
        type: String,
        enum: ['RAZORPAY', 'WALLET'],
        default: 'RAZORPAY',
        required: true
    },
    razorpayOrderId: {
        type: String,
        required: function () {
            // Query updates do not reliably expose the persisted method/status; service transitions enforce those invariants.
            if (typeof this.getUpdate === 'function') return false;
            return this.method === 'RAZORPAY' && ['PENDING', 'SUCCESS'].includes(this.status);
        },
    },
    razorpayPaymentId: {
        type: String,
        default: null
    },
    razorpaySignature: {
        type: String,
        default: null
    },
    creationToken: {
        type: String,
        default: null
    },
    amount: {
        type: Number,
        required: true,
        min: 1
    },
    currency: {
        type: String,
        default: 'INR'
    },
    creationStartedAt: {
        type: Date,
        default: null
    },
    lastCaptureCheckAt: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ['CREATING','PENDING', 'SUCCESS', 'FAILED'],
        default: 'PENDING'
    }
}, { timestamps: true });

paymentSchema.index(
    { razorpayOrderId: 1 },
    { name: 'razorpayOrderId_string_unique_v2', unique: true, partialFilterExpression: { razorpayOrderId: { $type: 'string', $gt: '' } } }
);
paymentSchema.index({ status: 1, method: 1, lastCaptureCheckAt: 1 });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
