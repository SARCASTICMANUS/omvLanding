import React, { useState } from "react";
import { Platform } from "react-native";
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
