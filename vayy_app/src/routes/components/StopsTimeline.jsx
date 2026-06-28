import React from "react";
import { StyleSheet, View } from "react-native";

import SPACING from "../../shared/constants/spacing";
import StopRow from "./StopRow";

export default function StopsTimeline({ stops = [], activeIndex = 0, dark = false }) {
  return (
    <View>
      {stops.map((stop, index) => (
        <View key={stop?.id || stop?.stop_id || index}>
          {index > 0 && <View style={styles.separator} />}
          <StopRow
            dark={dark}
            index={index}
            isActive={index === activeIndex}
            stop={stop}
            totalStops={stops.length}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  separator: {
    height: SPACING.xs,
  },
});
