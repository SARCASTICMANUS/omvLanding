import React, { useState } from "react";
import {
  FlatList, Pressable, StyleSheet, Text, TextInput,
  TouchableOpacity, View, Platform, StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import COLORS from "../../shared/constants/colors";
import SPACING from "../../shared/constants/spacing";
import { NOMINATIM_SEARCH } from "../../constants";

export default function DestinationSearchScreen({ navigation }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (text) => {
    setQuery(text);
    if (text.length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await NOMINATIM_SEARCH(text);
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item) => {
    navigation.navigate("PassengerTripPlanner", {
      destination: {
        lat: Number(item.lat),
        lon: Number(item.lon),
        name: item.name || item.display_name?.split(",")?.[0],
        display_name: item.display_name,
      },
    });
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Destination Search</Text>
      </View>
      <View style={styles.searchBar}>
        <TextInput
          autoCapitalize="none"
          onChangeText={handleSearch}
          placeholder="Search destination..."
          placeholderTextColor={COLORS.textLight}
          style={styles.input}
          value={query}
        />
      </View>
      {loading && <Text style={styles.loadingText}>Searching...</Text>}
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.place_id)}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable onPress={() => handleSelect(item)} style={styles.resultRow}>
            <Text style={styles.resultTitle}>
              {item.name || item.display_name?.split(",")?.[0]}
            </Text>
            <Text numberOfLines={2} style={styles.resultSub}>{item.display_name}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          !loading && query.length >= 3 ? (
            <Text style={styles.emptyText}>No destinations found</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.base,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + SPACING.base : SPACING.base,
    gap: SPACING.md,
  },
  backBtn: { width: 38, height: 38, justifyContent: "center", alignItems: "center" },
  backText: { fontSize: 34, color: COLORS.text, lineHeight: 36 },
  title: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  searchBar: {
    marginHorizontal: SPACING.base,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  input: { height: 48, fontSize: 15, color: COLORS.text, flex: 1 },
  loadingText: { textAlign: "center", color: COLORS.textMuted, fontSize: 13, marginTop: SPACING.md },
  resultRow: {
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  resultTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  resultSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  emptyText: { textAlign: "center", color: COLORS.textMuted, fontSize: 14, marginTop: SPACING.xl },
});
