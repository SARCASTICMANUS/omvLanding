import React from "react";
import { FlatList, StyleSheet, View } from "react-native";

import SPACING from "../../constants/spacing";
import StopRow from "./StopRow";

export default function StopsTimeline({ stops = [], activeIndex = 0 }) {
  return (
    <FlatList
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      data={stops}
      keyExtractor={(item, index) => String(item?.id || item?.stop_id || index)}
      renderItem={({ item, index }) => (
        <StopRow
          index={index}
          isActive={index === activeIndex}
          stop={item}
          totalStops={stops.length}
        />
      )}
      scrollEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  separator: {
    height: SPACING.xs,
  },
});
