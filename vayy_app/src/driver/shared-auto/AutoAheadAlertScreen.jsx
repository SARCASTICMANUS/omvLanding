import React, { useEffect, useState, useRef, useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import AppFrame from "../../components/AppFrame";
import PrimaryButton from "../../shared/components/common/PrimaryButton";
import { acceptDispatch, rejectDispatch, setDispatchStatus } from "../../store/slices/dispatchSlice";
import useWebSocket from "../../shared/hooks/useWebSocket";
import { WS } from "../../constants";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

export default function AutoAheadAlertScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const dispatchId = route?.params?.dispatchId;
  const passengerName = route?.params?.passengerName || "Ravi Kumar";
  const destination = route?.params?.destination || null;
  const nextStop = route?.params?.nextStop || null;
  const [count, setCount] = useState(10);
  const handled = useRef(false);
  const { user } = useSelector((state) => state.auth);
  const userId = user?.id;

  const handleWsMessage = useCallback((data) => {
    if (data.type === "dispatch_cancelled") {
      dispatch(setDispatchStatus("cancelled"));
      if (!handled.current) {
        handled.current = true;
        navigation.goBack();
      }
    }
  }, [dispatch, navigation]);

  useWebSocket(dispatchId ? WS.dispatch(dispatchId) : null, {
    enabled: !!dispatchId,
    onMessage: handleWsMessage,
  });
  useEffect(() => {
    const timer = setInterval(() => setCount((value) => Math.max(value - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (count === 0 && !handled.current) {
      handled.current = true;
      if (dispatchId) dispatch(rejectDispatch(dispatchId));
      navigation.goBack();
    }
  }, [count]);
  return (
    <AppFrame navigation={navigation} title="Ahead alert" accent={colors.autoAccent}>
      <View style={styles.page}>
        <View style={styles.alertCard}>
          <Text style={styles.heroSmall}>{passengerName}</Text>
          <Text style={styles.muted}>500m ahead on your route</Text>
          <Text style={styles.countdown}>{count}</Text>
        </View>
        <View style={styles.actions}>
          <PrimaryButton label="Accept ✓" accent={colors.primary} onPress={() => {
            if (handled.current) return;
            handled.current = true;
            if (dispatchId) dispatch(acceptDispatch(dispatchId));
            navigation.navigate("BoardedPopup", { dispatchId, passengerName, destination, nextStop });
          }} />
          <PrimaryButton label="Ignore ✕" accent={colors.textMuted} outline onPress={() => {
            if (handled.current) return;
            handled.current = true;
            if (dispatchId) dispatch(rejectDispatch(dispatchId));
            navigation.goBack();
          }} />
        </View>
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  alertCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  heroSmall: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  muted: {
    ...typography.body,
    color: colors.textSecondary,
  },
  countdown: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    borderColor: colors.autoAccent,
    color: colors.textPrimary,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 24,
    fontWeight: "900",
  },
  actions: {
    width: "100%",
    gap: spacing.sm,
  },
});
