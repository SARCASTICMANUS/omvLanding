export const formatFare = (value) => (typeof value === "number" ? `₹${value}` : value);
export const formatETA = (value) => (typeof value === "number" ? `${value} min` : value);
export const formatDistance = (value) => (typeof value === "number" ? `${value.toFixed(1)} km` : value);

// Seconds -> human readable "45 sec" / "12 min" / "1 hr 20 min".
export const formatWaitDuration = (seconds) => {
  const total = Math.max(1, Math.round(Number(seconds) || 0));
  if (total < 60) return `${total} sec`;
  if (total < 3600) return `${Math.ceil(total / 60)} min`;
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
};
