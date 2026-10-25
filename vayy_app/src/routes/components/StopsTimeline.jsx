import React from "react";
import { StyleSheet, View } from "react-native";

import SPACING from "../../shared/constants/spacing";
import StopRow from "./StopRow";

export default function StopsTimeline({ stops = [], activeIndex = 0, dark = false }) {
  const unnamedCount = stops.filter((stop) =>
    !String(stop?.short_name || stop?.name || stop?.stop_name || "").trim()
  ).length;
  let unnamedIndex = 0;

  return (
    <View>
      {stops.map((stop, index) => {
        const unnamed = !String(stop?.short_name || stop?.name || stop?.stop_name || "").trim();
        const fallbackName = unnamed
          ? unnamedCount === 1 ? "Nearest OMV Stop" : `OMV Stop ${++unnamedIndex}`
          : null;
        return (
          <View key={stop?.id || stop?.stop_id || index}>
            {index > 0 && <View style={styles.separator} />}
            <StopRow
              dark={dark}
              index={index}
              isActive={index === activeIndex}
              stop={unnamed ? { ...stop, name: fallbackName, short_name: fallbackName } : stop}
              totalStops={stops.length}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  separator: {
    height: SPACING.xs,
  },
});
