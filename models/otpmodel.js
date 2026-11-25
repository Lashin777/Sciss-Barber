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
        // Worked by Codex: allow the separate admin recovery flow to persist its OTP purpose.
        enum: ['EMAIL_VERIFICATION', 'PASSWORD_RESET', 'EMAIL_CHANGE', 'ADMIN_PASSWORD_RESET'],
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
    lockedUntil: {
        type: Date,
        default: null
    },
    isUsed: {
        type: Boolean,
        default: false
    },
    signupData: {
        type: {
            name: String,
            password: String,
            phone: String,
            referralCode: String,
            referrerId: mongoose.Schema.Types.ObjectId
        },
        default: undefined
    },

}, { timestamps: true })

const Otp = mongoose.model('Otp', otpSchema);

export default Otp
