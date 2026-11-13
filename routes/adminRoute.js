import {
    adminLoginController,
    adminBlockController,
    adminUnblockController,
    getAllUserController,
    adminLogoutController,
    renderAdminLoginPageController,
    renderAdminUsersPageController,
    getCustomerByIdController,
    renderCustomerDetailsPageController,
    renderAdminDashboardController
} from "../controllers/adminController.js";
import express from 'express';
import { adminProtect, adminPageProtect, adminOnly, preventCache } from '../middlewares/authMiddleware.js';
import { validationLogin,validationAdminUserQuery,validationMongoId } from "../middlewares/validation.js";

const router = express.Router();


router.post('/api/admin/login', validationLogin,adminLoginController);
router.post('/api/admin/logout', adminProtect, adminLogoutController);
router.patch('/api/admin/users/:id/block', adminProtect, adminOnly,validationMongoId,adminBlockController);
router.patch('/api/admin/users/:id/unblock', adminProtect, adminOnly,validationMongoId, adminUnblockController);
router.get('/api/admin/getUser', adminProtect, adminOnly,validationAdminUserQuery, getAllUserController)
router.get('/api/admin/users/:id', adminProtect, adminOnly,validationMongoId, getCustomerByIdController)
router.get('/admin/login', renderAdminLoginPageController);
router.get('/admin/users', adminPageProtect, preventCache, renderAdminUsersPageController);
router.get('/admin/users/:id', adminPageProtect, preventCache, renderCustomerDetailsPageController);
router.get('/admin/dashboard', adminProtect, adminOnly, preventCache, renderAdminDashboardController)
export default router;
