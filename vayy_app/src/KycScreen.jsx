import React, { useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Modal, Alert, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useDispatch, useSelector } from "react-redux";
import { uploadDocument, clearVerification } from "./store/slices/verificationSlice";
import { AUTH } from "./constants";

const KycScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { state: verificationState, user } = useSelector((state) => state.verification);

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Initialize docs list from required_docs if in docs_pending stage
  useEffect(() => {
    if (verificationState?.stage === "docs_pending" && verificationState?.required_docs) {
      setDocs(verificationState.required_docs);
    }
  }, [verificationState]);

  const handlePick = async (docType) => {
    setSelectedDoc(docType);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.mediaTypesLibrary,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedDoc(null);
      // result.uri is the local URI of the picked image
      // We'll submit it directly via the uploadDocument thunk
      setLoading(true);
      try {
        await dispatch(
          uploadDocument({
            documentType: docType,
            fileUri: result.uri,
            fileName: result.uri.split("/").pop(),
          })
        );
        // After upload, re-fetch verification status
        await dispatch(fetchVerification());
        setLoading(false);
      } catch (err) {
        console.error("Document upload failed:", err);
        Alert.alert("Upload failed", "Could not upload document. Please try again.");
        setLoading(false);
      }
    }
  };

  const renderDoc = ({ item }) => {
    return (
      <View style={styles.docItem}>
        <Text style={styles.docLabel}>{item}</Text>
        {selectedDoc === item && (
          <Text style={styles.docSelected}>Selected</Text>
        )}
      </View>
    );
  };

  if (verificationState?.stage === "docs_under_review") {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Documents under review</Text>
        <Text style={styles.message}>
          Your documents are being reviewed. You can use OMV as soon as an admin approves them.
        </Text>
        <Text style={styles.submittedAt}>
          Submitted{": " + new Date(verificationState.submitted_at).toLocaleDateString()}
        </Text>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (verificationState?.stage === "docs_rejected") {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Documents rejected</Text>
        <Text style={styles.message}>
          {verificationState.rejection_reason}
          {" "}{"Re-upload the corrected documents to continue."}
        </Text>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // docs_pending or initial render - show the KYC screen with document picker
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Complete your verification</Text>

      {verificationState?.stage !== "fully_verified" && (
        <Text style={styles.subtitle}>
          {verificationState?.message || "Complete your verification: upload the required documents to start using OMV."}
        </Text>
      )}

      <FlatList
        data={docs}
        renderItem={renderDoc}
        keyExtractor={(item) => item}
        horizontal={false}
        style={styles.docFlatList}
      />

      {selectedDoc && (
        <View style={styles.previewContainer}>
          <Text style={styles.previewLabel}>Preview</Text>
          <Text style={styles.previewUri}>{selectedDoc}</Text>
          <TouchableOpacity style={styles.closePreview} onPress={() => setSelectedDoc(null)}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={styles.pickBtn}
        onPress={() => setShowPicker(true)}
        disabled={loading}
      >
        <Text style={styles.pickBtnText}>
          {loading ? "Uploading..." : "Submit for review"}
        </Text>
      </TouchableOpacity>

      {showPicker && !loading && (
        <Modal
          transparent
          statusBarTransparency={true}
          onRequestClose={() => setShowPicker(false)}
        >
          <View style={styles.pickerModalView}>
            <Text style={styles.pickerTitle}>Select document type</Text>
            {docs.map((doc) => (
              <TouchableOpacity
                key={doc}
                style={styles.pickerItem}
                onPress={() => setShowPicker(handlePick(doc))}>
                <Text style={styles.pickerText}>{doc}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowPicker(false)}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAF9",
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#5F6368",
    marginBottom: 20,
    textAlign: "center",
  },
  docFlatList: {
    marginTop: 16,
  },
  docItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  docLabel: {
    fontSize: 14,
    flex: 1,
  },
  docSelected: {
    color: "#009849",
    fontWeight: "600",
    marginLeft: 6,
  },
  previewContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  previewLabel: {
    fontSize: 12,
    color: "#5F6368",
    marginBottom: 4,
  },
  previewUri: {
    color: "#009849",
    fontSize: 12,
  },
  closePreview: {
    alignSelf: "flex-end",
    color: "#CCCCCC",
    fontSize: 12,
  },
  pickBtn: {
    marginTop: 24,
    backgroundColor: "#009849",
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignSelf: "stretch",
  },
  pickBtnText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
    textAlign: "center",
  },
  pickerModalView: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
  pickerItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  pickerText: {
    fontSize: 14,
  },
  pickerCancel: {
    marginTop: 12,
    alignSelf: "flex-end",
  },
  pickerCancelText: {
    color: "#5F6368",
    fontSize: 14,
  },
});

export default KycScreen;