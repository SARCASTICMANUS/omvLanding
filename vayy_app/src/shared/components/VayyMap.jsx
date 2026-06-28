import React, { forwardRef, useImperativeHandle, useRef, useCallback } from "react";
import { StyleSheet } from "react-native";
import { Map, Camera, ViewAnnotation, GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";

const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_API_KEY || "VHJ2bQbYo88r3CZHiOKU";
const MAPTILER_STYLE = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;

function zoomToDelta(zoom) {
  const lngDelta = 360 / Math.pow(2, zoom);
  const latDelta = lngDelta * Math.abs(Math.cos((26.8467 * Math.PI) / 180));
  return { latitudeDelta: latDelta, longitudeDelta: lngDelta };
}

function deltaToZoom(latDelta) {
  return Math.round(14 - Math.log2((latDelta || 0.05) * 111 / 2));
}

function initialViewStateFromProps(props) {
  if (props.center && Array.isArray(props.center)) {
    return {
      center: props.center,
      zoomLevel: props.zoom || 14,
      pitch: props.pitch || 0,
      heading: props.heading || 0,
    };
  }
  if (props.center && typeof props.center === "object" && props.center.latitude != null) {
    const zoom = props.center.latitudeDelta
      ? Math.round(14 - Math.log2((props.center.latitudeDelta || 0.05) * 111 / 2))
      : 14;
    return {
      center: [props.center.longitude || 80.9462, props.center.latitude || 26.8467],
      zoomLevel: zoom,
      pitch: 0,
      heading: 0,
    };
  }
  if (props.initialViewState) {
    const [lon, lat] = props.initialViewState.center || [80.9462, 26.8467];
    return {
      center: [lon, lat],
      zoomLevel: props.initialViewState.zoom || 14,
      pitch: props.initialViewState.pitch || 0,
      heading: props.initialViewState.heading || 0,
    };
  }
  return undefined;
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
    onPress,
    cameraRef,
    children,
    ...rest
  },
  ref
) {
  const mapRef = useRef(null);
  const cameraRefInternal = useRef(null);
  const activeCameraRef = cameraRef || cameraRefInternal;

  const viewState = initialViewStateFromProps({ center: initialRegion, initialViewState, zoom: initialViewState?.zoom, pitch: initialViewState?.pitch, heading: initialViewState?.heading });

  useImperativeHandle(ref, () => ({
    getZoom: async () => {
      try {
        return await mapRef.current?.getZoom();
      } catch {
        return 14;
      }
    },
    zoomIn: async (delta = 1, duration = 300) => {
      try {
        const zoom = await mapRef.current?.getZoom();
        const center = await mapRef.current?.getCenter();
        const pitch = await mapRef.current?.getPitch();
        const bearing = await mapRef.current?.getBearing();
        activeCameraRef.current?.setStop({
          center,
          zoom: Math.min((zoom || 14) + delta, 22),
          pitch: pitch || 0,
          heading: bearing || 0,
          duration,
        });
      } catch {}
    },
    zoomOut: async (delta = 1, duration = 300) => {
      try {
        const zoom = await mapRef.current?.getZoom();
        const center = await mapRef.current?.getCenter();
        const pitch = await mapRef.current?.getPitch();
        const bearing = await mapRef.current?.getBearing();
        activeCameraRef.current?.setStop({
          center,
          zoom: Math.max((zoom || 14) - delta, 2),
          pitch: pitch || 0,
          heading: bearing || 0,
          duration,
        });
      } catch {}
    },
    fitBounds: (bounds, paddingOrOptions, duration) => {
      if (!bounds || !Array.isArray(bounds) || bounds.length < 4) return;
      const [west, south, east, north] = bounds;

      let d = 500;
      let pad = { paddingTop: 80, paddingRight: 80, paddingBottom: 80, paddingLeft: 80 };

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
        { top: pad.paddingTop, right: pad.paddingRight, bottom: pad.paddingBottom, left: pad.paddingLeft },
        d
      );
    },
    setCamera: (stop) => {
      if (!stop) return;
      const center = stop.center || [80.9462, 26.8467];
      const zoom = stop.zoom || 14;
      activeCameraRef.current?.setStop({
        center,
        zoom,
        pitch: stop.pitch || 0,
        heading: stop.heading || 0,
        duration: stop.duration || 500,
      });
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
            lngLat: coords
              ? [coords[0], coords[1]]
              : undefined,
          },
        });
      }
    },
    [onPress]
  );

  return (
    <Map
      ref={mapRef}
      style={[styles.map, style]}
      mapStyle={MAPTILER_STYLE}
      scrollEnabled={scrollEnabled}
      zoomEnabled={zoomEnabled}
      touchPitch={pitchEnabled}
      touchRotate={rotateEnabled}
      onPress={handlePress}
      attribution={false}
      logo={false}
      compass={false}
      scaleBar={false}
      {...rest}
    >
      {viewState && (
        <Camera
          ref={activeCameraRef}
          initialViewState={{
            center: viewState.center,
            zoom: viewState.zoomLevel,
            pitch: viewState.pitch,
            heading: viewState.heading,
          }}
          animationDuration={500}
        />
      )}
      {children}
    </Map>
  );
});

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});

export default VayyMap;
export { ViewAnnotation, GeoJSONSource, Layer };
