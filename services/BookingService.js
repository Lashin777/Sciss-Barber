import mongoose from "mongoose";
import Booking from "../models/bookingModel.js";
import Service from "../models/Service.js";
import ShopRules from "../models/ShopRules.js";
import Barber from "../models/barberModel.js";
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

            if (!Number.isFinite(advanceAmount) || advanceAmount < 0 || advanceAmount>servicePrice) {
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
                appointmentEnd: selectedBarber.endTime
            }], { session });

            booking = createdBookings[0];
        });

        return booking;

    } finally {
        // 12. Always close the session
        await session.endSession();
    }
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

    .populate('serviceId')
    .populate('barberId')
}
export {getAvailableSlotsService,
        getCustomerAvailableSlotsService,
        createBookingService,
        getMyBookingsService,
        getBookingDetailsService
        };