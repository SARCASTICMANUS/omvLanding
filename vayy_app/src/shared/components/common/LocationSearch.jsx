import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../../lib/api";

// Use registered backend endpoints: database stops plus broader Nominatim places.
const DB_SEARCH_PATH = "/api/transport/geocode/db/search/";
const GEOCODE_SEARCH_PATH = "/api/transport/geocode/search/";
const DROPDOWN_MAX_HEIGHT = 440;

// Backend result -> the shape the existing rows already render, plus the
// stop id so downstream route search can use a real Stop PK when there is one.
const mapResult = (item) => {
  const lat = Number(item?.lat);
  const lng = Number(item?.lng ?? item?.lon);
  const name = item?.name || item?.display_name?.split(",")?.[0];
  const displayName = item?.display_name || item?.name;
  return {
    ...item,
    name,
    display_name: displayName,
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lng) ? lng : null,
    kind: item?.kind || (item?.id ? "city_stop" : "osm_place"),
    stop_id: item?.stop_id ?? (item?.id ? item.id : null),
    city_name: item?.city_name || item?.address?.city || item?.address?.town || item?.address?.county || "",
    key: String(item?.kind || (item?.id ? "city_stop" : "osm_place")) + ":" + String(item?.id ?? item?.osm_id ?? item?.place_id ?? name),
  };
};

function LocationSearch({
  label,
  placeholder,
  value,
  onSelect,
  dropdownLift = 90,
  isPickup,
  rightAction,
  cityName,
}) {
  const [query, setQuery] = useState(value?.name || value?.display_name || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSelection, setHasSelection] = useState(Boolean(value));
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);
  const editingRef = useRef(false);

  useEffect(() => {
    if (hasSelection) {
      return undefined;
    }

    if (!query || query.length < 3) {
      setResults([]);
      setSearched(false);
      return undefined;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        const params = { q: query.trim(), limit: 5, countrycodes: "in" };
        const geocodeParams = {
          ...params,
          q: cityName ? `${query.trim()}, ${cityName}` : query.trim(),
        };
        const [dbResponse, geoResponse] = await Promise.allSettled([
          api.get(DB_SEARCH_PATH, { params }),
          api.get(GEOCODE_SEARCH_PATH, { params: geocodeParams }),
        ]);
        if (!active) return;

        const unwrap = (response) => {
          if (response.status !== "fulfilled") return [];
          const body = response.value?.data?.data ?? response.value?.data;
          return Array.isArray(body) ? body : Array.isArray(body?.results) ? body.results : [];
        };
        const dbResults = unwrap(dbResponse).map((item) => ({ ...item, kind: "city_stop" }));
        const geoResults = unwrap(geoResponse).map((item) => ({ ...item, kind: "osm_place" }));
        const seen = new Set();
        const merged = [...dbResults, ...geoResults].filter((item) => {
          const lat = Number(item?.lat);
          const lon = Number(item?.lon ?? item?.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lon) || (!item?.name && !item?.display_name)) return false;
          const key = lat.toFixed(5) + ":" + lon.toFixed(5);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
        merged.sort((a, b) => {
          const score = (item) => {
            const text = `${item.name || ""} ${item.display_name || ""} ${item.city_name || ""} ${item.address?.city || ""}`.toLocaleLowerCase();
            const cityMatch = cityName && text.includes(cityName.toLocaleLowerCase()) ? 5 : 0;
            return cityMatch + terms.reduce((total, term) => total + Number(text.includes(term)), 0);
          };
          return score(b) - score(a);
        });
        setResults(merged.slice(0, 5).map(mapResult));
        setSearched(true);
      } catch {
        if (!active) return;
        setResults([]);
        setSearched(true);
      } finally {
        if (active) setLoading(false);
      }
    }, 500);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [cityName, hasSelection, query]);

  const handleSelect = (item) => {
    const next = {
      lat: Number(item.lat),
      lon: Number(item.lon),
      name: item.name || item.display_name?.split(",")?.[0],
      display_name: item.display_name,
      stop_id: item.stop_id ?? null,
      kind: item.kind ?? null,
    };
    setQuery(next.display_name || next.name || "");
    setResults([]);
    setSearched(false);
    setLoading(false);
    setHasSelection(true);
    onSelect(next);
  };

  useEffect(() => {
    if (value) {
      editingRef.current = false;
      setQuery(value.name || value.display_name || "");
      setHasSelection(true);
    } else {
      // Typing clears the parent's selected coordinates, but must not clear the
      // text currently being edited. External resets (e.g. swapping endpoints)
      // still clear the input.
      if (!editingRef.current) setQuery("");
      setHasSelection(false);
    }
    setResults([]);
    setSearched(false);
    setLoading(false);
  }, [value]);

  const handleChangeText = (text) => {
    editingRef.current = true;
    setQuery(text);
    setHasSelection(false);
    setSearched(false);
    setResults([]);
    onSelect(null);
  };

  const handleClear = () => {
    editingRef.current = true;
    setQuery("");
    setHasSelection(false);
    setResults([]);
    setSearched(false);
    onSelect(null);
    inputRef.current?.focus();
  };

  const showResults = results.length > 0;
  const showEmpty =
    searched && !loading && !showResults && !hasSelection && query.length >= 3;
  const showDropdown = showResults || showEmpty;

  return (
    <View
      style={[
        styles.locationField,
        showDropdown && { zIndex: 9999 },
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
        {rightAction}
      </View>

      {showResults ? (
        // A plain View, NOT a ScrollView. Nested inside the host screen's own
        // ScrollView, a second ScrollView claims the touch before the rows'
        // Pressable gets it - the rows rendered and were visible, but onPress
        // never fired. The API caps results at 5, so the list is short enough
        // not to need its own scroller.
        <View style={styles.dropdown}>
          {results.map((item) => (
            <Pressable key={item.key} onPress={() => handleSelect(item)} style={styles.resultRow}>
              <View style={styles.resultIcon}>
                <Ionicons name="location-outline" size={16} color="#009849" />
              </View>
              <View style={styles.resultCol}>
                <Text numberOfLines={1} style={styles.resultTitle}>
                  {item.name || item.display_name?.split(",")?.[0]}
                </Text>
                <Text numberOfLines={2} style={styles.resultSubtitle}>
                  {item.display_name || [item.name, item.city_name].filter(Boolean).join(", ")}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : showEmpty ? (
        <View style={styles.dropdown}>
          <View style={styles.emptyRow}>
            <View style={styles.emptyIcon}>
              <Ionicons name="search-outline" size={16} color="#9CA3AF" />
            </View>
            <View style={styles.resultCol}>
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text numberOfLines={1} style={styles.emptySubtitle}>
                {`No matches for "${query}". Try a different search.`}
              </Text>
            </View>
          </View>
        </View>
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
    maxHeight: DROPDOWN_MAX_HEIGHT,
    marginTop: 8,
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
  emptyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  emptyIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "700",
  },
  emptySubtitle: {
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
