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


const getAvailableSlotsService = async (serviceId, date, session=null) => {
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
    const serviceDuration = service.duration * 60 * 1000;
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
     const bookingWindowStart = new Date(shopStart.getTime() - bufferDuration);
     const existingBookings = await Booking.find({
        appointmentStart: { $lt: shopEnd },
        appointmentEnd: { $gt: bookingWindowStart },
        status: { $in: ["PENDING", "ACCEPTED"] }
    }).session(session);

    const unavailabilities = await BarberUnavailability.find({
        startTime: { $lt: shopEnd },
        endTime: { $gt: shopStart }
    }).session(session);


    const availableSlots = [];
    const now = new Date();

    for(const barber of barbers){
        const barberBookings = existingBookings.filter(booking => booking.barberId.toString()== barber._id.toString());
        const barberUnavailabilities = unavailabilities.filter(
            item => item.barberId.toString() === barber._id.toString()
        );

        let currentSlot = new Date(shopStart);

        while(currentSlot.getTime()+serviceDuration<=shopEnd.getTime()){
            const currentSlotEnd = new Date(currentSlot.getTime()+serviceDuration);
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



const getCustomerAvailableSlotsService = async (serviceId, date) => {
    const slots = await getAvailableSlotsService(serviceId, date);

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

    return [...slotMap.values()].map(slot => ({
        startTime: slot.startTime,
        endTime: slot.endTime
    }));
};


const createBookingService = async ({ userId, serviceId, date, startTime }) => {

    // 1. Validate required input
    if (!userId || !serviceId || !date || !startTime) {
        throw new Error("Missing required booking details");
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

            // 6. Get active service
            const service = await Service.findOne({_id: serviceId,isActive: true}).session(session);

            if (!service) {
                throw new Error("Service not found or inactive");
            }

            // 7. Validate price and advance payment
            const servicePrice = service.price;
            const advanceAmount = shopRules.advancePayment;

            if (!Number.isFinite(servicePrice) || servicePrice < 0) {
                throw new Error("Invalid service price");
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
                serviceId,
                date,
                session
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
            const createdBookings = await Booking.create([{
                userId,
                serviceId,
                barberId: selectedBarber.barberId,
                appointmentDate: selectedDate,
                servicePrice,
                serviceDuration:service.duration,
                advanceAmount,
                status: "PENDING",
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

        if (!admin?.email) {
            throw new Error("Admin email not found");
        }

        await sendBookingNotification({
            adminEmail: admin.email,
            customerName: bookingDetails.userId.name,
            serviceName: bookingDetails.serviceId.name,
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
const createWalkInBookingService = async ({name,phone,serviceId,date,startTime}) => {
    // 1. Validate required inputs
    if (!name || !phone || !serviceId || !date || !startTime) {
        throw new Error("Missing required booking details");
    }

    // 2. Validate and normalize name
    const normalizedName = name.trim();

    if (!/^[a-zA-Z\s]+$/.test(normalizedName)) {
        throw new Error("Name should contain only letters and spaces");
    }

    // 3. Validate and normalize phone
    const normalizedPhone = phone.trim();

    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
        throw new Error("Enter a valid 10-digit phone number");
    }

    // 4. Find or create walk-in customer
    const walkInCustomer = await WalkInCustomer.findOneAndUpdate(
        { phone: normalizedPhone },
        { name: normalizedName, phone: normalizedPhone },
        { new: true, upsert: true, runValidators: true }
    );

    // 5. Find active service
    const service = await Service.findOne({
        _id: serviceId,
        isActive: true
    });

    if (!service) {
        throw new Error("Service not found or inactive");
    }

    // 6. Validate service duration
    if (!Number.isFinite(service.duration) || service.duration <= 0) {
        throw new Error("Invalid service duration");
    }

    // 7. Validate appointment date
    const appointmentDate = new Date(date);

    if (Number.isNaN(appointmentDate.getTime())) {
        throw new Error("Invalid appointment date");
    }

    // 8. Calculate appointment start and end
    const appointmentStart = new Date(`${date}T${startTime}:00`);

    if (Number.isNaN(appointmentStart.getTime())) {
        throw new Error("Invalid appointment start time");
    }

    const appointmentEnd = new Date(
        appointmentStart.getTime() + service.duration * 60000
    );

    // 9. Generate booking token
    const counter = await Counter.findByIdAndUpdate(
        "bookingToken",
        { $inc: { sequence: 1 } },
        { new: true, upsert: true }
    );

    // 10. Create completed booking
    const booking = await Booking.create({
        bookingType: "WALK_IN",
        walkInCustomerId: walkInCustomer._id,
        serviceId: service._id,
        appointmentDate,
        servicePrice: service.price,
        serviceDuration: service.duration,
        advanceAmount: 0,
        status: "COMPLETED",
        appointmentStart,
        appointmentEnd,
        bookingToken: `SB-${String(counter.sequence).padStart(4, "0")}`
    });

    return booking;
};

const getMyBookingsService = async (userId) => {
    return await Booking.find({ userId })
        .populate('serviceId')
        .populate('barberId')
        .sort({ appointmentDate: -1, appointmentStart: -1 });
};

const getBookingDetailsService = async(bookingId,userId)=>{
    return await Booking.findOne({
        _id:bookingId,
        userId
    })
    .select('bookingToken userId serviceId barberId appointmentDate servicePrice serviceDuration advanceAmount status appointmentStart appointmentEnd')
    .populate('serviceId')
    .populate('barberId')
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
    .populate('barberId', 'name');
};

const cancelBookingService = async (bookingId, userId) => {
    const booking = await Booking.findOne({
        _id:bookingId,
        userId:userId
    });

    if(!booking){
        const error = new Error("Booking Not Found");
            error.statusCode = 404;
            throw error;
    }
    if (["CANCELLED", "COMPLETED"].includes(booking.status)) {
        throw new Error("This booking cannot be cancelled");
    }

    const currentTime = new Date();
    const appointmentTime = new Date(booking.appointmentStart);
    const timeDifference = appointmentTime - currentTime;

    if(timeDifference<=3*60*60*1000){
        throw new Error("Cancelation is not allowed  within 3 hours of  the appoimnet ")
    }

    booking.status = "CANCELLED";
    await booking.save();
     return booking
};


export {getAvailableSlotsService,
        getCustomerAvailableSlotsService,
        createBookingService,
        getMyBookingsService,
        getBookingDetailsService,
        getBookingHistoryService,
        cancelBookingService,
        createWalkInBookingService
        };
