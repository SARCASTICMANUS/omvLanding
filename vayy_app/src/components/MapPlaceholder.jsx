import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

export default function MapPlaceholder({ accent = colors.primary, vehicle = "🛺", compact = false, routeLine = false }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const drive = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(drive, { toValue: 1, duration: 3600, useNativeDriver: true }),
        Animated.timing(drive, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, [drive, pulse]);

  const pingScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const pingOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.65, 0] });
  const vehicleMove = drive.interpolate({ inputRange: [0, 1], outputRange: [-120, 120] });

  return (
    <View style={[styles.map, compact && styles.compact]}>
      <View style={styles.gridA} />
      <View style={styles.gridB} />
      <View style={styles.roadOne} />
      <View style={styles.roadTwo} />
      {routeLine && <View style={[styles.routeLine, { borderColor: accent }]} />}
      <View style={styles.pinWrap}>
        <Animated.View style={[styles.ping, { backgroundColor: accent, transform: [{ scale: pingScale }], opacity: pingOpacity }]} />
        <View style={[styles.pin, { backgroundColor: accent }]} />
      </View>
      <Animated.Text style={[styles.vehicle, { transform: [{ translateX: vehicleMove }] }]}>{vehicle}</Animated.Text>
      <Text style={styles.mapLabel}>OMV LIVE MAP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    minHeight: 280,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#303030",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  compact: {
    minHeight: 230,
  },
  gridA: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    transform: [{ rotate: "12deg" }, { scale: 1.5 }],
  },
  gridB: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    transform: [{ rotate: "-18deg" }, { scale: 1.6 }],
  },
  roadOne: {
    position: "absolute",
    width: "120%",
    height: 34,
    backgroundColor: "rgba(255,255,255,0.06)",
    transform: [{ rotate: "-16deg" }],
  },
  roadTwo: {
    position: "absolute",
    width: 36,
    height: "130%",
    backgroundColor: "rgba(255,255,255,0.05)",
    transform: [{ rotate: "24deg" }],
  },
  routeLine: {
    position: "absolute",
    width: "72%",
    borderTopWidth: 3,
    borderStyle: "dashed",
    transform: [{ rotate: "-12deg" }],
  },
  pinWrap: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  ping: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  pin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: colors.white,
  },
  vehicle: {
    position: "absolute",
    top: "42%",
    fontSize: 34,
  },
  mapLabel: {
    position: "absolute",
    bottom: 14,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
