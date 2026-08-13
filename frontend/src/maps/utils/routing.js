import axios from "axios";
import { decodePolyline } from "./geo";

const OSRM_HOST = "http://localhost:5000"; // Assuming OSRM walking profile is running here

export const getWalkingRoute = async (start, end) => {
  const url = `${OSRM_HOST}/route/v1/foot/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=polyline`;
  try {
    const response = await axios.get(url);
    if (response.data.code === "Ok" && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      const coords = decodePolyline(route.geometry);
      return {
        distance: route.distance, // in meters
        geometry: coords.map(([lat, lon]) => [lon, lat]), // GeoJSON needs [lon, lat]
      };
    }
  } catch (error) {
    console.error("OSRM Routing error:", error);
  }
  return null;
};
