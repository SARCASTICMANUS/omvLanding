import React, { useCallback, useRef, useState } from "react";
import { ArrowLeft, Calendar, Check, Clock3, Heart, Ruler, Star } from "lucide-react";
import api from "../../../lib/api";
import { API_PATHS } from "../../../constants/apiPaths";
import bikeFrontImg from "../../../assets/vayyFrontBike.webp";

const RATING_HINTS = {
  1: "Poor",
  2: "Below Average",
  3: "Average",
  4: "Good",
  5: "Excellent",
};

function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "--";
  return `\u20B9${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}

function formatDistance(km) {
  const value = Number(km);
  if (!Number.isFinite(value) || value <= 0) return null;
  return `${value} km`;
}

export default function PassengerRideComplete({
  booking = {},
  onBookAnother,
  onBackToDashboard,
}) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [showThankYou, setShowThankYou] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submittingRef = useRef(false);

  const finalFare = booking.finalFare ?? booking.estimateFare ?? null;
  const distanceText = formatDistance(booking.distanceKm);
  const durationText =
    booking.durationMin != null && Number(booking.durationMin) > 0
      ? `${Math.ceil(Number(booking.durationMin))} min`
      : null;
  const driverName = booking.driverName || "Your driver";

  const submitRating = useCallback(async () => {
    if (!booking.tripId || submittingRef.current) return;
    if (rating <= 0) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError("");
    try {
      await api.post(API_PATHS.ride.rating, {
        trip: booking.tripId,
        rating,
        review,
      });
    } catch (error) {
      setSubmitError(
        error?.response?.data?.message ||
          error?.response?.data?.detail ||
          "We couldn't save your rating.",
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [booking.tripId, rating, review]);

  const handleBookAnother = useCallback(async () => {
    await submitRating();
    onBookAnother?.();
  }, [submitRating, onBookAnother]);

  const handleHome = useCallback(async () => {
    await submitRating();
    onBackToDashboard?.();
  }, [submitRating, onBackToDashboard]);

  const now = new Date();
  const timeStr = `${now.toLocaleDateString("en-IN", { weekday: "short" })}, ${now.toLocaleTimeString(
    "en-IN",
    { hour: "numeric", minute: "2-digit" },
  )}`;

  return (
    <div className="fixed inset-0 z-[500] overflow-y-auto bg-vayy-canvas font-sans">
      <div className="mx-auto w-full max-w-[560px] px-5 pb-12 pt-5 sm:px-6 lg:max-w-[640px]">
        <button
          type="button"
          onClick={onBackToDashboard}
          aria-label="Go back"
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#111827] shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition hover:bg-slate-50 active:scale-95"
        >
          <ArrowLeft size={22} strokeWidth={2.4} />
        </button>

        {/* Success header */}
        <div className="mb-6 text-center">
          <span className="mx-auto mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#009849] text-white shadow-[0_8px_24px_rgba(0,152,73,0.35)]">
            <Check size={36} strokeWidth={3} />
          </span>
          <h1 className="text-[24px] font-extrabold text-[#111827]">Ride Complete</h1>
          <p className="mt-1.5 text-sm font-medium text-[#6B7280]">
            You've reached your destination safely
          </p>
        </div>

        {/* Driver card */}
        <div className="mb-4 rounded-[20px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-3.5">
            <span className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[#F3F4F6]">
              <span className="text-xl font-extrabold text-[#009849]">
                {driverName.charAt(0).toUpperCase()}
              </span>
              <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#009849]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-extrabold text-[#111827]">{driverName}</p>
              <p className="truncate text-xs font-medium text-[#6B7280]">
                {booking.vehicleNumber || booking.routeName || "OMV ride"}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-[12px] bg-[#FFFBEB] px-2.5 py-1.5">
              <Star size={14} className="fill-[#FFB800] text-[#FFB800]" />
              <span className="text-[13px] font-extrabold text-[#111827]">
                {booking.driverRating || "--"}
              </span>
            </span>
          </div>
        </div>

        {/* Trip details card */}
        <div className="mb-4 rounded-[20px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <p className="mb-4 text-base font-extrabold text-[#111827]">Trip Details</p>

          <div className="flex items-center gap-3.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ECFAF1]">
              <span className="h-3 w-3 rounded-full bg-[#009849]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[#888888]">Pickup</p>
              <p className="truncate text-sm font-bold text-[#111827]">
                {booking.pickupName || "--"}
              </p>
            </div>
          </div>

          <div className="my-1 ml-[13px] h-7 w-0.5 bg-[#E5E7EB]" />

          <div className="flex items-center gap-3.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#009849] text-white">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[#888888]">Dropoff</p>
              <p className="truncate text-sm font-bold text-[#111827]">
                {booking.dropName || "--"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[#F3F4F6] pt-4">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7280]">
              <Ruler size={16} /> {distanceText || "--"}
            </span>
            <span className="h-1 w-1 rounded-full bg-[#D1D5DB]" />
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7280]">
              <Clock3 size={16} /> {durationText || "--"}
            </span>
            <span className="h-1 w-1 rounded-full bg-[#D1D5DB]" />
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7280]">
              <Calendar size={16} /> {timeStr}
            </span>
          </div>
        </div>

        {/* Fare breakdown card */}
        <div className="mb-4 rounded-[20px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <p className="mb-4 text-base font-extrabold text-[#111827]">Fare Breakdown</p>

          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#6B7280]">Estimated fare</span>
            <span className="text-sm font-bold text-[#111827]">{money(booking.estimateFare)}</span>
          </div>
          {booking.finalFare != null ? (
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#6B7280]">Final fare</span>
              <span className="text-sm font-bold text-[#111827]">{money(booking.finalFare)}</span>
            </div>
          ) : null}
          <div className="my-2 h-px bg-[#E5E7EB]" />
          <div className="flex items-center justify-between">
            <span className="text-base font-extrabold text-[#111827]">Total</span>
            <span className="text-xl font-extrabold text-[#009849]">{money(finalFare)}</span>
          </div>
        </div>

        {/* Rating card */}
        <div className="mb-4 rounded-[20px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <p className="mb-4 text-base font-extrabold text-[#111827]">Rate Your Ride</p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                onClick={() => {
                  setRating(star);
                  setShowThankYou(true);
                }}
                className="transition active:scale-90"
              >
                <Star
                  size={36}
                  className={
                    star <= rating
                      ? "fill-[#FFB800] text-[#FFB800]"
                      : "fill-[#E5E7EB] text-[#E5E7EB]"
                  }
                />
              </button>
            ))}
          </div>
          {rating > 0 ? (
            <p className="mt-3 text-center text-[13px] font-semibold text-[#6B7280]">
              {RATING_HINTS[rating]}
            </p>
          ) : null}

          <textarea
            value={review}
            onChange={(event) => setReview(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Tell us more about your ride (optional)"
            className="mt-4 w-full resize-none rounded-[14px] border border-[#E5E7EB] bg-[#F9FAF9] px-4 py-3 text-sm font-medium text-[#111827] outline-none transition focus:border-[#009849] focus:bg-white"
          />

          {submitError ? (
            <p className="mt-3 rounded-[14px] bg-[#FEF2F2] px-4 py-3 text-xs font-bold text-[#EF4444]">
              {submitError}
            </p>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleBookAnother}
            disabled={submitting}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-[#009849] text-[17px] font-extrabold text-white shadow-[0_4px_14px_rgba(0,152,73,0.3)] transition hover:bg-[#007A3B] active:scale-[0.99] disabled:opacity-60"
          >
            <img src={bikeFrontImg} alt="" className="h-5 w-5 object-contain" />
            {submitting
              ? "Saving..."
              : rating > 0
                ? "Book Another Ride"
                : "Skip & Book Another Ride"}
          </button>
          <button
            type="button"
            onClick={handleHome}
            disabled={submitting}
            className="h-[50px] w-full rounded-[18px] bg-[#F3F4F6] text-[15px] font-bold text-[#6B7280] transition hover:bg-[#E5E7EB] disabled:opacity-60"
          >
            Back to Home
          </button>
        </div>
      </div>

      {showThankYou ? (
        <div
          className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/50 px-8"
          role="dialog"
          aria-modal="true"
          aria-label="Thank you"
          onKeyDown={(event) => {
            if (event.key === "Escape") setShowThankYou(false);
          }}
        >
          <div className="w-full max-w-[320px] rounded-[24px] bg-white px-6 pb-6 pt-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
            <span className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#009849] text-white">
              <Heart size={34} className="fill-white" />
            </span>
            <h2 className="text-[24px] font-black text-[#111827]">Thank You!</h2>
            <p className="mt-2 text-sm font-medium leading-5 text-[#6B7280]">
              Your feedback helps us improve the experience for everyone.
            </p>
            <button
              type="button"
              autoFocus
              onClick={() => setShowThankYou(false)}
              className="mt-6 h-[52px] w-full rounded-[18px] bg-[#009849] text-[17px] font-extrabold text-white transition hover:bg-[#007A3B]"
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
