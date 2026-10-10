import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

const protect = async (req, res, next) => {
    const token = req.cookies.token

    if (!token) {
        return res.status(401).json({ message: "please login first" })
    }
    try {
        const decode = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decode.id).select('-password');
        if (!user) {
            return res.status(401).json({ message: "Account Not Available" })
        }
        if (user.status === 'BLOCKED') {
            return res.status(401).json({ message: "Account Not Available" })
        }
        req.user = user
    } catch (error) {
        return res.status(401).json({ message: "Expired Token" })
    }
    next()
}

const adminOnly = async (req, res, next) => {
    if (req.user.role !== "ADMIN") {
        return res.status(403).json({ message: "Admin Access Required" })
    }
    next()
}

export { protect, adminOnly };  