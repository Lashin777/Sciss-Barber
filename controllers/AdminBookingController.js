import { getAdminBookingsService, updateBookingStatusService, getAdminBookingDetailsService, cancelAdminBookingService } from "../services/AdminBookingService.js";
import {createWalkInBookingService} from "../services/BookingService.js";

const renderAdminBookingsPageController = async (req, res) => {
    const requestedPage = Number.parseInt(req.query.page, 10);
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const limit = [10, 25, 50].includes(requestedLimit) ? requestedLimit : 10;
    const validStatuses = ['PENDING', 'CONFIRMED', 'ACCEPTED', 'DECLINED', 'COMPLETED', 'CANCELLED'];
    const requestedStatus = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : '';
    const status = validStatuses.includes(requestedStatus) ? requestedStatus : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';

    try {
        const result = await getAdminBookingsService({ page, limit, status, search });
        return res.render('admin/booking', { title: 'Admin Bookings', ...result, status, search, bookingPageError: null });
    } catch (error) {
        return res.status(500).render('admin/booking', {
            title: 'Admin Bookings',
            bookings: [],
            totalBookings: 0,
            allBookingsCount: 0,
            totalPages: 0,
            page: 1,
            limit,
            bookingStats: {},
            status,
            search,
            bookingPageError: error.message || 'Could not load bookings.'
        });
    }
};

const updateBookingStatusController = async (req, res, next) => {
    try {
        const booking = await updateBookingStatusService(
            req.params.bookingId,
            req.body.status
        );

        return res.status(200).json({
            success: true,
            message: "Booking status updated successfully",
            booking
        });

    } catch (error) {
        next(error);
    }
};

const getAdminBookingDetailsController = async (req, res, next) => {
    try {
        const booking = await getAdminBookingDetailsService(req.params.bookingId);

        return res.status(200).json({
            success: true,
            booking
        });
    } catch (error) {
        next(error);
    }
};

const cancelAdminBookingController = async (req, res, next) => {
    try {
        const booking = await cancelAdminBookingService(req.params.bookingId);
        return res.status(200).json({
            success: true,
            message: 'Booking cancelled successfully',
            booking
        });
    } catch (error) {
        next(error);
    }
};


const renderAdminBookingDetailsPageController = async (req, res, next) => {
    try {
        const booking = await getAdminBookingDetailsService(req.params.bookingId);

        return res.render('admin/booking-details', {
            title: 'Booking Details',
            booking
        });
    } catch (error) {
        next(error);
    }
};

const createWalkInBookingController = async(req,res,next)=>{
    try{
        const booking = await createWalkInBookingService({
            name:req.body.name,
            phone:req.body.phone,
            serviceId:req.body.serviceId,
            date:req.body.date,
            startTime:req.body.startTime
        });


        return res.status(201).json({
            success:true,
            message:"Walk-in booking is add successfully",
            booking
        });
    }catch(error){
        next(error)
    }
}
export { renderAdminBookingsPageController,
        updateBookingStatusController,
        getAdminBookingDetailsController,
        renderAdminBookingDetailsPageController,
        cancelAdminBookingController,
        createWalkInBookingController
};
