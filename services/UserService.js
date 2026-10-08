import bcrypt from 'bcrypt';
import User from '../models/userModel.js';
import { generateOtp, verifyOtp } from './otpService.js';



const UsersignUp = async (email, name, password) => {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new Error("User Already Exists");
    } else {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ name, email, password: hashedPassword });
        await generateOtp(email, 'EMAIL_VERIFICATION')
        return newUser;
    }

}

const forgetPassword = async (email) => {
    const userforget = await User.findOne({ email })
    if (!userforget) {
        throw new Error("No Account With This EMAIL")
    }
    await generateOtp(email, 'PASSWORD_RESET')
}

const resetPassword = async (email, otp, newpassword) => {
    await verifyOtp(email, otp, 'PASSWORD_RESET');
    const hashedPassword = await bcrypt.hash(newpassword, 10);

    await User.updateOne({ email }, { password: hashedPassword })
}
export { UsersignUp, forgetPassword, resetPassword }