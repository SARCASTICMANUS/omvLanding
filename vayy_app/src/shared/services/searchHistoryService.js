import api from "../lib/api";
import { AUTH } from "../../constants";

/**
 * Fetch recent searches for the current user (from Redis, fallback DB).
 * Returns top 10 most recent searches.
 */
export const getRecentSearches = async () => {
  try {
    const response = await api.get(AUTH.recentSearches);
    const data = response.data?.data || response.data;
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to fetch recent searches:", error);
    return [];
  }
};

/**
 * Save a recent search for the current user.
 * Deduplicates by pickup+destination lat/lon.
 * Stored in Redis (48h TTL) and persisted to DB if unique.
 */
export const saveRecentSearch = async (searchData) => {
  try {
    await api.post(AUTH.recentSearches, searchData);
  } catch (error) {
    console.error("Failed to save recent search:", error);
  }
};
