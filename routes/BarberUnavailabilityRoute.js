import express from 'express';
import { adminOnly,adminProtect } from "../middlewares/authMiddleware.js";
import {
    addBarberUnavailabilityController,
    getBarberUnavailabilityController
} from "../controllers/BarberUnavailabilityController.js";

const router = express.Router();


router.post('/api/admin/barber/unavailability',adminProtect,adminOnly,addBarberUnavailabilityController);
// Worked by Codex: expose the correctly spelled path used by project documentation and clients.
router.get('/api/admin/barber/unavailability',adminProtect,adminOnly,getBarberUnavailabilityController);
// Keep the historical misspelled URL available for any existing caller.
router.get('/api/admin/barber/unavailablity',adminProtect,adminOnly,getBarberUnavailabilityController);


export default router;
