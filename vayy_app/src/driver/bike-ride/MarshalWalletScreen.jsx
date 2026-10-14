import React, { useEffect, useMemo } from "react";
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { fetchWallet } from "../../store/slices/walletSlice";
import COLORS from "../../shared/constants/colors";

const inPeriod = (iso, days) => {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
};

const isToday = (iso) => {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.toDateString() === now.toDateString();
};

const timeAgo = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
};

const formatAmount = (amount) => {
  const num = Number(amount);
  if (Number.isNaN(num)) return "₹0";
  return `₹${Math.round(num).toLocaleString("en-IN")}`;
};

const txTitle = (tx) => {
  if (tx.type === "credit") return "Trip Fuel Share";
  if (tx.type === "debit") return "Withdrawal";
  return "Wallet";
};

export default function MarshalWalletScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { balance, transactions, loading } = useSelector((state) => state.wallet);

  useEffect(() => {
    dispatch(fetchWallet());
  }, [dispatch]);

  const credits = useMemo(() => (transactions || []).filter((t) => t.type === "credit"), [transactions]);

  const earnings = useMemo(() => {
    const sum = (list) => list.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    return {
      today: sum(credits.filter((t) => isToday(t.created_at))),
      week: sum(credits.filter((t) => inPeriod(t.created_at, 7))),
      month: sum(credits.filter((t) => inPeriod(t.created_at, 30))),
    };
  }, [credits]);

  const recent = transactions || [];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#009849" />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerGradient}>
          <View style={styles.gradBase} />
          <View style={styles.gradRay1} />
          <View style={styles.gradRay2} />
        </View>
        <Text style={styles.headerTitle}>Marshal Wallet</Text>
        <Text style={styles.headerSub}>Your earnings &amp; balance</Text>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>
            {loading ? "—" : formatAmount(balance)}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.earningsRow}>
          <View style={styles.earningCard}>
            <Text style={styles.earningLabel}>Today</Text>
            <Text style={styles.earningAmount}>{formatAmount(earnings.today)}</Text>
          </View>
          <View style={styles.earningCard}>
            <Text style={styles.earningLabel}>This Week</Text>
            <Text style={styles.earningAmount}>{formatAmount(earnings.week)}</Text>
          </View>
          <View style={styles.earningCard}>
            <Text style={styles.earningLabel}>This Month</Text>
            <Text style={styles.earningAmount}>{formatAmount(earnings.month)}</Text>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <View style={styles.metricIconWrap}>
              <Ionicons name="people-outline" size={18} color="#009849" />
            </View>
            <Text style={styles.metricValue}>{recent.length}</Text>
            <Text style={styles.metricLabel}>Transactions</Text>
            <Text style={styles.metricSub}>All time</Text>
          </View>
          <View style={styles.metricCard}>
            <View style={styles.metricIconWrap}>
              <Ionicons name="wallet-outline" size={18} color="#009849" />
            </View>
            <Text style={styles.metricValue}>{credits.length}</Text>
            <Text style={styles.metricLabel}>Earnings</Text>
            <Text style={styles.metricSub}>Credit entries</Text>
          </View>
        </View>

        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={() => navigation.navigate("DriverTripHistoryScreen", { list: true })}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {loading && (
            <View style={styles.stateCard}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.stateText}>Loading transactions...</Text>
            </View>
          )}

          {!loading && recent.length === 0 && (
            <View style={styles.stateCard}>
              <Ionicons name="receipt-outline" size={28} color="#9CA3AF" />
              <Text style={styles.stateText}>No transactions yet</Text>
            </View>
          )}

          {!loading &&
            recent.slice(0, 10).map((t, i) => (
              <View key={t.id || i} style={[styles.transactionCard, i === Math.min(recent.length, 10) - 1 && { marginBottom: 0 }]}>
                <View style={styles.transactionLeft}>
                  <Text style={styles.transactionType}>{txTitle(t)}</Text>
                  <Text style={styles.transactionRoute}>{t.reference || (t.status === "completed" ? "Completed" : t.status)}</Text>
                </View>
                <View style={styles.transactionRight}>
                  <Text style={[styles.transactionAmount, t.type === "debit" && styles.transactionDebit]}>
                    {t.type === "debit" ? "-" : "+"}{formatAmount(t.amount)}
                  </Text>
                  <Text style={styles.transactionTime}>{timeAgo(t.created_at)}</Text>
                </View>
              </View>
            ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
  },
  headerGradient: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  gradBase: { ...StyleSheet.absoluteFillObject, backgroundColor: "#009849" },
  gradRay1: {
    position: "absolute", top: -60, right: -40,
    width: "70%", height: "90%",
    backgroundColor: "#00B857", opacity: 0.25,
    borderRadius: 120, transform: [{ rotate: "25deg" }],
  },
  gradRay2: {
    position: "absolute", top: -80, right: -20,
    width: "50%", height: "70%",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 100, transform: [{ rotate: "35deg" }],
  },
  headerTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "900", position: "relative", zIndex: 2 },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600", marginTop: 2, position: "relative", zIndex: 2 },
  balanceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 18,
    padding: 18,
    marginTop: 20,
    position: "relative",
    zIndex: 2,
  },
  balanceLabel: { fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: "600", flex: 1 },
  balanceAmount: { fontSize: 22, fontWeight: "900", color: "#FFFFFF" },

  content: { padding: 16, paddingBottom: 32 },
  earningsRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  earningCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    boxShadow: "0 0 6 rgba(0, 0, 0, 0.04)",
  },
  earningLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600" },
  earningAmount: { fontSize: 16, fontWeight: "900", color: COLORS.text, marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text, marginBottom: 12 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  metricCard: {
    width: "48%",
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    boxShadow: "0 0 6 rgba(0, 0, 0, 0.03)",
  },
  metricIconWrap: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: "#ECFAF1",
    justifyContent: "center", alignItems: "center",
    marginBottom: 8,
  },
  metricValue: { fontSize: 18, fontWeight: "900", color: COLORS.text },
  metricLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600", marginTop: 1 },
  metricSub: { fontSize: 10, color: COLORS.textLight, fontWeight: "500", marginTop: 1 },
  recentSection: { marginBottom: 16 },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  seeAll: { fontSize: 12, color: "#009849", fontWeight: "700" },
  transactionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    boxShadow: "0 0 4 rgba(0, 0, 0, 0.02)",
  },
  transactionLeft: { flex: 1 },
  transactionType: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  transactionRoute: { fontSize: 11, color: COLORS.textMuted, fontWeight: "500", marginTop: 1 },
  transactionRight: { alignItems: "flex-end" },
  transactionAmount: { fontSize: 14, fontWeight: "900", color: "#009849" },
  transactionDebit: { color: "#EF4444" },
  transactionTime: { fontSize: 10, color: COLORS.textLight, fontWeight: "600", marginTop: 1 },
  stateCard: {
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingVertical: 28,
  },
  stateText: { fontSize: 13, color: "#9CA3AF", fontWeight: "600" },
});
