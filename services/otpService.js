import crypto from 'crypto';
import Otp from '../models/otpmodel.js';
import { sendEmail } from './emailService.js';
import User from '../models/userModel.js'


const generateOtp = async (email, purpose) => {
    await Otp.deleteMany({ email, purpose, isUsed: false });
    const otp = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);


    await Otp.create({ email, otp, purpose, expiresAt });
    await sendEmail({
        to: email,
        subject: 'Your Sciss Barber OTP',
        text: `Your OTP is ${otp}. It expires in 10 minutes`
    });
    return otp;
}

const consumeOtp = async (email, otp, purpose) => {
    const record = await Otp.findOne({ email, otp, purpose });

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
    await consumeOtp(email, otp, purpose);

    if (purpose === 'EMAIL_VERIFICATION') {
        await User.updateOne(
            { email },
            { isEmailVerified: true }
        );
    }


}

const resendOtp = async (email, purpose) => {
    await Otp.deleteMany({ email, purpose, isUsed: false });
    return await generateOtp(email, purpose);
}

export { generateOtp, verifyOtp, resendOtp, consumeOtp };
