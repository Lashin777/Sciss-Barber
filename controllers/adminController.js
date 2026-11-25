import User from '../models/userModel.js';
import { adminLogin, requestAdminPasswordReset, resetAdminPassword, blockUser, UnblockUser, getAllUser, getCustomerById } from '../services/adminService.js';
import { getAdminDashboardData, getAdminCalendarBookings, getAdminRevenueReport } from '../services/AdminDashboardService.js';
import { getAdminPaymentsService } from '../services/AdminPaymentService.js';
import { getAdminReferralsService } from '../services/ReferralService.js';
import { setAdminSessionCookie, clearAdminSessionCookie } from '../utils/session.js';
import Booking from '../models/bookingModel.js';
import ShopRules from '../models/ShopRules.js';

const renderAdminLoginPageController = (req, res) => res.render('admin/login', { title: 'Login' });
const renderAdminUsersPageController = (req, res) => res.render('admin/users', { title: 'Admin Customer management' });
const renderAdminDashboardController = async (req, res) => {
    try {
        const dashboard = await getAdminDashboardData();
        return res.render('admin/dashboard', { title: 'Admin Dashboard', dashboard, dashboardError: null });
    } catch (error) {
        return res.status(500).render('admin/dashboard', {
            title: 'Admin Dashboard',
            dashboard: { dailyRevenue: '—', dailyRazorpay: '—', dailyWallet: '—', totalBookings: '—', pendingBookings: '—', completedBookings: '—', cancelledBookings: '—', appointments: [] },
            dashboardError: error.message || 'Could not load dashboard data.'
        });
    }
};
const renderAdminCalendarController = (req, res) => res.render('admin/calendar', { title: 'Booking Calendar' });
const renderAdminRevenuePageController = (req, res) => res.render('admin/revenue', { title: 'Admin Revenue', user: req.user });
const renderAdminPaymentsPageController = (req, res) => res.render('admin/payments', { title: 'Admin Payments', user: req.user });
const renderAdminReferralsPageController = (req, res) => res.render('admin/referrals', { title: 'Admin Referrals', user: req.user });
const getAdminRevenueReportController = async (req, res, next) => {
    try {
        const report = await getAdminRevenueReport({
            from: req.query.from,
            to: req.query.to,
            page: req.query.page ?? 1,
            limit: req.query.limit ?? 10,
            search: req.query.search ?? '',
            method: req.query.method ?? '',
            chartView: req.query.chartView ?? 'monthly'
        });
        return res.status(200).json({ success: true, ...report });
    } catch (error) {
        return next(error);
    }
};
const getAdminPaymentsController = async (req, res, next) => {
    try {
        const report = await getAdminPaymentsService({
            from: req.query.from,
            to: req.query.to,
            page: req.query.page ?? 1,
            limit: req.query.limit ?? 10,
            search: req.query.search ?? '',
            method: req.query.method ?? '',
            status: req.query.status ?? ''
        });
        return res.status(200).json({ success: true, ...report });
    } catch (error) {
        return next(error);
    }
};
const getAdminReferralsController = async (req, res, next) => {
    try {
        const report = await getAdminReferralsService({
            page: req.query.page ?? 1,
            limit: req.query.limit ?? 10,
            search: req.query.search ?? '',
            status: req.query.status ?? ''
        });
        return res.status(200).json({ success: true, ...report });
    } catch (error) {
        return next(error);
    }
};
const getAdminCalendarController = async (req, res, next) => {
    try {
        const month = typeof req.query.month === 'string' ? req.query.month : '';
        const calendarData = await getAdminCalendarBookings(month);
        return res.status(200).json({
            success:true,
            bookings:calendarData.bookings,
            closures: calendarData.closures,
            unavailabilities: calendarData.unavailabilities,
            shopRules:calendarData.shopRules
        });
    } catch (error) {
        return next(error);
    }
};
const renderCustomerDetailsPageController = async (req, res) => {
    try {
        const customer = await getCustomerById(req.params.id);

        res.render('admin/customer-details', {
            title: 'customer-details',
            customer
        });
    } catch {
        return res.redirect('/admin/users');
    }
}
const adminLoginController = async (req, res) => {
    try {
        const result = await adminLogin(req.body.email, req.body.password);
        setAdminSessionCookie(res, result.token);
        res.status(200).json({ message: 'Admin login successful', user: result.user });
    } catch (error) {
        res.status(400).json({ message: error.message })
    }

}


const requestAdminPasswordResetController = async (req, res, next) => {
    try {
        await requestAdminPasswordReset(req.body.email);
        return res.status(200).json({
            success: true,
            message: 'If an active admin account matches that email, a reset code has been sent.'
        });
    } catch (error) {
        return next(error);
    }
};

const resetAdminPasswordController = async (req, res, next) => {
    try {
        await resetAdminPassword(req.body.email, req.body.otp, req.body.password);
        return res.status(200).json({ success: true, message: 'Admin password updated. Please sign in again.' });
    } catch (error) {
        return next(error);
    }
};

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
        // Worked by Codex: do not report success for a missing or non-customer account.
        if (!block) return res.status(404).json({ message: 'Customer account not found' });
        res.status(200).json({ message: "the User Have Been block " })
    } catch (error) {
        res.status(400).json({ message: error.message })
    }
}

const adminUnblockController = async (req, res) => {
    try {
        const Unblock = await UnblockUser(req.params.id);
        // Worked by Codex: do not report success for a missing or non-customer account.
        if (!Unblock) return res.status(404).json({ message: 'Customer account not found' });
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


const getCustomerByIdController = async (req, res) => {
    try {
        const getCustomer = await getCustomerById(req.params.id);
        res.status(200).json({ message: getCustomer })
    } catch (error) {
        res.status(400).json({
            message: error.message
        })
    }
}
export {
    renderAdminLoginPageController,
    renderAdminUsersPageController,
    adminLoginController,
    requestAdminPasswordResetController,
    resetAdminPasswordController,
    adminLogoutController,
    adminBlockController,
    adminUnblockController,
    getAllUserController,
    getCustomerByIdController,
    renderCustomerDetailsPageController,
    renderAdminDashboardController,
    renderAdminCalendarController,
    renderAdminRevenuePageController,
    renderAdminPaymentsPageController,
    renderAdminReferralsPageController,
    getAdminRevenueReportController,
    getAdminPaymentsController,
    getAdminReferralsController,
    getAdminCalendarController
}
