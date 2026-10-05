import crypto from 'crypto';
import Otp from '../models/otpmodel.js';
import nodemailer from 'nodemailer';
import User from '../models/userModel.js'

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const generateOtp = async (email, purpose) => {
    const otp = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);


    await Otp.create({ email, otp, purpose, expiresAt });
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'your Sciss baber OTP',
        text: `Your OTP is ${otp}. it expires in 10 minutes`

    });

    return otp;
}

const verifyOtp = async (email, otp, purpose) => {
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

    record.isUsed = true;
    await record.save();

    await User.updateOne({ email }, { isEmailVerified: true });

}

export { generateOtp, verifyOtp };
