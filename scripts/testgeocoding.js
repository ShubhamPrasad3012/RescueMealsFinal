
const {
  geocodeAddress,
  calculateDistance
} = require("../utils/geocoding");

async function main() {
  const vellore = await geocodeAddress(
    "Vellore",
    "Vellore",
    "Tamil Nadu"
  );

  console.log("Vellore location:", vellore);

  const chennai = await geocodeAddress(
    "Chennai",
    "Chennai",
    "Tamil Nadu"
  );

  console.log(
    "Distance between city centres:",
    calculateDistance(
      vellore.latitude,
      vellore.longitude,
      chennai.latitude,
      chennai.longitude
    ).toFixed(2),
    "km"
  );
}

main().catch(console.error);
