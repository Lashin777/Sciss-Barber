import bcrypt from 'bcrypt';
import User from '../models/userModel.js';
import jwt from 'jsonwebtoken';
import { hashPassword } from '../utils/passwordUtils.js';
import { generateOtp, consumeOtp } from './otpService.js';
import AppError from '../utils/AppError.js';


const adminLogin = async (email, password) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || user.role !== "ADMIN") {
        throw new Error("Invalid admin credentials")
    }

    if (user.status === 'BLOCKED') {
        throw new Error('Your admin account is blocked');
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        throw new Error("Invalid admin credentials");
    }

    const token = jwt.sign(
        { id: user._id, role: user.role, tokenVersion: user.tokenVersion },
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
};

// Worked by Codex: keep admin password recovery separate from customer recovery.
const requestAdminPasswordReset = async (email, otpSender = generateOtp) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const admin = await User.findOne({ email: normalizedEmail, role: 'ADMIN', status: 'ACTIVE' }).select('_id');
    if (admin) await otpSender(normalizedEmail, 'ADMIN_PASSWORD_RESET');
};

const resetAdminPassword = async (email, otp, newPassword, otpConsumer = consumeOtp) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const admin = await User.findOne({ email: normalizedEmail, role: 'ADMIN', status: 'ACTIVE' });
    if (!admin) throw new AppError('Invalid or expired verification code', 400);

    try {
        await otpConsumer(normalizedEmail, otp, 'ADMIN_PASSWORD_RESET');
    } catch (error) {
        if (/invalid OTP|expired|already used/i.test(error.message || '')) {
            throw new AppError('Invalid or expired verification code', 400);
        }
        throw error;
    }
    const password = await hashPassword(newPassword);
    const result = await User.updateOne(
        { _id: admin._id, role: 'ADMIN', status: 'ACTIVE' },
        { $set: { password }, $inc: { tokenVersion: 1 } }
    );
    if (!result.matchedCount) throw new AppError('Admin account is no longer active', 400);
};
const blockUser = async (userId) => {
    // Worked by Codex: customer management must never block an administrator account.
    const blockedUser = await User.findOneAndUpdate({ _id: userId, role: 'CUSTOMER' }, { status: 'BLOCKED' });
    return blockedUser
}

const UnblockUser = async (userId) => {
    // Worked by Codex: customer management must never change an administrator account.
    const unblockedUser = await User.findOneAndUpdate({ _id: userId, role: 'CUSTOMER' }, { status: 'ACTIVE' });
    return unblockedUser
}

const getAllUser = async (search, page, list, date) => {
    // Worked by Codex: keep the customer directory scoped to customer accounts.
    let filter = { role: 'CUSTOMER' }

    if (search) {
        const escapedSearch = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.name = { $regex: escapedSearch, $options: 'i' };
    }
    if (date) {
        const startDate = new Date(`${date}T00:00:00.000Z`);
        const endDate = new Date(startDate);
        endDate.setUTCDate(endDate.getUTCDate() + 1);
        filter.createdAt = {
            $gte: startDate,
            $lt: endDate
        }

    }
    const currentPage = page || 1;
    const perPage = list || 10;

    const users = await User.find(filter).select('-password').sort({ createdAt: -1 }).skip((currentPage - 1) * perPage).limit(perPage);
    return users
}

const getCustomerById = async (userId) => {
    const result = await User.findOne({ _id: userId, role: 'CUSTOMER' }).select('-password');

    if (!result) {
        throw new Error("Customer Id not found")
    }

    return result

}

export { adminLogin, requestAdminPasswordReset, resetAdminPassword, blockUser, UnblockUser, getAllUser, getCustomerById }
