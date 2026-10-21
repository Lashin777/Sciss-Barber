import {
    adminLoginController,
    adminBlockController,
    adminUnblockController,
    getAllUserController,
    adminLogoutController,
    renderAdminLoginPageController,
    renderAdminUsersPageController
} from "../controllers/adminController.js";
import express from 'express';
import { adminProtect, adminPageProtect, adminOnly } from '../middlewares/authMiddleware.js';

const router = express.Router();


router.post('/api/admin/login', adminLoginController);
router.post('/api/admin/logout', adminLogoutController);
router.patch('/api/admin/users/:id/block', adminProtect, adminOnly, adminBlockController);
router.patch('/api/admin/users/:id/unblock', adminProtect, adminOnly, adminUnblockController);
router.get('/api/admin/getUser', adminProtect, adminOnly, getAllUserController)

// Worked by Codex: keep admin pages alongside admin API routes.
router.get('/admin/login', renderAdminLoginPageController);
router.get('/admin/users', adminPageProtect, renderAdminUsersPageController);

export default router;
