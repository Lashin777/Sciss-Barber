import { adminLoginController, adminBlockController, adminUnblockController, getAllUserController } from "../controllers/adminController.js";
import express from 'express';
import { protect, adminOnly } from '../middlewares/authMiddleware.js';

const router = express.Router();


router.post('/login', adminLoginController);
router.patch('/users/:id/block', protect, adminOnly, adminBlockController);
router.patch('/users/:id/unblock', protect, adminOnly, adminUnblockController);
router.get('/getUser', protect, adminOnly, getAllUserController)

export default router;