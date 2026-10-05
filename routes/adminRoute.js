import { adminLoginController } from "../controllers/adminController.js";
import express from 'express';

const router = express.Router();


router.post('/login', adminLoginController);

export default router;