import React, { useEffect, useState, useRef, useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import AppFrame from "../../components/AppFrame";
import PrimaryButton from "../../shared/components/common/PrimaryButton";
import { acceptBroadcast, rejectBroadcast } from "../../store/slices/dispatchSlice";
import useWebSocket from "../../shared/hooks/useWebSocket";
import { WS } from "../../constants";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

export default function AutoAheadAlertScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const dispatchId = route?.params?.dispatchId;
  const requestId = route?.params?.requestId || dispatchId;
  const passengerName = route?.params?.passengerName || "Ravi Kumar";
  const destination = route?.params?.destination || null;
  const nextStop = route?.params?.nextStop || null;
  const [count, setCount] = useState(10);
  const handled = useRef(false);
  const { user } = useSelector((state) => state.auth);
  const userId = user?.id;

  // This screen is always reached from a broadcast `new_dispatch_request`, so
  // `requestId` is a DispatchRequest id. The direct dispatch endpoints resolve
  // against ActiveTrip and would 400, and the dispatch WS channel authorizes
  // against ActiveTrip too — the backend pushes accept/cancel to the driver's
  // notifications channel instead.
  const dismiss = useCallback(() => {
    if (handled.current) return;
    handled.current = true;
    navigation.goBack();
  }, [navigation]);

  const handleWsMessage = useCallback((data) => {
    if (data.type === "request_cancelled" && data.request_id === requestId) {
      dismiss();
    }
  }, [dismiss, requestId]);

  useWebSocket(userId ? WS.notifications(userId) : null, {
    enabled: !!userId,
    onMessage: handleWsMessage,
  });

  useEffect(() => {
    const timer = setInterval(() => setCount((value) => Math.max(value - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (count === 0) {
      if (requestId) dispatch(rejectBroadcast(requestId));
      dismiss();
    }
  }, [count, dispatch, dismiss, requestId]);

  const onAccept = useCallback(async () => {
    if (handled.current || !requestId) return;
    handled.current = true;
    try {
      await dispatch(acceptBroadcast(requestId)).unwrap();
    } catch (e) {
      console.warn("acceptBroadcast failed:", e);
      handled.current = false;
      dismiss();
      return;
    }
    navigation.navigate("BoardedPopup", { dispatchId, passengerName, destination, nextStop });
  }, [dispatch, dismiss, dispatchId, navigation, nextStop, passengerName, destination, requestId]);

  const onReject = useCallback(() => {
    if (handled.current) return;
    handled.current = true;
    if (requestId) dispatch(rejectBroadcast(requestId));
    navigation.goBack();
  }, [dispatch, navigation, requestId]);

  return (
    <AppFrame navigation={navigation} title="Ahead alert" accent={colors.autoAccent}>
      <View style={styles.page}>
        <View style={styles.alertCard}>
          <Text style={styles.heroSmall}>{passengerName}</Text>
          <Text style={styles.muted}>500m ahead on your route</Text>
          <Text style={styles.countdown}>{count}</Text>
        </View>
        <View style={styles.actions}>
          <PrimaryButton label="Accept ✓" accent={colors.primary} onPress={onAccept} />
          <PrimaryButton label="Ignore ✕" accent={colors.textMuted} outline onPress={onReject} />
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
