import {
    adminLoginController,
    adminBlockController,
    adminUnblockController,
    getAllUserController,
    adminLogoutController,
    renderAdminLoginPageController,
    renderAdminUsersPageController,
    getCustomerByIdController,
    renderCustomerDetailsPageController
} from "../controllers/adminController.js";
import express from 'express';
import { adminProtect, adminPageProtect, adminOnly, preventCache } from '../middlewares/authMiddleware.js';

const router = express.Router();


router.post('/api/admin/login', adminLoginController);
router.post('/api/admin/logout', adminProtect, adminLogoutController);
router.patch('/api/admin/users/:id/block', adminProtect, adminOnly, adminBlockController);
router.patch('/api/admin/users/:id/unblock', adminProtect, adminOnly, adminUnblockController);
router.get('/api/admin/getUser', adminProtect, adminOnly, getAllUserController)
router.get('/api/admin/users/:id', adminProtect, adminOnly, getCustomerByIdController)
router.get('/admin/login', renderAdminLoginPageController);
router.get('/admin/users', adminPageProtect, preventCache, renderAdminUsersPageController);
router.get('/admin/users/:id', adminPageProtect, preventCache, renderCustomerDetailsPageController)

export default router;
