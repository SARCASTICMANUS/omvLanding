import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  IndianRupee,
  LoaderCircle,
  Map,
  ShieldCheck,
  Star,
} from "lucide-react";
import api from "../../lib/api";
import { API_PATHS } from "../../constants/apiPaths";
import { ScreenHeader, StatusBadge, VayyCard } from "../../components/vayy";
import { buildRouteSummary } from "./driverFlowUtils";
import { formatKm } from "./driverRideUtils";

const shakeVariants = {
  rest: { x: 0 },
  shake: { x: [0, -10, 10, -8, 8, 0] },
};

const MotionDiv = motion.div;

export default function DriverOtpEntry({ ride, route, onBack, onVerified }) {
  const summary = useMemo(() => buildRouteSummary(route || {}), [route]);
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [shaking, setShaking] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputsRef = useRef([]);

  const shake = useCallback(() => {
    setShaking(true);
    window.setTimeout(() => setShaking(false), 450);
  }, []);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const handleChange = (value, index) => {
    const digit = value.replace(/[^0-9]/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    setError("");
    if (digit && index < 3) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (event, index) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const finish = () => {
    setSuccess(true);
    window.setTimeout(() => onVerified?.(ride.tripId), 1100);
  };

  const verify = async () => {
    const code = digits.join("");
    if (code.length < 4 || verifying || success) {
      shake();
      return;
    }

    setVerifying(true);
    setError("");
    try {
      const response = await api.patch(API_PATHS.dispatchStart(ride.tripId), { otp: code });
      const payload = response.data || {};
      if (payload.success !== false) {
        setVerifying(false);
        finish();
        return;
      }
      throw new Error(payload.message || "Invalid safety code");
    } catch (requestError) {
      try {
        const detail = await api.get(API_PATHS.dispatchDetail(ride.tripId));
        if (detail.data?.status === "active") {
          setVerifying(false);
          finish();
          return;
        }
      } catch {
        // Trip state unavailable — surface the original verification error.
      }
      setError(requestError?.response?.data?.message || requestError?.message || "Invalid code. Please try again.");
      setVerifying(false);
      shake();
    }
  };

  const metaRating = ride?.rating ?? null;
  const metaFare = ride?.fareAmount ?? null;
  const metaDistance = ride?.distanceKm != null ? formatKm(ride.distanceKm) : null;
  const hasMeta = metaRating != null || metaFare != null || metaDistance != null;
  const codeLength = digits.join("").length;

  return (
    <div className="min-h-screen bg-[#F8FAF9] pb-[120px]">
      <div className="mx-auto w-full max-w-[560px] px-4 pt-4 sm:px-6 lg:max-w-[720px]">
        <ScreenHeader
          title="Verify Safety Code"
          subtitle={summary.title}
          onBack={onBack}
          right={success ? <StatusBadge tone="success">Verified</StatusBadge> : null}
        />

        {/* Passenger summary card — replica of the mobile buddy card */}
        <VayyCard className="mt-2">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#009849] text-[15px] font-black text-white">
              {ride?.avatar || "P"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-extrabold text-[#111827]">
                {ride?.name || "Passenger"}
              </p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#009849]" />
                <span className="truncate text-[12px] font-medium text-[#6B7280]">
                  {ride?.pickup || "Pickup"}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#EF4444]" />
                <span className="truncate text-[12px] font-medium text-[#6B7280]">
                  {ride?.drop || "Destination"}
                </span>
              </div>
            </div>
          </div>

          {hasMeta && (
            <div className="mt-3 flex items-center justify-around border-t border-[#F3F4F6] pt-2.5">
              {metaRating != null && (
                <span className="flex items-center gap-1 text-[12px] font-bold text-[#374151]">
                  <Star size={12} className="text-[#F59E0B]" />
                  {metaRating}
                </span>
              )}
              {metaFare != null && (
                <span className="flex items-center gap-1 text-[12px] font-bold text-[#374151]">
                  <IndianRupee size={12} className="text-[#009849]" />
                  {metaFare}
                </span>
              )}
              {metaDistance != null && (
                <span className="flex items-center gap-1 text-[12px] font-bold text-[#374151]">
                  <Map size={12} className="text-[#6B7280]" />
                  {metaDistance}
                </span>
              )}
            </div>
          )}
        </VayyCard>

        <p className="mt-6 text-center text-[14px] font-medium leading-5 text-[#6B7280]">
          Ask your buddy for the 4-digit code
          <br />
          and enter it below
        </p>

        {/* OTP entry */}
        <VayyCard className="mt-5 p-5">
          <div className="flex items-center justify-center gap-2 text-[#009849]">
            <ShieldCheck size={18} />
            <span className="text-[12px] font-extrabold uppercase tracking-[0.5px]">
              Passenger safety code
            </span>
          </div>

          <MotionDiv
            variants={shakeVariants}
            initial="rest"
            animate={shaking ? "shake" : "rest"}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="mt-5 flex justify-center gap-3"
          >
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  inputsRef.current[index] = element;
                }}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(event) => handleChange(event.target.value, index)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                disabled={verifying || success}
                aria-label={`Safety code digit ${index + 1}`}
                className={`h-16 w-[min(56px,14vw)] rounded-[12px] border-[1.5px] text-center text-[22px] font-bold outline-none transition-colors disabled:opacity-60 ${
                  error
                    ? "border-[#EF4444] bg-[#FEF2F2] text-[#EF4444]"
                    : digit
                      ? "border-[#009849] bg-[#F0FAF2] text-[#009849]"
                      : "border-[#111827] bg-white text-[#111827] focus:border-[#009849] focus:ring-2 focus:ring-[#009849]/15"
                }`}
              />
            ))}
          </MotionDiv>

          <div className="mt-4 min-h-[40px] text-center">
            {error ? (
              <p className="text-[13px] font-bold text-[#EF4444]">{error}</p>
            ) : (
              <p className="text-[13px] font-medium text-[#9CA3AF]">
                The code is shared by your passenger when the ride starts.
              </p>
            )}
          </div>
        </VayyCard>

        <button
          type="button"
          onClick={verify}
          disabled={verifying || success}
          className={`mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-vayy bg-[#009849] text-[17px] font-extrabold text-white shadow-[0_4px_14px_rgba(0,152,73,0.35)] transition hover:bg-[#007A3B] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#D1D5DB] disabled:shadow-none ${
            codeLength < 4 && !verifying ? "opacity-40" : ""
          }`}
        >
          {verifying ? (
            <>
              <LoaderCircle size={20} className="animate-spin" />
              Verifying…
            </>
          ) : (
            <>
              <ShieldCheck size={20} strokeWidth={2.4} />
              Verify &amp; Start Ride
            </>
          )}
        </button>
      </div>

      {success && (
        <div
          className="fixed inset-0 z-[7000] flex flex-col items-center justify-center gap-4 bg-[#F8FAF9]/95 px-6 backdrop-blur-md"
          role="status"
          aria-label="Verified"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#009849] shadow-[0_4px_14px_rgba(0,152,73,0.3)]">
            <Check size={44} strokeWidth={3} className="text-white" />
          </span>
          <p className="text-[22px] font-extrabold tracking-[-0.4px] text-[#009849]">
            Verified!
          </p>
        </div>
      )}
    </div>
  );
}
