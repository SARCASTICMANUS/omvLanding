import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import AppFrame from "../../components/AppFrame";
import RouteCard from "../../components/RouteCard";
import { bikeRoutes, sharedAutoRoutes } from "../../data/routes";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

export function RouteListScreen({ navigation, mode = "auto" }) {
  const isBike = mode === "bike";
  const accent = isBike ? colors.bikeAccent : colors.primary;
  const routes = isBike ? bikeRoutes : sharedAutoRoutes;
  const next = isBike ? "BikeMapPreRide" : "SharedAutoMap";
  return (
    <AppFrame navigation={navigation} title="Hazratganj → Charbagh" subtitle={isBike ? "2 bikes available" : "3 autos available"} accent={accent}>
      <ScrollView contentContainerStyle={styles.list}>
        {routes.map((route) => (
          <RouteCard key={route.id} route={route} accent={accent} icon={isBike ? "🏍️" : "🛺"} actionLabel={isBike ? "Request" : "Board"} onPress={() => navigation.navigate(next)} />
        ))}
      </ScrollView>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.md,
  },
});
