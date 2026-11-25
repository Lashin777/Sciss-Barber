import express from "express";
import { renderAdminBookingsPageController,
        updateBookingStatusController,
        getAdminBookingDetailsController,
        renderAdminBookingDetailsPageController,
        cancelAdminBookingController,
        rescheduleAdminBookingController,
        createWalkInBookingController}
from "../controllers/AdminBookingController.js";
import { adminProtect, adminOnly, adminPageProtect, preventCache } from "../middlewares/authMiddleware.js";
// Worked by Codex: reject malformed booking IDs before admin service/database work.
import { validationBookingId } from "../middlewares/validation.js";


const router = express.Router();

router.get('/admin/booking', adminPageProtect, preventCache, renderAdminBookingsPageController);
router.patch("/api/admin/bookings/:bookingId/status",adminProtect,adminOnly,validationBookingId,updateBookingStatusController);
router.patch("/api/admin/bookings/:bookingId/cancel",adminProtect,adminOnly,validationBookingId,cancelAdminBookingController);
router.patch("/api/admin/bookings/:bookingId/reschedule",adminProtect,adminOnly,validationBookingId,rescheduleAdminBookingController);
router.get("/api/admin/bookings/:bookingId",adminProtect,adminOnly,validationBookingId,getAdminBookingDetailsController);
router.post("/api/admin/bookings/walk-in",adminProtect,adminOnly,createWalkInBookingController);


router.get("/admin/booking/:bookingId",adminPageProtect,preventCache,renderAdminBookingDetailsPageController);

export default router;
