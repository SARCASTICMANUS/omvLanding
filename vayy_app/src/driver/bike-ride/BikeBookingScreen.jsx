import React from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AppFrame from "../../components/AppFrame";
import AvatarCircle from "../../components/AvatarCircle";
import { rideBuddy } from "../../data/passengers";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
// import VayyMap from "../../shared/components/VayyMap";
import PrimaryButton from "../../shared/components/common/PrimaryButton";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ACCENT = "#1D9E75";

// ─── MapPlaceholder ───────────────────────────────────────────────────────────
// Shows the VAYY header (logo + icons) inline since AppFrame is hidden on map screens.
// Reproduces the route line with stop dots seen in the design.
function MapPlaceholder() {
  return (
    <View style={styles.mapContainer}>
      {/* <VayyMap
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: 26.8467,
          longitude: 80.9462,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
      /> */}
      {/* VAYY Header overlay — Icons removed */}
      <View style={styles.mapHeader}>
        <View style={styles.mapHeaderLogo}>
          <Text style={styles.mapLogoText}>VAYY</Text>
          <Text style={styles.mapLogoSub}>URBAN MOBILITY</Text>
        </View>
      </View>

      {/* Route line: vertical path with stop dots */}
      <View style={styles.routeWrapper} pointerEvents="none">
        {/* Top pin — Hazratganj Metro */}
        <View style={styles.routeTopRow}>
          <View style={styles.routeEndDot} />
          <View style={[styles.mapLabel, { right: -112 }]}>
            <Text style={[styles.mapLabelText, { color: ACCENT, fontWeight: "700" }]}>Hazratganj{"\n"}Metro</Text>
          </View>
        </View>

        {/* Route line segment */}
        <View style={styles.routeLineWrap}>
          <View style={styles.routeLine} />
          {/* Mid stop dot */}
          <View style={[styles.routeMidDot, { top: "28%" }]} />
          {/* Auto icon circle */}
          <View style={styles.autoCircle}>
            <Text style={styles.autoEmoji}>🚌</Text>
          </View>
          {/* Another mid stop dot */}
          <View style={[styles.routeMidDot, { top: "72%" }]} />
        </View>

        {/* Bottom pin — Alambagh Bus Terminal */}
        <View style={styles.routeBottomRow}>
          <View style={styles.routeEndDotSmall} />
          <View style={[styles.mapLabel, { left: -120 }]}>
            <Text style={[styles.mapLabelText, { color: ACCENT, fontWeight: "700" }]}>Alambagh{"\n"}Bus Terminal</Text>
          </View>
        </View>
      </View>

      {/* Charbagh label */}
      <View style={[styles.mapFloatLabel, { top: "42%", left: 24 }]}>
        <View style={styles.mapFloatIcon}>
          <Text style={styles.mapFloatIconText}>🚉</Text>
        </View>
        <Text style={[styles.mapFloatText, { color: "#1565C0" }]}>Charbagh</Text>
      </View>

      {/* Aminabad label */}
      <View style={[styles.mapFloatLabel, { top: "32%", right: 24 }]}>
        <Text style={[styles.mapFloatText, { color: "#444" }]}>Aminabad</Text>
      </View>

      {/* Wave Mall label */}
      <View style={[styles.mapFloatLabel, { top: "55%", right: 20 }]}>
        <View style={styles.mapFloatIcon}>
          <Text style={styles.mapFloatIconText}>🛍️</Text>
        </View>
        <Text style={[styles.mapFloatText, { color: "#1565C0" }]}>Wave Mall{"\n"}Lucknow</Text>
      </View>

      {/* Recenter + direction buttons */}
      <View style={styles.mapActions}>
        <TouchableOpacity style={styles.mapActionBtn}>
          <Text style={styles.mapActionIcon}>◎</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.mapActionBtn, { backgroundColor: ACCENT }]}>
          <Text style={[styles.mapActionIcon, { color: "#FFF" }]}>➤</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── RouteStopColumn ─────────────────────────────────────────────────────────
function RouteStopColumn() {
  return (
    <View style={styles.stopCol}>
      {/* Pickup */}
      <View style={styles.stopRow}>
        <View style={styles.stopIconWrap}>
          <Text style={styles.stopPinIcon}>📍</Text>
        </View>
        <View>
          <Text style={styles.stopTypeLabel}>PICKUP STOP</Text>
          <Text style={styles.stopName}>Hazratganj Metro{"\n"}Gate 2</Text>
        </View>
      </View>

      {/* Dashed connector */}
      <View style={styles.stopDashWrap}>
        <View style={styles.stopDashLine} />
      </View>

      {/* Destination */}
      <View style={styles.stopRow}>
        <View style={styles.stopIconWrap}>
          <View style={[styles.stopDotIcon, { backgroundColor: ACCENT }]} />
        </View>
        <View>
          <Text style={styles.stopTypeLabel}>DESTINATION</Text>
          <Text style={styles.stopName}>Alambagh{"\n"}Bus Terminal</Text>
        </View>
      </View>
    </View>
  );
}

// ─── BestRouteMatchCard ───────────────────────────────────────────────────────
function BestRouteMatchCard() {
  return (
    <View style={[styles.routeMatchCard, { backgroundColor: ACCENT + "12", borderColor: ACCENT + "30" }]}>
      <View style={styles.routeMatchTop}>
        <View style={[styles.routeMatchCheck, { backgroundColor: ACCENT }]}>
          <Text style={styles.routeMatchCheckText}>✓</Text>
        </View>
        <Text style={[styles.routeMatchTitle, { color: ACCENT }]}>Best Route Match</Text>
      </View>
      <Text style={styles.routeMatchSub}>92% compatible route</Text>
      <Text style={[styles.routeMatchDetour, { color: ACCENT }]}>No major detour</Text>
    </View>
  );
}

// ─── StatsRow ─────────────────────────────────────────────────────────────────
function StatsRow() {
  const stats = [
    { icon: "👤", value: "1", label: "Passenger" },
    { icon: "₹", value: "₹25", label: "Est. Fare" },
    { icon: "↔", value: "+0.4 km", label: "Detour" },
    { icon: "🕐", value: "2 min", label: "To Pickup" },
  ];

  return (
    <View style={styles.statsRow}>
      {stats.map((s, i) => (
        <React.Fragment key={i}>
          <View style={styles.statItem}>
            <View style={styles.statIconRow}>
              <Text style={styles.statIconText}>{s.icon}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
            </View>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
          {i < stats.length - 1 && <View style={styles.statDivider} />}
        </React.Fragment>
      ))}
    </View>
  );
}

// ─── AcceptButton ─────────────────────────────────────────────────────────────
function AcceptButton({ onPress }) {
  return (
    <TouchableOpacity
      style={[styles.acceptBtn, { backgroundColor: ACCENT }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={[styles.acceptChevronWrap, { backgroundColor: "#FFFFFF22" }]}>
        <Text style={styles.acceptChevron}>{">>"}</Text>
      </View>
      <Text style={styles.acceptBtnText}>Accept Passenger</Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function BuddyRequestPopupScreen({ navigation }) {
  return (
    <AppFrame
      navigation={navigation}
      title="Buddy request"
      accent={ACCENT}
      hideHeader
    >
      <View style={[styles.root, { marginTop: spacing.md }]}>
        {/* Top — Map */}
        <MapPlaceholder />

        {/* Bottom — Sheet */}
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetContent}
          >
            {/* LIVE banner */}
            <View style={styles.liveBanner}>
              <View style={styles.livePill}>
                <View style={[styles.liveDot, { backgroundColor: ACCENT }]} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
              <Text style={styles.liveBannerTitle}>New Passenger Flag</Text>
            </View>

            {/* Passenger + Best Match side-by-side */}
            <View style={styles.passengerRouteSection}>
              <View style={styles.passengerInfoContainer}>
                 <AvatarCircle initials="PS" accent={ACCENT} size={64} />
                 <View style={styles.passengerDetails}>
                    <Text style={styles.passengerName}>{rideBuddy.name}</Text>
                    <View style={styles.passengerMeta}>
                      <Text style={styles.starIcon}>★</Text>
                      <Text style={styles.ratingText}>4.9</Text>
                      <View style={[styles.verifiedChip, { borderColor: ACCENT }]}>
                        <Text style={[styles.verifiedText, { color: ACCENT }]}>✓ Verified</Text>
                      </View>
                    </View>
                 </View>
              </View>
              <BestRouteMatchCard />
            </View>

            <View style={styles.divider} />

            {/* Horizontal Stops */}
            <View style={styles.horizontalStops}>
                <View style={styles.stopItem}>
                    <Text style={styles.stopTypeLabel}>PICKUP</Text>
                    <Text style={styles.stopName}>Hazratganj</Text>
                </View>
                <View style={styles.stopConnector} />
                <View style={styles.stopItem}>
                    <Text style={styles.stopTypeLabel}>DESTINATION</Text>
                    <Text style={styles.stopName}>Alambagh</Text>
                </View>
            </View>

            <View style={styles.divider} />

            {/* Stats row */}
            <StatsRow />

            <View style={styles.divider} />

            {/* Accept button — preserves navigation.navigate("OTPHandshake") */}
            <AcceptButton onPress={() => navigation.navigate("OTPHandshake")} />

            {/* Ignore button — preserves navigation.goBack() */}
            <TouchableOpacity
              style={[styles.ignoreBtn, { borderColor: ACCENT }]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <Text style={[styles.ignoreBtnText, { color: ACCENT }]}>Ignore Request</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </AppFrame>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#E8EEE8",
  },

  // ── Map ──────────────────────────────────────────────────────────────────
  mapContainer: {
    flex: 1,
    backgroundColor: "#EEF2EE",
    minHeight: 300,
    position: "relative",
    overflow: "hidden",
  },
  mapHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  mapHeaderIcon: {
    width: 44,
    height: 44,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  mapHeaderIconText: { fontSize: 18 },
  notifDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT,
    borderWidth: 1.5,
    borderColor: "#FFF",
  },
  mapHeaderLogo: { alignItems: "center" },
  mapLogoText: {
    fontSize: 22,
    fontWeight: "800",
    color: ACCENT,
    letterSpacing: 1,
  },
  mapLogoSub: { fontSize: 9, color: "#666", letterSpacing: 2 },

  mapGrid: { ...StyleSheet.absoluteFillObject },
  mapGridLine: { position: "absolute", backgroundColor: "#D8E4D8" },
  mapGridLineH: { left: 0, right: 0, height: 0.5 },
  mapGridLineV: { top: 0, bottom: 0, width: 0.5 },

  // Route path
  routeWrapper: {
    position: "absolute",
    top: 64,
    bottom: 20,
    alignSelf: "center",
    width: 4,
    alignItems: "center",
  },
  routeTopRow: {
    alignItems: "center",
    position: "relative",
  },
  routeEndDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: ACCENT,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  routeLineWrap: {
    flex: 1,
    alignItems: "center",
    position: "relative",
    width: 4,
  },
  routeLine: {
    flex: 1,
    width: 4,
    backgroundColor: ACCENT,
    borderRadius: 2,
  },
  routeMidDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFF",
    borderWidth: 2,
    borderColor: ACCENT,
    zIndex: 2,
  },
  autoCircle: {
    position: "absolute",
    top: "48%",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3,
    shadowColor: ACCENT,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  autoEmoji: { fontSize: 22 },
  routeBottomRow: {
    alignItems: "center",
    position: "relative",
  },
  routeEndDotSmall: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  mapLabel: {
    position: "absolute",
    top: -4,
  },
  mapLabelText: { fontSize: 12, lineHeight: 16 },

  // Float labels (Charbagh, Aminabad, Wave Mall)
  mapFloatLabel: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  mapFloatIcon: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: "#E3F0FF",
    justifyContent: "center",
    alignItems: "center",
  },
  mapFloatIconText: { fontSize: 13 },
  mapFloatText: { fontSize: 12, fontWeight: "600", lineHeight: 16 },

  // Map action buttons
  mapActions: {
    position: "absolute",
    right: 16,
    bottom: 24,
    gap: spacing.sm,
  },
  mapActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 8,
  },
  mapActionIcon: { fontSize: 18, color: "#555" },

// ── Sheet ─────────────────────────────────────────────────────────────────
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl, // Increased bottom padding
    marginTop: -40,
    zIndex: 5,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E0E0E0",
    marginBottom: spacing.md,
  },
  sheetContent: {
    gap: spacing.sm,
  },

  // LIVE banner
  liveBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 0,
    gap: spacing.sm,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: ACCENT + "14",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  liveText: {
    fontSize: 11,
    fontWeight: "700",
    color: ACCENT,
    letterSpacing: 0.5,
  },
  liveBannerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  liveBannerTime: {
    fontSize: 12,
    color: "#AAA",
  },

  // Passenger row
  passengerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  passengerInfo: { flex: 1 },
  passengerName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 5,
  },
  passengerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  starIcon: { fontSize: 14, color: "#FFA500" },
  ratingText: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  verifiedChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 4,
  },
  verifiedText: { fontSize: 12, fontWeight: "600" },

  divider: {
    height: 0.5,
    backgroundColor: "#EBEBEB",
    marginVertical: spacing.md,
  },

  passengerRouteSection: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  passengerInfoContainer: {
    flex: 2,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  passengerDetails: {
    alignItems: 'flex-start',
  },
  horizontalStops: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  stopItem: {
    flex: 1,
  },
  stopConnector: {
    height: 1,
    flex: 1,
    backgroundColor: "#EBEBEB",
    marginHorizontal: spacing.sm,
  },

  // Stop column
  stopCol: { flex: 1 },
  stopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  stopIconWrap: {
    width: 20,
    alignItems: "center",
    paddingTop: 2,
  },
  stopPinIcon: { fontSize: 16 },
  stopDotIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 3,
  },
  stopDashWrap: {
    paddingLeft: 9,
    height: 24,
    justifyContent: "center",
  },
  stopDashLine: {
    width: 1.5,
    flex: 1,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#BBBBBB",
    marginVertical: 2,
  },
  stopTypeLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#AAA",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  stopName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
    lineHeight: 20,
  },

  // Best Route Match card
  routeMatchCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.md,
    justifyContent: "center",
  },
  routeMatchTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  routeMatchCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  routeMatchCheckText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
  },
  routeMatchTitle: {
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  routeMatchSub: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  routeMatchDetour: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Stats row
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  statIconText: {
    fontSize: 16,
    color: ACCENT,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  statLabel: {
    fontSize: 11,
    color: "#888",
    textAlign: "center",
  },
  statDivider: {
    width: 0.5,
    height: 36,
    backgroundColor: "#EBEBEB",
  },

  // Accept button
  acceptBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 50,
    paddingVertical: 18,
    paddingHorizontal: spacing.md,
    backgroundColor: ACCENT,
    marginBottom: spacing.sm,
    justifyContent: "center",
  },
  acceptChevronWrap: {
    marginRight: spacing.sm,
  },
  acceptChevron: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  acceptBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFF",
    textAlign: "center",
  },

  // Ignore button
  ignoreBtn: {
    borderWidth: 1.5,
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: spacing.sm,
    backgroundColor: '#FFFFFF', // Explicit white background
  },
  ignoreBtnText: {
    fontSize: 17,
    fontWeight: "700",
  },
});
