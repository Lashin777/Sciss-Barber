import express from 'express'
import { getAvailableSlotsController } from "../controllers/BookingController.js";


const router = express.Router();

router.post('/api/bookings/available-slots',getAvailableSlotsController);

export default router;
