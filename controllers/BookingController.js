import { getCustomerAvailableSlotsService,
        createBookingService,
        getMyBookingsService,
        getBookingDetailsService,
        getBookingInvoiceService,
        getBookingHistoryService,
        cancelBookingService
    } from "../services/BookingService.js";

const getAvailableSlotsController = async (req, res) => {
    try {
        const { serviceId, date } = req.query;
        const serviceIds = typeof req.query.serviceIds === 'string'
            ? req.query.serviceIds.split(',').filter(Boolean)
            : Array.isArray(req.query.serviceIds) ? req.query.serviceIds : serviceId;

        if (!serviceIds || !date) {
            return res.status(400).json({
                success: false,
                message: "service id and date are required"
            });
        }

        const customerSlots = await getCustomerAvailableSlotsService(serviceIds, date);

        return res.status(200).json({
            success: true,
            slots: customerSlots
        });

    } catch (error) {
        return res.status(error.statusCode || 400).json({
            success: false,
            message: error.message || "Failed to fetch available slots"
        });
    }
};



const createBookingController = async (req, res) => {
    try {
        const { serviceIds, serviceId, date, startTime } = req.body;

        const booking = await createBookingService({
            userId: req.user._id,
            serviceIds,
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
        if (!/^[a-f\d]{24}$/i.test(String(req.params.bookingId || ''))) {
            return res.status(400).json({ success: false, message: 'Invalid booking ID' });
        }
        const  booking = await getBookingDetailsService(
            req.params.bookingId,
            req.user._id
        );

        if(!booking){
            return res.status(404).json({
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

const renderBookingInvoiceController = async (req, res, next) => {
    try {
        if (!/^[a-f\d]{24}$/i.test(String(req.params.bookingId || ''))) {
            return res.status(400).render('errors/404', { title: 'Invalid booking ID' });
        }
        const booking = await getBookingInvoiceService(req.params.bookingId, req.user._id);
        if (!booking) return res.status(404).render('errors/404', { title: 'Booking not found' });
        return res.render('user/booking-invoice', { title: 'Booking Invoice', booking });
    } catch (error) {
        next(error);
    }
};



const getBookingHistoryController = async(req,res,next)=>{
    try{
        const history = await getBookingHistoryService(req.user._id);

        if(history){
            return res.status(200).json({
                success:true,
                bookings:history
            })
        }

    }catch(error){
            next(error)
        }
};


const cancelBookingController = async (req, res, next) => {
    try {
        const booking = await cancelBookingService(
            req.params.bookingId,
            req.user._id
        );

        return res.status(200).json({
            success: true,
            message: "Booking cancelled successfully",
            booking
        });

    } catch (error) {
        next(error);
    }
};



export { getAvailableSlotsController,
         createBookingController,
         getMyBookingsController,
         getBookingDetailsController,
         renderBookingInvoiceController,
         getBookingHistoryController,
         cancelBookingController
};
