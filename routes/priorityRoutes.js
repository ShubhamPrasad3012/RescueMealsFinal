const mongoose = require("mongoose");
const geocoding = require("../utils/geocoding");
const Rawitems = require("../models/rawitems");
const Cookedfood = require("../models/cookedfood");
const Recipient = require("../models/Recipient");
const Volunteer = require("../models/Volunteer");

const {
  DEFAULT_WEIGHTS,
  calculateUrgency,
  calculateDemand,
  calculateQuantityFit,
  calculateProximity,
  calculateVolunteerSupply,
  calculatePriority
} = require("../utils/priority");

function getCoordinates(record) {
  // Supports the flat shape and the nested shape in the
  // existing donation schema.
  const location = record.location || {};
  const nested = location.type || {};

  const latitude = Number(location.latitude ?? nested.latitude);
  const longitude = Number(location.longitude ?? nested.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 ||
    longitude < -180 || longitude > 180
  ) {
    return null;
  }

  // (0, 0) is often a placeholder; don't treat it as a real location.
  if (latitude === 0 && longitude === 0) return null;

  return { latitude, longitude };
}

function distanceKm(a, b) {
  const radians = degrees => degrees * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
    Math.cos(radians(b.latitude)) *
    Math.sin(dLon / 2) ** 2;

  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

function getCreatedAt(item) {
  if (item.createdAt && !Number.isNaN(new Date(item.createdAt).getTime())) {
    return new Date(item.createdAt);
  }

  if (item._id && typeof item._id.getTimestamp === "function") {
    return item._id.getTimestamp();
  }

  return null;
}

function normalizeDonation(item, type) {
  return {
    id: String(item._id),
    type,
    title: type === "raw" ? item.name : item.meal,
    quantity: type === "raw" ? item.quantity : item.people,
    unit: type === "raw" ? (item.unit || "kg") : "meals",
    // Cooked people is a serving/meal estimate. Raw kilograms
    // must not be compared with meal counts without conversion data.
    estimatedMeals:
      type === "cooked"
        ? Number(item.people)
        : Number(item.estimatedMeals),
    city: item.city,
    state: item.state,
    expiryDate: item.expiryDate || null,
    createdAt: getCreatedAt(item),
    location: getCoordinates(item)
  };
}

module.exports = function registerPriorityRoutes(router) {
  router.get("/priority/queue", async (req, res) => {
    try {
      const now = new Date();

      const [rawDocs, cookedDocs, recipients, volunteers] =
        await Promise.all([
          Rawitems.find({ requeststatus: false }).lean(),
          Cookedfood.find({ requeststatus: false }).lean(),
          Recipient.find({ active: true }).lean(),
          Volunteer.find({ available: true }).lean()
        ]);

      const donations = [
        ...rawDocs.map(item => normalizeDonation(item, "raw")),
        ...cookedDocs.map(item => normalizeDonation(item, "cooked"))
      ];

      const recipientData = recipients.map(recipient => {
        const demand = calculateDemand(
          recipient.dailyMealDemand,
          recipient.mealsReceivedToday,
          1
        );

        return {
          record: recipient,
          location: getCoordinates(recipient),
          deficit: demand.deficit
        };
      });

      const maxDeficit = Math.max(
        0,
        ...recipientData.map(item => item.deficit)
      );

      const matches = [];

      for (const donation of donations) {
        const urgency = calculateUrgency(
          donation.expiryDate,
          8,
          now
        );

        if (urgency.expired) continue;

        // Missing expiry is not proof the food is safe.
        if (urgency.expiryUnknown) {
          matches.push({
            donation,
            status: "incomplete",
            warning: "Expiry date missing or invalid; verify food safety."
          });
          continue;
        }

        for (const recipientInfo of recipientData) {
          const recipient = recipientInfo.record;
          const recipientLocation = recipientInfo.location;

          if (recipientInfo.deficit <= 0) continue;

          if (
            !donation.location ||
            !recipientLocation
          ) {
            matches.push({
              donation,
              recipient: {
                id: String(recipient._id),
                name: recipient.name
              },
              status: "incomplete",
              warning: "Valid donation and recipient coordinates are required."
            });
            continue;
          }

          const distance = distanceKm(
            donation.location,
            recipientLocation
          );

          // This is a prototype travel-distance limit, not a road route.
          const maxDistanceKm = 20;

          if (distance > maxDistanceKm) continue;

          const nearbyVolunteers = volunteers.filter(volunteer => {
            const volunteerLocation = getCoordinates(volunteer);
            if (!volunteerLocation) return false;

            const volunteerDistance = distanceKm(
              volunteerLocation,
              donation.location
            );

            return volunteerDistance <=
              Number(volunteer.coverageRadiusKm || 0);
          });

          const quantityFit = calculateQuantityFit(
            donation.estimatedMeals,
            Math.min(
              recipientInfo.deficit,
              Number(recipient.receivingCapacity || 0)
            )
          );

          const proximity = calculateProximity(
            distance,
            maxDistanceKm
          );

          const volunteerSupply = calculateVolunteerSupply(
            nearbyVolunteers.length,
            3
          );

          const demand = calculateDemand(
            recipient.dailyMealDemand,
            recipient.mealsReceivedToday,
            maxDeficit
          );

          const features = {
            urgency: urgency.value,
            demand: demand.value,
            quantityFit,
            proximity,
            volunteerSupply
          };

          // Raw donations require an explicitly supplied estimatedMeals
          // value before they can be compared with recipient meal demand.
          if (
            !Number.isFinite(donation.estimatedMeals) ||
            donation.estimatedMeals <= 0
          ) {
            matches.push({
              donation,
              recipient: {
                id: String(recipient._id),
                name: recipient.name
              },
              status: "incomplete",
              warning:
                "Raw-food meal equivalent is missing; add a validated estimatedMeals value."
            });
            continue;
          }

          const result = calculatePriority(features, DEFAULT_WEIGHTS);

          matches.push({
            donation,
            recipient: {
              id: String(recipient._id),
              name: recipient.name,
              city: recipient.city,
              state: recipient.state,
              unmetDemand: demand.deficit
            },
            distanceKm: Number(distance.toFixed(2)),
            nearbyVolunteers: nearbyVolunteers.length,
            status: "ranked",
            ...result
          });
        }
      }

      matches.sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === "ranked" ? -1 : 1;
        }

        return (b.score || 0) - (a.score || 0);
      });

      res.json({
        success: true,
        generatedAt: now,
        weights: DEFAULT_WEIGHTS,
        counts: {
          donations: donations.length,
          recipients: recipients.length,
          availableVolunteers: volunteers.length,
          rankedMatches: matches.filter(m => m.status === "ranked").length,
          incompleteMatches: matches.filter(m => m.status === "incomplete").length
        },
        matches
      });
    } catch (error) {
      console.error("Priority queue error:", error);
      res.status(500).json({
        success: false,
        message: "Unable to generate the priority queue."
      });
    }
  });

  
  // ---------- Recipient management ----------

  router.get("/recipients", async (req, res) => {
    try {
      const recipients = await Recipient.find()
        .sort({ createdAt: -1 })
        .lean();

      res.json({ success: true, recipients });
    } catch (error) {
      console.error("List recipients error:", error);
      res.status(500).json({
        success: false,
        message: "Unable to load recipients."
      });
    }
  });

  router.post("/recipients", async (req, res) => {
    try {
      const {
        name, city, state, address,
        dailyMealDemand, receivingCapacity
      } = req.body;

      if (
        !name?.trim() ||
        !city?.trim() ||
        !state?.trim() ||
        dailyMealDemand === undefined ||
        receivingCapacity === undefined
      ) {
        return res.status(400).json({
          success: false,
          message: "Name, city, state, daily meal demand, and receiving capacity are required."
        });
      }

      const demand = Number(dailyMealDemand);
      const capacity = Number(receivingCapacity);

      if (
        !Number.isFinite(demand) || demand < 0 ||
        !Number.isFinite(capacity) || capacity < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Demand and capacity must be non-negative numbers."
        });
      }

      const location = await geocoding.geocodeAddress(
        address, city, state
      );

      const recipient = await Recipient.create({
        name: name.trim(),
        city: city.trim(),
        state: state.trim(),
        address: address || "",
        location: {
          latitude: location.latitude,
          longitude: location.longitude
        },
        dailyMealDemand: demand,
        receivingCapacity: capacity,
        active: true
      });

      res.status(201).json({
        success: true,
        message: "Recipient registered successfully.",
        recipient
      });
    } catch (error) {
      console.error("Create recipient error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Unable to register recipient."
      });
    }
  });

  router.patch("/recipients/:id", async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid recipient ID."
        });
      }

      const allowed = [
        "name", "address", "dailyMealDemand",
        "mealsReceivedToday", "receivingCapacity", "active"
      ];

      const updates = {};

      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          updates[key] = req.body[key];
        }
      }

      for (const key of [
        "dailyMealDemand", "mealsReceivedToday", "receivingCapacity"
      ]) {
        if (updates[key] !== undefined) {
          updates[key] = Number(updates[key]);

          if (!Number.isFinite(updates[key]) || updates[key] < 0) {
            return res.status(400).json({
              success: false,
              message: key + " must be a non-negative number."
            });
          }
        }
      }

      if (updates.active !== undefined &&
          typeof updates.active !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "Active must be true or false."
        });
      }

      const recipient = await Recipient.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!recipient) {
        return res.status(404).json({
          success: false,
          message: "Recipient not found."
        });
      }

      res.json({
        success: true,
        message: "Recipient updated successfully.",
        recipient
      });
    } catch (error) {
      console.error("Update recipient error:", error);
      res.status(500).json({
        success: false,
        message: "Unable to update recipient."
      });
    }
  });


  // ---------- Volunteer management ----------

  router.get("/volunteers", async (req, res) => {
    try {
      const volunteers = await Volunteer.find()
        .sort({ createdAt: -1 })
        .lean();

      res.json({ success: true, volunteers });
    } catch (error) {
      console.error("List volunteers error:", error);
      res.status(500).json({
        success: false,
        message: "Unable to load volunteers."
      });
    }
  });

  router.post("/volunteers", async (req, res) => {
    try {
      const {
        name, city, state, address,
        coverageRadiusKm, carryingCapacity
      } = req.body;

      if (!name?.trim() || !city?.trim() || !state?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name, city, and state are required."
        });
      }

      const radius = Number(coverageRadiusKm ?? 10);
      const capacity = Number(carryingCapacity ?? 50);

      if (
        !Number.isFinite(radius) || radius < 0 ||
        !Number.isFinite(capacity) || capacity < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Coverage radius and carrying capacity must be non-negative numbers."
        });
      }

      const location = await geocoding.geocodeAddress(
        address, city, state
      );

      const volunteer = await Volunteer.create({
        name: name.trim(),
        city: city.trim(),
        state: state.trim(),
        location: {
          latitude: location.latitude,
          longitude: location.longitude
        },
        available: true,
        coverageRadiusKm: radius,
        carryingCapacity: capacity
      });

      res.status(201).json({
        success: true,
        message: "Volunteer registered successfully.",
        volunteer
      });
    } catch (error) {
      console.error("Create volunteer error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Unable to register volunteer."
      });
    }
  });

  router.patch("/volunteers/:id", async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid volunteer ID."
        });
      }

      const allowed = [
        "name", "address", "available",
        "coverageRadiusKm", "carryingCapacity"
      ];

      const updates = {};

      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          updates[key] = req.body[key];
        }
      }

      for (const key of ["coverageRadiusKm", "carryingCapacity"]) {
        if (updates[key] !== undefined) {
          updates[key] = Number(updates[key]);

          if (!Number.isFinite(updates[key]) || updates[key] < 0) {
            return res.status(400).json({
              success: false,
              message: key + " must be a non-negative number."
            });
          }
        }
      }

      if (updates.available !== undefined &&
          typeof updates.available !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "Available must be true or false."
        });
      }

      const volunteer = await Volunteer.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!volunteer) {
        return res.status(404).json({
          success: false,
          message: "Volunteer not found."
        });
      }

      res.json({
        success: true,
        message: "Volunteer updated successfully.",
        volunteer
      });
    } catch (error) {
      console.error("Update volunteer error:", error);
      res.status(500).json({
        success: false,
        message: "Unable to update volunteer."
      });
    }
  });


  return router;
};
