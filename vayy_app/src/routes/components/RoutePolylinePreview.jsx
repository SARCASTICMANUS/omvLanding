import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import VayyMap, { GeoJSONSource, Layer, Marker } from "../../shared/components/VayyMap";
import ZoomControls from "../../shared/components/common/ZoomControls";
import { toRouteGeoJSON } from "../services/dynamicRouteNormalizer";
import {
  getRouteEndpoints,
  getRoutePreviewBounds,
  getRoutePreviewCenter,
  getValidRouteCoordinates,
} from "./routePreviewUtils";

/**
 * Route polyline preview for a route CARD.
 *
 * Draws the generated route line (OSRM geometry from dynamic-preview) with the
 * existing VayyMap + GeoJSONSource + Layer primitives, plus the existing
 * ZoomControls. Nothing is invented: geometry, endpoint names and ids all come
 * from the normalised route object the card already receives.
 *
 * Intended to be mounted ONLY while its card is expanded. Both route lists keep a
 * single `expandedRouteId`, so at most ONE map exists at a time - which is what
 * keeps this viable inside a FlatList. Mounting a MapView per row would mean one
 * native GL surface per card, which is both a perf and a memory problem on
 * Android.
 *
 * `scrollEnabled={true}` maps to MapLibre's `dragPan`, so panning the map cannot
 * steal the FlatList's vertical scroll.
 */
export default function RoutePolylinePreview({
  route,
  height = 170,
  showEndpoints = true,
}) {
  const mapRef = useRef(null);
  const cameraRef = useRef(null);

  const geojson = useMemo(() => toRouteGeoJSON(route), [route]);
  const coordinates = useMemo(
    () => getValidRouteCoordinates(geojson?.coordinates),
    [geojson]
  );
  const endpoints = useMemo(() => getRouteEndpoints(route), [route]);
  const previewCenter = useMemo(
    () => getRoutePreviewCenter(route, coordinates),
    [route, coordinates]
  );
  const bounds = useMemo(
    () => getRoutePreviewBounds(coordinates, route),
    [coordinates, route]
  );
  const hasRouteLine = coordinates.length >= 2;

  const sourceId = useMemo(
    () => `routeLine-${route?.id ?? "x"}-${route?.route_id ?? "y"}`,
    [route?.id, route?.route_id]
  );

  useEffect(() => {
    if (!bounds) return undefined;
    let cancelled = false;

    // The camera mounts asynchronously, so retry briefly until the ref lands.
    const fit = (attempt = 0) => {
      if (cancelled) return;
      const map = mapRef.current;
      if (!map) {
        if (attempt < 12) setTimeout(() => fit(attempt + 1), 120);
        return;
      }
      map.fitBounds(bounds, { padding: 36 }, 0);
    };

    fit();
    return () => {
      cancelled = true;
    };
  }, [bounds]);

  // Keep the map visible when a route geometry is absent but real endpoint
  // coordinates exist. In that case show the endpoints without inventing a
  // straight-line route; only draw a line when actual route geometry is valid.
  if (!previewCenter) return null;

  // Honour the height prop supplied by the card; if the caller passes 0
  // we still render a minimal map so the touch area isn't zero.
  const mapHeight = height > 0 ? height : 170;

  const pickup = endpoints.pickup;
  const dropoff = endpoints.dropoff;
  const canMark = showEndpoints && Boolean(pickup);


  return (
    <View style={[styles.wrap, { height: mapHeight }]}>
      <VayyMap
        ref={mapRef}
        cameraRef={cameraRef}
        scrollEnabled={true}
        zoomEnabled
        style={styles.map}
        initialViewState={{
          center: previewCenter,
          zoom: 13,
        }}
      >
        {hasRouteLine ? (
          <>
            <GeoJSONSource id={sourceId} data={{ type: "LineString", coordinates }} />
            <Layer
              id={`${sourceId}-layer`}
              type="line"
              source={sourceId}
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": "#009849", "line-width": 4, "line-opacity": 0.9 }}
            />
          </>
        ) : null}
        {/* MapLibre RN v11 Marker takes `lngLat` (the pre-ride screens use the
            same prop); `coordinate` was the v10 name and is ignored here. */}
        {canMark ? (
          <Marker lngLat={[pickup.lng, pickup.lat]}>
            <View style={styles.pinPickup} />
          </Marker>
        ) : null}
        {showEndpoints && Number.isFinite(dropoff?.lat) && Number.isFinite(dropoff?.lng) ? (
          <Marker lngLat={[dropoff.lng, dropoff.lat]}>
            <View style={styles.pinDropoff} />
          </Marker>
        ) : null}
      </VayyMap>

      <ZoomControls
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
        style={styles.zoom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 12,
    position: "relative",
  },
  map: {
    flex: 1,
    backgroundColor: "#E8E8E8",
  },
  // ZoomControls ships bottom: 100 for a full-screen map; this is a card-sized
  // preview, so pin it to the corner of the card instead.
  zoom: {
    bottom: 10,
    right: 10,
    gap: 8,
  },
  pinPickup: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#009849",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  pinDropoff: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#F59E0B",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
});