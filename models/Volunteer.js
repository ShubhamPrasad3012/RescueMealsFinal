
const mongoose = require("mongoose");

const VolunteerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

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

    // Whether the volunteer can currently help
    available: {
      type: Boolean,
      default: true
    },

    // Maximum distance the volunteer is willing to cover, in km
    coverageRadiusKm: {
      type: Number,
      min: 0,
      default: 10
    },

    // Optional limit on meals the volunteer can transport per trip
    carryingCapacity: {
      type: Number,
      min: 0,
      default: 50
    }
  },
  { timestamps: true }
);

VolunteerSchema.index({
  available: 1,
  city: 1,
  state: 1
});

module.exports =
  mongoose.models.Volunteer ||
  mongoose.model("Volunteer", VolunteerSchema);
