import BarberUnavailability from "../models/barberUnavailabilityModel.js";
import Barber from "../models/barberModel.js";

const addBarberUnavailabilityService = async(barberId,startTime,endTime,reason)=>{
    const barber = await Barber.findById(barberId);

    if(!barber){
        throw new Error("Barber is not found");
    }
    if(!barber.isActive){
        throw new Error("Cannot add unavailability for an inActive Barber ");

    }
        const start = new Date(startTime);
        const end = new Date(endTime);

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime())
    ) {
        throw new Error("Invalid start or end time");
    }

    if (end <= start) {
        throw new Error("End time must be later than start time");
    }

    const existingUnavailability = await BarberUnavailability.findOne({
        barberId,
        startTime: { $lt: end },
        endTime: { $gt: start }
    });
    if (existingUnavailability) {
        throw new Error("Barber already has an overlapping unavailability");
    }

    const unavailability  = await BarberUnavailability.create({
        barberId,
        startTime:start,
        endTime:end,
        reason
    })
    return unavailability

}


const getBarberUnavailabilityService = async (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);


    if(Number.isNaN(start.getTime())|| Number.isNaN(end.getTime())){
        throw new Error("invalid start or endtime ")
    }
    if(end <=start){
        throw new Error("end time must be later than start time ");
    }

    const unavailability = await BarberUnavailability.find({
        startTime:{$lt:end},
        endTime:{$gt:start}
    });

    return unavailability
};


export {addBarberUnavailabilityService,getBarberUnavailabilityService}