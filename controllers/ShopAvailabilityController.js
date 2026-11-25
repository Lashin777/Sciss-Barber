import {
    createShopAvailabilityService,
    getShopAvailabilityService,
    reopenShopAvailabilityService
} from "../services/ShopAvailabilityService.js";

const createShopAvailabilityController = async (req, res, next) => {
    try {
        const { date, type, startTime, endTime, reason } = req.body || {};
        const closure = await createShopAvailabilityService(date, type, startTime, endTime, reason);
        return res.status(201).json({ success: true, message: "Shop closure created", data: closure });
    } catch (error) { return next(error); }
};

const getShopAvailabilityController = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        const closures = await getShopAvailabilityService(startDate, endDate);
        return res.status(200).json({ success: true, message: "Shop closures fetched", data: closures });
    } catch (error) { return next(error); }
};

const reopenShopAvailabilityController = async (req, res, next) => {
    try {
        const closure = await reopenShopAvailabilityService(req.params.id);
        return res.status(200).json({ success: true, message: "Shop closure reopened", data: closure });
    } catch (error) { return next(error); }
};

export { createShopAvailabilityController, getShopAvailabilityController, reopenShopAvailabilityController };
