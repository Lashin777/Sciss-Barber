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

    await User.updateOne(
        { email },
        {
            $set: { password: hashedPassword },
            $inc: { tokenVersion: 1 }
        }
    );
}


const userLogin = async (email, password) => {
    const user = await User.findOne({ email });


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
        {
            id: user._id,
            role: user.role,
            tokenVersion: user.tokenVersion

        },
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
    if (typeof updates.name === 'string') {
        fields.name = updates.name.trim();
    }

    if (typeof updates.phone === 'string') {
        fields.phone = updates.phone.trim();
    }

    if (typeof updates.profileImage === 'string') {
        fields.profileImage = updates.profileImage.trim();
    }

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: fields },
        { returnDocument: 'after', runValidators: true, select: '-password' }
    );

    if (!updatedUser) throw new Error('User not found');
    return updatedUser;
}

const changeUserPassword = async (userId, currentPassword, newPassword) => {
    const user = await User.findById(userId);
    if (!user || user.role !== 'CUSTOMER') throw new Error('Customer account not found');
    if (user.googleId || !user.password) {
        throw new Error('This account uses Google sign-in and does not have a password to change');
    }

    const currentPasswordMatches = await comparePassword(currentPassword, user.password);
    if (!currentPasswordMatches) throw new Error('Current password is incorrect');
    if (newPassword.length < 8) throw new Error('New password must be at least 8 characters');

    const newPasswordMatches = await comparePassword(newPassword, user.password);
    if (newPasswordMatches) throw new Error('Choose a new password different from your current password');

    const hashedPassword = await hashPassword(newPassword);
    await User.updateOne(
        { _id: userId },
        {
            $set: { password: hashedPassword },
            $inc: { tokenVersion: 1 }
        }
    );
};


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


// Worked by Codex: saved address management and its API service have been removed.

export {
    UsersignUp,
    forgetPassword,
    resetPassword,
    userLogin,
    UpdateUserProfile,
    changeUserPassword,
    sendEmailChangeOtp,
    verifyEmailChangeOtp
}
