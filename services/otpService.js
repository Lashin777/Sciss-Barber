import crypto from 'crypto';
import Otp from '../models/otpmodel.js';
import { sendEmail } from './emailService.js';
import User from '../models/userModel.js';
import Referral from '../models/ReferralModel.js';
import mongoose from 'mongoose';



const MAX_OTP_ATTEMPTS = 5;
const OTP_LOCK_DURATION_MS = 5 * 60 * 1000;

const generateOtp = async (email, purpose, signupData = null) => {
    const normalizedEmail = String(email).trim().toLowerCase();

    const otp = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const newOtp = await Otp.create({
        email: normalizedEmail,
        otp,
        purpose,
        expiresAt,
        ...(purpose === 'EMAIL_VERIFICATION' && signupData
            ? { signupData }
            : {})
    });

    try {
        await sendEmail({
            to: normalizedEmail,
            subject: 'Your Sciss Barber OTP',
            text: `Your OTP is ${otp}. It expires in 10 minutes`
        });
    } catch (error) {
        await Otp.deleteOne({ _id: newOtp._id });
        throw error;
    }

    await Otp.deleteMany({
        email: normalizedEmail,
        purpose,
        isUsed: false,
        _id: { $ne: newOtp._id }
    });

    return otp;
};

const consumeOtp = async (email, otp, purpose) => {
    const record = await Otp.findOne({ email, otp, purpose, isUsed:false });

    if (!record) {
        throw new Error("invalid OTP");
    }
    if (record.expiresAt < Date.now()) {
        throw new Error("OTP had expired")
    }
    if (record.isUsed) {
        throw Error('OTP already Used')
    }

    const consumedRecord = await Otp.findOneAndUpdate(
        { _id: record._id, isUsed: false, expiresAt: { $gt: new Date() } },
        { $set: { isUsed: true } },
        { returnDocument: 'after' }
    );
    if (!consumedRecord) throw new Error('OTP already Used');

    return consumedRecord;
}


const verifyOtp = async (email, otp, purpose) => {
    const normalizedEmail = String(email).trim().toLowerCase();

    if (purpose !== 'EMAIL_VERIFICATION') {
        await consumeOtp(normalizedEmail, otp, purpose);
        return;
    }

    const now = new Date();

    let activeOtp = await Otp.findOne({
        email: normalizedEmail,
        purpose: 'EMAIL_VERIFICATION',
        isUsed: false,
        expiresAt: { $gt: now }
    }).sort({ createdAt: -1 });

    if (!activeOtp) {
        throw new Error('Invalid or expired OTP. Please sign up again.');
    }

    // Reject attempts while the cooldown is active.
    if (activeOtp.lockedUntil && activeOtp.lockedUntil > now) {
        throw new Error('Too many incorrect attempts. Please try again after 5 minutes.');
    }

    // Reset attempts after the cooldown expires.
    if (activeOtp.lockedUntil && activeOtp.lockedUntil <= now) {
        const refreshedOtp = await Otp.findOneAndUpdate(
            {
                _id: activeOtp._id,
                isUsed: false,
                expiresAt: { $gt: now },
                lockedUntil: { $lte: now }
            },
            {
                $set: {
                    attempts: 0,
                    lockedUntil: null
                }
            },
            { new: true }
        );

    if (!refreshedOtp) {
            throw new Error('OTP expired. Please sign up again.');
        }

        activeOtp = refreshedOtp;
    }

    // Incorrect OTP: increment attempts atomically.
    if (activeOtp.otp !== String(otp)) {
        const lockUntil = new Date(Date.now() + OTP_LOCK_DURATION_MS);

        const updatedOtp = await Otp.findOneAndUpdate(
            {
                _id: activeOtp._id,
                isUsed: false,
                expiresAt: { $gt: new Date() },
                attempts: { $lt: MAX_OTP_ATTEMPTS },
                $or: [
                    { lockedUntil: null },
                    { lockedUntil: { $lte: new Date() } }
                ]
            },
            [
                {
                    $set: {
                        attempts: {
                            $add: [{ $ifNull: ['$attempts', 0] }, 1]
                        },
                        lockedUntil: {
                            $cond: [
                                {
                                    $gte: [
                                        { $add: [{ $ifNull: ['$attempts', 0] }, 1] },
                                        MAX_OTP_ATTEMPTS
                                    ]
                                },
                                lockUntil,
                                '$lockedUntil'
                            ]
                        }
                    }
                }
            ],
            { new: true ,updatePipeline:true}
        );

        if (!updatedOtp) {
    const latestOtp = await Otp.findById(activeOtp._id);

    if (!latestOtp || latestOtp.isUsed || latestOtp.expiresAt <= new Date()) {
        throw new Error('OTP expired. Please sign up again.');
    }

    if (latestOtp.lockedUntil && latestOtp.lockedUntil > new Date()) {
        throw new Error('Too many incorrect attempts. Please try again after 5 minutes.');
    }

    throw new Error('OTP verification state changed. Please try again.');
}

if (updatedOtp.attempts >= MAX_OTP_ATTEMPTS) {
    throw new Error('Too many incorrect attempts. Please try again after 5 minutes.');
}

throw new Error('Invalid OTP');
    }

    // Correct OTP: consume it and create the account in one transaction.
    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const record = await Otp.findOneAndUpdate(
                {
                    _id: activeOtp._id,
                    email: normalizedEmail,
                    otp: String(otp),
                    purpose: 'EMAIL_VERIFICATION',
                    isUsed: false,
                    expiresAt: { $gt: new Date() },
                    attempts: { $lt: MAX_OTP_ATTEMPTS },
                    lockedUntil: null
                },
                { $set: { isUsed: true } },
                { new: true, session }
            );

            if (!record) {
                throw new Error('OTP is invalid, expired, or temporarily locked.');
            }

            if (
                !record.signupData?.name ||
                !record.signupData?.password ||
                !record.signupData?.phone
            ) {
                throw new Error('Signup information missing. Please register again.');
            }

            const existingUser = await User.findOne({
                email: normalizedEmail
            }).session(session);

            if (existingUser) {
                throw new Error('User Already Exists');
            }

            const referralCode = String(record.signupData.referralCode || '').trim().toUpperCase();
            const hasReferrerId = Boolean(record.signupData.referrerId);
            if (Boolean(referralCode) !== hasReferrerId) {
                throw new Error('Signup referral information is incomplete. Please register again.');
            }

            let referrer = null;
            if (referralCode) {
                referrer = await User.findOne({
                    _id: record.signupData.referrerId,
                    role: 'CUSTOMER',
                    status: 'ACTIVE',
                    isEmailVerified: true
                }).select('_id email phone referralCode').session(session);
                if (!referrer) throw new Error('Referral code is no longer available. Please register again.');
                if (String(referrer.referralCode || '').trim().toUpperCase() !== referralCode) throw new Error('Referral code is no longer available. Please register again.');
                if (
                    referrer.email.toLowerCase() === normalizedEmail ||
                    (referrer.phone && referrer.phone.trim() === record.signupData.phone.trim())
                ) {
                    throw new Error('You cannot use your own referral code');
                }
            }

            const [createdUser] = await User.create([{
                name: record.signupData.name,
                email: normalizedEmail,
                password: record.signupData.password,
                phone: record.signupData.phone,
                ...(referrer ? { referredBy: referrer._id } : {}),
                isEmailVerified: true
            }], { session });

            if (referrer) {
                await Referral.create([{
                    referrerId: referrer._id,
                    referredUserId: createdUser._id,
                    referralCode,
                    rewardStatus: 'PENDING_POLICY'
                }], { session });
            }

            await Otp.deleteMany({
                email: normalizedEmail,
                purpose: 'EMAIL_VERIFICATION'
            }).session(session);
        });
    } finally {
        await session.endSession();
    }
};

const resendOtp = async (email, purpose) => {
    const normalizedEmail = String(email).trim().toLowerCase();
    let signupData = null;

    if (purpose === 'EMAIL_VERIFICATION') {
        const pendingOtp = await Otp.findOne({
            email: normalizedEmail,
            purpose,
            isUsed: false
        }).sort({ createdAt: -1 });

        if (!pendingOtp?.signupData) {
            throw new Error('Signup session expired. Please register again.');
        }

        signupData = pendingOtp.signupData;
    }

    return generateOtp(normalizedEmail, purpose, signupData);
};

export { generateOtp, verifyOtp, resendOtp, consumeOtp };
