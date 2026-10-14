import React, { useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";

import VayyCard from "../../shared/components/common/VayyCard";
import ScreenHeader from "../../shared/components/navigation/ScreenHeader";
import COLORS from "../../shared/constants/colors";
import SPACING from "../../shared/constants/spacing";
import {
  fetchNotifications,
  markNotificationRead,
} from "../../store/slices/notificationSlice";

const DUMMY_ALERTS = [
  {
    id: "1",
    title: "Bus Approaching",
    message: "Bus #OMV-101 is 500m away from your stop (Sector 12).",
    created_at: new Date(Date.now() - 2 * 60000).toISOString(),
    read: false,
    notification_type: "info",
  },
  {
    id: "2",
    title: "Bus Arrived",
    message: "Bus #OMV-101 has arrived at Sector 12 stop. Please board promptly.",
    created_at: new Date(Date.now() - 1 * 60000).toISOString(),
    read: false,
    notification_type: "info",
  },
  {
    id: "3",
    title: "Boarding Confirmed",
    message: "Your boarding request for Trip #823 has been accepted by the driver.",
    created_at: new Date(Date.now() - 1 * 3600000).toISOString(),
    read: true,
    notification_type: "success",
  },
  {
    id: "4",
    title: "Trip Delay",
    message: "Bus #OMV-205 is delayed by 10 minutes due to heavy traffic.",
    created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    read: true,
    notification_type: "warning",
  },
  {
    id: "5",
    title: "Boarding Rejected",
    message: "Boarding request for Trip #999 was rejected. The vehicle has reached capacity.",
    created_at: new Date(Date.now() - 4 * 3600000).toISOString(),
    read: true,
    notification_type: "error",
  },
  {
    id: "6",
    title: "Route Diversion",
    message: "Trip #442 has a route diversion near M.G. Road. Please check the map.",
    created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    read: true,
    notification_type: "warning",
  },
];

function getAlertColor(type) {
  switch (type) {
    case "success": return COLORS.success;
    case "warning": return COLORS.warning;
    case "error": return COLORS.error;
    default: return COLORS.info;
  }
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  const time = new Date(dateStr).getTime();
  if (Number.isNaN(time)) return "";

  const diffMs = Date.now() - time;
  const mins = Math.max(0, Math.floor(diffMs / 60000));

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

export default function PassengerAlertsScreen() {
  const dispatch = useDispatch();
  const { list, loading, error } = useSelector((state) => state.notifications);

  useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  const handlePress = (item) => {
    if (!item.read) {
      dispatch(markNotificationRead(item.id));
    }
  };

  const data = (list && list.length > 0) || !error ? (list || []) : DUMMY_ALERTS;

  const renderAlertItem = ({ item }) => {
    const accent = getAlertColor(item.notification_type);
    const isRead = !!item.read;

    return (
      <TouchableOpacity activeOpacity={0.7} onPress={() => handlePress(item)}>
        <VayyCard style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <View style={styles.alertTitleRow}>
              {!isRead && <View style={[styles.unreadDot, { backgroundColor: accent }]} />}
              <Text
                style={[
                  styles.alertTitle,
                  isRead && styles.alertTitleRead,
                  { color: isRead ? COLORS.textSecondary : accent },
                ]}
              >
                {item.title}
              </Text>
            </View>
            <Text style={styles.timestamp}>{formatRelativeTime(item.created_at)}</Text>
          </View>
          <Text style={[styles.alertMessage, isRead && styles.alertMessageRead]}>
            {item.message}
          </Text>
        </VayyCard>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#009849" />
      {/* Tab root — no back button. ScreenHeader renders a transparent spacer
          instead, so the title stays optically centred. */}
      <ScreenHeader
        title="Notifications"
        subtitle="Stay updated with your alerts"
      />

      {loading && list.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No new alerts</Text>
          <Text style={styles.emptySubtext}>Your notifications will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={renderAlertItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: SPACING.xs,
  },
  listContent: {
    gap: SPACING.base,
  },
  alertCard: {
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  alertTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    marginRight: SPACING.sm,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: "800",
    flexShrink: 1,
  },
  alertTitleRead: {
    fontWeight: "600",
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  alertMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  alertMessageRead: {
    opacity: 0.75,
  },
  emptyText: {
    textAlign: "center",
    marginTop: SPACING.xxxl,
    color: COLORS.textMuted,
    fontSize: 15,
  },
  emptySubtext: {
    textAlign: "center",
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
});
