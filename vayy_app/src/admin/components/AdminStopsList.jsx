import React from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";

const AdminStopsList = ({ stops }) => {
  return (
    <View style={styles.container}>
      <FlatList
        data={stops}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item, index }) => (
          <Text style={styles.item}>
            Stop {index + 1}: {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
          </Text>
        )}
      />
    </View>
  );
};

export default AdminStopsList;

const styles = StyleSheet.create({
  container: { padding: 10, backgroundColor: "#f8f8f8" },
  item: { paddingVertical: 4 },
});