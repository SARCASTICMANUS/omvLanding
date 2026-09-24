import React, { useState } from "react";
import { Platform, Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

export default function DatePickerModal({ visible, onClose, onSelect, selectedDate }) {
  const initial = selectedDate ? parseDate(selectedDate) : new Date(2000, 0, 1);
  const [date, setDate] = useState(initial);

  function parseDate(str) {
    const [d, m, y] = str.split("/").map(Number);
    return new Date(y, m - 1, d);
  }

  const handleChange = (event, selected) => {
    if (Platform.OS === "android") {
      onClose();
      if (selected) {
        const formatted = formatDate(selected);
        onSelect(formatted);
      }
    } else {
      if (selected) setDate(selected);
    }
  };

  const handleConfirm = () => {
    const formatted = formatDate(date);
    onSelect(formatted);
    onClose();
  };

  const formatDate = (d) => {
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  if (!visible) return null;

  if (Platform.OS === "web") {
    const toISO = (d) => {
      if (Number.isNaN(d.getTime())) return "";
      const day = d.getDate().toString().padStart(2, "0");
      const month = (d.getMonth() + 1).toString().padStart(2, "0");
      return `${d.getFullYear()}-${month}-${day}`;
    };
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>Select Date of Birth</Text>
            <input
              type="date"
              value={toISO(date)}
              min="1920-01-01"
              max={toISO(new Date())}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                const [y, m, d] = v.split("-").map(Number);
                setDate(new Date(y, m - 1, d));
              }}
              style={styles.input}
            />
            <View style={styles.actions}>
              <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirm} style={styles.confirmBtn}>
                <Text style={styles.confirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  if (Platform.OS === "android") {
    return (
      <DateTimePicker
        value={date}
        mode="date"
        display="spinner"
        maximumDate={new Date()}
        minimumDate={new Date(1920, 0, 1)}
        onChange={handleChange}
      />
    );
  }

  return (
    <DateTimePicker
      value={date}
      mode="date"
      display="spinner"
      maximumDate={new Date()}
      minimumDate={new Date(1920, 0, 1)}
      onChange={handleChange}
      onCancel={onClose}
      onConfirm={handleConfirm}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  card: { width: 320, backgroundColor: "#fff", borderRadius: 20, padding: 20 },
  title: { fontSize: 17, fontWeight: "800", color: "#111827", marginBottom: 14 },
  input: { width: "100%", height: 48, borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 14, paddingHorizontal: 14, fontSize: 15, backgroundColor: "#fafafa", boxSizing: "border-box", outlineColor: "#009849" },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 18 },
  cancelBtn: { paddingHorizontal: 16, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#e5e7eb" },
  cancelText: { fontSize: 14, fontWeight: "600", color: "#6b7280" },
  confirmBtn: { paddingHorizontal: 18, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#009849" },
  confirmText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
