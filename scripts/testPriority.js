
const {
  DEFAULT_WEIGHTS,
  calculateUrgency,
  calculateDemand,
  calculateQuantityFit,
  calculateProximity,
  calculateVolunteerSupply,
  calculatePriority
} = require("../utils/priority");

const now = new Date();

// Example values for testing only.
const urgency = calculateUrgency(
  new Date(now.getTime() + 2 * 3600000),
  8,
  now
);

const demand = calculateDemand(200, 80, 200);

const features = {
  urgency: urgency.value,
  demand: demand.value,
  quantityFit: calculateQuantityFit(40, 50),
  proximity: calculateProximity(2, 20),
  volunteerSupply: calculateVolunteerSupply(2, 5)
};

const result = calculatePriority(features, DEFAULT_WEIGHTS);

console.log("Features:", features);
console.log("Priority result:", result);
