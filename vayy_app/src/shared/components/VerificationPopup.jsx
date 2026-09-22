import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Modal, BackHandler, StyleSheet } from "react-native";
import { useSelector } from "react-redux";
import { ShieldCheck, Clock, AlertTriangle, Upload } from "lucide-react-native";
import COLORS from "../../shared/constants/colors";

const STATUS_CONFIG = {
  verified: {
    icon: ShieldCheck,
    iconColor: COLORS.primary,
    bgColor: "#E0F5E8",
    borderColor: "#BBF7D0",
    title: "Account Verified",
    message: "Your account is fully verified. You can use all platform features.",
    dismissLabel: "Continue",
    action: "dismiss",
    dismissable: true,
  },
  pending: {
    icon: Clock,
    iconColor: "#d97706",
    bgColor: "#fffbeb",
    borderColor: "#fde68a",
    title: "Verification In Progress",
    message: "Your documents are being reviewed. We\u2019ll notify you once verification is complete. This usually takes 24\u201348 hours.",
    dismissLabel: "Got it",
    action: "dismiss",
    dismissable: true,
  },
  rejected: {
    icon: AlertTriangle,
    iconColor: "#dc2626",
    bgColor: "#FEF2F2",
    borderColor: "#FECACA",
    title: "Documents Rejected",
    message: "Some of your documents were rejected. Please re-upload to continue.",
    dismissLabel: "Re-upload Documents",
    action: "completeRegistration",
    dismissable: false,
  },
  not_submitted: {
    icon: Upload,
    iconColor: COLORS.primary,
    bgColor: "#E0F5E8",
    borderColor: "#BBF7D0",
    title: "Complete Your Profile",
    message: "Please complete your vehicle details, documents, and bank information to start using the platform.",
    dismissLabel: "Complete Profile",
    action: "completeRegistration",
    dismissable: false,
  },
  unverified: {
    icon: Upload,
    iconColor: COLORS.primary,
    bgColor: "#E0F5E8",
    borderColor: "#BBF7D0",
    title: "Complete Verification",
    message: "Verify your account to unlock all features and start riding.",
    dismissLabel: "Get Verified",
    action: "completeRegistration",
    dismissable: false,
  },
};

export default function VerificationPopup({ visible, onDismiss, navigation, onNavigate }) {
  const { verification } = useSelector((state) => state.profile);
  const prevStatusRef = useRef(null);

  const status = verification?.status || "unverified";
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unverified;
  const Icon = config.icon;

  // Auto-dismiss when status changes to verified or pending
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev && prev !== status && (status === "verified" || status === "pending")) {
      onDismiss?.();
    }
  }, [status, onDismiss]);

  const shouldShow = visible && status !== "verified";

  // Block hardware back button when popup is not dismissable
  useEffect(() => {
    if (!shouldShow || config.dismissable) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [shouldShow, config.dismissable]);

  const handleAction = () => {
    if (config.action === "dismiss") {
      onDismiss?.();
    } else if (config.action === "completeRegistration" && (onNavigate || navigation)) {
      onDismiss?.();
      if (onNavigate) {
        onNavigate();
      } else {
        navigation.navigate("DriverProfileCompletion");
      }
    }
  };

  // Tapping overlay: only dismiss if dismissable
  const handleOverlayPress = () => {
    if (config.dismissable) {
      onDismiss?.();
    }
  };

  return (
    <Modal visible={shouldShow} transparent animationType="fade" onRequestClose={config.dismissable ? onDismiss : undefined}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleOverlayPress}
        />
        <View style={[styles.card, { backgroundColor: config.bgColor, borderColor: config.borderColor }]}>
          <View style={[styles.iconWrap, { backgroundColor: `${config.iconColor}15` }]}>
            <Icon size={32} color={config.iconColor} />
          </View>
          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.message}>{config.message}</Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: config.iconColor }]} onPress={handleAction} activeOpacity={0.85}>
            <Text style={styles.btnText}>{config.dismissLabel}</Text>
          </TouchableOpacity>
          {config.dismissable && (
            <TouchableOpacity style={styles.dismissLink} onPress={onDismiss} activeOpacity={0.7}>
              <Text style={styles.dismissText}>Dismiss</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    borderWidth: 1.5,
    zIndex: 1,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  btn: {
    width: "100%",
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  dismissLink: {
    marginTop: 12,
    padding: 8,
  },
  dismissText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: "600",
  },
});
