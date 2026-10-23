import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Modal, Alert, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useDispatch, useSelector } from "react-redux";
import { uploadDocument } from "./store/slices/profileSlice";
import { fetchVerification } from "./store/slices/verificationSlice";

const KycScreen = () => {
  const dispatch = useDispatch();
  const { state: verificationState } = useSelector((state) => state.verification);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

  useEffect(() => {
    if (verificationState?.stage === "docs_pending" && Array.isArray(verificationState.required_docs)) {
      setDocs(verificationState.required_docs);
    }
  }, [verificationState]);

  const handlePick = async (docType) => {
    setSelectedDoc(docType);
    setShowPicker(false);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission required", "Allow photo library access to upload a verification document.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert("Unable to select image", "Please select an image and try again.");
        return;
      }

      setLoading(true);
      const uploadResult = await dispatch(uploadDocument({
        documentType: docType,
        fileUri: asset.uri,
        fileName: asset.fileName || asset.uri.split("/").pop() || `${docType}.jpg`,
      }));

      if (uploadDocument.fulfilled.match(uploadResult)) {
        await dispatch(fetchVerification());
        setSelectedDoc(null);
      } else {
        const payload = uploadResult.payload;
        const message = payload?.message || payload?.detail || payload?.error;
        Alert.alert("Upload failed", typeof message === "string" ? message : "Could not upload document. Please try again.");
      }
    } catch (error) {
      console.error("Document upload failed:", error);
      Alert.alert("Upload failed", "Could not upload document. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderDoc = ({ item }) => {
    const label = typeof item === "string" ? item : item?.label || item?.name || item?.type || "Document";
    return (
      <View style={styles.docItem}>
        <Text style={styles.docLabel}>{label}</Text>
        {selectedDoc === label && <Text style={styles.docSelected}>Selected</Text>}
      </View>
    );
  };

  if (verificationState?.stage === "docs_under_review") {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Documents under review</Text>
        <Text style={styles.message}>Your documents are being reviewed. You can use OMV as soon as an admin approves them.</Text>
        {!!verificationState.submitted_at && (
          <Text style={styles.submittedAt}>{"Submitted: " + new Date(verificationState.submitted_at).toLocaleDateString()}</Text>
        )}
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (verificationState?.stage === "docs_rejected") {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Documents rejected</Text>
        <Text style={styles.message}>
          {verificationState.rejection_reason || "Please review and re-upload the required documents."}
          {" Re-upload the corrected documents to continue."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Complete your verification</Text>
      {verificationState?.stage !== "fully_verified" && (
        <Text style={styles.subtitle}>{verificationState?.message || "Complete your verification: upload the required documents to start using OMV."}</Text>
      )}
      <FlatList
        data={docs}
        renderItem={renderDoc}
        keyExtractor={(item, index) => String(item?.id ?? item?.type ?? item ?? index)}
        style={styles.docFlatList}
        ListEmptyComponent={
          <Text style={styles.message}>
            {verificationState?.stage === "fully_verified"
              ? "Your verification is complete."
              : "No required documents were returned. Refresh your verification status or contact support."}
          </Text>
        }
      />
      <TouchableOpacity style={styles.pickBtn} onPress={() => setShowPicker(true)} disabled={loading || docs.length === 0}>
        <Text style={styles.pickBtnText}>{loading ? "Uploading..." : "Upload document"}</Text>
      </TouchableOpacity>
      {showPicker && !loading && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.pickerModalView}>
              <Text style={styles.pickerTitle}>Select document type</Text>
              {docs.map((doc, index) => {
                const label = typeof doc === "string" ? doc : doc?.label || doc?.name || doc?.type || "Document";
                return (
                  <TouchableOpacity key={String(doc?.id ?? label ?? index)} style={styles.pickerItem} onPress={() => handlePick(label)}>
                    <Text style={styles.pickerText}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowPicker(false)}>
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FAF9", padding: 24, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "600", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#5F6368", marginBottom: 20, textAlign: "center" },
  message: { color: "#5F6368", fontSize: 14, marginVertical: 12, textAlign: "center" },
  submittedAt: { color: "#5F6368", fontSize: 12, marginBottom: 12, textAlign: "center" },
  docFlatList: { marginTop: 16 },
  docItem: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "center" },
  docLabel: { fontSize: 14, flex: 1 },
  docSelected: { color: "#009849", fontWeight: "600", marginLeft: 6 },
  pickBtn: { marginTop: 24, backgroundColor: "#009849", borderRadius: 18, paddingHorizontal: 24, paddingVertical: 12, alignSelf: "stretch" },
  pickBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: 14, textAlign: "center" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 24 },
  pickerModalView: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24 },
  pickerTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16, textAlign: "center" },
  pickerItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: "#EEE" },
  pickerText: { fontSize: 14 },
  pickerCancel: { marginTop: 12, alignSelf: "flex-end" },
  pickerCancelText: { color: "#009849", fontSize: 14 },
});

export default KycScreen;
