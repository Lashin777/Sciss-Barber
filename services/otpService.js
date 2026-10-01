import crypto from 'crypto';
import Otp from '../models/otpmodel.js';


const generateOtp = async (email, purpose) => {
    const otp = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await Otp.create({ email, otp, purpose, expiresAt });

    return otp;
}

export default generateOtp;
