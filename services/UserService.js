import { hashPassword, comparePassword } from '../utils/passwordUtils.js';
import User from '../models/userModel.js';
import { generateOtp, verifyOtp, resendOtp, consumeOtp } from './otpService.js';
import jwt from 'jsonwebtoken';



const UsersignUp = async (email, name, password, phone) => {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new Error("User Already Exists");
    } else {
        const hashedPassword = await hashPassword(password);
        const newUser = await User.create({ name, email, password: hashedPassword, phone });
        await generateOtp(email, 'EMAIL_VERIFICATION')
        return newUser;
    }

}

const getPasswordLoginAccount = async (email) => {
    const user = await User.findOne({ email });
    if (!user || user.role !== 'CUSTOMER') {
        throw new Error('No Account With This EMAIL');
    }
    // Worked by Codex: Google-linked accounts manage credentials through Google.
    if (user.googleId) {
        throw new Error('This account uses Google sign-in. Manage your password through Google.');
    }
    return user;
}

const forgetPassword = async (email) => {
    await getPasswordLoginAccount(email);
    await generateOtp(email, 'PASSWORD_RESET')
}

const resetPassword = async (email, otp, newpassword) => {
    await getPasswordLoginAccount(email);
    await verifyOtp(email, otp, 'PASSWORD_RESET');
    const hashedPassword = await hashPassword(newpassword);

    await User.updateOne({ email }, { password: hashedPassword })
}


const userLogin = async (email, password) => {
    const user = await User.findOne({ email });

    // Worked by Codex: keep admin accounts out of customer login.
    if (!user || user.role !== 'CUSTOMER') {
        throw new Error("Invalid Email Or Password");
    }
    const ismatch = await comparePassword(password, user.password);
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


const UpdateUserProfile = async (userId, updates) => {
    const fields = {};
    if (typeof updates.name === 'string') fields.name = updates.name.trim();
    if (typeof updates.phone === 'string') fields.phone = updates.phone.trim();
    if (typeof updates.profileImage === 'string') fields.profileImage = updates.profileImage.trim();

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: fields },
        { new: true, runValidators: true, select: '-password' }
    );

    if (!updatedUser) throw new Error('User not found');
    return updatedUser;
}

// Worked by Codex: change the account email only after its new address proves ownership.
const sendEmailChangeOtp = async (userId, newEmail) => {
    const normalizedEmail = typeof newEmail === 'string' ? newEmail.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        throw new Error('Enter a valid email address');
    }

    const user = await User.findById(userId);
    if (!user || user.role !== 'CUSTOMER') throw new Error('Customer account not found');
    if (user.email.toLowerCase() === normalizedEmail) throw new Error('This is already your current email');

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) throw new Error('An account already uses this email address');

    await resendOtp(normalizedEmail, 'EMAIL_CHANGE');
};

const verifyEmailChangeOtp = async (userId, newEmail, otp) => {
    const normalizedEmail = typeof newEmail === 'string' ? newEmail.trim().toLowerCase() : '';
    if (!/^\d{6}$/.test(String(otp || ''))) throw new Error('Enter the six-digit code');

    const user = await User.findById(userId);
    if (!user || user.role !== 'CUSTOMER') throw new Error('Customer account not found');
    if (user.email.toLowerCase() === normalizedEmail) throw new Error('This is already your current email');

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) throw new Error('An account already uses this email address');

    await consumeOtp(normalizedEmail, String(otp), 'EMAIL_CHANGE');

    try {
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: { email: normalizedEmail, isEmailVerified: true } },
            { new: true, runValidators: true, select: '-password' }
        );
        if (!updatedUser) throw new Error('Customer account not found');
        return updatedUser;
    } catch (error) {
        if (error.code === 11000) throw new Error('An account already uses this email address');
        throw error;
    }
};

export {
    UsersignUp,
    forgetPassword,
    resetPassword,
    userLogin,
    UpdateUserProfile,
    sendEmailChangeOtp,
    verifyEmailChangeOtp
}
