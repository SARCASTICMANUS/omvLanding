import React from "react";
import { View, Text, StyleSheet } from "react-native";

const AdminStopsList = ({ stops }) => {
  return (
    <View style={styles.container}>
      {stops.map((item, index) => (
        <Text key={index} style={styles.item}>
          Stop {index + 1}: {Array.isArray(item) ? item[0].toFixed(4) : item.latitude?.toFixed(4)}, {Array.isArray(item) ? item[1].toFixed(4) : item.longitude?.toFixed(4)}
        </Text>
      ))}
    </View>
  );
};

export default AdminStopsList;

const styles = StyleSheet.create({
  container: { padding: 10, backgroundColor: "#f8f8f8" },
  item: { paddingVertical: 4 },
});
