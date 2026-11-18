import express from "express";
import { renderAdminBookingsPageController,
        updateBookingStatusController,
        getAdminBookingDetailsController,
        renderAdminBookingDetailsPageController,
        cancelAdminBookingController,
        createWalkInBookingController}
from "../controllers/AdminBookingController.js";
import { adminProtect, adminOnly, adminPageProtect, preventCache } from "../middlewares/authMiddleware.js";


const router = express.Router();

router.get('/admin/booking', adminPageProtect, preventCache, renderAdminBookingsPageController);
router.patch("/api/admin/bookings/:bookingId/status",adminProtect,adminOnly,updateBookingStatusController);
router.patch("/api/admin/bookings/:bookingId/cancel",adminProtect,adminOnly,cancelAdminBookingController);
router.get("/api/admin/bookings/:bookingId",adminProtect,adminOnly,getAdminBookingDetailsController);
router.post("/api/admin/bookings/walk-in",adminProtect,adminOnly,createWalkInBookingController);


router.get("/admin/booking/:bookingId",adminPageProtect,preventCache,renderAdminBookingDetailsPageController);

export default router;
