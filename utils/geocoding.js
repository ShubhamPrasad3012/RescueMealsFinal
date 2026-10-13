
const CITY_COORDINATES = {
  "vellore, tamil nadu": {
    latitude: 12.9165,
    longitude: 79.1325
  },
  "chennai, tamil nadu": {
    latitude: 13.0827,
    longitude: 80.2707
  },
  "bengaluru, karnataka": {
    latitude: 12.9716,
    longitude: 77.5946
  },
  "bangalore, karnataka": {
    latitude: 12.9716,
    longitude: 77.5946
  },
  "hyderabad, telangana": {
    latitude: 17.3850,
    longitude: 78.4867
  },
  "mumbai, maharashtra": {
    latitude: 19.0760,
    longitude: 72.8777
  },
  "new delhi, delhi": {
    latitude: 28.6139,
    longitude: 77.2090
  }
};

function geocodeAddress(address, city, state) {
  return new Promise((resolve, reject) => {
    if (!city || !state) {
      return reject(
        new Error("City and state are required for location lookup")
      );
    }

    const key = `${city.trim()}, ${state.trim()}`.toLowerCase();
    const coordinates = CITY_COORDINATES[key];

    if (!coordinates) {
      return reject(
        new Error(
          `No approximate coordinates configured for ${city}, ${state}`
        )
      );
    }

    resolve({
      ...coordinates,
      formattedAddress: address || `${city}, ${state}`,
      precision: "city-centre"
    });
  });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const values = [lat1, lon1, lat2, lon2].map(Number);

  if (!values.every(Number.isFinite)) {
    throw new Error("Valid coordinates are required");
  }

  const [latitude1, longitude1, latitude2, longitude2] = values;

  if (
    Math.abs(latitude1) > 90 ||
    Math.abs(latitude2) > 90 ||
    Math.abs(longitude1) > 180 ||
    Math.abs(longitude2) > 180
  ) {
    throw new Error("Coordinates are outside valid ranges");
  }

  const radians = degrees => degrees * Math.PI / 180;
  const dLat = radians(latitude2 - latitude1);
  const dLon = radians(longitude2 - longitude1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(latitude1)) *
    Math.cos(radians(latitude2)) *
    Math.sin(dLon / 2) ** 2;

  return 6371 * 2 * Math.atan2(
    Math.sqrt(a),
    Math.sqrt(1 - a)
  );
}

function findNearbyDonations(
  userLocation,
  donations,
  maxDistance = 10
) {
  if (
    !userLocation ||
    !Number.isFinite(Number(userLocation.latitude)) ||
    !Number.isFinite(Number(userLocation.longitude))
  ) {
    return [];
  }

  return donations
    .filter(donation => donation.location)
    .map(donation => {
      const location = donation.location.type || donation.location;

      if (
        !Number.isFinite(Number(location.latitude)) ||
        !Number.isFinite(Number(location.longitude))
      ) {
        return null;
      }

      const distance = calculateDistance(
        Number(userLocation.latitude),
        Number(userLocation.longitude),
        Number(location.latitude),
        Number(location.longitude)
      );

      return {
        ...donation,
        distance: Number(distance.toFixed(2))
      };
    })
    .filter(donation =>
      donation !== null && donation.distance <= maxDistance
    )
    .sort((a, b) => a.distance - b.distance);
}

module.exports = {
  geocodeAddress,
  calculateDistance,
  findNearbyDonations
};
