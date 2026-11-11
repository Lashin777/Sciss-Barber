import Booking from "../models/bookingModel.js";
import Service from "../models/Service.js";
import ShopRules from "../models/ShopRules.js";
import Barber from "../models/barberModel.js";
import BarberUnavailability from "../models/barberUnavailabilityModel.js";


const getAvailableSlotsService = async (serviceId, date) => {
    const service = await Service.findOne({
        _id:serviceId,
        isActive:true
    });

    if(!service){
        throw new Error("Service Not Found OR inActive")
    }
    if (!Number.isFinite(service.duration) || service.duration <= 0) {
    throw new Error("Invalid Service Duration");
}
    const serviceDuration = service.duration * 60 * 1000;
    const shopRules = await ShopRules.findOne();

    if(!shopRules){
        throw new Error("Shop Rules Not Configured ")
    }
    if (!Number.isFinite(shopRules.bufferMinutes) || shopRules.bufferMinutes < 0) {
    throw new Error("Invalid Buffer Duration");
}
    const bufferDuration = shopRules.bufferMinutes * 60 * 1000;

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

     const barbers = await Barber.find({isActive:true});

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
    });

    const unavailabilities = await BarberUnavailability.find({
        startTime: { $lt: shopEnd },
        endTime: { $gt: shopStart }
    });


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

export {getAvailableSlotsService,getCustomerAvailableSlotsService};