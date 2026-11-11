import mongoose from "mongoose";


const barberUnavailabilitySchema = new mongoose.Schema({
    barberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Barber",
        required: true
    },
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date,
        required: true,
        validate:{
            validator:function(value){
            return value > this.startTime;
        },
        message:"end time must be later than start time"

        }
    },

    reason: {
        type: String,
        trim: true,
        default: ""
    }
}, { timestamps: true });

const BarberUnavailability = mongoose.model(
    "BarberUnavailability",
    barberUnavailabilitySchema
);

export default BarberUnavailability;