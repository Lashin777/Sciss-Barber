import express from 'express'
import { getAvailableSlotsController,
        createBookingController,
        getMyBookingsController,
        getBookingDetailsController,
        renderBookingInvoiceController,
        getBookingHistoryController,
        cancelBookingController
} from "../controllers/BookingController.js";
import { protect,customerOnly } from '../middlewares/authMiddleware.js';
// Worked by Codex: validate path IDs consistently for protected customer booking actions.
import { validationBookingId } from '../middlewares/validation.js';


const router = express.Router();

router.get('/api/bookings/available-slots',protect,customerOnly,getAvailableSlotsController);
router.post('/api/bookings', protect, customerOnly, createBookingController);
router.get('/api/bookings/my-bookings', protect, customerOnly, getMyBookingsController);
router.get('/api/bookings/history',protect,customerOnly,getBookingHistoryController);
router.get('/bookings/:bookingId/invoice',protect,customerOnly,renderBookingInvoiceController);
router.get('/api/bookings/:bookingId',protect,customerOnly,validationBookingId,getBookingDetailsController);
router.patch('/api/bookings/:bookingId/cancel',protect,customerOnly,validationBookingId,cancelBookingController);




export default router;
