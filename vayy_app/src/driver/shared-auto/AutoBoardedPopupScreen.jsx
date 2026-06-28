import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useDispatch } from "react-redux";
import AppFrame from "../../components/AppFrame";
import PrimaryButton from "../../shared/components/common/PrimaryButton";
import { arrivedDispatch } from "../../store/slices/dispatchSlice";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

export default function AutoBoardedPopupScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const dispatchId = route?.params?.dispatchId;
  const passengerName = route?.params?.passengerName || "Ravi Kumar";
  const destination = route?.params?.destination || "Charbagh";
  const nextStop = route?.params?.nextStop || "Civil Lines";
  return (
    <AppFrame navigation={navigation} title="Boarding check" accent={colors.autoAccent}>
      <View style={styles.sheetOnly}>
        <Text style={styles.heroSmall}>Did {passengerName} board?</Text>
        <Text style={styles.muted}>Destination: {destination} · Next stop: {nextStop}</Text>
        <View style={styles.actions}>
          <PrimaryButton label="Yes, Boarded ✓" accent={colors.primary} onPress={() => {
            if (dispatchId) dispatch(arrivedDispatch(dispatchId));
            navigation.navigate("AutoRideActive", { dispatchId });
          }} />
          <PrimaryButton label="No, Skip" accent={colors.textMuted} outline onPress={() => navigation.goBack()} />
        </View>
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  sheetOnly: {
    margin: spacing.md,
    marginTop: "auto",
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: "center",
  },
  heroSmall: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  muted: {
    ...typography.body,
    color: colors.textSecondary,
  },
  actions: {
    width: "100%",
    gap: spacing.sm,
  },
});
