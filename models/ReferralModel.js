import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema({
    referrerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    referredUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    referralCode: {
        type: String,
        required: true,
        trim: true,
        uppercase: true
    },
    rewardStatus: {
        type: String,
        enum: ['PENDING_POLICY', 'REWARDED'],
        default: 'PENDING_POLICY',
        required: true
    },
    rewardAmount: {
        type: Number,
        min: 0,
        default: null
    },
    walletTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WalletTransaction',
        unique: true,
        sparse: true
    }
}, { timestamps: true });

referralSchema.index({ createdAt: -1 });

const Referral = mongoose.model('Referral', referralSchema);

export default Referral;
