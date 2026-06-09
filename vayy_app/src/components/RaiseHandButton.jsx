import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity } from "react-native";
import { colors } from "../theme/colors";

export default function RaiseHandButton({ active = true, accent = colors.primary, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      scale.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.1, duration: 650, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, scale]);

  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale }] }]}>
      <TouchableOpacity disabled={!active} onPress={onPress} style={[styles.button, { backgroundColor: active ? accent : colors.textMuted }]}>
        <Text style={styles.icon}>✋</Text>
        <Text style={styles.text}>Raise</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "center",
  },
  button: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.white,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  icon: {
    fontSize: 25,
  },
  text: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
  },
});
