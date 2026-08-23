import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../../constants/colors";

const AUTO_DISMISS_MS = 4000;
const MAX_VISIBLE = 3;
const TOAST_HEIGHT = 80;

const TYPE_CONFIG = {
  success: { color: COLORS.primary, icon: "checkmark-circle", bg: "#ECFDF5", border: "#BBF7D0" },
  warning: { color: COLORS.warning, icon: "warning", bg: "#FFFBEB", border: "#FDE68A" },
  error:   { color: COLORS.error, icon: "close-circle", bg: COLORS.errorLight, border: "#FECACA" },
  info:    { color: COLORS.info, icon: "information-circle", bg: "#EFF6FF", border: "#BFDBFE" },
};

function timeAgo(timestamp) {
  if (!timestamp) return "";
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function ToastItem({ item, onDismiss, safeTop, index }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-TOAST_HEIGHT - 20)).current;

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -TOAST_HEIGHT - 20,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss(item.id));
  }, [item.id, onDismiss, translateY, opacity]);

  const dismissRef = useRef(dismiss);
  useEffect(() => {
    dismissRef.current = dismiss;
  }, [dismiss]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      dismissRef.current();
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [translateY, opacity]);

  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.info;
  const topOffset = safeTop + 8 + index * (TOAST_HEIGHT + 8);

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          top: topOffset,
          opacity,
          transform: [{ translateY }],
          backgroundColor: config.bg,
          borderColor: config.border,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          dismiss();
          item.onPress?.();
        }}
        style={styles.toastContent}
      >
        <View style={[styles.iconWrap, { backgroundColor: config.color + "18" }]}>
          <Ionicons name={config.icon} size={20} color={config.color} />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: config.color }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {item.message}
          </Text>
        </View>
        <Text style={styles.time}>{timeAgo(item.timestamp)}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const NotificationToast = forwardRef(function NotificationToast(_, ref) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState([]);

  useImperativeHandle(ref, () => ({
    show({ id, title, message, type = "info", timestamp, onPress }) {
      const toastId = id || `toast_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      setToasts((prev) => {
        const next = [
          { id: toastId, title, message, type, timestamp, onPress },
          ...prev,
        ];
        return next.slice(0, MAX_VISIBLE);
      });
    },
  }));

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <Animated.View style={[styles.overlay, { pointerEvents: "box-none" }]} pointerEvents="box-none">
      {toasts.map((toast, i) => (
        <ToastItem
          key={toast.id}
          item={toast}
          onDismiss={dismiss}
          safeTop={insets.top}
          index={i}
        />
      ))}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  toastContainer: {
    position: "absolute",
    left: 12,
    right: 12,
    height: TOAST_HEIGHT,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
  },
  toastContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
  },
  message: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  time: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
});

export default NotificationToast;
