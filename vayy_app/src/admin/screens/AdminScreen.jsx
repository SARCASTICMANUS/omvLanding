import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, FlatList } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../shared/lib/api";
import { TRANSPORT } from "../../constants/apiPaths";
import AdminMap from "../components/AdminMap";
import AdminRouteForm from "../components/AdminRouteForm";
import AdminStopsList from "../components/AdminStopsList";
import { fetchRoutes, createRoute, fetchStops } from "../adminSlice";

export default function AdminScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { routes, stops, loading } = useSelector((state) => state.admin || {});

  const [routeName, setRouteName] = useState("");
  const [routeData, setRouteData] = useState({ startPoint: null, endPoint: null, stops: [] });
  const [tab, setTab] = useState("map");
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    dispatch(fetchRoutes());
    dispatch(fetchStops());
    api.get(TRANSPORT.cities).then((res) => {
      const data = res.data?.data || res.data || [];
      setCities(data);
      if (data.length > 0) setSelectedCity(data[0]);
    }).catch(() => {});
  }, [dispatch]);

  const handleRouteChange = useCallback((data) => {
    setRouteData(data);
  }, []);

  const handleSaveRoute = useCallback(async () => {
    if (!routeName.trim()) {
      Alert.alert("Error", "Route name is required");
      return;
    }
    const { startPoint, endPoint, stops: waypoints } = routeData;
    if (!startPoint || !endPoint) {
      Alert.alert("Error", "Tap start and end points on the map");
      return;
    }
    try {
      await dispatch(createRoute({
        name: routeName.trim(),
        start_name: "Start",
        end_name: "End",
        city: selectedCity?.id,
        path: {
          type: "LineString",
          coordinates: [
            [startPoint[0], startPoint[1]],
            ...waypoints.map((s) => [s[0], s[1]]),
            [endPoint[0], endPoint[1]],
          ],
        },
      })).unwrap();
      setRouteName("");
      setRouteData({ startPoint: null, endPoint: null, stops: [] });
      setMapKey((k) => k + 1);
      Alert.alert("Success", "Route created");
      dispatch(fetchRoutes());
    } catch (err) {
      Alert.alert("Error", err?.message || "Failed to create route");
    }
  }, [routeName, routeData, dispatch, selectedCity]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ width: 28 }} />
        <Text style={styles.title}>Admin Panel</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.tabs}>
        {["map", "routes", "stops"].map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.activeTab]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.activeTabText]}>
              {t === "map" ? "Create Route" : t === "routes" ? `Routes (${routes?.length || 0})` : `Stops (${stops?.length || 0})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "map" && (
        <View style={styles.mapContainer}>
          <AdminMap key={mapKey} onRouteChange={handleRouteChange} />
          <ScrollView style={styles.formPanel} keyboardShouldPersistTaps="handled">
            <View style={styles.formRow}>
              <TouchableOpacity style={styles.cityPicker} onPress={() => setCityPickerVisible(true)}>
                <Text style={styles.cityPickerLabel}>City: {selectedCity?.name || "Select"}</Text>
                <Ionicons name="chevron-down" size={16} color="#6B7280" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={() => { setRouteData({ startPoint: null, endPoint: null, stops: [] }); setMapKey((k) => k + 1); }}
              >
                <Ionicons name="refresh" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
            <AdminRouteForm
              routeName={routeName}
              setRouteName={setRouteName}
              onSave={handleSaveRoute}
            />
            {routeData.stops.length > 0 && (
              <AdminStopsList stops={routeData.stops} />
            )}
          </ScrollView>
        </View>
      )}

      {tab === "routes" && (
        <ScrollView style={styles.listPanel}>
          {loading ? (
            <Text style={styles.loadingText}>Loading...</Text>
          ) : routes?.length === 0 ? (
            <Text style={styles.emptyText}>No routes yet</Text>
          ) : (
            routes?.map((r) => (
              <View key={r.id} style={styles.listItem}>
                <Text style={styles.itemTitle}>{r.name}</Text>
                <Text style={styles.itemSub}>{r.route_code} — {r.start_name} → {r.end_name}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={cityPickerVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select City</Text>
            <FlatList
              data={cities}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.cityOption, selectedCity?.id === item.id && styles.cityOptionSelected]}
                  onPress={() => { setSelectedCity(item); setCityPickerVisible(false); }}
                >
                  <Text style={[styles.cityOptionText, selectedCity?.id === item.id && styles.cityOptionTextSelected]}>
                    {item.name}{item.state ? `, ${item.state}` : ""}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setCityPickerVisible(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {tab === "stops" && (
        <ScrollView style={styles.listPanel}>
          {stops?.length === 0 ? (
            <Text style={styles.emptyText}>No stops yet</Text>
          ) : (
            stops?.map((s) => (
              <View key={s.id} style={styles.listItem}>
                <Text style={styles.itemTitle}>{s.name}</Text>
                <Text style={styles.itemSub}>Order: {s.order}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAF9" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#111827" },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
  },
  activeTab: { backgroundColor: "#009849" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  activeTabText: { color: "#fff" },
  mapContainer: { flex: 1 },
  formPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: 220,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  listPanel: { flex: 1, padding: 16 },
  loadingText: { textAlign: "center", color: "#9CA3AF", marginTop: 40 },
  emptyText: { textAlign: "center", color: "#9CA3AF", marginTop: 40 },
  listItem: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  itemTitle: { fontSize: 15, fontWeight: "600", color: "#111827" },
  itemSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  formRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  resetBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  cityPicker: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
  },
  cityPickerLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 16,
    maxHeight: "60%",
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#111827", marginBottom: 12, textAlign: "center" },
  cityOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 4,
  },
  cityOptionSelected: { backgroundColor: "#00984915" },
  cityOptionText: { fontSize: 15, color: "#374151" },
  cityOptionTextSelected: { color: "#009849", fontWeight: "700" },
  modalClose: { marginTop: 8, paddingVertical: 12, alignItems: "center" },
  modalCloseText: { fontSize: 15, color: "#6B7280", fontWeight: "600" },
});
