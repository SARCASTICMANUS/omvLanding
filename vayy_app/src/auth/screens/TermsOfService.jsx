import React, { useState, useEffect, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import COLORS from "../../shared/constants/colors";
import TOS_MD from "../../data/tosContent";

function parseMd(md) {
  const lines = md.split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2).trim() });
      i++;
    } else if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      i++;
    } else if (line.startsWith("> ")) {
      let quote = line.slice(2);
      i++;
      while (i < lines.length && lines[i].startsWith("> ")) {
        quote += " " + lines[i].slice(2);
        i++;
      }
      blocks.push({ type: "quote", text: quote.trim() });
    } else if (line.startsWith("- ")) {
      const items = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2).trim());
        i++;
      }
      blocks.push({ type: "list", items });
    } else if (line.startsWith("---")) {
      blocks.push({ type: "hr" });
      i++;
    } else if (line.trim() === "") {
      i++;
    } else {
      let para = line;
      i++;
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !lines[i].startsWith("#") &&
        !lines[i].startsWith("- ") &&
        !lines[i].startsWith("> ") &&
        !lines[i].startsWith("---")
      ) {
        para += " " + lines[i];
        i++;
      }
      blocks.push({ type: "p", text: para.trim() });
    }
  }
  return blocks;
}

function renderInline(text) {
  const parts = [];
  const regex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <Text key={match.index} style={{ fontWeight: "700" }}>
        {match[1]}
      </Text>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export default function TermsOfService({ navigation }) {
  const blocks = useMemo(() => parseMd(TOS_MD), []);

  return (
    <SafeAreaView style={styles.root}>
      <TouchableOpacity
        style={styles.back}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <ArrowLeft size={22} color={COLORS.text} />
      </TouchableOpacity>
      <View style={styles.header}>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.sub}>Last updated: 9 September 2026</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {blocks.map((block, i) => {
          if (block.type === "h1") {
            return (
              <Text key={i} style={styles.h1}>
                {block.text}
              </Text>
            );
          }
          if (block.type === "h2") {
            return (
              <Text key={i} style={styles.h2}>
                {block.text}
              </Text>
            );
          }
          if (block.type === "quote") {
            return (
              <View key={i} style={styles.quoteBox}>
                <Text style={styles.quoteLabel}>Important</Text>
                <Text style={styles.quoteText}>
                  {renderInline(block.text)}
                </Text>
              </View>
            );
          }
          if (block.type === "list") {
            return (
              <View key={i} style={styles.listBlock}>
                {block.items.map((item, j) => (
                  <View key={j} style={styles.listItem}>
                    <Text style={styles.bullet}>{"\u2022"}</Text>
                    <Text style={styles.listText}>
                      {renderInline(item)}
                    </Text>
                  </View>
                ))}
              </View>
            );
          }
          if (block.type === "hr") {
            return <View key={i} style={styles.hr} />;
          }
          return (
            <Text key={i} style={styles.p}>
              {renderInline(block.text)}
            </Text>
          );
        })}
        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 16,
    marginTop: 8,
  },
  header: { paddingHorizontal: 24, marginBottom: 8 },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
    marginBottom: 4,
  },
  scroll: { flex: 1, paddingHorizontal: 24 },
  scrollContent: { paddingBottom: 100 },
  h1: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  h2: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 20,
    marginBottom: 6,
  },
  p: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 19,
    marginBottom: 8,
  },
  quoteBox: {
    backgroundColor: "#fffbeb",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  quoteLabel: { fontSize: 12, fontWeight: "700", color: "#92400e", marginBottom: 4 },
  quoteText: { fontSize: 12, color: "#78350f", lineHeight: 17 },
  listBlock: { marginBottom: 12, marginLeft: 4 },
  listItem: { flexDirection: "row", gap: 8, marginBottom: 4 },
  bullet: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "700",
    width: 14,
  },
  listText: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 19,
    flex: 1,
  },
  hr: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 12 },
});
