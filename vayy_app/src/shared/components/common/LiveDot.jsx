import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import COLORS from "../../constants/colors";
import RADIUS from "../../constants/radius";

export default function LiveDot({ size = 10 }) {
  const [pulse] = React.useState(() => new Animated.Value(1));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 800,
          toValue: 1.9,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          duration: 800,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={[styles.container, { height: size * 2, width: size * 2 }]}>
      <Animated.View
        style={[
          styles.pulse,
          {
            borderRadius: size,
            height: size,
            transform: [{ scale: pulse }],
            width: size,
          },
        ]}
      />
      <View style={[styles.dot, { borderRadius: size / 2, height: size, width: size }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: {
    backgroundColor: COLORS.liveAccent,
    opacity: 0.22,
    position: "absolute",
  },
  dot: {
    backgroundColor: COLORS.liveAccent,
  },
});
