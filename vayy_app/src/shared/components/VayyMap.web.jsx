import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
  useEffect,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";
import {
  Map as GlMap,
  Marker as GlMarker,
  Source as GlSource,
  Layer as GlLayer,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  transformStyleToGrayscale,
  convertInitialRegion,
  DEFAULT_CENTER,
  MAPTILER_STYLE,
} from "./mapUtils";

function flattenStyles(style) {
  if (!style) return {};
  return StyleSheet.flatten(style) || {};
}

function toLngLat(lngLat) {
  if (!lngLat) return [undefined, undefined];
  if (Array.isArray(lngLat)) return [lngLat[0], lngLat[1]];
  if (typeof lngLat === "object") {
    return [
      lngLat.lng ?? lngLat.longitude ?? lngLat.lon,
      lngLat.lat ?? lngLat.latitude,
    ];
  }
  return [undefined, undefined];
}

function toCenter(center) {
  if (!center) return [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude];
  const [lng, lat] = toLngLat(center);
  return [lng ?? DEFAULT_CENTER.longitude, lat ?? DEFAULT_CENTER.latitude];
}

function toGeoJSON(data, id) {
  if (!data) return data;
  if (data.type === "Feature" || data.type === "FeatureCollection") return data;
  if (Array.isArray(data)) {
    return {
      type: "Feature",
      id,
      properties: {},
      geometry: { type: "LineString", coordinates: data },
    };
  }
  if (data.type && data.coordinates) {
    return { type: "Feature", id, properties: data.properties || {}, geometry: data };
  }
  if (data.geometry && data.geometry.type) {
    return {
      type: "Feature",
      id,
      properties: data.properties || {},
      geometry: data.geometry,
    };
  }
  return data;
}

function GeoJSONSource({ id, data, children, ...rest }) {
  const normalized = toGeoJSON(data, id);
  if (!normalized) return null;
  return (
    <GlSource id={id} type="geojson" data={normalized} {...rest}>
      {children}
    </GlSource>
  );
}

function Layer(props) {
  return <GlLayer {...props} />;
}

function Marker({ lngLat, children, ...rest }) {
  const [lng, lat] = toLngLat(lngLat);
  if (lng == null || lat == null) return null;
  return (
    <GlMarker longitude={lng} latitude={lat} {...rest}>
      {children}
    </GlMarker>
  );
}

function ViewAnnotation({ lngLat, anchor, onSelect, children, ...rest }) {
  const [lng, lat] = toLngLat(lngLat);
  if (lng == null || lat == null) return null;
  return (
    <GlMarker
      longitude={lng}
      latitude={lat}
      anchor={anchor || "center"}
      onClick={(e) => {
        e?.originalEvent?.stopPropagation?.();
        if (onSelect) onSelect(e);
      }}
      {...rest}
    >
      {children}
    </GlMarker>
  );
}

function UserLocation({ visible = true, children, ...rest }) {
  const [position, setPosition] = useState(null);
  useEffect(() => {
    if (!visible || typeof navigator === "undefined" || !navigator.geolocation) {
      return undefined;
    }
    let watchId = null;
    const onPosition = (p) => {
      setPosition({ lng: p.coords.longitude, lat: p.coords.latitude });
    };
    try {
      navigator.geolocation.getCurrentPosition(onPosition, () => {}, {
        enableHighAccuracy: true,
      });
      watchId = navigator.geolocation.watchPosition(onPosition, () => {}, {
        enableHighAccuracy: true,
      });
    } catch {}
    return () => {
      if (watchId != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [visible]);
  if (!visible || !position) return null;
  return (
    <GlMarker longitude={position.lng} latitude={position.lat} anchor="center" {...rest}>
      <View style={styles.locationDot} />
    </GlMarker>
  );
}

function Camera() {
  return null;
}

function Images() {
  return null;
}

function Animated({ children }) {
  return children || null;
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
    children,
    ...rest
  },
  ref
) {
  const { onDidFinishLoadingMap, ...mapRest } = rest;
  const internalCameraRef = useRef(null);
  const activeCameraRef = cameraRef || internalCameraRef;
  const glMapRef = useRef(null);
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

  const glInstance = useCallback(() => {
    const r = glMapRef.current;
    if (!r) return null;
    return typeof r.getMap === "function" ? r.getMap() : r;
  }, []);

  const centerRef = useRef(null);
  const zoomRef = useRef(null);
  const pitchRef = useRef(null);
  const bearingRef = useRef(null);

  const animate = useCallback(
    (stop) => {
      const m = glInstance();
      if (!m) return;
      const opts = {};
      if (stop.center != null) opts.center = stop.center;
      if (stop.zoom != null) opts.zoom = stop.zoom;
      if (stop.bearing != null) opts.bearing = stop.bearing;
      if (stop.pitch != null) opts.pitch = stop.pitch;
      const duration = stop.duration || 0;
      if (duration > 0) {
        m.easeTo({ ...opts, duration, essential: true });
      } else {
        m.jumpTo(opts);
      }
    },
    [glInstance]
  );

  const fitBoundsImpl = useCallback(
    (bounds, paddingOrOptions, duration) => {
      if (!bounds || !Array.isArray(bounds) || bounds.length < 4) return;
      const [west, south, east, north] = bounds;
      let d = 500;
      let pad = {
        top: 80,
        right: 80,
        bottom: 80,
        left: 80,
      };
      if (typeof paddingOrOptions === "number") {
        d = paddingOrOptions;
      } else if (paddingOrOptions && typeof paddingOrOptions === "object") {
        if (paddingOrOptions.top != null || paddingOrOptions.paddingTop != null) {
          pad = {
            top: paddingOrOptions.top ?? paddingOrOptions.paddingTop ?? 80,
            right: paddingOrOptions.right ?? paddingOrOptions.paddingRight ?? 80,
            bottom: paddingOrOptions.bottom ?? paddingOrOptions.paddingBottom ?? 80,
            left: paddingOrOptions.left ?? paddingOrOptions.paddingLeft ?? 80,
          };
        } else if (paddingOrOptions.padding) {
          pad = {
            top: paddingOrOptions.padding.top ?? 80,
            right: paddingOrOptions.padding.right ?? 80,
            bottom: paddingOrOptions.padding.bottom ?? 80,
            left: paddingOrOptions.padding.left ?? 80,
          };
        }
        if (paddingOrOptions.duration) d = paddingOrOptions.duration;
      }
      if (typeof duration === "number") d = duration;
      const m = glInstance();
      if (!m) return;
      m.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: pad, duration: d, essential: true }
      );
    },
    [glInstance]
  );

  const cameraHandle = useRef({
    setStop: () => {},
    fitBounds: () => {},
  });

  cameraHandle.current.setStop = useCallback(
    (stop) => {
      if (!stop) return;
      const currentZoom = glInstance()?.getZoom() ?? zoomRef.current ?? 14;
      const currentPitch = glInstance()?.getPitch() ?? pitchRef.current ?? 0;
      const currentBearing = glInstance()?.getBearing() ?? bearingRef.current ?? 0;
      animate({
        center: stop.center || centerRef.current || [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude],
        zoom: stop.zoom ?? currentZoom,
        bearing: stop.bearing ?? stop.heading ?? currentBearing,
        pitch: stop.pitch ?? currentPitch,
        duration: stop.duration ?? 0,
      });
    },
    [animate, glInstance]
  );

  cameraHandle.current.fitBounds = fitBoundsImpl;

  useEffect(() => {
    const handle = cameraHandle.current;
    activeCameraRef.current = handle;
    return () => {
      if (!cameraRef && activeCameraRef.current === handle) {
        activeCameraRef.current = null;
      }
    };
  }, [activeCameraRef, cameraRef, cameraHandle]);

  const viewState =
    initialViewState ||
    convertInitialRegion(initialRegion) || {
      center: [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude],
      zoom: 14,
    };

  const center = toCenter(viewState.center);
  zoomRef.current = viewState.zoom ?? 14;
  bearingRef.current = viewState.bearing || 0;
  pitchRef.current = viewState.pitch || 0;
  centerRef.current = center;

  useImperativeHandle(ref, () => ({
    getZoom: async () => {
      try {
        return glInstance()?.getZoom() ?? zoomRef.current ?? 14;
      } catch {
        return zoomRef.current ?? 14;
      }
    },
    getCenter: async () => {
      try {
        const c = glInstance()?.getCenter();
        return c
          ? [c.lng, c.lat]
          : centerRef.current || [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude];
      } catch {
        return centerRef.current || [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude];
      }
    },
    getBearing: async () => {
      try {
        return glInstance()?.getBearing() ?? bearingRef.current ?? 0;
      } catch {
        return bearingRef.current ?? 0;
      }
    },
    getPitch: async () => {
      try {
        return glInstance()?.getPitch() ?? pitchRef.current ?? 0;
      } catch {
        return pitchRef.current ?? 0;
      }
    },
    zoomIn: (delta = 1, duration = 300) => {
      const base = glInstance()?.getZoom() ?? zoomRef.current ?? 14;
      animate({
        center: centerRef.current || [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude],
        zoom: Math.min(base + delta, 22),
        duration,
      });
    },
    zoomOut: (delta = 1, duration = 300) => {
      const base = glInstance()?.getZoom() ?? zoomRef.current ?? 14;
      animate({
        center: centerRef.current || [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude],
        zoom: Math.max(base - delta, 2),
        duration,
      });
    },
    fitBounds: fitBoundsImpl,
    setCamera: (stop) => {
      if (!stop) return;
      const currentZoom = glInstance()?.getZoom() ?? zoomRef.current ?? 14;
      const currentPitch = glInstance()?.getPitch() ?? pitchRef.current ?? 0;
      const currentBearing = glInstance()?.getBearing() ?? bearingRef.current ?? 0;
      animate({
        center: stop.center || centerRef.current || [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude],
        zoom: stop.zoom ?? currentZoom,
        bearing: stop.bearing ?? stop.heading ?? currentBearing,
        pitch: stop.pitch ?? currentPitch,
        duration: stop.duration ?? 500,
      });
    },
  }));

  const handlePress = useCallback(
    (event) => {
      if (onPress) {
        const lngLat = event?.lngLat;
        onPress({
          nativeEvent: {
            coordinate: lngLat
              ? { latitude: lngLat.lat, longitude: lngLat.lng }
              : undefined,
            lngLat: lngLat ? [lngLat.lng, lngLat.lat] : undefined,
          },
        });
      }
    },
    [onPress]
  );

  const handleLoad = useCallback(
    (event) => {
      const m = glInstance();
      if (m) {
        const zoom = m.getZoom();
        const c = m.getCenter();
        if (zoom != null) zoomRef.current = zoom;
        if (c) centerRef.current = [c.lng, c.lat];
      }
      if (onDidFinishLoadingMap) onDidFinishLoadingMap(event);
    },
    [glInstance, onDidFinishLoadingMap]
  );

  const mergedStyle = flattenStyles([styles.map, style]);
  const containerStyle = { ...mergedStyle };

  return (
    <View style={containerStyle}>
      <GlMap
        ref={glMapRef}
        initialViewState={{
          longitude: center[0],
          latitude: center[1],
          zoom: viewState.zoom ?? 14,
          pitch: viewState.pitch ?? 0,
          bearing: viewState.bearing ?? 0,
        }}
        style={styles.fill}
        mapStyle={grayscaleStyle || MAPTILER_STYLE}
        dragPan={scrollEnabled}
        scrollZoom={zoomEnabled}
        boxZoom={zoomEnabled}
        doubleClickZoom={zoomEnabled}
        touchPitch={pitchEnabled}
        touchZoomRotate={rotateEnabled}
        keyboard={false}
        onClick={handlePress}
        onLoad={handleLoad}
        {...mapRest}
      >
        {children}
      </GlMap>
    </View>
  );
});

const styles = StyleSheet.create({
  map: {
    flex: 1,
    backgroundColor: "#E8E8E8",
  },
  fill: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  locationDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#1D6BF3",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    boxShadow: "0 0 6px rgba(0, 0, 0, 0.35)",
  },
});

export default VayyMap;
export { ViewAnnotation, GeoJSONSource, Layer, Marker, UserLocation, Camera, Images, Animated };