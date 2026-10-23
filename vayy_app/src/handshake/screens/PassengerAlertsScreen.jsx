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
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";

import VayyCard from "../../shared/components/common/VayyCard";
import ScreenHeader from "../../shared/components/navigation/ScreenHeader";
import COLORS from "../../shared/constants/colors";
import SPACING from "../../shared/constants/spacing";
import { colors as THEME_COLORS } from "../../constants/theme";
import {
  fetchNotifications,
  markNotificationRead,
} from "../../store/slices/notificationSlice";

function getAlertStyle(type) {
  switch (type) {
    case "success": return { color: THEME_COLORS.success, icon: "checkmark-circle" };
    case "warning": return { color: THEME_COLORS.warning, icon: "warning" };
    case "error": return { color: THEME_COLORS.danger, icon: "close-circle" };
    default: return { color: THEME_COLORS.info, icon: "information-circle" };
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

  const data = list || [];

  const renderAlertItem = ({ item }) => {
    const alertStyle = getAlertStyle(item.notification_type || item.type);
    const isRead = !!item.read;

    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => handlePress(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.message}`}
        accessibilityHint={isRead ? undefined : "Marks this notification as read"}
      >
        <VayyCard style={[styles.alertCard, !isRead && styles.unreadCard]}>
          <View style={styles.alertRow}>
            <View style={[styles.iconWrap, { backgroundColor: `${alertStyle.color}14` }]}>
              <Ionicons name={alertStyle.icon} size={21} color={alertStyle.color} />
            </View>
            <View style={styles.alertContent}>
              <View style={styles.alertHeader}>
                <Text style={styles.alertTitle} numberOfLines={2}>{item.title}</Text>
                {!isRead && <View style={styles.unreadDot} />}
              </View>
              <Text style={[styles.alertMessage, isRead && styles.alertMessageRead]}>
                {item.message}
              </Text>
              <Text style={styles.timestamp}>
                {formatRelativeTime(item.created_at || item.timestamp)}
              </Text>
            </View>
          </View>
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
      ) : error && data.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Couldn&apos;t load notifications</Text>
          <TouchableOpacity onPress={() => dispatch(fetchNotifications())}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="notifications-outline" size={26} color={COLORS.textMuted} />
          </View>
          <Text style={styles.emptyText}>You&apos;re all caught up</Text>
          <Text style={styles.emptySubtext}>Important trip and account updates will appear here.</Text>
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
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
  },
  alertCard: {
    padding: SPACING.md,
    borderRadius: 16,
  },
  unreadCard: {
    borderColor: COLORS.successBorder,
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  alertContent: {
    flex: 1,
    minWidth: 0,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: COLORS.primary,
  },
  alertTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
    flexShrink: 1,
  },
  timestamp: {
    marginTop: SPACING.sm,
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.textMuted,
  },
  alertMessage: {
    marginTop: SPACING.xs,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  alertMessageRead: {
    color: COLORS.textMuted,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  emptyText: {
    textAlign: "center",
    color: COLORS.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700",
  },
  emptySubtext: {
    textAlign: "center",
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  retryText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "700",
    marginTop: SPACING.sm,
  },
});
