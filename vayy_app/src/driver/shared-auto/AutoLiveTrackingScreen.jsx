import React, { useEffect, useRef, useState, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { useDispatch } from "react-redux";
import { startDispatchTrip, completeDispatch } from "../../store/slices/dispatchSlice";
import useWebSocket from "../../shared/hooks/useWebSocket";
import { WS } from "../../constants";
import AppFrame from "../../components/AppFrame";
import VayyMap from "../../shared/components/VayyMap";
import StatBar from "../../components/StatBar";
import PrimaryButton from "../../shared/components/common/VayyButton";
import ZoomControls from "../../shared/components/common/ZoomControls";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

export default function AutoLiveTrackingScreen({ navigation, route, mode = "auto" }) {
  const dispatchRedux = useDispatch();
  const isBike = mode === "bike";
  const accent = isBike ? colors.bikeAccent : colors.autoAccent;
  const tripData = route?.params?.tripData || {};
  const [livePassengers, setLivePassengers] = useState(Number(route?.params?.passengersOnboard) || tripData.passengersOnboard || 0);
  const [liveNextStop, setLiveNextStop] = useState(route?.params?.nextStop || tripData.nextStop || "");
  const [liveProgress, setLiveProgress] = useState(Number(route?.params?.routeProgress) || tripData.routeProgress || 0);
  const dispatchId = route?.params?.dispatchId || tripData.id;
  const [liveDistance, setLiveDistance] = useState(route?.params?.distance || tripData.distance || "");
  const [liveDuration, setLiveDuration] = useState(route?.params?.duration || tripData.duration || "");
  const initialLat = route?.params?.latitude || tripData.latitude || 26.8467;
  const initialLng = route?.params?.longitude || tripData.longitude || 80.9462;
  const [earning, setEarning] = useState(Number(route?.params?.initialEarning) || 0);
  const mapRef = useRef(null);
  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  const handleWsMessage = useCallback((data) => {
    if (data.type === "trip_update" || data.type === "vehicle_update") {
      if (data.passengers_onboard != null) setLivePassengers(data.passengers_onboard);
      if (data.next_stop) setLiveNextStop(data.next_stop);
      if (data.route_progress != null) setLiveProgress(data.route_progress);
      if (data.distance) setLiveDistance(`${data.distance}`);
      if (data.duration) setLiveDuration(`${data.duration}`);
    }
  }, []);

  useWebSocket(dispatchId ? WS.dispatch(dispatchId) : null, {
    enabled: !!dispatchId,
    onMessage: handleWsMessage,
  });

  const handleEndTrip = useCallback(async () => {
    if (dispatchId) {
      try { await dispatchRedux(startDispatchTrip(dispatchId)).unwrap(); } catch (_e) { /* already active */ }
      try { await dispatchRedux(completeDispatch(dispatchId)).unwrap(); } catch (_e) { /* ok */ }
    }
    navigation.navigate("AutoTripComplete", {
      dispatchId,
      tripData,
      buddy: { distance: liveDistance, duration: liveDuration, fare: earning },
      summary: { earnings: earning, distance: liveDistance, duration: liveDuration },
      stats: { earnings: earning, distance: liveDistance, duration: liveDuration, passengers: livePassengers, stops: route?.params?.stops, rating: route?.params?.rating },
    });
  }, [dispatchId, dispatchRedux, navigation, tripData, liveDistance, liveDuration, earning, livePassengers, route?.params?.stops, route?.params?.rating]);

  useEffect(() => {
    // Real earning would come from backend via WS or polling
    // For now, start with initialEarning from params
  }, [isBike]);

  return (
    <AppFrame navigation={navigation} title="Trip active" accent={accent}>
      <View style={styles.mapPage}>
        <VayyMap
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={{
            latitude: initialLat,
            longitude: initialLng,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        />
        <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} />
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${liveProgress * 100}%`, backgroundColor: accent }]} />
        </View>
        <View style={styles.mapBottom}>
          <StatBar accent={accent} stats={[
            { label: isBike ? "Buddy" : "On board", value: isBike ? "1" : `${livePassengers}` },
            { label: "Earned", value: `₹${earning}` },
            { label: "Next stop", value: liveNextStop },
          ]} />
          <PrimaryButton 
            label="End Trip" 
            onPress={handleEndTrip} 
            style={{ backgroundColor: colors.danger }}
          />
        </View>
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  mapPage: {
    flex: 1,
    padding: spacing.md,
  },
  progressTrack: {
    position: "absolute",
    top: spacing.xl,
    left: spacing.xl,
    right: spacing.xl,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
  },
  mapBottom: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    gap: spacing.md,
  },
});
