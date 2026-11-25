import mongoose from "mongoose";
import { generateReferralCode } from '../utils/referralCode.js';


const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
        required: false
    },
    role: {
        type: String,
        enum: ['CUSTOMER', 'ADMIN'],
        default: 'CUSTOMER'
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'BLOCKED'],
        default: 'ACTIVE'
    },
    tokenVersion: {
        type: Number,
        default: 0
    },
    phone: {
        type: String,
        trim: true
    },
    // Worked by Codex: customer addresses are no longer part of the profile model.
    profileImage: {
        type: String,
        default: ''
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    facebookId: {
        type: String,
        unique: true,
        sparse: true
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    referralCode: {
        type: String,
        trim: true,
        uppercase: true,
        unique: true,
        sparse: true,
        default: generateReferralCode
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

export default User;
