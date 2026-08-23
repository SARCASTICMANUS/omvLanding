import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../../lib/api";

function LocationSearch({ label, placeholder, value, onSelect, dropdownLift = 90, isPickup }) {
  const [query, setQuery] = useState(value?.name || value?.display_name || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSelection, setHasSelection] = useState(Boolean(value));
  const [dropdownHeight, setDropdownHeight] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (hasSelection) {
      return undefined;
    }

    if (!query || query.length < 3) {
      setResults([]);
      setDropdownHeight(0);
      return undefined;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        const res = await api.get("/api/transport/geocode/search/", {
          params: { q: query, limit: 5, countrycodes: "in" },
        });
        if (!active) return;
        const data = res.data?.data || res.data;
        setResults(Array.isArray(data) ? data : []);
      } catch {
        if (!active) return;
        setResults([]);
        setDropdownHeight(0);
      } finally {
        if (active) setLoading(false);
      }
    }, 500);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [hasSelection, query]);

  const handleSelect = (item) => {
    const next = {
      lat: Number(item.lat),
      lon: Number(item.lon),
      name: item.name || item.display_name?.split(",")?.[0],
      display_name: item.display_name,
    };
    setQuery(next.display_name || next.name || "");
    setResults([]);
    setDropdownHeight(0);
    setLoading(false);
    setHasSelection(true);
    onSelect(next);
  };

  const handleChangeText = (text) => {
    setQuery(text);
    setHasSelection(false);

    if (text.length < 3) {
      setResults([]);
      setDropdownHeight(0);
    }
  };

  const handleClear = () => {
    setQuery("");
    setHasSelection(false);
    setResults([]);
    setDropdownHeight(0);
    inputRef.current?.focus();
  };

  const showResults = results.length > 0;

  return (
    <View
      style={[
        styles.locationField,
        showResults && { marginBottom: dropdownHeight + 20, zIndex: 9999 },
      ]}
    >
      <View style={styles.searchInputWrap}>
        <View style={[styles.inputIconBox, isPickup ? styles.inputIconPickup : styles.inputIconDest]}>
          {isPickup ? (
            <Ionicons name="location" size={16} color="#fff" />
          ) : (
            <Ionicons name="flag" size={14} color="#fff" />
          )}
        </View>
        <View style={styles.inputCol}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <TextInput
            ref={inputRef}
            autoCapitalize="none"
            onChangeText={handleChangeText}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
            value={query}
          />
        </View>
        {query.length > 0 && !hasSelection && (
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
        {hasSelection && <Ionicons name="checkmark-circle" size={18} color="#009849" />}
      </View>

      {showResults ? (
        <ScrollView
          onLayout={(e) => setDropdownHeight(e.nativeEvent.layout.height)}
          style={[styles.dropdown, { top: dropdownLift }]}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {results.map((item) => (
            <Pressable key={String(item.place_id)} onPress={() => handleSelect(item)} style={styles.resultRow}>
              <View style={styles.resultIcon}>
                <Ionicons name="location-outline" size={16} color="#009849" />
              </View>
              <View style={styles.resultCol}>
                <Text numberOfLines={1} style={styles.resultTitle}>
                  {item.name || item.display_name?.split(",")?.[0]}
                </Text>
                <Text numberOfLines={2} style={styles.resultSubtitle}>
                  {item.display_name}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      ) : loading ? (
        <Text style={styles.searchingText}>Searching...</Text>
      ) : null}
    </View>
  );
}

export default LocationSearch;

const styles = StyleSheet.create({
  locationField: {
    marginBottom: 16,
    position: "relative",
    zIndex: 10,
  },
  searchInputWrap: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  inputIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  inputIconPickup: {
    backgroundColor: "#009849",
  },
  inputIconDest: {
    backgroundColor: "#f59e0b",
  },
  inputCol: {
    flex: 1,
    gap: 2,
  },
  fieldLabel: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  searchInput: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
    minHeight: 22,
    paddingVertical: 0,
    margin: 0,
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  dropdown: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderRadius: 14,
    borderWidth: 1,
    left: 0,
    maxHeight: 200,
    position: "absolute",
    right: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    zIndex: 9999,
    elevation: 20,
    paddingTop: 4,
    paddingBottom: 4,
  },
  resultRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomColor: "#F3F4F6",
    borderBottomWidth: 1,
  },
  resultIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#ECFAF1",
    justifyContent: "center",
    alignItems: "center",
  },
  resultCol: {
    flex: 1,
  },
  resultTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  resultSubtitle: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
    lineHeight: 15,
  },
  searchingText: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },
});
