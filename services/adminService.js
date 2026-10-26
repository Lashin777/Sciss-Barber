import bcrypt from 'bcrypt';
import User from '../models/userModel.js';
import jwt from 'jsonwebtoken';


const adminLogin = async (email, password) => {
    const user = await User.findOne({ email });

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
}

const blockUser = async (userId) => {
    const blockedUser = await User.findByIdAndUpdate(userId, { status: 'BLOCKED' });
    return blockedUser
}

const UnblockUser = async (userId) => {
    const unblockedUser = await User.findByIdAndUpdate(userId, { status: 'ACTIVE' });
    return unblockedUser
}

const getAllUser = async (search, page, list, date) => {
    let filter = {}

    if (search) {
        filter.name = ({ $regex: search, $options: 'i' });
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

export { adminLogin, blockUser, UnblockUser, getAllUser }
