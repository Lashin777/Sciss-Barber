import bcrypt from 'bcrypt';
import User from '../models/userModel.js';
import { generateOtp, verifyOtp } from './otpService.js';
import jwt from 'jsonwebtoken';



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


const userLogin = async (email, password) => {
    const user = await User.findOne({ email });

    if (!user) {
        throw new Error("Invalid Email Or Password");
    }
    const ismatch = await bcrypt.compare(password, user.password);
    if (!ismatch) {
        throw new Error("Invalid Email Or Password");
    }
    if (user.status === 'BLOCKED') {
        throw new Error("Your Account Is Blocked");
    }
    if (!user.isEmailVerified) {
        throw new Error("Please Verify Your Email first");
    }


    const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
    )
    return {
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email
        }
    };
}
export { UsersignUp, forgetPassword, resetPassword, userLogin }