import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Bike,
  Calendar,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  HelpCircle,
  Info,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  Star,
  Upload,
  User,
} from "lucide-react";
import { logout } from "../features/auth/authSlice";
import { fetchProfile, fetchVerificationStatus } from "../features/profile/profileSlice";
import { DRIVER_ROLES } from "../constants/roles";
import { APP_ROUTES } from "../constants/routes";
import { normalizeRole } from "../utils/roles";

const APP_VERSION = "1.0.0";
const HELP_PATH = APP_ROUTES.help || "/help";
const PRIVACY_PATH = APP_ROUTES.privacy || "/privacy";

const INITIALS_COLORS = ["#009849", "#2563EB", "#F59E0B", "#EF4444", "#8B5CF6"];

function safeStr(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    if (val.name) return String(val.name);
    if (val.display_name) return String(val.display_name);
    if (val.lat !== undefined && val.lng !== undefined) return `${val.lat}, ${val.lng}`;
    try { return JSON.stringify(val); } catch { return ""; }
  }
  return "";
}

function getInitials(name) {
  if (!name || typeof name !== "string") return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name) {
  let hash = 0;
  if (!name) return INITIALS_COLORS[0];
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return INITIALS_COLORS[Math.abs(hash) % INITIALS_COLORS.length];
}

export default function ProfilePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth || {});
  const { data: profile, loading, error, verification } = useSelector(
    (state) => state.profile || {},
  );

  useEffect(() => {
    dispatch(fetchProfile());
    dispatch(fetchVerificationStatus());
  }, [dispatch]);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/");
  };

  const p = profile || {};
  const prof = p.profile || {};
  const rawRole = user?.role || p.role;
  const isDriver = DRIVER_ROLES.includes(normalizeRole(rawRole));
  const authName =
    user?.full_name ||
    user?.name ||
    [p.first_name, p.last_name].filter(Boolean).join(" ");
  const displayName = safeStr(prof.display_name || authName) || "User Name";
  const displayEmail = safeStr(user?.email || p.email) || "user@example.com";
  const phoneNumber = safeStr(prof.phone_number || p.phone_number) || "--";
  const licenseNumber = safeStr(prof.license_number);
  const vehicleNumber = safeStr(prof.vehicle_number);
  const vehicleType = safeStr(prof.vehicle_type);
  const rating = typeof prof.rating === "number" ? prof.rating : null;
  const totalTrips = prof.total_trips || 0;
  const cityName =
    safeStr(prof.city_name || p.city_name || user?.city?.name || user?.city) || null;
  const avatarColor = getAvatarColor(displayName);
  const initials = getInitials(displayName);
  const roleLabel = isDriver ? "MARSHAL" : safeStr(rawRole).toUpperCase() || "PASSENGER";
  // BUG FIX: this read `verification?.status`, but the backend's
  // verification_service.verification_state() returns a `stage` key - there
  // is no `status` key at all. So this was always `undefined` and EVERY
  // driver fell through to the "Not Verified" branch, even when fully
  // verified. `status` is kept as a fallback so an older payload still maps.
  const verifyStatus = verification?.stage ?? verification?.status;
  const cityShort = (cityName ? cityName.split(",")[0] : "") || "—";

  // Stage vocabulary: email_pending / docs_pending / docs_under_review /
  // docs_rejected / fully_verified. The legacy "verified"/"pending" strings are
  // still mapped so an older payload cannot render as "Not Verified".
  const VERIFIED_STAGES = new Set(["fully_verified", "verified"]);
  const PENDING_STAGES = new Set([
    "email_pending", "docs_pending", "docs_under_review", "pending",
  ]);
  const REJECTED_STAGES = new Set(["docs_rejected", "rejected"]);

  const verifyMeta = VERIFIED_STAGES.has(verifyStatus)
    ? { label: "Verified", cls: "bg-emerald-400/20 text-emerald-300", Icon: CheckCircle2 }
    : PENDING_STAGES.has(verifyStatus)
      ? { label: "Pending", cls: "bg-amber-400/20 text-amber-300", Icon: Clock }
      : REJECTED_STAGES.has(verifyStatus)
        ? { label: "Rejected", cls: "bg-amber-400/20 text-amber-300", Icon: AlertCircle }
        : { label: "Not Verified", cls: "bg-red-400/20 text-red-300", Icon: AlertCircle };

  const headerStats = [
    { label: "Trips", value: String(totalTrips) },
    { label: "Rating", value: rating ? rating.toFixed(1) : "—" },
    {
      label: isDriver ? "Vehicle" : "City",
      value: isDriver ? (vehicleType ? vehicleType.toUpperCase() : "—") : cityShort,
    },
  ];

  const stats = [
    { icon: Calendar, label: "Trips", value: String(totalTrips) },
    { icon: Star, label: "Rating", value: rating ? rating.toFixed(1) : "—" },
    isDriver
      ? { icon: Car, label: "Vehicle", value: vehicleType ? vehicleType.toUpperCase() : "—" }
      : { icon: MapPin, label: "City", value: cityShort },
    { icon: Phone, label: "Phone", value: phoneNumber },
  ];

  const detailItems = [
    { icon: User, label: "Full Name", value: displayName },
    { icon: Mail, label: "Email", value: displayEmail },
    { icon: Phone, label: "Phone", value: phoneNumber },
    ...(isDriver
      ? [
          { icon: CreditCard, label: "License", value: licenseNumber || "—" },
          { icon: Car, label: "Vehicle", value: vehicleNumber || vehicleType || "—" },
        ]
      : [{ icon: MapPin, label: "City", value: cityName || "—" }]),
  ];

  const settings = [
    {
      icon: Pencil,
      label: "Edit Profile",
      to: isDriver ? APP_ROUTES.driverProfileUpdate : APP_ROUTES.passengerProfileUpdate,
    },
    ...(isDriver
      ? [{ icon: Upload, label: "Upload Documents", to: `${APP_ROUTES.driverProfileUpdate}?mode=manage` }]
      : []),
    { icon: ShieldCheck, label: "Privacy Policy", value: "View", to: PRIVACY_PATH },
    { icon: HelpCircle, label: "Help & Support", to: HELP_PATH },
    { icon: Info, label: "About", value: APP_VERSION },
  ];

  if (loading && !profile) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] pb-10 font-sans">
        <div className="relative overflow-hidden rounded-b-[32px] bg-[#009849] px-6 pb-7 pt-10">
          <div className="relative z-10 flex flex-col items-center">
            <div className="h-20 w-20 animate-pulse rounded-full bg-white/20" />
            <div className="mt-3 h-5 w-36 animate-pulse rounded-full bg-white/20" />
            <div className="mt-2 h-3.5 w-44 animate-pulse rounded-full bg-white/10" />
            <div className="mt-3 h-6 w-24 animate-pulse rounded-full bg-white/20" />
            <div className="mt-5 w-full rounded-2xl bg-white/10 p-4">
              <div className="flex justify-around">
                <div className="h-10 w-16 animate-pulse rounded-lg bg-white/15" />
                <div className="h-10 w-16 animate-pulse rounded-lg bg-white/15" />
                <div className="h-10 w-16 animate-pulse rounded-lg bg-white/15" />
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto -mt-4 w-full max-w-2xl px-4 lg:max-w-3xl">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-white shadow-sm" />
            ))}
          </div>
          <div className="mt-6 h-56 animate-pulse rounded-[18px] bg-white shadow-sm" />
          <div className="mt-6 h-64 animate-pulse rounded-[18px] bg-white shadow-sm" />
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 text-gray-400">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-xs font-semibold">Loading your profile…</span>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#F8FAF9] px-4 pb-10 font-sans">
        <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertCircle size={24} />
          </div>
          <p className="text-lg font-bold text-gray-900">Error loading profile</p>
          <p className="mt-1 text-sm text-gray-500">
            We couldn&apos;t reach the server. Please check your connection.
          </p>
          <button
            type="button"
            onClick={() => dispatch(fetchProfile())}
            className="mt-6 w-full rounded-xl bg-[#009849] py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#007a3b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009849]"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] pb-10 font-sans">
      <header className="relative overflow-hidden rounded-b-[32px] bg-[#009849] px-6 pb-7 pt-8 lg:pt-12">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <span className="absolute -right-10 -top-16 h-[90%] w-[70%] rotate-[25deg] rounded-[120px] bg-[#00B857] opacity-25" />
          <span className="absolute -right-5 -top-20 h-[70%] w-[50%] rotate-[35deg] rounded-[100px] bg-white/10" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center text-center lg:max-w-3xl">
          <div className="relative mb-3">
            {prof.profile_photo ? (
              <img
                src={prof.profile_photo}
                alt={displayName}
                className="h-20 w-20 rounded-full border-[3px] border-white/40 object-cover"
              />
            ) : (
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-white/40 text-white"
                style={{ backgroundColor: avatarColor }}
              >
                <span className="text-[28px] font-black leading-none">{initials}</span>
              </div>
            )}
            <span
              aria-hidden="true"
              className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-[3px] border-[#009849] bg-[#00E676]"
            />
          </div>

          <h1 className="text-[22px] font-black leading-tight text-white">{displayName}</h1>
          <p className="mb-2.5 mt-0.5 text-[13px] font-medium text-white/70">{displayEmail}</p>

          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-[5px] text-[11px] font-extrabold text-white">
            {isDriver ? <Bike size={12} /> : <User size={12} />}
            {roleLabel}
          </span>

          {isDriver && verification && (
            <span
              className={`mt-1.5 inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[10px] font-bold ${verifyMeta.cls}`}
            >
              <verifyMeta.Icon size={12} />
              {verifyMeta.label}
            </span>
          )}

          <div className="mx-4 mt-5 flex w-full items-center justify-center rounded-2xl bg-white/15 px-4 py-3.5">
            {headerStats.map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <span aria-hidden="true" className="h-7 w-px bg-white/20" />}
                <div className="flex-1 text-center">
                  <p className="text-xl font-black text-white">{s.value}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-white/70">{s.label}</p>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-4 w-full max-w-2xl px-4 lg:max-w-3xl">
        {error && profile && (
          <div
            role="alert"
            className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
          >
            <span>Couldn&apos;t refresh your profile.</span>
            <button
              type="button"
              onClick={() => dispatch(fetchProfile())}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-bold transition-colors hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              Retry
            </button>
          </div>
        )}

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map((s) => {
            const StatIcon = s.icon;
            return (
              <div
                key={s.label}
                className="flex flex-col items-center gap-1 rounded-2xl bg-white p-4 shadow-v-sm"
              >
                <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-[#ECFAF1]">
                  <StatIcon size={20} className="text-[#009849]" aria-hidden="true" />
                </span>
                <p className="text-lg font-black text-gray-900">{s.value}</p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-gray-400">
                  {s.label}
                </p>
              </div>
            );
          })}
        </section>

        <section className="mt-6">
          <h2 className="mb-2.5 ml-1 text-xs font-black uppercase tracking-[0.8px] text-gray-400">
            Profile Details
          </h2>
          <div className="rounded-[18px] border border-[#F0F0F0] bg-white px-4 shadow-v-sm">
            {detailItems.map((item, i) => {
              const DetailIcon = item.icon;
              return (
                <div key={item.label}>
                  {i > 0 && <div aria-hidden="true" className="ml-7 h-px bg-[#F0F0F0]" />}
                  <div className="flex items-center justify-between gap-3 py-3.5">
                    <span className="flex min-w-0 items-center gap-2.5 text-sm font-semibold text-gray-700">
                      <DetailIcon size={16} className="shrink-0 text-gray-400" aria-hidden="true" />
                      {item.label}
                    </span>
                    <span className="max-w-[50%] truncate text-right text-sm font-extrabold text-gray-900">
                      {item.value}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="mb-2.5 ml-1 text-xs font-black uppercase tracking-[0.8px] text-gray-400">
            Settings
          </h2>
          <div className="rounded-[18px] border border-[#F0F0F0] bg-white px-4 shadow-v-sm">
            {settings.map((item, i) => {
              const SettingIcon = item.icon;
              const inner = (
                <>
                  {i > 0 && <div aria-hidden="true" className="ml-7 h-px bg-[#F0F0F0]" />}
                  <div className="flex items-center justify-between gap-3 py-3.5">
                    <span className="flex items-center gap-2.5 text-sm font-bold text-gray-900">
                      <SettingIcon size={18} className="text-gray-400" aria-hidden="true" />
                      {item.label}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {item.value && (
                        <span className="text-[13px] font-semibold text-gray-400">{item.value}</span>
                      )}
                      <ChevronRight size={16} className="text-gray-400" aria-hidden="true" />
                    </span>
                  </div>
                </>
              );

              if (item.to) {
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => navigate(item.to)}
                    className="block w-full rounded-xl text-left transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#009849]"
                  >
                    {inner}
                  </button>
                );
              }

              return (
                <div key={item.label} className="rounded-xl">
                  {inner}
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-2xl border-[1.5px] border-red-100 bg-red-50 px-7 py-3.5 text-[15px] font-extrabold text-red-500 transition-colors hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
          >
            <LogOut size={20} aria-hidden="true" />
            Log Out
          </button>
        </div>

        <p className="mt-5 text-center text-xs text-gray-400">OMV App v{APP_VERSION}</p>
      </main>
    </div>
  );
}
