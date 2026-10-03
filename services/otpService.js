import crypto from 'crypto';
import Otp from '../models/otpmodel.js';
import nodemailer from 'nodemailer';

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

export default generateOtp;
