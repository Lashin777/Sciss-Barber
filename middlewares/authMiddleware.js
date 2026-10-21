import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import { clearUserSessionCookie, clearAdminSessionCookie } from '../utils/session.js';

const protect = async (req, res, next) => {
    const token = req.cookies.token

    if (!token) {
        return res.status(401).json({ message: "please login first" })
    }
    try {
        const decode = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decode.id).select('-password');
        if (!user) {
            // Worked by Codex: remove stale customer session cookies.
            clearUserSessionCookie(res);
            return res.status(401).json({ message: "Account Not Available" })
        }
        if (user.status === 'BLOCKED') {
            clearUserSessionCookie(res);
            return res.status(401).json({ message: "Account Not Available" })
        }
        req.user = user
    } catch (error) {
        clearUserSessionCookie(res);
        return res.status(401).json({ message: "Expired Token" })
    }
    next()
}

const optionalAuth = async (req, res, next) => {
    const token = req.cookies?.token;
    req.user = null;

    if (!token) return next();

    let decode;
    try {
        decode = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        // Invalid or expired tokens are treated as signed out on public pages.
        clearUserSessionCookie(res);
        return next();
    }

    const user = await User.findById(decode.id).select('-password');
    // Worked by Codex: only customer sessions count as signed in on public pages.
    if (user && user.role === 'CUSTOMER' && user.status !== 'BLOCKED') req.user = user;
    else if (!user || user.status === 'BLOCKED') clearUserSessionCookie(res);

    next();
}

const adminOnly = async (req, res, next) => {
    if (req.user.role !== "ADMIN") {
        return res.status(403).json({ message: "Admin Access Required" })
    }
    next()
}

// Worked by Codex: validate the separate admin cookie and current account status.
const loadAdminSession = async (req, res) => {
    const token = req.cookies?.admin_token;
    if (!token) return false;

    try {
        const decode = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decode.id).select('-password');
        if (!user || user.role !== 'ADMIN' || user.status === 'BLOCKED') {
            clearAdminSessionCookie(res);
            return false;
        }
        req.user = user;
        return true;
    } catch (error) {
        clearAdminSessionCookie(res);
        return false;
    }
};

const adminProtect = async (req, res, next) => {
    if (!await loadAdminSession(req, res)) {
        return res.status(401).json({ message: 'Please sign in as an admin' });
    }
    next();
};

const adminPageProtect = async (req, res, next) => {
    if (!await loadAdminSession(req, res)) return res.redirect('/admin/login');
    next();
};

const customerOnly = (req, res, next) => {
    // Worked by Codex: prevent admin sessions from calling customer profile APIs.
    if (req.user.role !== 'CUSTOMER') {
        return res.status(403).json({ message: 'Customer Access Required' });
    }
    next();
}

export { protect, optionalAuth, customerOnly, adminOnly, adminProtect, adminPageProtect };
