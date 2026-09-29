import mongoose from "mongoose";


const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true
    },
    otp: {
        type: String,
        required: true
    },
    purpose: {
        type: String,
        enum: ['EMAIL_VERIFICATION', 'PASSWORD_RESET', 'EMAIL_CHANGE'],
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,

    },
    attempts: {
        type: Number,
        default: 0
    },
    isUsed: {
        type: Boolean,
        default: false
    },

}, { timestamps: true })

const Otp = mongoose.model('Otp', otpSchema);

export default Otp