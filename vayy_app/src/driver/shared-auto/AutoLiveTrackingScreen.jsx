import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import AppFrame from "../../components/AppFrame";
import VayyMap from "../../shared/components/VayyMap";
import StatBar from "../../components/StatBar";
import PrimaryButton from "../../shared/components/common/VayyButton";
import ZoomControls from "../../shared/components/common/ZoomControls";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

export default function AutoLiveTrackingScreen({ navigation, route, mode = "auto" }) {
  const isBike = mode === "bike";
  const accent = isBike ? colors.bikeAccent : colors.autoAccent;
  const tripData = route?.params?.tripData || {};
  const passengersOnboard = route?.params?.passengersOnboard || tripData.passengersOnboard || 0;
  const nextStop = route?.params?.nextStop || tripData.nextStop || "";
  const routeProgress = route?.params?.routeProgress || tripData.routeProgress || 0;
  const dispatchId = route?.params?.dispatchId || tripData.id;
  const distance = route?.params?.distance || tripData.distance || "";
  const duration = route?.params?.duration || tripData.duration || "";
  const initialLat = route?.params?.latitude || tripData.latitude || 26.8467;
  const initialLng = route?.params?.longitude || tripData.longitude || 80.9462;
  const [earning, setEarning] = useState(Number(route?.params?.initialEarning) || 0);
  const mapRef = useRef(null);
  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  useEffect(() => {
    const tick = isBike ? 3 : 5;
    const timer = setInterval(() => setEarning((value) => value + tick), 2200);
    return () => clearInterval(timer);
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
          <View style={[styles.progressFill, { width: `${routeProgress * 100}%`, backgroundColor: accent }]} />
        </View>
        <View style={styles.mapBottom}>
          <StatBar accent={accent} stats={[
            { label: isBike ? "Buddy" : "On board", value: isBike ? "1" : `${passengersOnboard}` },
            { label: "Earned", value: `₹${earning}` },
            { label: "Next stop", value: nextStop },
          ]} />
          <PrimaryButton 
            label="End Trip" 
            onPress={() => navigation.navigate(isBike ? "BikeTripComplete" : "TripEndSummary", {
              dispatchId,
              tripData,
              buddy: { distance, duration, fare: earning },
              summary: { earnings: earning, distance, duration },
              stats: { earnings: earning, distance, duration, passengers: passengersOnboard, stops: route?.params?.stops, rating: route?.params?.rating },
            })} 
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
