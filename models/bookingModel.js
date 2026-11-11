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

    status: {
        type: String,
        enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'COMPLETED', 'CANCELLED'],
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
