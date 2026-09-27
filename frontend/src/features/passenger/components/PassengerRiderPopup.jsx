import React, { useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Clock3,
  MapPin,
  Navigation,
  Phone,
  Route,
  Star,
  X,
} from "lucide-react";
import { MetricChip, SheetHandle, StatusBadge } from "../../../components/vayy";

function formatDistance(km) {
  const value = Number(km);
  if (!Number.isFinite(value)) return null;
  return value <= 1 ? `${Math.round(value * 1000)} m` : `${value} km`;
}

function formatEta(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 1) return null;
  return `${Math.ceil(value)} min`;
}

export default function PassengerRiderPopup({
  booking = {},
  statusLabel,
  live = false,
  cancelling = false,
  onTrack,
  onCancel,
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const driverName = booking.driverName || "Your driver";
  const otpDigits = booking.otp ? String(booking.otp).split("") : [];
  const digits = otpDigits.length ? otpDigits : ["", "", "", ""];
  const arrived = booking.status === "arrived";
  const distanceText = formatDistance(booking.distanceKm);
  const etaText = formatEta(booking.etaMin);
  const rating = booking.driverRating || null;

  return (
    <div className="fixed inset-0 z-[1300]">
      <div className="absolute inset-0 bg-black/25" aria-hidden="true" />

      {/* Green gradient header */}
      <header className="absolute inset-x-0 top-0 z-10 overflow-hidden bg-[#009849] px-5 pb-3 pt-4 shadow-[0_4px_18px_rgba(0,152,73,0.25)]">
        <span className="pointer-events-none absolute -right-10 -top-16 h-[190%] w-[70%] rotate-[25deg] rounded-[120px] bg-[#00B857] opacity-25" />
        <span className="pointer-events-none absolute -right-6 -top-24 h-[170%] w-[50%] rotate-[35deg] rounded-[100px] bg-white/10" />
          <div className="relative mx-auto flex w-full max-w-[720px] items-center justify-between gap-3">
          <button
            type="button"
            onClick={onTrack}
            aria-label="Back to live map"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#111827] shadow-[0_2px_10px_rgba(0,0,0,0.12)] transition active:scale-95"
          >
            <ArrowLeft size={21} strokeWidth={2.5} />
          </button>
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-white text-[#111827] shadow-[0_2px_10px_rgba(0,0,0,0.12)]">
              <Check size={26} strokeWidth={3} />
            </span>
            <h1 className="truncate text-[22px] font-extrabold tracking-[-0.5px] text-white">
              Ride Accepted!
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={cancelling}
            className="flex shrink-0 items-center gap-1.5 rounded-[20px] border border-[#FEE2E2] bg-[#FEF2F2] px-3 py-2 text-[13px] font-bold text-[#EF4444] transition active:scale-95 disabled:opacity-60"
          >
            Cancel
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>
      </header>

      {/* Ride accepted bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ride accepted"
        className="absolute inset-x-0 bottom-0 z-10 mx-auto max-h-[85dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[32px] bg-white px-6 pb-6 pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.18)] lg:max-w-[720px]"
      >
        <SheetHandle />

        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F0FAF2] text-[#009849]">
            <Check size={20} strokeWidth={3.2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-extrabold text-[#111827]">
              {arrived ? "Your Marshal Has Arrived" : "Ride Accepted!"}
            </p>
            <p className="text-[12px] font-medium text-[#6B7280]">
              {arrived ? "Your Marshal is here. Please get ready." : "Your Marshal is on the way to you"}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-[11px] font-semibold text-[#9CA3AF]">
              {arrived ? "Arrived" : "Just now"}
            </span>
            {live ? (
              <StatusBadge tone="live">Live</StatusBadge>
            ) : statusLabel ? (
              <StatusBadge tone="neutral">{statusLabel}</StatusBadge>
            ) : null}
          </div>
        </div>

        <div className="my-[18px] h-px bg-[#F3F4F6]" />

        <div className="flex items-center gap-4">
          <span className="relative flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-[#F3F4F6]">
            <span className="text-[22px] font-extrabold text-[#009849]">
              {driverName.charAt(0).toUpperCase()}
            </span>
            <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-[10px] border border-[#F3F4F6] bg-white px-1.5 py-0.5">
              <Star size={10} className="fill-[#FFB800] text-[#FFB800]" />
              <span className="text-[10px] font-extrabold text-[#111827]">{rating || "--"}</span>
            </span>
          </span>

          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-[16px] font-extrabold text-[#111827]">
              {driverName}
              <BadgeCheck size={16} className="shrink-0 text-[#009849]" />
            </p>
            <span className="mt-1.5 inline-flex max-w-full items-center truncate rounded-[10px] border border-[#E5E7EB] bg-[#F9FAF9] px-2.5 py-1 text-[13px] font-extrabold tracking-[0.6px] text-[#111827]">
              {booking.vehicleNumber || "Vehicle details pending"}
            </span>
          </div>

          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F0FAF2] text-[#009849]">
            <Phone size={22} strokeWidth={2.2} />
          </span>
        </div>

        <div className="my-[18px] h-px bg-[#F3F4F6]" />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[14px] font-extrabold text-[#111827]">Safety Code</p>
            <p className="text-[11px] font-medium text-[#6B7280]">
              Share with Marshal to start ride
            </p>
          </div>
          <div className="flex gap-2">
            {digits.map((digit, index) => (
              <span
                key={`${digit}-${index}`}
                className="flex h-[42px] w-[38px] items-center justify-center rounded-[12px] border-[1.5px] border-[#E5E7EB] bg-[#F9FAFB] text-[22px] font-bold text-[#009849]"
              >
                {digit}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <MetricChip icon={Route} label="Distance" value={distanceText || "nearby"} />
          <MetricChip icon={Clock3} label="ETA" value={etaText || "Arriving"} green />
        </div>

        <div className="mt-4 rounded-[12px] bg-[#F3F4F6] px-4 py-3 text-center text-[13px] font-bold text-[#4B5563]">
          {arrived
            ? "Your Marshal has arrived. Share the Safety Code below to start the ride."
            : `Your Marshal is ${distanceText || "nearby"} away${
                etaText ? ` \u2022 Arriving in ${etaText}` : ""
              }`}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-[14px] border border-[#F0F0F0] bg-white px-4 py-3">
          <MapPin size={15} className="shrink-0 text-[#009849]" />
          <p className="min-w-0 flex-1 truncate text-xs font-bold text-[#6B7280]">
            {booking.pickupName || "Pickup"}
            <span className="px-2 text-[#E5E7EB]">/</span>
            {booking.dropName || "Drop"}
          </p>
          {booking.routeName ? (
            <span className="shrink-0 truncate rounded-full bg-[#E0F5E8] px-3 py-1 text-[11px] font-black text-[#009849]">
              {booking.routeName}
            </span>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onTrack}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-[#009849] text-base font-extrabold text-white shadow-[0_4px_14px_rgba(0,152,73,0.3)] transition hover:bg-[#007A3B] active:scale-[0.99]"
          >
            <Navigation size={19} strokeWidth={2.4} />
            Track Ride
          </button>
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={cancelling}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[18px] text-sm font-extrabold text-[#EF4444] transition hover:bg-[#FEF2F2] disabled:opacity-60"
          >
            <X size={17} /> Cancel Ride
          </button>
        </div>
      </div>

      {showConfirm ? (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 px-6"
          role="dialog"
          aria-modal="true"
          aria-label="Cancel ride confirmation"
          onKeyDown={(event) => {
            if (event.key === "Escape") setShowConfirm(false);
          }}
        >
          <div className="w-full max-w-[320px] rounded-[24px] bg-white px-6 pb-6 pt-7 text-center shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
            <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#ECFAF1] text-[#EF4444]">
              <X size={32} strokeWidth={2.4} />
            </span>
            <h2 className="text-[20px] font-extrabold text-[#111827]">Cancel Ride?</h2>
            <p className="mt-2 text-sm font-medium leading-5 text-[#6B7280]">
              Your ride with {driverName} will be cancelled.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  onCancel?.();
                }}
                disabled={cancelling}
                className="h-[52px] w-full rounded-[18px] bg-[#EF4444] text-base font-extrabold text-white shadow-[0_4px_12px_rgba(239,68,68,0.3)] transition active:scale-[0.99] disabled:opacity-60"
              >
                {cancelling ? "Cancelling..." : "Yes, Cancel"}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => setShowConfirm(false)}
                className="h-11 w-full rounded-[18px] bg-[#F3F4F6] text-sm font-bold text-[#6B7280] transition hover:bg-[#E5E7EB]"
              >
                No, go back
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
