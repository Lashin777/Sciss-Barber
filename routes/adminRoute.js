import {
    adminLoginController,
    requestAdminPasswordResetController,
    resetAdminPasswordController,
    adminBlockController,
    adminUnblockController,
    getAllUserController,
    adminLogoutController,
    renderAdminLoginPageController,
    renderAdminUsersPageController,
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
} from "../controllers/adminController.js";
import express from 'express';
import { adminProtect, adminPageProtect, adminOnly, preventCache } from '../middlewares/authMiddleware.js';
import { validationLogin, validationResetPassword, validationForgotPassword, validationAdminUserQuery, validationMongoId } from "../middlewares/validation.js";

const router = express.Router();


router.post('/api/admin/login', validationLogin,adminLoginController);
router.post('/api/admin/forget-password', validationForgotPassword, requestAdminPasswordResetController);
router.patch('/api/admin/reset-password', validationResetPassword, resetAdminPasswordController);
router.post('/api/admin/logout', adminProtect, adminLogoutController);
router.patch('/api/admin/users/:id/block', adminProtect, adminOnly,validationMongoId,adminBlockController);
router.patch('/api/admin/users/:id/unblock', adminProtect, adminOnly,validationMongoId, adminUnblockController);
router.get('/api/admin/getUser', adminProtect, adminOnly,validationAdminUserQuery, getAllUserController)
router.get('/api/admin/users/:id', adminProtect, adminOnly,validationMongoId, getCustomerByIdController)
router.get('/admin/login', renderAdminLoginPageController);
router.get('/admin/users', adminPageProtect, preventCache, renderAdminUsersPageController);
router.get('/admin/users/:id', adminPageProtect, preventCache, renderCustomerDetailsPageController);
// Worked by Codex: protected HTML pages redirect expired admin sessions to the login screen.
router.get('/admin/dashboard', adminPageProtect, preventCache, renderAdminDashboardController)
router.get('/admin/calendar', adminPageProtect, preventCache, renderAdminCalendarController);
router.get('/admin/revenue', adminPageProtect, preventCache, renderAdminRevenuePageController);
router.get('/admin/payments', adminPageProtect, preventCache, renderAdminPaymentsPageController);
router.get('/admin/referrals', adminPageProtect, preventCache, renderAdminReferralsPageController);
router.get('/api/admin/calendar', adminProtect, adminOnly, getAdminCalendarController);
router.get('/api/admin/revenue', adminProtect, adminOnly, getAdminRevenueReportController);
router.get('/api/admin/payments', adminProtect, adminOnly, preventCache, getAdminPaymentsController);
router.get('/api/admin/referrals', adminProtect, adminOnly, preventCache, getAdminReferralsController);
export default router;
