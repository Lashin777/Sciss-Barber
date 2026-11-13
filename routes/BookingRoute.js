import express from 'express'
import { getAvailableSlotsController,
        createBookingController,
        getMyBookingsController,
        getBookingDetailsController
} from "../controllers/BookingController.js";
import { protect,customerOnly } from '../middlewares/authMiddleware.js';


const router = express.Router();

router.get('/api/bookings/available-slots',protect,customerOnly,getAvailableSlotsController);
router.post('/api/bookings', protect, customerOnly, createBookingController);
router.get('/api/bookings/my-bookings', protect, customerOnly, getMyBookingsController);
router.get('/api/bookings/:bookingId',protect,customerOnly,getBookingDetailsController);




export default router;
