export const normalizeApiError = (error, fallbackMessage) => {
  const data = error?.response?.data;
  if (data) {
    if (typeof data === "string") return new Error(data);
    if (data.message) return new Error(data.message);
    if (data.detail) return new Error(data.detail);
    if (data.error) return new Error(data.error);
    const firstValue = Object.values(data)[0];
    if (Array.isArray(firstValue) && firstValue.length) return new Error(firstValue[0]);
    if (typeof firstValue === "string") return new Error(firstValue);
  }
  return new Error(error?.message || fallbackMessage || "An unexpected error occurred");
};
