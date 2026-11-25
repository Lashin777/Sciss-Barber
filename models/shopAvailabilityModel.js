import mongoose from "mongoose";


const shopAvailabilitySchema = new mongoose.Schema({
date: {
    type: Date,
    required: true
},
type: {
    type: String,
    enum: ["FULL_DAY", "TIME_RANGE"],
    required: true
},
startTime: {
    type: Date,
    required: function () {
        return this.type === "TIME_RANGE";
    }
},
endTime: {
    type: Date,
    required: function () { return this.type === "TIME_RANGE"; },
    validate: {
        validator: function (value) {
        return this.type !== "TIME_RANGE" || value > this.startTime;
    },
        message: "End time must be later than start time"
    }
},
reason: {
    type: String,
    trim: true,
    default: ""
},
isActive: {
    type: Boolean,
    default: true
},

},{timestamps:true});

shopAvailabilitySchema.index({ date: 1, isActive: 1, startTime: 1 });

const ShopAvailability = mongoose.model("ShopAvailability", shopAvailabilitySchema);

export default ShopAvailability;
