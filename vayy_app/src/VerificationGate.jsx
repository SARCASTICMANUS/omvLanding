import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useSelector } from "react-redux";
import { DRIVER_ROLES } from "./constants";

const VerificationGate = ({ isCompletionScreen, onComplete }) => {
  // Server is the only source of truth (GET /api/accounts/me/ -> data.verification).
  // Until the server has answered there is nothing to show: never block the UI
  // on "loading" or on a failed fetch — the backend's 403 still enforces access.
  const verification = useSelector((state) => state.verification?.state ?? null);
  const user = useSelector((state) => state.auth?.user);

  if (!verification) return null;
  if (isCompletionScreen) return null;

  const {
    stage,
    can_use_app,
    title,
    message,
    required_docs,
    missing_docs,
    rejection_reason,
    submitted_at,
  } = verification || {};

  // The gate remains visible until the server confirms the account can use OMV.
  if (stage === "fully_verified" || can_use_app === true) {
    return null;
  }

  const displayMessage =
    typeof message === "function" ? message(rejection_reason) : message;

  const stageMessage =
    displayMessage ||
    (stage === "email_pending"
      ? "Verify your email to continue: enter the code we sent you."
      : stage === "docs_pending"
        ? "Complete your verification: upload the required documents to start using OMV."
        : stage === "docs_under_review"
          ? "Your documents are under review. You can use OMV as soon as an admin approves them."
          : stage === "docs_rejected"
            ? `Your documents were rejected: ${rejection_reason || "Please review the feedback"}.`
            : "We’re checking your verification status. Please wait.");

  const canCompleteDriverKyc =
    DRIVER_ROLES.includes(user?.role) &&
    (stage === "docs_pending" || stage === "docs_rejected");

  const handleClose = () => {
    // Keep the verification gate blocking until the server allows access.
  };

  return (
    <Modal
      visible
      transparent
      statusBarTranslucency
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalView}>
        <View style={styles.stageCard}>
          <Text style={styles.stageTitle}>
            {title || "Verification Required"}
          </Text>

          <Text style={styles.stageMessage}>{stageMessage}</Text>

          {stage === "docs_pending" && (
            <View style={styles.docList}>
              <Text>Required documents:</Text>
              {required_docs?.map((doc, index) => (
                <View key={String(doc) + index} style={styles.docRow}>
                  <Text>{doc}</Text>
                </View>
              ))}
              {missing_docs?.map((doc, index) => (
                <View key={String(doc) + index} style={styles.docRow}>
                  <Text style={styles.docMissing}>Missing: {doc}</Text>
                </View>
              ))}
            </View>
          )}

          {stage === "docs_under_review" && submitted_at && (
            <Text>
              Submitted at {new Date(submitted_at).toLocaleDateString()}
            </Text>
          )}

          {stage === "docs_rejected" && rejection_reason && (
            <Text style={styles.stageMessage}>{rejection_reason}</Text>
          )}

          {canCompleteDriverKyc && (
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.submitBtn}
              onPress={() => onComplete?.(stage)}
            >
              <Text style={styles.submitBtnText}>
                {stage === "docs_rejected" ? "Review documents" : "Add vehicle & documents"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  stageCard: {
    width: 280,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  stageTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  stageMessage: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: "center",
    lineHeight: 18,
  },
  docList: {
    marginTop: 12,
    alignSelf: "stretch",
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  docMissing: {
    color: "#ff3b30",
    marginLeft: 6,
    fontSize: 12,
  },
  submitBtn: {
    marginTop: 20,
    backgroundColor: "#009849",
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
});

export default VerificationGate;
