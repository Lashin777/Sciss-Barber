import { adminLoginController, adminBlockController, adminUnblockController, getAllUserController } from "../controllers/adminController.js";
import express from 'express';

const router = express.Router();


router.post('/login', adminLoginController);
router.patch('/users/:id/block', adminBlockController);
router.patch('/users/:id/unblock', adminUnblockController);
router.get('/getUser', getAllUserController)

export default router;