import mongoose from "mongoose";


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

    addresses: [
        {
            label: {
                type: String,
                enum: ['Home', 'Work', 'Other'],
                default: 'Home'
            },
            fullName: {
                type: String,
                required: true,
                trim: true
            },
            phone: {
                type: String,
                required: true,
                trim: true
            },
            addressLine: {
                type: String,
                required: true,
                trim: true
            },
            city: {
                type: String,
                required: true,
                trim: true
            },
            state: {
                type: String,
                required: true,
                trim: true
            },
            postalCode: {
                type: String,
                required: true,
                trim: true
            },
            isDefault: {
                type: Boolean,
                default: false
            }
        }
    ],
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
    }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

export default User;