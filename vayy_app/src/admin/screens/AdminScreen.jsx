import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, FlatList,
  TextInput, KeyboardAvoidingView, Platform, Image, ActivityIndicator,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../shared/lib/api";
import { TRANSPORT, ADMIN } from "../../constants/apiPaths";
import { DRIVER_ROLES } from "../../constants";
import AdminMap from "../components/AdminMap";
import AdminRouteForm from "../components/AdminRouteForm";
import AdminStopsList from "../components/AdminStopsList";
import { fetchRoutes, createRoute, fetchStops } from "../adminSlice";

const DRIVER_ROLES_SET = new Set(DRIVER_ROLES);

function formatLocation(loc) {
  if (!loc) return "—";
  if (typeof loc === "object" && loc.lat !== undefined && loc.lng !== undefined) {
    return `${Number(loc.lat).toFixed(4)}, ${Number(loc.lng).toFixed(4)}`;
  }
  if (typeof loc === "string") return loc;
  return "—";
}

function formatValue(val) {
  if (val === null || val === undefined) return "—";
  if (typeof val === "object") {
    if (val.lat !== undefined && val.lng !== undefined) return formatLocation(val);
    if (Array.isArray(val)) return val.join(", ");
    return JSON.stringify(val);
  }
  return String(val);
}

export default function AdminScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { routes, stops, loading } = useSelector((state) => state.admin || {});

  const [routeName, setRouteName] = useState("");
  const [routeData, setRouteData] = useState({ startPoint: null, endPoint: null, stops: [] });
  const [tab, setTab] = useState("users");
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [pendingDrivers, setPendingDrivers] = useState([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [expandedDriver, setExpandedDriver] = useState(null);

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dispatch(fetchRoutes());
    dispatch(fetchStops());
    api.get(TRANSPORT.cities).then((res) => {
      const data = res.data?.data || res.data || [];
      setCities(data);
      if (data.length > 0) setSelectedCity(data[0]);
    }).catch(() => {});
  }, [dispatch]);

  useEffect(() => {
    if (tab === "drivers") fetchPendingDrivers();
    if (tab === "users") fetchUsers();
  }, [tab]);

  const fetchPendingDrivers = async () => {
    setDriversLoading(true);
    try {
      const res = await api.get(ADMIN.driversPending);
      setPendingDrivers(res.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch pending drivers:", err);
    } finally {
      setDriversLoading(false);
    }
  };

  const handleDriverAction = async (driverId, action) => {
    try {
      await api.patch(ADMIN.driverVerify(driverId), { action });
      Alert.alert("Success", `Driver ${action === "approve" ? "approved" : "rejected"}`);
      setPendingDrivers((prev) => prev.filter((d) => d.id !== driverId));
      setExpandedDriver(null);
    } catch (err) {
      Alert.alert("Error", err?.response?.data?.message || "Action failed");
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await api.get(ADMIN.users);
      setUsers(res.data?.data || res.data?.results || []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchUserProfile = async (user) => {
    setProfileLoading(true);
    setSelectedUser(user);
    setUserProfile(null);
    setEditMode(false);
    try {
      const isDriver = DRIVER_ROLES_SET.has(user.role);
      const url = isDriver ? ADMIN.driverProfile(user.id) : ADMIN.passengerProfile(user.id);
      const res = await api.get(url);
      const data = res.data?.data || res.data;
      if (data && typeof data === "object") {
        if (data.home_location && typeof data.home_location === "object" && !("lat" in data.home_location)) {
          console.warn("[Admin] home_location is object without lat/lng:", data.home_location);
        }
      }
      setUserProfile(data);
      setEditForm({
        first_name: data?.first_name || "",
        last_name: data?.last_name || "",
        display_name: data?.display_name || "",
        phone_number: data?.phone_number || "",
        bio: data?.bio || "",
        profile_photo: data?.profile_photo || "",
        ...(isDriver ? {
          license_number: data?.license_number || "",
          vehicle_number: data?.vehicle_number || "",
          vehicle_type: data?.vehicle_type || "",
        } : {}),
      });
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      Alert.alert("Error", "Failed to load profile");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const isDriver = DRIVER_ROLES_SET.has(selectedUser.role);
      const url = isDriver ? ADMIN.driverProfile(selectedUser.id) : ADMIN.passengerProfile(selectedUser.id);
      const payload = { ...editForm };
      await api.put(url, payload);
      Alert.alert("Success", "Profile updated");
      setEditMode(false);
      fetchUserProfile(selectedUser);
    } catch (err) {
      Alert.alert("Error", err?.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      (u.first_name || "").toLowerCase().includes(q) ||
      (u.last_name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.role || "").toLowerCase().includes(q)
    );
  });

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

  const isDriverUser = selectedUser && DRIVER_ROLES_SET.has(selectedUser.role);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ width: 28 }} />
        <Text style={styles.title}>Admin Panel</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.tabs}>
        {["users", "drivers", "map", "routes", "stops"].map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.activeTab]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.activeTabText]}>
              {t === "users" ? `Users (${users.length})` : t === "drivers" ? `Drivers (${pendingDrivers.length})` : t === "map" ? "Create Route" : t === "routes" ? `Routes (${routes?.length || 0})` : `Stops (${stops?.length || 0})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "users" && (
        <View style={{ flex: 1 }}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, email, or role..."
              placeholderTextColor="#9CA3AF"
              value={userSearch}
              onChangeText={setUserSearch}
            />
            {userSearch.length > 0 && (
              <TouchableOpacity onPress={() => setUserSearch("")}>
                <Ionicons name="close-circle" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView style={styles.listPanel}>
            {usersLoading ? (
              <Text style={styles.loadingText}>Loading users...</Text>
            ) : filteredUsers.length === 0 ? (
              <Text style={styles.emptyText}>No users found</Text>
            ) : (
              filteredUsers.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={styles.userCard}
                  onPress={() => fetchUserProfile(u)}
                  activeOpacity={0.7}
                >
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>
                      {(u.first_name || u.email || "?")[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{u.first_name} {u.last_name}</Text>
                    <Text style={styles.userEmail}>{u.email}</Text>
                    <View style={styles.userMeta}>
                      <View style={[styles.roleBadge, { backgroundColor: DRIVER_ROLES_SET.has(u.role) ? "#ECFDF5" : "#EFF6FF" }]}>
                        <Text style={[styles.roleBadgeText, { color: DRIVER_ROLES_SET.has(u.role) ? "#065F46" : "#1E40AF" }]}>
                          {DRIVER_ROLES_SET.has(u.role) ? "Marshal" : u.role || "User"}
                        </Text>
                      </View>
                      {u.is_verified && (
                        <View style={[styles.roleBadge, { backgroundColor: "#D1FAE5" }]}>
                          <Text style={[styles.roleBadgeText, { color: "#065F46" }]}>Verified</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}

      {tab === "drivers" && (
        <ScrollView style={styles.listPanel}>
          {driversLoading ? (
            <Text style={styles.loadingText}>Loading drivers...</Text>
          ) : pendingDrivers.length === 0 ? (
            <Text style={styles.emptyText}>No pending drivers</Text>
          ) : (
            pendingDrivers.map((driver) => (
              <TouchableOpacity
                key={driver.id}
                style={styles.driverCard}
                onPress={() => setExpandedDriver(expandedDriver === driver.id ? null : driver.id)}
                activeOpacity={0.7}
              >
                <View style={styles.driverHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.driverName}>
                      {driver.first_name} {driver.last_name}
                    </Text>
                    <Text style={styles.driverEmail}>{driver.email}</Text>
                    <Text style={styles.driverRole}>
                      {driver.role === "bikedriver" ? "Bike Driver" : "Auto Driver"}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: "#FEF3C7" }]}>
                    <Text style={[styles.statusText, { color: "#D97706" }]}>Pending</Text>
                  </View>
                </View>

                {expandedDriver === driver.id && (
                  <View style={styles.driverDetails}>
                    {driver.profile && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Profile</Text>
                        {driver.profile.phone_number && (
                          <Text style={styles.detailLine}>Phone: {formatValue(driver.profile.phone_number)}</Text>
                        )}
                        {driver.profile.license_number && (
                          <Text style={styles.detailLine}>License: {formatValue(driver.profile.license_number)}</Text>
                        )}
                        {driver.profile.vehicle_number && (
                          <Text style={styles.detailLine}>Vehicle: {formatValue(driver.profile.vehicle_number)}</Text>
                        )}
                      </View>
                    )}

                    {driver.vehicle && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Vehicle</Text>
                        <Text style={styles.detailLine}>Number: {formatValue(driver.vehicle.vehicle_number)}</Text>
                        <Text style={styles.detailLine}>Type: {formatValue(driver.vehicle.vehicle_type)}</Text>
                        <Text style={styles.detailLine}>Status: {formatValue(driver.vehicle.status)}</Text>
                      </View>
                    )}

                    {driver.documents?.length > 0 && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Documents</Text>
                        {driver.documents.map((doc) => (
                          <View key={doc.id} style={styles.docRow}>
                            <Text style={styles.docType}>{doc.document_type}</Text>
                            <View style={[styles.docStatus, {
                              backgroundColor: doc.status === "verified" ? "#D1FAE5" : doc.status === "rejected" ? "#FEE2E2" : "#FEF3C7",
                            }]}>
                              <Text style={[styles.docStatusText, {
                                color: doc.status === "verified" ? "#065F46" : doc.status === "rejected" ? "#991B1B" : "#92400E",
                              }]}>{doc.status}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.approveBtn]}
                        onPress={() => handleDriverAction(driver.id, "approve")}
                      >
                        <Ionicons name="checkmark-circle" size={18} color="#fff" />
                        <Text style={styles.actionBtnText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.rejectBtn]}
                        onPress={() => handleDriverAction(driver.id, "reject")}
                      >
                        <Ionicons name="close-circle" size={18} color="#fff" />
                        <Text style={styles.actionBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

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

      {/* ── User Profile Modal ── */}
      <Modal visible={!!selectedUser} animationType="slide" onRequestClose={() => { setSelectedUser(null); setEditMode(false); }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.profileModal}>
            <View style={styles.profileHeader}>
              <TouchableOpacity onPress={() => { setSelectedUser(null); setEditMode(false); }} style={styles.profileBackBtn}>
                <Ionicons name="arrow-back" size={22} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.profileHeaderTitle}>
                {editMode ? "Edit Profile" : "User Profile"}
              </Text>
              {profileLoading ? (
                <View style={{ width: 40 }} />
              ) : (
                <TouchableOpacity
                  onPress={() => setEditMode(!editMode)}
                  style={styles.profileEditBtn}
                >
                  <Text style={styles.profileEditText}>{editMode ? "Cancel" : "Edit"}</Text>
                </TouchableOpacity>
              )}
            </View>

            {profileLoading ? (
              <View style={styles.profileLoadingWrap}>
                <ActivityIndicator size="large" color="#009849" />
                <Text style={styles.loadingText}>Loading profile...</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.profileBody} keyboardShouldPersistTaps="handled">
                {/* Avatar */}
                <View style={styles.profileAvatarSection}>
                  {editMode && editForm.profile_photo ? (
                    <Image source={{ uri: editForm.profile_photo }} style={styles.profileAvatar} />
                  ) : userProfile?.profile_photo ? (
                    <Image source={{ uri: userProfile.profile_photo }} style={styles.profileAvatar} />
                  ) : (
                    <View style={[styles.profileAvatar, { backgroundColor: "#009849", justifyContent: "center", alignItems: "center" }]}>
                      <Text style={{ fontSize: 28, fontWeight: "800", color: "#fff" }}>
                        {(selectedUser?.first_name || selectedUser?.email || "?")[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.profileUserName}>{String(selectedUser?.first_name || "")} {String(selectedUser?.last_name || "")}</Text>
                  <Text style={styles.profileUserEmail}>{String(selectedUser?.email || "")}</Text>
                  <View style={[styles.roleBadge, { backgroundColor: isDriverUser ? "#ECFDF5" : "#EFF6FF", alignSelf: "center", marginTop: 6 }]}>
                    <Text style={[styles.roleBadgeText, { color: isDriverUser ? "#065F46" : "#1E40AF" }]}>
                      {isDriverUser ? "Marshal" : selectedUser?.role || "User"}
                    </Text>
                  </View>
                </View>

                {editMode ? (
                  /* ── Edit Form ── */
                  <View style={styles.profileCard}>
                    <ProfileField label="First Name" value={editForm.first_name} onChangeText={(v) => setEditForm((p) => ({ ...p, first_name: v }))} />
                    <ProfileField label="Last Name" value={editForm.last_name} onChangeText={(v) => setEditForm((p) => ({ ...p, last_name: v }))} />
                    <ProfileField label="Display Name" value={editForm.display_name} onChangeText={(v) => setEditForm((p) => ({ ...p, display_name: v }))} />
                    <ProfileField label="Phone" value={editForm.phone_number} onChangeText={(v) => setEditForm((p) => ({ ...p, phone_number: v }))} keyboardType="phone-pad" />
                    <ProfileField label="Bio" value={editForm.bio} onChangeText={(v) => setEditForm((p) => ({ ...p, bio: v }))} multiline />
                    <ProfileField label="Profile Photo URL" value={editForm.profile_photo} onChangeText={(v) => setEditForm((p) => ({ ...p, profile_photo: v }))} autoCapitalize="none" />
                    {isDriverUser && (
                      <>
                        <ProfileField label="License Number" value={editForm.license_number} onChangeText={(v) => setEditForm((p) => ({ ...p, license_number: v }))} autoCapitalize="characters" />
                        <ProfileField label="Vehicle Number" value={editForm.vehicle_number} onChangeText={(v) => setEditForm((p) => ({ ...p, vehicle_number: v }))} autoCapitalize="characters" />
                        <ProfileField label="Vehicle Type" value={editForm.vehicle_type} onChangeText={(v) => setEditForm((p) => ({ ...p, vehicle_type: v }))} />
                      </>
                    )}
                    <TouchableOpacity
                      style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                      onPress={handleSaveProfile}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.saveBtnText}>Save Changes</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* ── View Mode ── */
                  <View style={styles.profileCard}>
                    <ProfileDetailRow icon="person-outline" label="First Name" value={userProfile?.first_name} />
                    <ProfileDetailRow icon="person-outline" label="Last Name" value={userProfile?.last_name} />
                    <ProfileDetailRow icon="text-outline" label="Display Name" value={userProfile?.display_name} />
                    <ProfileDetailRow icon="call-outline" label="Phone" value={userProfile?.phone_number} />
                    <ProfileDetailRow icon="document-text-outline" label="Bio" value={userProfile?.bio} />
                    <ProfileDetailRow icon="mail-outline" label="Email" value={userProfile?.email} />
                    <ProfileDetailRow icon="location-outline" label="City" value={userProfile?.city_name || String(userProfile?.city || "")} />
                    <ProfileDetailRow icon="calendar-outline" label="Joined" value={userProfile?.date_joined} />

                    {isDriverUser && (
                      <>
                        <View style={styles.profileSectionDivider} />
                        <Text style={styles.profileSectionTitle}>Driver Details</Text>
                        <ProfileDetailRow icon="card-outline" label="License" value={userProfile?.license_number} />
                        <ProfileDetailRow icon="bicycle-outline" label="Vehicle Number" value={userProfile?.vehicle_number} />
                        <ProfileDetailRow icon="speedometer-outline" label="Vehicle Type" value={userProfile?.vehicle_type} />
                        <ProfileDetailRow icon="star-outline" label="Rating" value={userProfile?.rating?.toFixed?.(1) || userProfile?.rating} />
                        <ProfileDetailRow icon="trophy-outline" label="Total Trips" value={userProfile?.total_trips} />
                        <ProfileDetailRow icon="shield-checkmark-outline" label="Verified" value={userProfile?.is_verified ? "Yes" : "No"} />
                      </>
                    )}

                    {!isDriverUser && (
                      <>
                        <View style={styles.profileSectionDivider} />
                        <Text style={styles.profileSectionTitle}>Passenger Details</Text>
                        <ProfileDetailRow icon="home-outline" label="Home Location" value={formatLocation(userProfile?.home_location)} />
                        <ProfileDetailRow icon="navigate-outline" label="Current Location" value={formatLocation(userProfile?.current_location)} />
                        <ProfileDetailRow icon="time-outline" label="Last Active" value={userProfile?.last_active_at} />
                        <ProfileDetailRow icon="shield-checkmark-outline" label="Verified" value={userProfile?.is_verified ? "Yes" : "No"} />
                      </>
                    )}
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function ProfileDetailRow({ icon, label, value }) {
  const safe = formatValue(value);
  if (typeof safe === "object") {
    console.warn("[AdminScreen] ProfileDetailRow received object instead of string:", safe);
  }
  return (
    <View style={pStyles.row}>
      <View style={pStyles.left}>
        <Ionicons name={icon} size={15} color="#6B7280" />
        <Text style={pStyles.label}>{typeof label === "string" ? label : ""}</Text>
      </View>
      <Text style={pStyles.value} numberOfLines={2}>{typeof safe === "object" ? JSON.stringify(safe) : safe}</Text>
    </View>
  );
}

function ProfileField({ label, value, onChangeText, keyboardType, multiline, autoCapitalize }) {
  return (
    <View style={pStyles.fieldGroup}>
      <Text style={pStyles.fieldLabel}>{label}</Text>
      <TextInput
        style={[pStyles.fieldInput, multiline && { minHeight: 60, textAlignVertical: "top" }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={`Enter ${label.toLowerCase()}`}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType || "default"}
        multiline={multiline}
        autoCapitalize={autoCapitalize || "sentences"}
      />
    </View>
  );
}

const pStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  label: { fontSize: 13, color: "#6B7280", fontWeight: "600" },
  value: { fontSize: 13, color: "#111827", fontWeight: "700", maxWidth: "55%", textAlign: "right" },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 },
  fieldInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
  },
});

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
  tabText: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
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
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchInput: { flex: 1, fontSize: 14, color: "#111827", padding: 0 },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 10,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
  },
  userAvatarText: { fontSize: 16, fontWeight: "800", color: "#fff" },
  userName: { fontSize: 14, fontWeight: "700", color: "#111827" },
  userEmail: { fontSize: 12, color: "#6B7280", marginTop: 1 },
  userMeta: { flexDirection: "row", gap: 6, marginTop: 4 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  roleBadgeText: { fontSize: 10, fontWeight: "700" },
  driverCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  driverHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  driverName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  driverEmail: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  driverRole: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { fontSize: 11, fontWeight: "600" },
  driverDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  detailSection: { marginBottom: 12 },
  detailSectionTitle: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 4 },
  detailLine: { fontSize: 13, color: "#6B7280", marginBottom: 2 },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  docType: { fontSize: 13, color: "#374151" },
  docStatus: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  docStatusText: { fontSize: 11, fontWeight: "600" },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  approveBtn: { backgroundColor: "#009849" },
  rejectBtn: { backgroundColor: "#EF4444" },
  actionBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  profileModal: { flex: 1, backgroundColor: "#F8FAF9" },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  profileBackBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  profileHeaderTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  profileEditBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#ECFDF5" },
  profileEditText: { fontSize: 13, fontWeight: "700", color: "#009849" },
  profileLoadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  profileBody: { padding: 16, paddingBottom: 40 },
  profileAvatarSection: { alignItems: "center", marginBottom: 20 },
  profileAvatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: "rgba(0,152,73,0.2)" },
  profileUserName: { fontSize: 20, fontWeight: "800", color: "#111827", marginTop: 10 },
  profileUserEmail: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  profileSectionDivider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 12 },
  profileSectionTitle: { fontSize: 13, fontWeight: "800", color: "#374151", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  saveBtn: {
    backgroundColor: "#009849",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
