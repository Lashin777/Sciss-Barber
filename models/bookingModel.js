import mongoose from "mongoose";


const bookingSchema = new mongoose.Schema({
        bookingType: {
        type: String,
        enum: ["ONLINE", "WALK_IN"],
        default: "ONLINE"
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function () {
        return this.bookingType !== "WALK_IN";
        }
    },
    walkInCustomerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'walkInCustomer',
        required: function () {
        return this.bookingType === "WALK_IN";
        }
    },
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: true
    },
    // Worked by Codex: keep the legacy primary service reference and retain every service in a combined booking.
    serviceIds: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
        default: []
    },
    serviceSnapshots: {
        type: [{ serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true }, name: { type: String, required: true }, price: { type: Number, required: true, min: 0 }, duration: { type: Number, required: true, min: 1 } }],
        default: []
    },
    bookingToken: {
        type: String,
        required: true,
        unique: true
    },
    barberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Barber',
        required:function(){
            return this.bookingType !== "WALK_IN"
        }
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
    paymentDeadline: {
        type: Date
    },
    status: {
        type: String,
        enum: ['PENDING', 'FAILED', 'CONFIRMED','ACCEPTED', 'DECLINED', 'COMPLETED', 'CANCELLED'],
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

bookingSchema.index({ status: 1, paymentDeadline: 1, createdAt: 1 });


const Booking = mongoose.model('Booking', bookingSchema);


export default Booking;
