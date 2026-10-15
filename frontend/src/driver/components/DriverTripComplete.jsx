import React, { useMemo } from "react";
import {
  Bike,
  Calendar,
  Check,
  Flag,
  IndianRupee,
  MessageCircle,
  Navigation,
  Star,
  Timer,
  Wallet,
} from "lucide-react";
import { VayyButton, VayyCard, StatusBadge } from "../../components/vayy";
import { buildRouteSummary } from "./driverFlowUtils";

const money = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `₹${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
};

export default function DriverTripComplete({ result, onNextRide, onBackHome }) {
  const ride = result?.ride || null;
  const summary = useMemo(
    () => buildRouteSummary(result?.route || ride?.routeSnapshot || {}),
    [result?.route, ride?.routeSnapshot],
  );

  const fare = result?.fare || null;
  const earnings = result?.earnings || null;
  const totalFare = ride?.boardingRequestId
    ? (fare?.total_fare ?? null)
    : (fare?.total_fare ?? ride?.fareAmount ?? null);
  const distanceKm = fare?.distance_km ?? ride?.distanceKm ?? null;
  const perKmRate = fare?.per_km_charge ?? null;
  const baseFare = fare?.base_fare ?? null;
  const distanceFare = fare?.distance_fare ?? null;

  const tripDistance = result?.distanceText || summary.distanceText || "—";
  const tripDuration = result?.durationText || summary.durationText || "—";

  const riderRating = Number(ride?.rating) || 0;
  const pickupLabel = ride?.pickup || summary.startLabel;
  const dropLabel = ride?.drop || summary.endLabel;

  return (
    <div className="min-h-screen bg-[#F8FAF9] pb-16 font-sans">
      <div className="mx-auto w-full max-w-[560px] px-5 pt-10 sm:px-6 lg:max-w-[720px]">
        {/* Success header (mobile successSection) */}
        <div className="text-center">
          <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#009849] shadow-[0_14px_30px_rgba(0,152,73,0.3)]">
            <Check size={36} strokeWidth={3} className="text-white" />
          </div>
          <h1 className="mt-4 text-[24px] font-extrabold leading-tight text-[#111827]">
            Trip Complete
          </h1>
          <p className="mt-1.5 text-[14px] font-medium text-[#6B7280]">
            {ride?.name ? `${ride.name} dropped off safely` : "Buddy dropped off safely"}
          </p>
        </div>

        {/* Passenger row (mobile buddyRow) */}
        <VayyCard className="mt-6">
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[#009849]">
              <span className="text-[17px] font-black text-white">
                {ride?.avatar || "P"}
              </span>
              <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#009849]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-extrabold text-[#111827]">
                {ride?.name || "Passenger"}
              </p>
              <p className="mt-0.5 truncate text-[12px] font-medium text-[#6B7280]">
                {pickupLabel} → {dropLabel}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#FFFBEB] px-2.5 py-1.5">
              <Star size={14} className="fill-[#FFB800] text-[#FFB800]" />
              <span className="text-[13px] font-extrabold text-[#111827]">
                {ride?.rating || "—"}
              </span>
            </span>
          </div>
        </VayyCard>

        {/* Trip details */}
        <VayyCard className="mt-4">
          <p className="text-[16px] font-extrabold text-[#111827]">Trip Details</p>

          <div className="mt-4">
            <div className="flex items-center gap-3.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ECFAF1]">
                <span className="h-3 w-3 rounded-full bg-[#009849]" />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-[#888888]">Pickup</p>
                <p className="truncate text-[14px] font-bold text-[#111827]">
                  {pickupLabel}
                </p>
              </div>
            </div>

            <div className="my-1 ml-[13px] h-7 w-0.5 rounded-full bg-[#E5E7EB]" />

            <div className="flex items-center gap-3.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#009849]">
                <Flag size={12} className="text-white" fill="currentColor" />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-[#888888]">Dropoff</p>
                <p className="truncate text-[14px] font-bold text-[#111827]">
                  {dropLabel}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[#F3F4F6] pt-4">
              <span className="flex items-center gap-1.5">
                <Navigation size={16} className="text-[#6B7280]" />
                <span className="text-[12px] font-semibold text-[#6B7280]">
                  {tripDistance}
                </span>
              </span>
              <span className="h-1 w-1 rounded-full bg-[#D1D5DB]" />
              <span className="flex items-center gap-1.5">
                <Timer size={16} className="text-[#6B7280]" />
                <span className="text-[12px] font-semibold text-[#6B7280]">
                  {tripDuration}
                </span>
              </span>
              <span className="h-1 w-1 rounded-full bg-[#D1D5DB]" />
              <span className="flex items-center gap-1.5">
                <Calendar size={16} className="text-[#6B7280]" />
                <span className="text-[12px] font-semibold text-[#6B7280]">
                  {result?.completedAtLabel || "Just now"}
                </span>
              </span>
            </div>
          </div>
        </VayyCard>

        {/* Fare breakdown + earnings */}
        <VayyCard className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[16px] font-extrabold text-[#111827]">Earnings</p>
            <StatusBadge tone="success">
              <IndianRupee size={12} className="mr-1" />
              Settled
            </StatusBadge>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-[13px] font-medium text-[#6B7280]">
                Base Fuel Share
              </span>
              <span className="text-[14px] font-bold text-[#111827]">
                {money(baseFare)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-[13px] font-medium text-[#6B7280]">
                Distance
                {distanceKm != null && perKmRate != null
                  ? ` (${Number(distanceKm).toFixed(1)} km × ${money(perKmRate)}/km)`
                  : ""}
              </span>
              <span className="text-[14px] font-bold text-[#111827]">
                {money(distanceFare)}
              </span>
            </div>
            <div className="my-1 h-px bg-[#E5E7EB]" />
            <div className="flex items-center justify-between gap-3 py-1">
              <span className="text-[16px] font-extrabold text-[#111827]">
                Total Earned
              </span>
              <span className="text-[20px] font-extrabold text-[#009849]">
                {money(totalFare)}
              </span>
            </div>
          </div>

          {earnings && (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#F0F0F6] bg-[#FAFCFB] px-4 py-3">
              <Wallet size={18} className="text-[#009849]" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                  Today&apos;s earnings
                </p>
                <p className="truncate text-[15px] font-extrabold text-[#111827]">
                  {money(earnings.total_earnings)} · {earnings.total_trips ?? 0} trips
                </p>
              </div>
            </div>
          )}
        </VayyCard>

        {/* Buddy feedback — star rating */}
        <VayyCard className="mt-4">
          <p className="text-[16px] font-extrabold text-[#111827]">Buddy Feedback</p>

          <div className="mt-3 flex justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={32}
                strokeWidth={1.8}
                className={
                  star <= riderRating
                    ? "fill-[#FFB800] text-[#FFB800]"
                    : "text-[#D1D5DB]"
                }
              />
            ))}
          </div>

          <p className="mt-3 text-center text-[13px] font-medium italic leading-relaxed text-[#374151]">
            &quot;{ride?.feedback || "Thanks for riding!"}&quot;
          </p>
          <div className="mt-2 flex items-center justify-center gap-1.5">
            <MessageCircle size={14} className="text-[#009849]" />
            <span className="text-[11px] font-semibold text-[#009849]">
              — {ride?.name || "Passenger"}
            </span>
          </div>
        </VayyCard>

        {/* Actions (mobile primaryBtn + secondaryBtn) */}
        <div className="mt-6 space-y-3">
          <VayyButton fullWidth size="lg" onClick={onNextRide}>
            <Bike size={20} strokeWidth={2.6} />
            Next Ride
          </VayyButton>
          <button
            type="button"
            onClick={onBackHome}
            className="flex h-[50px] w-full items-center justify-center rounded-vayy bg-[#F3F4F6] text-[15px] font-bold text-[#6B7280] transition hover:bg-[#E5E7EB] active:scale-[0.99]"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
