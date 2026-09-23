import React, { forwardRef, useImperativeHandle, useRef, useCallback, useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import {
  transformStyleToGrayscale,
  convertInitialRegion,
  DEFAULT_CENTER,
  MAPTILER_STYLE,
} from "./mapUtils";
import {
  Map,
  Camera,
  ViewAnnotation,
  GeoJSONSource,
  Layer,
  Marker,
  UserLocation,
  Images,
  Animated,
} from "@maplibre/maplibre-react-native";

const VayyMap = forwardRef(function VayyMap(
  {
    style,
    initialRegion,
    initialViewState,
    scrollEnabled = true,
    zoomEnabled = true,
    pitchEnabled = true,
    rotateEnabled = true,
    zoomControlEnabled,
    grayscale = false,
    onPress,
    cameraRef,
    mapRef: mapRefProp,
    children,
    ...rest
  },
  ref
) {
  const internalMapRef = useRef(null);
  const internalCameraRef = useRef(null);
  const activeMapRef = mapRefProp || internalMapRef;
  const activeCameraRef = cameraRef || internalCameraRef;
  const [grayscaleStyle, setGrayscaleStyle] = useState(null);

  useEffect(() => {
    if (!grayscale) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(MAPTILER_STYLE);
        const style = await res.json();
        if (cancelled) return;
        setGrayscaleStyle(transformStyleToGrayscale(style));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [grayscale]);

  const viewState =
    initialViewState ||
    convertInitialRegion(initialRegion) || {
      center: [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude],
      zoom: 14,
    };

  useImperativeHandle(ref, () => ({
    getZoom: async () => {
      try {
        return await activeMapRef.current?.getZoom();
      } catch {
        return 14;
      }
    },
    getCenter: async () => {
      try {
        return await activeMapRef.current?.getCenter();
      } catch {
        return [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude];
      }
    },
    zoomIn: async (delta = 1, duration = 300) => {
      try {
        const zoom = await activeMapRef.current?.getZoom();
        const center = await activeMapRef.current?.getCenter();
        const pitch = await activeMapRef.current?.getPitch();
        const heading = await activeMapRef.current?.getBearing();
        activeCameraRef.current?.setStop({
          center: center || [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude],
          zoom: Math.min((zoom || 14) + delta, 22),
          bearing: heading || 0,
          duration,
        });
      } catch {}
    },
    zoomOut: async (delta = 1, duration = 300) => {
      try {
        const zoom = await activeMapRef.current?.getZoom();
        const center = await activeMapRef.current?.getCenter();
        const pitch = await activeMapRef.current?.getPitch();
        const heading = await activeMapRef.current?.getBearing();
        activeCameraRef.current?.setStop({
          center: center || [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude],
          zoom: Math.max((zoom || 14) - delta, 2),
          bearing: heading || 0,
          duration,
        });
      } catch {}
    },
    fitBounds: (bounds, paddingOrOptions, duration) => {
      if (!bounds || !Array.isArray(bounds) || bounds.length < 4) return;
      const [west, south, east, north] = bounds;
      let d = 500;
      let pad = {
        paddingTop: 80,
        paddingRight: 80,
        paddingBottom: 80,
        paddingLeft: 80,
      };
      if (typeof paddingOrOptions === "number") {
        d = paddingOrOptions;
      } else if (paddingOrOptions && typeof paddingOrOptions === "object") {
        if (paddingOrOptions.top != null || paddingOrOptions.paddingTop != null) {
          pad = {
            paddingTop: paddingOrOptions.top ?? paddingOrOptions.paddingTop ?? 80,
            paddingRight: paddingOrOptions.right ?? paddingOrOptions.paddingRight ?? 80,
            paddingBottom: paddingOrOptions.bottom ?? paddingOrOptions.paddingBottom ?? 80,
            paddingLeft: paddingOrOptions.left ?? paddingOrOptions.paddingLeft ?? 80,
          };
        } else if (paddingOrOptions.padding) {
          pad = {
            paddingTop: paddingOrOptions.padding.top ?? 80,
            paddingRight: paddingOrOptions.padding.right ?? 80,
            paddingBottom: paddingOrOptions.padding.bottom ?? 80,
            paddingLeft: paddingOrOptions.padding.left ?? 80,
          };
        }
        if (paddingOrOptions.duration) d = paddingOrOptions.duration;
      }
      if (typeof duration === "number") d = duration;
      activeCameraRef.current?.fitBounds(
        [west, south, east, north],
        pad,
        d
      );
    },
    setCamera: (stop) => {
      if (!stop) return;
      const center = stop.center || [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude];
      const zoom = stop.zoom || 14;
      activeCameraRef.current?.setStop({
        center,
        zoom,
        bearing: stop.bearing ?? stop.heading ?? 0,
        pitch: stop.pitch ?? 0,
        duration: stop.duration ?? 500,
      });
    },
    getBearing: async () => {
      try {
        return await activeMapRef.current?.getBearing();
      } catch {
        return 0;
      }
    },
    getPitch: async () => {
      try {
        return await activeMapRef.current?.getPitch();
      } catch {
        return 0;
      }
    },
  }));

  const handlePress = useCallback(
    (event) => {
      if (onPress) {
        const geometry = event?.geometry;
        const coords = geometry?.coordinates;
        onPress({
          nativeEvent: {
            coordinate: coords
              ? { latitude: coords[1], longitude: coords[0] }
              : undefined,
            lngLat: coords ? [coords[0], coords[1]] : undefined,
          },
        });
      }
    },
    [onPress]
  );

  return (
    <Map
      ref={activeMapRef}
      style={[styles.map, style]}
      mapStyle={grayscaleStyle || MAPTILER_STYLE}
      dragPan={scrollEnabled}
      touchZoom={zoomEnabled}
      touchPitch={pitchEnabled}
      touchRotate={rotateEnabled}
      onPress={handlePress}
      scaleBar={false}
      {...rest}
    >
      <Camera
        ref={activeCameraRef}
        initialViewState={viewState}
      />
      {children}
    </Map>
  );
});

const styles = StyleSheet.create({
  map: {
    flex: 1,
    backgroundColor: "#E8E8E8",
  },
});

export default VayyMap;
export { ViewAnnotation, GeoJSONSource, Layer, Marker, UserLocation, Camera, Images, Animated };
