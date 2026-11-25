import express from "express";
import { adminProtect, adminOnly } from "../middlewares/authMiddleware.js";
import {
    createShopAvailabilityController,
    getShopAvailabilityController,
    reopenShopAvailabilityController
} from "../controllers/ShopAvailabilityController.js";

const router = express.Router();

router.post("/api/admin/shop-availability", adminProtect, adminOnly, createShopAvailabilityController);
router.get("/api/admin/shop-availability", adminProtect, adminOnly, getShopAvailabilityController);
router.patch("/api/admin/shop-availability/:id/reopen", adminProtect, adminOnly, reopenShopAvailabilityController);

export default router;
