import * as Location from "expo-location";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import VayyMap, { ViewAnnotation, GeoJSONSource, Layer } from "../../shared/components/VayyMap";
import { SafeAreaView } from "react-native-safe-area-context";

import VehicleIconBadge from "../../shared/components/common/VehicleIconBadge";
import SmoothMarker from "../../shared/components/common/SmoothMarker";
import LiveDot from "../../shared/components/common/LiveDot";
import VayyButton from "../../shared/components/common/VayyButton";
import useWebSocket from "../../shared/hooks/useWebSocket";
import { WS } from "../../constants";
import COLORS from "../../shared/constants/colors";
import RADIUS from "../../shared/constants/radius";
import SHADOW from "../../shared/constants/shadow";
import SPACING from "../../shared/constants/spacing";
import ZoomControls from "../../shared/components/common/ZoomControls";
import { getNextStops } from "../services/driverService";
import { buildRouteSummary } from "../utils/driverFlowUtils";
import { useDispatch, useSelector } from "react-redux";
import { acceptBroadcast, rejectBroadcast } from "../../store/slices/dispatchSlice";
import { endJourney, clearJourney, fetchJourney } from "../../store/slices/journeySlice";
import useDriverLocationPush from "../hooks/useDriverLocationPush";
import { confirmAction } from "../../shared/lib/confirmAction";

const toCoord = (point) => {
  const lat = Number(point?.lat ?? point?.latitude);
  const lon = Number(point?.lon ?? point?.lng ?? point?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lon)
    ? { latitude: lat, longitude: lon }
    : null;
};

export default function DriverLiveTracking({ navigation, route: navRoute }) {
  const { route, activeTrip } = navRoute?.params || {};
  const [vehiclePos, setVehiclePos] = useState(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [nextStops, setNextStops] = useState([]);
  const [passengers, setPassengers] = useState({});
  const [wsStatus, setWsStatus] = useState("connecting");
  const [isDriving, setIsDriving] = useState(true);
  const mapRef = useRef(null);
  const sendRef = useRef(null);
  const markers = useRef({});
  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  const summary = useMemo(() => buildRouteSummary(route || {}), [route]);
  const tripId = activeTrip?.trip_id || activeTrip?.id;
  const cityId = activeTrip?.city_id || activeTrip?.city || route?.city_id || route?.city;

  /* ── Journey runtime ───────────────────────────────────────
     A journey (route-free) arrives as `journey` with the server-resolved path
     and the global stops on it, plus any passenger who raises a hand at one of
     them. A fixed-route trip has none of this and behaves exactly as before.

     The end action is shared: a fixed route ends via the dispatch lifecycle, a
     journey via /journeys/end/, which is what settles each passenger's own
     pickup→drop segment.
  */
  const authUserId = useSelector((state) => state.auth?.user?.id);
  const dispatch = useDispatch();

  /* The live journey document.
     Taken from the navigation params on arrival, then refreshed from the server
     so the stop ETAs count down as the driver moves. Previously this read the
     params once, so the distances and times shown were whatever they were when
     the journey started. */
  const [journey, setJourney] = useState(navRoute?.params?.journey || null);
  const isJourney = Boolean(journey?.trip_id);

  // The driver's own id, which the notification channel is keyed on. Params and
  // the journey payload both supply it, but the signed-in user is the
  // authoritative fallback: if this resolved to undefined the socket silently
  // never connected and no raised hand could ever reach the driver.
  const driverId =
    navRoute?.params?.driverId ||
    activeTrip?.driver_id ||
    journey?.driver_id ||
    authUserId;

  useEffect(() => {
    if (!tripId || !isJourney) return undefined;

    const refresh = async () => {
      try {
        const fresh = await dispatch(fetchJourney(tripId)).unwrap();
        if (fresh?.trip_id) setJourney(fresh);
      } catch {
        // A failed refresh must not clear what is already on screen.
      }
    };

    refresh();
    // Every 30s is often enough for a stop ETA and cheap enough to leave running
    // for the length of a trip.
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [dispatch, tripId, isJourney]);

  const [request, setRequest] = useState(null);
  const [accepted, setAccepted] = useState([]);
  const [notice, setNotice] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [ending, setEnding] = useState(false);

  // Push GPS for a journey using the shared hook, which already handles the
  // web/native split. The fixed-route watcher below is left untouched.
  useDriverLocationPush({
    enabled: isJourney && Boolean(activeTrip?.vehicle_id),
    vehicleId: activeTrip?.vehicle_id,
    tripId: isJourney ? tripId : undefined,
    vehicleType: activeTrip?.vehicle_type,
    vehicleNumber: activeTrip?.vehicle_number,
    driverId,
    onLocation: (coords) => {
      setVehiclePos({ lat: coords.latitude, lon: coords.longitude });
      if (coords.speed != null) setCurrentSpeed(Math.max(0, Math.round(coords.speed * 3.6)));
      if (coords.heading != null) setCurrentHeading(coords.heading);
    },
  });

  // Hand-raises arrive on the driver's personal channel, the same channel the
  // legacy broadcast flow uses, so no new socket is needed.
  const notifyPath = driverId ? WS.notifications(driverId) : null;
  const handleNotify = useCallback((msg) => {
    if (!msg?.type) return;
    if (msg.type === "new_dispatch_request") {
      setRequest(msg.dispatch || null);
      setNotice(null);
      return;
    }
    if (msg.type === "request_cancelled") {
      setRequest((cur) =>
        cur && cur.request_id === msg.request_id ? null : cur
      );
      setNotice(
        msg.reason === "accepted_by_other"
          ? "That ride was taken by another driver"
          : "Request cancelled"
      );
      return;
    }
    if (msg.type === "request_expired") setRequest(null);
  }, []);

  useWebSocket(notifyPath, {
    // Both flows get hand-raises on the driver's personal channel; limiting
    // this to journeys meant a fixed-route driver could never accept from here.
    enabled: Boolean(notifyPath),
    onMessage: handleNotify,
  });

  const handleAccept = useCallback(async () => {
    if (!request?.request_id || actionBusy) return;
    setActionBusy(true);
    const result = await dispatch(acceptBroadcast(request.request_id));
    if (acceptBroadcast.fulfilled.match(result)) {
      const data = result.payload?.data || result.payload || {};
      // Keep the rider visible: an OTP line alone leaves the driver with
      // nothing to match the person at the stop against.
      setAccepted((cur) => [
        {
          key: `${data.boarding_request_id || request.request_id}-${cur.length}`,
          name: data.passenger_name || request.passenger_name || "Passenger",
          phone: data.passenger_phone || "",
          pickup: data.pickup_stop_name || request.pickup_name || "",
          drop: data.drop_stop_name || request.drop_name || "",
          otp: data.otp || "",
          etaMinutes: data.eta_minutes ?? null,
          distanceKm: data.distance_km ?? null,
        },
        ...cur,
      ]);
      setNotice(data.otp ? `Pickup confirmed — safety code ${data.otp}` : "Pickup confirmed");
    } else {
      setNotice(
        result.payload?.message ||
          result.payload?.detail ||
          "Could not accept that request"
      );
    }
    setRequest(null);
    setActionBusy(false);
  }, [dispatch, request, actionBusy]);

  const handleReject = useCallback(async () => {
    if (!request?.request_id || actionBusy) return;
    setActionBusy(true);
    await dispatch(rejectBroadcast(request.request_id));
    setRequest(null);
    setActionBusy(false);
  }, [dispatch, request, actionBusy]);

  const handleEnd = useCallback(async () => {
    // Alert.alert is inert on web, so the confirm goes through confirmAction or
    // the End button does nothing in a browser.
    const confirmed = await confirmAction({
      title: isJourney ? "End this journey?" : "End this trip?",
      message: isJourney ? "Boarded passengers will be charged." : undefined,
      confirmLabel: "End trip",
      cancelLabel: "Keep going",
    });
    if (!confirmed) return;

    setEnding(true);

    if (isJourney) {
      const result = await dispatch(endJourney({ tripId }));
      setEnding(false);
      if (endJourney.fulfilled.match(result)) {
        dispatch(clearJourney());
        // Only when someone actually rode; otherwise there is no fare to show.
        if (result.payload?.passenger_count > 0) {
          const settled = result.payload.passengers || [];
          const distanceKm =
            result.payload.distance_m != null
              ? Number((result.payload.distance_m / 1000).toFixed(1))
              : null;
          navigation.navigate("BikeTripComplete", {
            tripId,
            tripData: {
              trip_id: tripId,
              passengers: settled,
              distance_m: result.payload.distance_m,
              distance_km: distanceKm,
              // The completion screen reads `distance`/`fare`; send both spellings
              // so the summary is never blank on arrival.
              distance: distanceKm,
              fare: result.payload.total_fare,
              total_fare: result.payload.total_fare,
              passenger_count: result.payload.passenger_count,
            },
          });
          return;
        }
        navigation.navigate("DriverTabs", { screen: "DriverModeSelect" });
        return;
      }
      setNotice(
        (result.payload && (result.payload.message || result.payload.detail)) ||
          result.error?.message ||
          "Could not end your journey."
      );
      return;
    }

    // Fixed-route trips keep their existing behaviour.
    setEnding(false);
    navigation.navigate("DriverTabs", { screen: "DriverModeSelect" });
  }, [dispatch, navigation, tripId, isJourney]);

  useEffect(() => {
    let watcher = null;

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      // Initial position
      const initial = await Location.getCurrentPositionAsync({});
      setVehiclePos({ lat: initial.coords.latitude, lon: initial.coords.longitude });

      // Start continuous watcher
      watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (location) => {
          const newPos = { lat: location.coords.latitude, lon: location.coords.longitude };
          setVehiclePos(newPos);
          setCurrentSpeed(Math.max(0, Math.round((location.coords.speed || 0) * 3.6)));
          setCurrentHeading(location.coords.heading || 0);

          // Send to backend via WebSocket if connected
          if (sendRef.current) {
            sendRef.current("location_update", {
              trip_id: tripId,
              lat: newPos.lat,
              lon: newPos.lon,
              speed: Math.max(0, Math.round((location.coords.speed || 0) * 3.6)),
              heading: location.coords.heading || 0,
            });
          }
        },
      );
    };

    startTracking();

    return () => {
      if (watcher) {
        watcher.remove();
      }
    };
  }, [tripId]);

  useEffect(() => {
    if (!tripId) return undefined;

    const poll = async () => {
      try {
        const data = await getNextStops(tripId);
        const stops = Array.isArray(data) ? data : data?.results || data?.stops || [];
        setNextStops(stops);
      } catch {
        setNextStops([]);
      }
    };

    poll();
    const timer = setInterval(poll, 15000);

    return () => clearInterval(timer);
  }, [tripId]);

  const vehicleId = activeTrip?.vehicle_id || activeTrip?.bus_id || tripId;

  const handleWsMessage = useCallback((data) => {
    if (data.type === "student_update" || data.type === "passenger_update") {
      setPassengers((prev) => ({
        ...prev,
        [data.user_id]: {
          user_id: data.user_id,
          lat: data.lat,
          lon: data.lon,
          hand_raised: data.hand_raised,
        },
      }));
    }

    if (data.type === "passenger_stopped") {
      setPassengers((prev) => {
        const next = { ...prev };
        delete next[data.user_id];
        return next;
      });
    }
  }, []);

  const { send, connectionState } = useWebSocket(
    vehicleId ? WS.trackingVehicle(vehicleId) : null,
    {
      enabled: !!vehicleId,
      onMessage: handleWsMessage,
    },
  );

  sendRef.current = send;

  useEffect(() => {
    setWsStatus(connectionState);
  }, [connectionState]);

  // A journey carries no fixed-route object, so `route` may legitimately be
  // absent; only bail when there is neither a route nor a journey to draw.
  if ((!route && !isJourney) || !activeTrip) {
    return (
      <SafeAreaView style={styles.errorScreen}>
        <Text style={styles.warning}>!</Text>
        <Text style={styles.errorTitle}>Live trip data unavailable</Text>
        <VayyButton label="Return to Review" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  const vehicleCoord = toCoord(vehiclePos);
  // The journey's own path is the road the server resolved; a fixed route falls
  // back to its stop geometry exactly as before.
  const journeyCoords = (journey?.path || [])
    .filter((c) => Array.isArray(c) && c.length === 2)
    .map((c) => [c[1], c[0]]);
  const routeCoords = journeyCoords.length
    ? journeyCoords
    : summary.stops.map(toCoord).filter(Boolean).map((c) => [c.longitude, c.latitude]);
  // routeCoords is [lng, lat] pairs for the GeoJSON source; initialRegion needs
  // {latitude, longitude}. Derive it explicitly rather than reusing an element.
  const firstCoord = routeCoords[0];
  const initial =
    vehicleCoord ||
    (Array.isArray(firstCoord)
      ? { latitude: firstCoord[1], longitude: firstCoord[0] }
      : firstCoord) || { latitude: 26.8467, longitude: 80.9462 };

  /* Stops and ETA
     A journey's stops come from the server already ordered nearest-first, each
     with the distance and ETA left to it. The previous code read `eta` and
     `distance` off them, but the server sends `eta_minutes` and `distance_m`,
     so the panel rendered "—" for both. Read what is actually sent, and prefer
     the stop the server flagged as still ahead (`is_next`) over simply the first
     one, which may already be behind the vehicle. */
  const journeyStops = journey?.stops || [];
  const nextStop =
    nextStops[0] ||
    journeyStops.find((s) => s.is_next) ||
    journeyStops[0] ||
    summary.stops[1] ||
    summary.stops[0];

  const stopEta =
    nextStop?.eta_minutes ?? nextStop?.eta ?? nextStop?.eta_seconds
      ? Math.max(1, Math.round(
          (nextStop.eta_minutes ?? nextStop.eta ??
            (nextStop.eta_seconds || 0) / 60) || 0
        ))
      : null;

  // `distance_m` is metres left on the journey; the older route payload used a
  // pre-formatted `distance` string.
  const stopDistanceLabel = (() => {
    const raw =
      nextStop?.distance_m != null
        ? nextStop.distance_m
        : nextStop?.distance;
    if (raw == null) return null;
    if (typeof raw === "string") return raw;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return "0 m";
    return n >= 1000 ? `${(n / 1000).toFixed(1)} km` : `${Math.round(n)} m`;
  })();
  const passengerList = Object.values(passengers);

  return (
    <View style={styles.root}>
      <VayyMap
        ref={mapRef}
        initialRegion={{ ...initial, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
        style={styles.map}
      >
        {routeCoords.length > 1 ? (
          <GeoJSONSource
            id="route-line"
            data={{
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: routeCoords.map((c) => [c.longitude, c.latitude]),
              },
            }}
          >
            <Layer
              id="route-line-layer"
              type="line"
              layout={{
                "line-cap": "round",
                "line-join": "round",
              }}
              paint={{
                "line-color": COLORS.primary,
                "line-width": 5,
              }}
            />
          </GeoJSONSource>
        ) : null}
        {vehicleCoord ? (
          <SmoothMarker
            id="vehicle-marker"
            targetLat={vehicleCoord.latitude}
            targetLng={vehicleCoord.longitude}
            heading={currentHeading}
            speedKmh={currentSpeed}
          >
            <View style={styles.vehicleMarker}>
              <LiveDot size={13} />
              <VehicleIconBadge size={38} vehicleType={activeTrip?.vehicle_type || "auto"} />
            </View>
          </SmoothMarker>
        ) : null}
        {passengerList.map((passenger) => {
          const coord = toCoord(passenger);
          if (!coord) return null;
          return (
            <ViewAnnotation
              key={passenger.user_id}
              id={`passenger-${passenger.user_id}`}
              lngLat={[coord.longitude, coord.latitude]}
              anchor="center"
            >
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.warning, borderWidth: 2, borderColor: "#fff" }} />
            </ViewAnnotation>
          );
        })}
      </VayyMap>

      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.headerCard}>
          <View>
            <Text style={styles.vehicleTitle}>
              {activeTrip?.route_code || activeTrip?.vehicle_number || summary.vehicleNumber || "OMV Vehicle"}
            </Text>
            <Text style={styles.routeName}>{summary.title}</Text>
          </View>
          <View style={styles.onTime}>
            <Text style={styles.onTimeText}>On Time</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.panel}>
        {(!isJourney || request || notice) && (
          <>
            {notice && (
              <View style={styles.noticeRow}>
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            )}

            {request && (
              <View style={styles.requestCard}>
                <Text style={styles.requestTitle}>Passenger waiting</Text>
                <Text style={styles.requestLine}>
                  {request.passenger_name || "Passenger"} at {request.pickup_name}
                </Text>
                {request.fare != null && (
                  <Text style={styles.requestFare}>₹{request.fare} estimated</Text>
                )}
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[styles.rejectBtn, actionBusy && { opacity: 0.6 }]}
                    disabled={actionBusy}
                    onPress={handleReject}
                  >
                    <Text style={styles.rejectText}>Skip</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.acceptRideBtn, actionBusy && { opacity: 0.6 }]}
                    disabled={actionBusy}
                    onPress={handleAccept}
                  >
                    {actionBusy ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.acceptRideText}>Accept</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {accepted.length > 0 && (
              <View style={styles.boardedBlock}>
                <Text style={styles.boardedHeading}>On board ({accepted.length})</Text>
                <ScrollView style={styles.boardedScroll} nestedScrollEnabled>
                  {accepted.map((rider) => (
                    <View key={rider.key} style={styles.riderCard}>
                      <View style={styles.riderTop}>
                        <View style={styles.riderAvatar}>
                          <Text style={styles.riderAvatarText}>
                            {(rider.name || "P").trim().charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.riderInfo}>
                          <Text style={styles.riderName} numberOfLines={1}>
                            {rider.name}
                          </Text>
                          <Text style={styles.riderRoute} numberOfLines={1}>
                            {rider.pickup}
                            {rider.drop ? ` → ${rider.drop}` : ""}
                          </Text>
                        </View>
                        {rider.otp ? (
                          <View style={styles.otpChip}>
                            <Text style={styles.otpChipText}>{rider.otp}</Text>
                          </View>
                        ) : null}
                      </View>
                      {rider.phone ? (
                        <TouchableOpacity
                          style={styles.callBtn}
                          onPress={() =>
                            Linking.openURL(`tel:${rider.phone}`).catch(() =>
                              setNotice("Could not open the dialler on this device.")
                            )
                          }
                        >
                          <Text style={styles.callText}>Call passenger</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        )}

        <Text style={styles.panelLabel}>Next Stop</Text>
        <Text style={styles.nextStop}>{nextStop?.name || nextStop?.stop_name || "—"}</Text>
        <Text style={styles.distance}>{stopDistanceLabel || "—"}</Text>

        <View style={styles.etaRow}>
          <Text style={styles.etaNumber}>{stopEta != null ? stopEta : "—"}</Text>
          <Text style={styles.etaUnit}>min</Text>
        </View>

        {/* Every remaining stop on the journey, so the driver can see what is
            coming rather than only the immediate next one. */}
        {journeyStops.length > 0 && (
          <View style={styles.stopList}>
            {journeyStops.map((s, i) => (
              <View
                key={s.stop_id || i}
                style={[styles.stopRow, s.is_next && styles.stopRowNext]}
              >
                <Text style={styles.stopIndex}>{i + 1}</Text>
                <Text style={styles.stopName} numberOfLines={1}>
                  {s.name}
                </Text>
                <Text style={styles.stopEta}>
                  {s.eta_minutes != null ? `${s.eta_minutes} min` : "—"}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.stats}>
          <View>
            <Text style={styles.statValue}>{passengerList.length}</Text>
            <Text style={styles.statLabel}>Boarded</Text>
          </View>
          <View>
            <Text style={styles.statValue}>{currentSpeed}</Text>
            <Text style={styles.statLabel}>Speed</Text>
          </View>
          <View>
            <Text style={styles.statValue}>{nextStop?.traffic || "—"}</Text>
            <Text style={styles.statLabel}>Traffic</Text>
          </View>
        </View>

        <VayyButton
          fullWidth
          label={isJourney ? "End Journey" : "End Trip"}
          onPress={handleEnd}
          variant="primary"
          loading={ending}
        />
      </View>

      <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { flex: 1 },
  errorScreen: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    flex: 1,
    gap: SPACING.base,
    justifyContent: "center",
    padding: SPACING.xl,
  },
  warning: { color: COLORS.error, fontSize: 50, fontWeight: "900" },
  errorTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", textAlign: "center" },
  overlay: {
    bottom: 0,
    left: 0,
    pointerEvents: "box-none",
    position: "absolute",
    right: 0,
    top: 0,
  },
  headerCard: {
    ...SHADOW.md,
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    margin: SPACING.base,
    padding: SPACING.base,
  },
  vehicleTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  routeName: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  onTime: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.successBorder,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  onTimeText: { color: COLORS.primary, fontSize: 12, fontWeight: "900" },
  vehicleMarker: { alignItems: "center", justifyContent: "center" },
  panel: {
    ...SHADOW.md,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    bottom: 0,
    gap: SPACING.md,
    left: 0,
    padding: SPACING.base,
    position: "absolute",
    right: 0,
  },
  noticeRow: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 10,
  },
  noticeText: { color: "#1E40AF", fontSize: 12, fontWeight: "600" },
  requestCard: {
    backgroundColor: "#F0FDF4",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    padding: 12,
  },
  requestTitle: { color: "#111827", fontSize: 14, fontWeight: "900" },
  requestLine: { color: "#374151", fontSize: 13, fontWeight: "600", marginTop: 3 },
  requestFare: { color: "#15803D", fontSize: 12, fontWeight: "800", marginTop: 2 },
  requestActions: { flexDirection: "row", gap: 10, marginTop: 10 },
  rejectBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  rejectText: { color: "#EF4444", fontSize: 14, fontWeight: "800" },
  acceptRideBtn: {
    flex: 1.5,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptRideText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  boardedBlock: { marginBottom: 4 },
  boardedHeading: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
  },
  boardedScroll: { maxHeight: 130 },
  riderCard: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
  },
  riderTop: { flexDirection: "row", alignItems: "center" },
  riderAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  riderAvatarText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  riderInfo: { flex: 1, marginLeft: 8 },
  riderName: { color: COLORS.text, fontSize: 13, fontWeight: "800" },
  riderRoute: { color: COLORS.textMuted, fontSize: 11, marginTop: 1, fontWeight: "600" },
  otpChip: {
    backgroundColor: "#FEF3C7",
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  otpChipText: { color: "#92400E", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  callBtn: { marginTop: 6, alignSelf: "flex-start" },
  callText: { color: COLORS.primary, fontSize: 11, fontWeight: "800" },

  stopList: {
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    paddingTop: SPACING.sm,
  },
  stopRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  stopRowNext: { backgroundColor: "#F0FDF4", borderRadius: 8, paddingHorizontal: 6 },
  stopIndex: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.warning,
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 18,
  },
  stopName: { flex: 1, color: COLORS.text, fontSize: 12, fontWeight: "700" },
  stopEta: { color: COLORS.textMuted, fontSize: 11, fontWeight: "700" },

  panelLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  nextStop: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  distance: { color: COLORS.textMuted, fontSize: 13 },
  etaRow: { alignItems: "baseline", flexDirection: "row", gap: SPACING.sm },
  etaNumber: { color: COLORS.primary, fontSize: 48, fontWeight: "900" },
  etaUnit: { color: COLORS.primary, fontSize: 18, fontWeight: "900" },
  stats: {
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: SPACING.md,
  },
  statValue: { color: COLORS.primary, fontSize: 18, fontWeight: "900", textAlign: "center" },
  statLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: "700", textAlign: "center" },
  wsText: { color: COLORS.textMuted, fontSize: 11, textAlign: "center" },
  zoomButtons: {
    gap: SPACING.sm,
    position: "absolute",
    right: SPACING.base,
    top: 120,
  },
  zoomButton: {
    ...SHADOW.sm,
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  zoomText: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
});
