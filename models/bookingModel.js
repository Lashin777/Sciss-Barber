import mongoose from "mongoose";


const bookingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: true
    },
    barberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Barber',
        required: true
    },
    appointmentDate: {
        type: Date,
        required: true
    },
    servicePrice: {
        type: Number,
        required: true,
        min: 0
    },
    serviceDuration: {
        type: Number,
        required: true,
        min: 1
    },
    advanceAmount: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['PENDING', 'CONFIRMED','ACCEPTED', 'DECLINED', 'COMPLETED', 'CANCELLED'],
        default: 'PENDING',
        required: true
    },
    appointmentStart: {
        type: Date,
        required: true
    },
    appointmentEnd: {
        type: Date,
        required: true
    },

}, { timestamps: true });


const Booking = mongoose.model('Booking', bookingSchema);


export default Booking;
