import mongoose from "mongoose";

const shopRulesSchema = new mongoose.Schema({
    openingTime: {
        type: String,
        required: true,
        default: "11:00"
},
    closingTime: {
        type: String,
        required: true,
        default: "00:00"
},
    weeklyOff: {
        type: String,
        required: true,
        default: "TUESDAY"
},
    maxConcurrentBookings: {
        type: Number,
        required: true,
        default: 2,
        min: 1
},
    bufferMinutes: {
        type: Number,
        required: true,
        default: 10,
        min: 0
},
advancePayment: {
    type: Number,
    required: true,
    default: 100,
    min: 1,
}
});

const ShopRules = mongoose.model("ShopRules", shopRulesSchema);

export default ShopRules;