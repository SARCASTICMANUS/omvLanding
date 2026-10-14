import React from "react";
import { View, Text, StyleSheet, ScrollView, StatusBar } from "react-native";
import COLORS from "../constants/colors";
import ScreenHeader from "../components/navigation/ScreenHeader";
import { PRIVACY_POLICY } from "../../data/landingPageData";

export default function PrivacyPolicyScreen({ navigation }) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#009849" />
      <ScreenHeader
        title="Privacy Policy"
        subtitle="How we handle your data"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lastUpdated}>Last updated: {PRIVACY_POLICY.lastUpdated}</Text>
        <Text style={styles.paragraph}>{PRIVACY_POLICY.intro}</Text>

        {PRIVACY_POLICY.sections.map((section, i) => (
          <View key={i}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.paragraphs.map((p, j) => (
              <Text key={j} style={styles.paragraph}>{p}</Text>
            ))}
            {section.bullets &&
              section.bullets.map((b, j) => (
                <Text key={j} style={styles.bullet}>• {b}</Text>
              ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  lastUpdated: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: "600",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
    marginTop: 24,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
    lineHeight: 22,
    marginBottom: 12,
  },
  bullet: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
    lineHeight: 22,
    marginLeft: 8,
    marginBottom: 4,
  },
});
