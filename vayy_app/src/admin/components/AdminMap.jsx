import React, { useEffect, useRef, useState } from "react";
import VayyMap, { ViewAnnotation, GeoJSONSource, Layer } from "../../shared/components/VayyMap";
import { View, StyleSheet } from "react-native";
import ZoomControls from "../../shared/components/common/ZoomControls";

const AdminMap = ({ onRouteChange }) => {
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [stops, setStops] = useState([]);
  const mapRef = useRef(null);
  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  useEffect(() => {
    onRouteChange({ startPoint, endPoint, stops });
  }, [startPoint, endPoint, stops, onRouteChange]);

  const handleMapPress = (e) => {
    const coord = e.nativeEvent.lngLat;

    if (!startPoint) {
      setStartPoint(coord);
    } else if (!endPoint) {
      setEndPoint(coord);
    } else {
      setStops([...stops, coord]);
    }
  };

  const toCoord = (p) => p ? [p[0], p[1]] : null;

  return (
    <View style={styles.container}>
      <VayyMap ref={mapRef} style={styles.map} onPress={handleMapPress}>
        {startPoint && (
          <ViewAnnotation id="start" lngLat={toCoord(startPoint)} anchor="center">
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "#009849", borderWidth: 2, borderColor: "#fff" }} />
          </ViewAnnotation>
        )}
        {endPoint && (
          <ViewAnnotation id="end" lngLat={toCoord(endPoint)} anchor="center">
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "#EF4444", borderWidth: 2, borderColor: "#fff" }} />
          </ViewAnnotation>
        )}

        {stops.map((stop, index) => (
          <ViewAnnotation
            key={`stop-${index}`}
            id={`stop-${index}`}
            lngLat={toCoord(stop)}
            anchor="center"
          >
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#F59E0B", borderWidth: 2, borderColor: "#fff" }} />
          </ViewAnnotation>
        ))}

        {(startPoint && endPoint) && (
          <GeoJSONSource
            id="route-line"
            data={{
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  toCoord(startPoint),
                  ...stops.map((s) => toCoord(s)),
                  toCoord(endPoint),
                ],
              },
            }}
          >
            <Layer
              id="route-line-layer"
              type="line"
              paint={{
                "line-color": "blue",
                "line-width": 4,
                "line-cap": "round",
                "line-join": "round",
              }}
            />
          </GeoJSONSource>
        )}
      </VayyMap>
      <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} />
    </View>
  );
};

export default AdminMap;

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});