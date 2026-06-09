export const formatFare = (value) => (typeof value === "number" ? `₹${value}` : value);
export const formatETA = (value) => (typeof value === "number" ? `${value} min` : value);
export const formatDistance = (value) => (typeof value === "number" ? `${value.toFixed(1)} km` : value);
