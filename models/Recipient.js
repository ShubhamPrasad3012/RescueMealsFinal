
const mongoose = require("mongoose");

const RecipientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    // Contact/location information
    city: {
      type: String,
      required: true,
      trim: true
    },

    state: {
      type: String,
      required: true,
      trim: true
    },

    address: {
      type: String,
      default: ""
    },

    location: {
      latitude: {
        type: Number,
        min: -90,
        max: 90,
        default: null
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180,
        default: null
      }
    },

    // Expected meal demand for the current day
    dailyMealDemand: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },

    // Number of meals actually received today
    mealsReceivedToday: {
      type: Number,
      default: 0,
      min: 0
    },

    // Maximum number of meals the recipient can accept
    receivingCapacity: {
      type: Number,
      required: true,
      min: 0,
      default: 100
    },

    active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

RecipientSchema.index({ active: 1, city: 1, state: 1 });

module.exports =
  mongoose.models.Recipient ||
  mongoose.model("Recipient", RecipientSchema);
