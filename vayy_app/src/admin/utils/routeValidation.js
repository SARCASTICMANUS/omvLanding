export const validateRoute = (route) => {
  const errors = {};

  if (!route.name || route.name.length < 3) {
    errors.name = "Route name must be at least 3 characters";
  }

  if (!route.stops || route.stops.length < 2) {
    errors.stops = "At least 2 stops required";
  }

  return errors;
};

export const validateStop = (stop) => {
  const errors = {};

  if (!stop.name) {
    errors.name = "Stop name required";
  }

  if (!stop.latitude || !stop.longitude) {
    errors.location = "Location required";
  }

  return errors;
};