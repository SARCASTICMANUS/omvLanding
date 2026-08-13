import React, { useRef, useState } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import COLORS from "../../shared/constants/colors";

export default function OTPInput({ length = 6, onComplete, error }) {
  const [values, setValues] = useState(Array(length).fill(""));
  const refs = useRef([]);

  const handleChange = (text, index) => {
    const digit = text.replace(/[^0-9]/g, "").slice(-1);
    const next = [...values];
    next[index] = digit;
    setValues(next);
    if (digit && index < length - 1) refs.current[index + 1]?.focus();
    if (digit && index === length - 1 && next.every(Boolean)) {
      onComplete?.(next.join(""));
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === "Backspace" && !values[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.container}>
      {values.map((val, i) => (
        <TextInput
          key={i}
          ref={(r) => { refs.current[i] = r; }}
          style={[styles.box, val && styles.boxFilled, error && styles.boxError]}
          value={val}
          onChangeText={(t) => handleChange(t, i)}
          onKeyPress={(e) => handleKeyPress(e, i)}
          keyboardType="number-pad"
          maxLength={1}
          selectTextOnFocus
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", gap: 10, justifyContent: "center", marginBottom: 24 },
  box: {
    width: 48, height: 56, borderRadius: 12, borderWidth: 1.5, borderColor: "#e5e7eb",
    backgroundColor: "#fff", textAlign: "center", fontSize: 22, fontWeight: "700",
    color: "#111827",
  },
  boxFilled: { borderColor: COLORS.primary, backgroundColor: "#f0faf2" },
  boxError: { borderColor: "#ef4444", backgroundColor: "#fef2f2" },
});
