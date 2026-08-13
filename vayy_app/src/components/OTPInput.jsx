import React, { useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";

export default function OTPInput({ accent = colors.primary }) {
  const [value, setValue] = useState(["", "", "", ""]);
  const [focused, setFocused] = useState(0);
  const refs = useRef([]);

  const onChange = (text, index) => {
    const next = [...value];
    next[index] = text.slice(-1);
    setValue(next);
    if (text && index < 3) {
      refs.current[index + 1]?.focus();
    }
  };

  return (
    <View style={styles.row}>
      {value.map((digit, index) => (
        <TextInput
          key={`otp-${index}`}
          ref={(ref) => {
            refs.current[index] = ref;
          }}
          style={[styles.box, focused === index && { borderColor: accent }]}
          value={digit}
          onChangeText={(text) => onChange(text, index)}
          onFocus={() => setFocused(index)}
          keyboardType="number-pad"
          maxLength={1}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  box: {
    flex: 1,
    height: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    textAlign: "center",
    ...typography.mono,
  },
});
