import { getCustomerAvailableSlotsService } from "../services/BookingService.js";

const getAvailableSlotsController = async (req, res) => {
    try {
        const { serviceId, date } = req.query;

        if (!serviceId || !date) {
            return res.status(400).json({
                success: false,
                message: "service id and date are required"
            });
        }

        const customerSlots = await getCustomerAvailableSlotsService(serviceId, date);

        return res.status(200).json({
            success: true,
            slots: customerSlots
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch available slots"
        });
    }
};

export { getAvailableSlotsController};