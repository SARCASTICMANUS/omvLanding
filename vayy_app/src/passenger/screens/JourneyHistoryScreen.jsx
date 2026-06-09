import React from "react";
import { StyleSheet, Text, View, SafeAreaView } from "react-native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

export default function JourneyHistoryScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.container}>
        <Text style={styles.title}>Journey History</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    padding: spacing.md,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
});
