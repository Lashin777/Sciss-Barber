import { getCustomerAvailableSlotsService,
        createBookingService,
        getMyBookingsService,
        getBookingDetailsService
    } from "../services/BookingService.js";

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



const createBookingController = async (req, res) => {
    try {
        const { serviceId, date, startTime } = req.body;

        const booking = await createBookingService({
            userId: req.user._id,
            serviceId,
            date,
            startTime
        });

        return res.status(201).json({
            success: true,
            message: "Booking created successfully",
            booking
        });

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message || "Booking creation failed"
        });
    }
};


const getMyBookingsController = async (req, res) => {
    try {
        const bookings = await getMyBookingsService(req.user._id);

        return res.status(200).json({
            success: true,
            bookings
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch bookings"
        });
    }
};

const getBookingDetailsController = async(req,res)=>{
    try{
        const  booking = await getBookingDetailsService(
            req.params.bookingId,
            req.user._id
        );

        if(!booking){
            return res.status(400).json({
                success:false,
                message:"Booking Not Found"
            });
        }
        return res.status(200).json({
            success:true,
            booking
        });

    }catch(error){
        return res.status(500).json({
            success:false,
            message:error.message||"failed to fetch booking details"
        })
    }
};







export { getAvailableSlotsController,
         createBookingController,
         getMyBookingsController,
         getBookingDetailsController
};