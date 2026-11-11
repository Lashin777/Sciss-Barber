import express from 'express';
import { adminOnly,adminProtect } from "../middlewares/authMiddleware.js";
import {
    addBarberUnavailabilityController,
    getBarberUnavailabilityController
} from "../controllers/BarberUnavailabilityController.js";

const router = express.Router();


router.post('/api/admin/barber/unavailability',adminProtect,adminOnly,addBarberUnavailabilityController);
router.get('/api/admin/barber/unavailablity',adminProtect,adminOnly,getBarberUnavailabilityController);


export default router;