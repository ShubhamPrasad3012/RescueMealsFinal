
const DEFAULT_WEIGHTS = Object.freeze({
  urgency: 0.35,
  demand: 0.20,
  quantityFit: 0.15,
  proximity: 0.20,
  volunteerSupply: 0.10
});

const FEATURE_KEYS = Object.keys(DEFAULT_WEIGHTS);

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function validateWeights(weights) {
  if (!weights || typeof weights !== "object") {
    throw new Error("Weights must be an object");
  }

  const sum = FEATURE_KEYS.reduce((total, key) => {
    const value = weights[key];

    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value > 1
    ) {
      throw new Error(`Invalid weight: ${key}`);
    }

    return total + value;
  }, 0);

  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error("Priority weights must sum to 1");
  }
}

function validateFeatures(features) {
  if (!features || typeof features !== "object") {
    throw new Error("Features must be an object");
  }

  for (const key of FEATURE_KEYS) {
    const value = features[key];

    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value > 1
    ) {
      throw new Error(
        `Feature "${key}" must be a number between 0 and 1`
      );
    }
  }
}

// U(d): urgency increases as the expiry deadline approaches.
// safeWindowHours is a configurable scoring window, not a
// food-safety guarantee.
function calculateUrgency(
  expiryDate,
  safeWindowHours,
  now = new Date()
) {
  if (
    expiryDate == null ||
    expiryDate === ""
  ) {
    return {
      value: null,
      expired: false,
      expiryUnknown: true
    };
  }

  const expiry = new Date(expiryDate);

  if (
    Number.isNaN(expiry.getTime()) ||
    !(now instanceof Date) ||
    Number.isNaN(now.getTime()) ||
    !Number.isFinite(safeWindowHours) ||
    safeWindowHours <= 0
  ) {
    return {
      value: null,
      expired: false,
      expiryUnknown: true
    };
  }

  const remainingHours =
    (expiry.getTime() - now.getTime()) / 3600000;

  if (remainingHours <= 0) {
    return {
      value: 0,
      expired: true,
      expiryUnknown: false
    };
  }

  return {
    value: clamp(
      1 - remainingHours / safeWindowHours
    ),
    expired: false,
    expiryUnknown: false
  };
}

// D(r): unmet demand normalized against the largest
// unmet demand among active recipients.
function calculateDemand(
  dailyMealDemand,
  mealsReceivedToday,
  maxDeficit
) {
  const demand = Number(dailyMealDemand);
  const received = Number(mealsReceivedToday);

  if (
    !Number.isFinite(demand) ||
    !Number.isFinite(received) ||
    demand < 0 ||
    received < 0
  ) {
    throw new Error("Invalid recipient demand data");
  }

  const deficit = Math.max(0, demand - received);

  if (!Number.isFinite(maxDeficit) || maxDeficit < 0) {
    throw new Error("Invalid maximum demand deficit");
  }

  return {
    deficit,
    value:
      maxDeficit > 0
        ? clamp(deficit / maxDeficit)
        : 0
  };
}

// Q(d,r): how well a donation's meal-equivalent quantity
// fits the recipient's target quantity.
// Both inputs must use the same unit.
function calculateQuantityFit(
  donationMeals,
  recipientCapacity
) {
  if (
    !Number.isFinite(donationMeals) ||
    !Number.isFinite(recipientCapacity) ||
    donationMeals < 0 ||
    recipientCapacity < 0
  ) {
    throw new Error("Invalid quantity-fit inputs");
  }

  const denominator = Math.max(
    donationMeals,
    recipientCapacity
  );

  if (denominator === 0) return 0;

  return clamp(
    1 -
      Math.abs(donationMeals - recipientCapacity) /
        denominator
  );
}

// X(d,r): proximity based on straight-line distance.
// This does not calculate actual road travel distance.
function calculateProximity(
  distanceKm,
  maxDistanceKm
) {
  if (
    !Number.isFinite(distanceKm) ||
    !Number.isFinite(maxDistanceKm) ||
    distanceKm < 0 ||
    maxDistanceKm <= 0
  ) {
    return null;
  }

  return clamp(1 - distanceKm / maxDistanceKm);
}

// V(d): volunteer scarcity relative to the expected
// number of available volunteers for the area.
function calculateVolunteerSupply(
  availableVolunteers,
  expectedCoverage
) {
  if (
    !Number.isFinite(availableVolunteers) ||
    !Number.isFinite(expectedCoverage) ||
    availableVolunteers < 0 ||
    expectedCoverage <= 0
  ) {
    return null;
  }

  return clamp(
    1 - availableVolunteers / expectedCoverage
  );
}

// Calculate a score only when all five factors are valid.
// Missing data must be handled before this function is called.
function calculatePriority(
  features,
  weights = DEFAULT_WEIGHTS
) {
  validateWeights(weights);
  validateFeatures(features);

  const contributions = {};

  for (const key of FEATURE_KEYS) {
    contributions[key] =
      features[key] * weights[key];
  }

  const score = Object.values(contributions).reduce(
    (total, value) => total + value,
    0
  );

  const strongestFactor = FEATURE_KEYS.reduce(
    (best, key) =>
      contributions[key] > contributions[best]
        ? key
        : best,
    FEATURE_KEYS[0]
  );

  return {
    score: Number(score.toFixed(4)),
    level:
      score >= 0.70
        ? "HIGH"
        : score >= 0.40
          ? "MEDIUM"
          : "NORMAL",
    strongestFactor,
    contributions,
    features: { ...features },
    weights: { ...weights }
  };
}

module.exports = {
  DEFAULT_WEIGHTS,
  FEATURE_KEYS,
  clamp,
  calculateUrgency,
  calculateDemand,
  calculateQuantityFit,
  calculateProximity,
  calculateVolunteerSupply,
  calculatePriority
};
