import React, { forwardRef, useImperativeHandle, useRef, useCallback, useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { DEFAULT_CENTER } from "../../constants/mapConfig";
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

const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_API_KEY || "VHJ2bQbYo88r3CZHiOKU";
const MAPTILER_STYLE = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;

function hexToGray(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 4) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 && h.length !== 8) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? h.slice(6, 8) : "";
  const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  return `#${[y, y, y].map((v) => v.toString(16).padStart(2, "0")).join("")}${a}`;
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

const NAMED_COLORS = {
  white: [255, 255, 255],
  black: [0, 0, 0],
  grey: [128, 128, 128],
  gray: [128, 128, 128],
  silver: [192, 192, 192],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  yellow: [255, 255, 0],
  orange: [255, 165, 0],
  purple: [128, 0, 128],
  pink: [255, 192, 203],
  brown: [165, 42, 42],
  cyan: [0, 255, 255],
  transparent: [0, 0, 0],
};

function grayCss(r, g, b, a) {
  const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  if (a == null) return `rgb(${y},${y},${y})`;
  return `rgba(${y},${y},${y},${a})`;
}

function toGrayColor(value) {
  if (typeof value !== "string") return value;
  const hexMatch = value.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) return hexToGray(value) || value;
  const rgbMatch = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const p = rgbMatch[1].split(",").map((x) => parseFloat(x.trim()));
    return grayCss(p[0] || 0, p[1] || 0, p[2] || 0, p.length >= 4 ? p[3] : undefined);
  }
  const hslMatch = value.match(/^hsla?\(([^)]+)\)$/i);
  if (hslMatch) {
    const p = hslMatch[1].split(",").map((x) => parseFloat(x.trim()));
    const [r, g, b] = hslToRgb(p[0] || 0, (p[1] || 0) / 100, (p[2] || 0) / 100);
    return grayCss(r, g, b, p.length >= 4 ? p[3] : undefined);
  }
  const named = NAMED_COLORS[value.toLowerCase()];
  if (named) return grayCss(named[0], named[1], named[2], undefined);
  return value;
}

function grayscaleWalk(value) {
  if (typeof value === "string") return toGrayColor(value);
  if (Array.isArray(value)) return value.map(grayscaleWalk);
  if (value && typeof value === "object") {
    const out = {};
    Object.keys(value).forEach((k) => { out[k] = grayscaleWalk(value[k]); });
    return out;
  }
  return value;
}

const ROAD_LAYERS = new Set([
  "Tunnel",
  "Tunnel outline",
  "Minor road outline",
  "Major road outline",
  "Highway outline",
  "Road under construction",
  "Minor road",
  "Major road",
  "Highway",
  "Pier road",
  "Bridge outline",
  "Bridge",
  "Footway tunnel outline",
  "Footway tunnel",
  "Road labels",
  "Highway junction",
  "Highway shield",
  "Highway shield (US)",
  "Highway shield interstate top (US)",
  "Highway shield interstate (US)",
  "Oneway",
]);

function transformStyleToGrayscale(style) {
  if (!style || typeof style !== "object") return style;
  const layers = style.layers;
  if (!Array.isArray(layers)) return grayscaleWalk(style);
  layers.forEach((layer) => {
    if (!layer || !layer.paint) return;
    if (ROAD_LAYERS.has(layer.id)) return;
    layer.paint = grayscaleWalk(layer.paint);
  });
  return style;
}

function convertInitialRegion(region) {
  if (!region) return undefined;
  const { latitude, longitude, latitudeDelta } = region;
  const zoom = latitudeDelta
    ? Math.round(14 - Math.log2(((latitudeDelta || 0.05) * 111) / 2))
    : 14;
  return {
    center: [longitude || DEFAULT_CENTER.longitude, latitude || DEFAULT_CENTER.latitude],
    zoom,
  };
}

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
