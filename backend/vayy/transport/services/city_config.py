"""Canonical fallback coordinates for configured service cities."""

CITY_DEFAULTS = {
    "lucknow": (26.8467, 80.9462, "Uttar Pradesh"),
    "noida": (28.5706333, 77.3272147, "Uttar Pradesh"),
    "delhi": (28.6139391, 77.2090239, "Delhi"),
}

# Keep coordinate-based fallback aligned with the mobile city's conservative
# centroid match; city centroids do not define a 100 km service boundary.
CITY_CENTROID_MATCH_RADIUS_M = 12_000
