import User from '../models/userModel.js';
import { adminLogin, blockUser, UnblockUser, getAllUser } from '../services/adminService.js';
import { setAdminSessionCookie, clearAdminSessionCookie } from '../utils/session.js';

// Worked by Codex: keep admin page response logic in the admin controller.
const renderAdminLoginPageController = (req, res) => res.render('admin/login', { title: 'Login' });
const renderAdminUsersPageController = (req, res) => res.render('admin/users', { title: 'Admin dashboard' });

const adminLoginController = async (req, res) => {
    try {
        const result = await adminLogin(req.body.email, req.body.password);
        setAdminSessionCookie(res, result.token);
        res.status(200).json({ message: 'Admin login successful', user: result.user });
    } catch (error) {
        res.status(400).json({ message: error.message })
    }

}

const adminLogoutController = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, {
            $inc: { tokenVersion: 1 }
        });

        clearAdminSessionCookie(res);
        res.redirect('/admin/login');

    } catch (error) {
        res.status(500).json({
            message: "Logout Failed"
        })
    }
};
const adminBlockController = async (req, res) => {
    try {
        const block = await blockUser(req.params.id);
        res.status(200).json({ message: "the User Have Been block " })
    } catch (error) {
        res.status(400).json({ message: error.message })
    }
}

const adminUnblockController = async (req, res) => {
    try {
        const Unblock = await UnblockUser(req.params.id);
        res.status(200).json({ message: "the User Have Been Unblock " })
    } catch (error) {
        res.status(400).json({ message: error.message })
    }
}

const getAllUserController = async (req, res) => {
    try {
        const getUser = await getAllUser(req.query.search, req.query.page, req.query.list, req.query.date);
        res.status(200).json({ message: getUser });
    } catch (error) {
        res.status(400).json({ message: error.message })
    }
}

export {
    renderAdminLoginPageController,
    renderAdminUsersPageController,
    adminLoginController,
    adminLogoutController,
    adminBlockController,
    adminUnblockController,
    getAllUserController
}
