import mongoose from "mongoose";
import Booking from "../models/bookingModel.js";
import Service from "../models/Service.js";
import ShopRules from "../models/ShopRules.js";
import Barber from "../models/barberModel.js";
import User from "../models/userModel.js";
import Counter from "../models/counterModel.js";
import WalkInCustomer from "../models/walkInCustomerModel.js";
import { sendBookingNotification } from "./emailService.js";
import BarberUnavailability from "../models/barberUnavailabilityModel.js";
import Payment from "../models/PaymentModel.js";
import AppError from "../utils/AppError.js";
import { creditWalletService } from "./WalletService.js";
import ShopAvailability from "../models/shopAvailabilityModel.js";
import { BOOKING_PAYMENT_WINDOW_MS, getActiveBookingAvailabilityFilter } from "../utils/bookingPaymentDeadline.js";


// Worked by Codex: availability can use the combined duration of selected services.
const getAvailableSlotsService = async (serviceId, date, session=null, requestedDuration=null, excludeBookingId=null) => {
    const service = await Service.findOne({
        _id:serviceId,
        isActive:true
    }).session(session);

    if(!service){
        throw new Error("Service Not Found OR inActive")
    }
    if (!Number.isFinite(service.duration) || service.duration <= 0) {
    throw new Error("Invalid Service Duration");
}
    const durationMinutes = requestedDuration ?? service.duration;
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        throw new Error("Invalid Service Duration");
    }
    const serviceDuration = durationMinutes * 60 * 1000;
    const shopRules = await ShopRules.findOne().session(session);

    if(!shopRules){
        throw new Error("Shop Rules Not Configured ")
    }
    if (!Number.isFinite(shopRules.bufferMinutes) || shopRules.bufferMinutes < 0) {
    throw new Error("Invalid Buffer Duration");
}
    const bufferDuration = shopRules.bufferMinutes * 60 * 1000;
    const maxConcurrentBookings = shopRules.maxConcurrentBookings;

        if (!Number.isInteger(maxConcurrentBookings) || maxConcurrentBookings < 1) {
            throw new Error("Invalid maximum concurrent bookings configuration");
        }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new Error("Invalid appointment date");
    }

    const[year,month,day]= date.split("-").map(Number);

    const appointmentDate = new Date(year,month-1,day);


    if(appointmentDate.getFullYear()!== year || appointmentDate.getMonth()!== month-1||appointmentDate.getDate() !== day){
        throw new Error("invalid Appointment Date");
    }

     const today = new Date();
     today.setHours(0,0,0,0);

     if(appointmentDate<today){
        throw new Error("Cannot Book For Past Date");
     }

     const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
     const selectedDay = dayNames[appointmentDate.getDay()];
     if(!dayNames.includes(shopRules.weeklyOff)){
        throw new Error("invalid Week off configuration")
     }

     if(selectedDay ===shopRules.weeklyOff){
        throw new Error("the Shop is Closed on This day ")
     }

     const barbers = await Barber.find({isActive:true}).session(session);

     if(barbers.length === 0 ){
        throw new Error("no Barber are Currently Available ");
     }
     const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

     if(!timeRegex.test(shopRules.openingTime)||!timeRegex.test(shopRules.closingTime)){
        throw new Error("invalid Shop  Operating Hour")
     }
     const shopStart = new Date(appointmentDate);
     const [openHour, openMinute] = shopRules.openingTime.split(":").map(Number);
     shopStart.setHours(openHour,openMinute,0,0);


     const shopEnd = new Date(appointmentDate);

     const [closeHour,closeMinute] = shopRules.closingTime.split(':').map(Number);
     shopEnd.setHours(closeHour, closeMinute, 0, 0);

    if (shopEnd <= shopStart) {
        shopEnd.setDate(shopEnd.getDate() + 1);
    }
    const closureQueryStart = new Date(shopStart);
    closureQueryStart.setHours(0, 0, 0, 0);
    const closureQueryEnd = new Date(shopEnd);
    closureQueryEnd.setHours(0, 0, 0, 0);
    closureQueryEnd.setDate(closureQueryEnd.getDate() + 1);
    const shopClosures = await ShopAvailability.find({ date: { $gte: closureQueryStart, $lt: closureQueryEnd }, isActive: true }).session(session);
    const closureIntervals = shopClosures.map((closure) => {
        if (closure.type === "TIME_RANGE") return { start: closure.startTime, end: closure.endTime };
        const start = new Date(closure.date);
        const [openHour, openMinute] = shopRules.openingTime.split(":").map(Number);
        start.setHours(openHour, openMinute, 0, 0);
        const end = new Date(closure.date);
        const [closeHour, closeMinute] = shopRules.closingTime.split(":").map(Number);
        end.setHours(closeHour, closeMinute, 0, 0);
        if (end <= start) end.setDate(end.getDate() + 1);
        return { start, end };
    });
     const bookingWindowStart = new Date(shopStart.getTime() - bufferDuration);
     const now = new Date();
     const bookingQuery = {
        appointmentStart: { $lt: shopEnd },
        appointmentEnd: { $gt: bookingWindowStart },
        ...getActiveBookingAvailabilityFilter(now)
    };
    if (excludeBookingId) bookingQuery._id = { $ne: excludeBookingId };
    const existingBookings = await Booking.find(bookingQuery).session(session);

    const unavailabilities = await BarberUnavailability.find({
        startTime: { $lt: shopEnd },
        endTime: { $gt: shopStart }
    }).session(session);


    const availableSlots = [];
    for(const barber of barbers){
        const barberBookings = existingBookings.filter(booking => booking.barberId.toString()== barber._id.toString());
        const barberUnavailabilities = unavailabilities.filter(
            item => item.barberId.toString() === barber._id.toString()
        );

        let currentSlot = new Date(shopStart);

        while(currentSlot.getTime()+serviceDuration<=shopEnd.getTime()){
            const currentSlotEnd = new Date(currentSlot.getTime()+serviceDuration);
            const closureConflicts = closureIntervals.filter((closure) => currentSlot < closure.end && currentSlotEnd > closure.start);
            if (closureConflicts.length) {
                currentSlot = new Date(Math.max(...closureConflicts.map((closure) => closure.end.getTime())));
                continue;
            }
            const overlappingBookings = existingBookings.filter(booking =>
                currentSlot < booking.appointmentEnd &&
                currentSlotEnd > booking.appointmentStart
            );


            const bookingEvents = [];

            overlappingBookings.forEach(booking =>{
                const overlapStart = Math.max(
                    booking.appointmentStart.getTime(), currentSlot.getTime());

                const overlapEnd = Math.min(
                    booking.appointmentEnd.getTime(), currentSlotEnd.getTime());


                bookingEvents.push(
                    {time:overlapStart,type:"START"},
                    {time:overlapEnd,type:"END"}
                );
            });

            //sort events chronolofigally 

            bookingEvents.sort((a, b) => {
                if (a.time !== b.time) {
                return a.time - b.time;
            }

                if (a.type === b.type) {
                return 0;
            }

                return a.type === "END" ? -1 : 1;
            });

            let activeBookings = 0;
            let peakConcurrentBookings = 0;

                bookingEvents.forEach(event => {
                    if (event.type === "END") {
                        activeBookings--;
                    } else {
                        activeBookings++;

                    peakConcurrentBookings = Math.max(
                    peakConcurrentBookings,
                    activeBookings
                );
            }
        });

        const hasShopCapacity = peakConcurrentBookings + 1 <= maxConcurrentBookings;

        if (!hasShopCapacity) {
           currentSlot = new Date(currentSlotEnd.getTime() + bufferDuration);
            continue;
        }

            if(appointmentDate.getTime() === today.getTime()&& currentSlot <=now){
                currentSlot = new Date(currentSlotEnd.getTime()+bufferDuration);
                continue;
            }
            const bookingConflict = barberBookings.filter(booking=>
                currentSlot< new Date(booking.appointmentEnd.getTime()+bufferDuration) && currentSlotEnd.getTime()+bufferDuration > booking.appointmentStart.getTime()
            );

            const bookingEndTimes = bookingConflict.map(booking =>
                booking.appointmentEnd.getTime() + bufferDuration
            );

            if(bookingConflict.length >0){
                const latestBookingEnd = Math.max(...bookingEndTimes);

                currentSlot = new Date(latestBookingEnd);
                continue;
            }

            const unavailabilityConflicts = barberUnavailabilities.filter(item =>
                currentSlot < item.endTime &&
                currentSlotEnd > item.startTime
            );


            if(unavailabilityConflicts.length >0){
                const latestUnavailabilityEnd = Math.max(
                ...unavailabilityConflicts.map(item => item.endTime.getTime())
             );
                currentSlot = new Date(latestUnavailabilityEnd + bufferDuration);
                continue;
            }

            const previousBookings = barberBookings.filter(booking => booking.appointmentEnd <= currentSlot);
            const lastBookingEnd = previousBookings.length? Math.max(...previousBookings.map(booking => booking.appointmentEnd.getTime()+bufferDuration)): shopStart.getTime();

            availableSlots.push({
                barberId: barber._id,
                startTime: new Date(currentSlot),
                endTime: currentSlotEnd,
                lastBookingEnd:new Date(lastBookingEnd)
            });

            currentSlot = new Date(currentSlotEnd.getTime() + bufferDuration);

        }

    }
            return availableSlots;

};



const normalizeServiceIds = (serviceIds) => [...new Set((Array.isArray(serviceIds) ? serviceIds : [serviceIds])
    .map((serviceId) => String(serviceId || '').trim())
    .filter(Boolean))];

// Worked by Codex: calculate customer slots against the duration of all selected services.
const getCustomerAvailableSlotsService = async (serviceIds, date) => {
    const normalizedServiceIds = normalizeServiceIds(serviceIds);
    if (!normalizedServiceIds.length || normalizedServiceIds.some((id) => !mongoose.isValidObjectId(id))) {
        throw new Error('Choose one or more valid services');
    }

    const services = await Service.find({ _id: { $in: normalizedServiceIds }, isActive: true });
    if (services.length !== normalizedServiceIds.length) {
        throw new Error('One or more selected services are unavailable');
    }
    const servicesById = new Map(services.map((service) => [String(service._id), service]));
    const totalDuration = normalizedServiceIds.reduce((total, id) => total + Number(servicesById.get(id).duration), 0);
    const slots = await getAvailableSlotsService(normalizedServiceIds[0], date, null, totalDuration);

    const slotMap = new Map();

    slots.forEach(slot => {
        const key = slot.startTime.getTime();

        if (!slotMap.has(key)) {
            slotMap.set(key, {
                startTime: slot.startTime,
                endTime: slot.endTime,
                availableBarbers: []
            });
        }

        slotMap.get(key).availableBarbers.push({
            barberId: slot.barberId,
            lastBookingEnd: slot.lastBookingEnd
        });
    });

    return [...slotMap.values()]
    .map(slot => ({
        startTime: slot.startTime,
        endTime: slot.endTime
    }))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
};


// Worked by Codex: create one booking record for the selected service sequence.
const createBookingService = async ({ userId, serviceIds, serviceId, date, startTime, notificationSender = sendBookingNotification }) => {
    const normalizedServiceIds = normalizeServiceIds(serviceIds?.length ? serviceIds : serviceId);

    // 1. Validate required input
    if (!userId || !normalizedServiceIds.length || !date || !startTime) {
        throw new Error("Missing required booking details");
    }
    if (normalizedServiceIds.some((id) => !mongoose.isValidObjectId(id))) {
        throw new Error('One or more selected services are invalid');
    }

    // 2. Create session
    const session = await mongoose.startSession();

    let booking;

    try {

        // 3. Start transaction
        await session.withTransaction(async () => {

            // 4. Get shop rules
            const shopRules = await ShopRules.findOne().session(session);

            if (!shopRules) {
                throw new Error("Shop rules not configured");
            }

            // 5. Acquire shared booking lock
            await ShopRules.updateOne({ _id: shopRules._id },{ $inc: { bookingLockVersion: 1 } },{ session });

            // 6. Get every active selected service
            const services = await Service.find({ _id: { $in: normalizedServiceIds }, isActive: true }).session(session);
            if (services.length !== normalizedServiceIds.length) {
                throw new Error("One or more selected services are unavailable");
            }
            const servicesById = new Map(services.map((service) => [String(service._id), service]));
            const selectedServices = normalizedServiceIds.map((id) => servicesById.get(id));

            // 7. Validate price and advance payment
            const servicePrice = selectedServices.reduce((total, service) => total + Number(service.price), 0);
            const serviceDuration = selectedServices.reduce((total, service) => total + Number(service.duration), 0);
            const advanceAmount = shopRules.advancePayment;

            if (!Number.isFinite(servicePrice) || servicePrice <= 0 || selectedServices.some((service) => !Number.isFinite(service.price) || service.price < 0)) {
                throw new Error("Invalid service price");
            }
            if (!Number.isFinite(serviceDuration) || serviceDuration <= 0 || selectedServices.some((service) => !Number.isFinite(service.duration) || service.duration <= 0)) {
                throw new Error("Invalid service duration");
            }

            if (!Number.isFinite(advanceAmount) || advanceAmount <=0 || advanceAmount>servicePrice) {
                throw new Error("Invalid advance payment configuration");
            }

            // 8. Validate requested start time
            const requestedStartTime = new Date(startTime);

            if (Number.isNaN(requestedStartTime.getTime())) {
                throw new Error("Invalid booking time");
            }

            const selectedDate = new Date(date);

            if (Number.isNaN(selectedDate.getTime())) {
                throw new Error("Invalid appointment date");
            }

            if (
                requestedStartTime.getFullYear() !== selectedDate.getFullYear() ||
                requestedStartTime.getMonth() !== selectedDate.getMonth() ||
                requestedStartTime.getDate() !== selectedDate.getDate()
            ) {
                throw new Error("Booking time does not match the selected date");
            }

            // 9. Recheck availability inside the transaction
            const availableSlots = await getAvailableSlotsService(
                normalizedServiceIds[0],
                date,
                session,
                serviceDuration
            );

            const matchingSlots = availableSlots.filter(slot => slot.startTime.getTime() === requestedStartTime.getTime());

            if (matchingSlots.length === 0) {
                throw new Error("Selected time slot is no longer available");
            }

            // 10. Choose the barber with the earliest idle time
            matchingSlots.sort((a, b) => a.lastBookingEnd.getTime() - b.lastBookingEnd.getTime());

            const selectedBarber = matchingSlots[0];

            const counter = await Counter.findByIdAndUpdate(
                "bookingToken",
                { $inc: { sequence: 1 } },
                { new: true, upsert: true, session }
            );

            // 11. Create booking
            const bookingCreatedAt = new Date();
            const createdBookings = await Booking.create([{
                userId,
                serviceId: selectedServices[0]._id,
                serviceIds: selectedServices.map((service) => service._id),
                serviceSnapshots: selectedServices.map((service) => ({ serviceId: service._id, name: service.name, price: service.price, duration: service.duration })),
                barberId: selectedBarber.barberId,
                appointmentDate: selectedDate,
                servicePrice,
                serviceDuration,
                advanceAmount,
                status: "PENDING",
                createdAt: bookingCreatedAt,
                paymentDeadline: new Date(bookingCreatedAt.getTime() + BOOKING_PAYMENT_WINDOW_MS),
                appointmentStart: selectedBarber.startTime,
                appointmentEnd: selectedBarber.endTime,
                bookingToken: `SB-${String(counter.sequence).padStart(4, "0")}`,
            }], { session });

            booking = createdBookings[0];
        });
        try {
            const bookingDetails = await Booking.findById(booking._id)
                .populate("userId", "name email")
                .populate("serviceId", "name")
                .populate("serviceIds", "name")
                .populate("barberId", "name");

        if (
            !bookingDetails ||
            !bookingDetails.userId ||
            !bookingDetails.serviceId ||
            !bookingDetails.barberId
        ) {
            throw new Error("Booking notification details are incomplete");
        }

        const admin = await User.findOne({ role: "ADMIN" }).select("email");
        const adminEmail = process.env.SHOP_ADMIN_EMAIL || admin?.email;

        if (!adminEmail) {
            throw new Error("Admin email not found");
        }

        await notificationSender({
            adminEmail,
            customerName: bookingDetails.userId.name,
            serviceName: bookingDetails.serviceIds?.length
                ? bookingDetails.serviceIds.map((service) => service.name).join(', ')
                : bookingDetails.serviceId.name,
            barberName: bookingDetails.barberId.name,
            appointmentStart: bookingDetails.appointmentStart,
            appointmentEnd: bookingDetails.appointmentEnd,
            advanceAmount: bookingDetails.advanceAmount,
            status: bookingDetails.status
        });

    } catch (emailError) {
        console.error("Booking notification failed:", emailError.message);
    }

        return booking;


    } finally {
        // 12. Always close the session
        await session.endSession();
    }
};
const createWalkInBookingService = async ({ name, phone, serviceId, date, startTime }) => {
    if (typeof name !== "string" || typeof phone !== "string" || !serviceId || !date || !startTime) throw new Error("Missing required booking details");
    const normalizedName = name.trim();
    if (normalizedName.length < 2 || normalizedName.length > 100 || !/^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/.test(normalizedName)) throw new Error("Enter a valid customer name");
    const normalizedPhone = phone.trim();
    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) throw new Error("Enter a valid 10-digit phone number");
    if (!mongoose.isValidObjectId(serviceId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) throw new Error("Invalid service, appointment date, or start time");
    const [year, month, day] = date.split("-").map(Number);
    const appointmentDate = new Date(year, month - 1, day);
    if (appointmentDate.getFullYear() !== year || appointmentDate.getMonth() !== month - 1 || appointmentDate.getDate() !== day) throw new Error("Invalid appointment date");
    const requestedStart = new Date(`${date}T${startTime}:00`);
    const session = await mongoose.startSession();
    let booking;
    try {
        await session.withTransaction(async () => {
            const rules = await ShopRules.findOne().session(session);
            if (!rules) throw new Error("Shop rules not configured");
            await ShopRules.updateOne({ _id: rules._id }, { $inc: { bookingLockVersion: 1 } }, { session });
            const service = await Service.findOne({ _id: serviceId, isActive: true }).session(session);
            if (!service || !Number.isFinite(service.duration) || service.duration <= 0) throw new Error("Service not found or inactive");
            const slots = await getAvailableSlotsService(service._id, date, session, service.duration);
            const slot = slots.find((item) => item.startTime.getTime() === requestedStart.getTime());
            if (!slot) throw new Error("Selected time slot is no longer available");
            const walkInCustomer = await WalkInCustomer.findOneAndUpdate({ phone: normalizedPhone }, { name: normalizedName, phone: normalizedPhone }, { new: true, upsert: true, runValidators: true, session });
            const counter = await Counter.findByIdAndUpdate("bookingToken", { $inc: { sequence: 1 } }, { new: true, upsert: true, session });
            [booking] = await Booking.create([{ bookingType: "WALK_IN", walkInCustomerId: walkInCustomer._id, serviceId: service._id, serviceIds: [service._id], serviceSnapshots: [{ serviceId: service._id, name: service.name, price: service.price, duration: service.duration }], appointmentDate, servicePrice: service.price, serviceDuration: service.duration, advanceAmount: 0, status: "COMPLETED", barberId: slot.barberId, appointmentStart: slot.startTime, appointmentEnd: slot.endTime, bookingToken: `SB-${String(counter.sequence).padStart(4, "0")}` }], { session });
        });
        return booking;
    } finally {
        await session.endSession();
    }
};

const getMyBookingsService = async (userId) => {
    const bookings = await Booking.find({ userId })
        .populate('serviceId')
        .populate('serviceIds')
        .populate('barberId')
        .sort({ appointmentDate: -1, appointmentStart: -1 });
    if (!bookings.length) return bookings;

    const payments = await Payment.find({ userId, bookingId: { $in: bookings.map(({ _id }) => _id) } })
        .select('bookingId status')
        .lean();
    const paymentByBookingId = new Map(payments.map((payment) => [String(payment.bookingId), payment]));

    return bookings.map((booking) => ({
        ...booking.toObject(),
        payment: paymentByBookingId.get(String(booking._id)) || null
    }));
};

const getBookingDetailsService = async(bookingId,userId)=>{
    const booking = await Booking.findOne({
        _id:bookingId,
        userId
    })
    .select('bookingToken userId serviceId serviceIds serviceSnapshots barberId appointmentDate servicePrice serviceDuration advanceAmount status appointmentStart appointmentEnd')
    .populate('serviceId')
    .populate('serviceIds')
    .populate('barberId');
    if (!booking) return null;
    const payment = await Payment.findOne({ bookingId: booking._id, userId }).select('-razorpaySignature').lean();
    return { ...booking.toObject(), payment };
};

// Worked by Codex: generate a booking invoice using ownership-checked booking and payment records.
const getBookingInvoiceService = async (bookingId, userId) => {
    const booking = await Booking.findOne({ _id: bookingId, userId })
        .populate('userId', 'name email phone')
        .populate('serviceId', 'name')
        .populate('serviceIds', 'name')
        .populate('barberId', 'name')
        .lean();
    if (!booking) return null;
    const payment = await Payment.findOne({ bookingId: booking._id, userId })
        .select('-razorpaySignature')
        .lean();
    return { ...booking, payment };
};



const getBookingHistoryService = async(userId)=>{
    const now = new Date();
    return await Booking.find({
        userId:userId,
        $or: [
            { appointmentStart: { $lt: now } },
            { status: 'COMPLETED' }
        ]
    }).sort({appointmentStart:-1})

    .populate('serviceId', 'name')
    .populate('serviceIds', 'name')
    .populate('barberId', 'name');
};


const cancelBookingService = async (bookingId, userId) => {
    const session = await mongoose.startSession();
    let cancelledBooking;

    try {
        await session.withTransaction(async () => {
            const booking = await Booking.findOne({
                _id: bookingId,
                userId
            }).session(session);

            if (!booking) {
                throw new AppError("Booking Not Found", 404);
            }

            if (!["PENDING", "CONFIRMED", "ACCEPTED"].includes(booking.status)) {
                throw new AppError("This booking cannot be cancelled", 400);
            }

            const appointmentTime = new Date(booking.appointmentStart);
            const timeDifference = appointmentTime.getTime() - Date.now();

            if (
                Number.isNaN(appointmentTime.getTime()) ||
                timeDifference <= 3 * 60 * 60 * 1000
            ) {
                throw new AppError(
                    "Cancellation is not allowed within 3 hours of the appointment",
                    400
                );
            }

            const payment = await Payment.findOne({
                bookingId: booking._id,
                userId,
                status: "SUCCESS"
            }).session(session);

            if (payment) {
                const refundAmount = Number(payment.amount);

                if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
                    throw new AppError("Invalid successful payment amount", 500);
                }

                await creditWalletService(
                    userId,
                    refundAmount,
                    "BOOKING_REFUND",
                    booking._id,
                    session
                );
            }

            const updatedBooking = await Booking.findOneAndUpdate(
                {
                    _id: booking._id,
                    userId,
                    status: { $in: ["PENDING", "CONFIRMED", "ACCEPTED"] }
                },
                { $set: { status: "CANCELLED" } },
                { new: true, runValidators: true, session }
            );

            if (!updatedBooking) {
                throw new AppError("This booking has already changed and cannot be cancelled", 409);
            }

            cancelledBooking = updatedBooking;
        });

        return cancelledBooking;
    } finally {
        await session.endSession();
    }
};


export {getAvailableSlotsService,
        getCustomerAvailableSlotsService,
        createBookingService,
        getMyBookingsService,
        getBookingDetailsService,
        getBookingInvoiceService,
        getBookingHistoryService,
        cancelBookingService,
        createWalkInBookingService
        };
