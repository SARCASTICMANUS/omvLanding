import React, { useEffect, useRef, useState } from "react";
import { Check, Cog, Radio, Shield, LoaderCircle } from "lucide-react";
import bikeImage1 from "../../assets/vayyWithoutPassengerBike.webp";
import bikeImage2 from "../../assets/vayyWithoutPassengerBike2.webp";
import bikeImage3 from "../../assets/vayyWithoutPassengerBike3.webp";
import bikeImage4 from "../../assets/vayyWithoutPassengerBike4.webp";

const CHECKS = [
  { key: "network", label: "Network", group: "system" },
  { key: "gps", label: "GPS", group: "system" },
  { key: "location", label: "Location", group: "system" },
  { key: "helmet", label: "Wear Helmet", group: "safety" },
  { key: "stand", label: "Kickstand Up", group: "safety" },
  { key: "bike", label: "Bike Ready", group: "safety" },
];
const BIKE_IMAGES = [bikeImage1, bikeImage2, bikeImage3, bikeImage4];

function CheckRow({ item, status, onConfirmReady }) {
  const passed = status === "passed";
  const checking = status === "checking";

  return (
    <div className="flex min-h-[72px] items-center gap-4 rounded-[22px] bg-white/[0.12] px-4 py-3 sm:min-h-[84px] sm:px-5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/[0.24] sm:h-[58px] sm:w-[58px]">
        {passed ? (
          <Check className="text-white" size={24} strokeWidth={2.2} />
        ) : checking ? (
          <LoaderCircle className="animate-spin text-amber-300" size={23} />
        ) : (
          <span className="h-2 w-2 rounded-full bg-white/70" />
        )}
      </span>
      <span className="min-w-0 flex-1 text-[16px] font-semibold text-white sm:text-[19px]">
        {item.label}
      </span>
      {item.group === "safety" ? (
        <button
          type="button"
          onClick={() => onConfirmReady(item.key)}
          aria-pressed={passed}
          className={`min-w-[88px] rounded-[14px] px-3 py-2 text-[12px] font-bold uppercase transition active:scale-95 sm:min-w-[104px] sm:px-4 sm:text-[14px] ${
            passed
              ? "bg-white/[0.28] text-white"
              : "bg-white/20 text-white hover:bg-white/30"
          }`}
        >
          {passed ? "Confirmed" : "Confirm"}
        </button>
      ) : (
        <span
          className={`rounded-[14px] px-3 py-2 text-[12px] font-bold uppercase sm:px-4 sm:text-[14px] ${
            passed
              ? "bg-white/[0.2] text-white"
              : checking
                ? "bg-amber-300/20 text-amber-300"
                : "bg-white/[0.12] text-white/55"
          }`}
        >
          {passed ? "Ready" : checking ? "Checking" : "Pending"}
        </span>
      )}
    </div>
  );
}

export default function DriverPreRideCheck({ onComplete }) {
  const [statuses, setStatuses] = useState(() => CHECKS.map(() => "pending"));
  const [vehicleIndex, setVehicleIndex] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimer = useRef(null);
  const passedCount = statuses.filter((status) => status === "passed").length;
  const allPassed = passedCount === CHECKS.length;

  useEffect(() => {
    let cancelled = false;
    let timer;
    const runChecks = async () => {
      for (let index = 0; index < 3; index += 1) {
        if (cancelled) return;
        setStatuses((current) => current.map((status, itemIndex) =>
          itemIndex === index ? "checking" : status,
        ));
        await new Promise((resolve) => {
          timer = setTimeout(resolve, 700);
        });
        if (cancelled) return;
        setStatuses((current) => current.map((status, itemIndex) =>
          itemIndex === index ? "passed" : status,
        ));
        await new Promise((resolve) => {
          timer = setTimeout(resolve, 180);
        });
      }
    };
    runChecks();
    const imageTimer = setInterval(() => {
      setVehicleIndex((index) => (index + 1) % BIKE_IMAGES.length);
    }, 2400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(imageTimer);
      clearTimeout(closeTimer.current);
    };
  }, []);

  const handleConfirmReady = (key) => {
    setStatuses((current) => current.map((status, index) =>
      CHECKS[index].key === key ? "passed" : status,
    ));
  };

  const handleGoLive = () => {
    if (!allPassed || isClosing) return;
    setIsClosing(true);
    closeTimer.current = setTimeout(() => onComplete?.(), 480);
  };

  return (
    <div className="fixed inset-0 z-[8000] flex items-start justify-center bg-slate-950/45">
      <main
        className="relative mx-auto flex h-[calc(100dvh-18px)] w-full max-w-[620px] flex-col overflow-y-auto rounded-b-[34px] bg-[#009849] px-5 pb-4 pt-[max(28px,env(safe-area-inset-top))] text-white shadow-2xl sm:px-8 sm:pt-10"
        style={{
          animation: isClosing
            ? "omv-pre-ride-slide-up 480ms cubic-bezier(0.65, 0, 0.35, 1) forwards"
            : "omv-pre-ride-slide-down 560ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        <header className="flex items-center gap-3 border-b border-white/20 pb-4 text-[18px] font-semibold uppercase tracking-[0.4px] text-white/65 sm:pb-6 sm:text-[21px]">
          <img src={BIKE_IMAGES[0]} alt="" className="h-5 w-5 object-contain opacity-60" />
          <span>Pre-Ride Check</span>
        </header>

        <section className="flex flex-1 flex-col">
          <div className="flex flex-col items-center pb-5 pt-7 text-center sm:pt-10">
            <div className="flex h-[128px] items-center justify-center sm:h-[150px]">
              <img
                src={BIKE_IMAGES[vehicleIndex]}
                alt="Bike readiness"
                className="h-[120px] w-[180px] object-contain sm:h-[142px] sm:w-[210px]"
              />
            </div>
            <div className="mt-3 h-1.5 w-1/2 max-w-[300px] overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-500"
                style={{ width: `${(passedCount / CHECKS.length) * 100}%` }}
              />
            </div>
            <div className="mt-3 rounded-[16px] bg-white/[0.16] px-4 py-1.5 text-[19px] font-extrabold">
              {passedCount}/{CHECKS.length}
            </div>
            <h1 className="mt-6 text-[29px] font-extrabold tracking-[-0.6px] sm:text-[34px]">
              Ready to Ride
            </h1>
            <p className="mt-1 text-[17px] font-medium text-white/60 sm:text-[19px]">
              Verifying your setup
            </p>
          </div>

          <div className="mt-1 flex items-center gap-2 px-1 pb-2 text-[14px] font-bold uppercase tracking-[0.5px] text-white/80 sm:text-[16px]">
            <Cog size={17} className="text-white/55" />
            System
          </div>
          <div className="flex flex-col gap-2.5">
            {CHECKS.slice(0, 3).map((item, index) => (
              <CheckRow key={item.key} item={item} status={statuses[index]} onConfirmReady={handleConfirmReady} />
            ))}
          </div>

          <div className="mt-5 flex items-center gap-2 px-1 pb-2 text-[14px] font-bold uppercase tracking-[0.5px] text-white/80 sm:mt-6 sm:text-[16px]">
            <Shield size={17} className="fill-white/45 text-white/45" />
            Safety
          </div>
          <div className="flex flex-col gap-2.5">
            {CHECKS.slice(3).map((item, index) => (
              <CheckRow key={item.key} item={item} status={statuses[index + 3]} onConfirmReady={handleConfirmReady} />
            ))}
          </div>
        </section>

        {allPassed ? (
          <button
            type="button"
            onClick={handleGoLive}
            disabled={isClosing}
            className="mt-5 flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[18px] bg-white font-extrabold text-[#009849] shadow-lg transition active:scale-[0.99] disabled:opacity-75"
          >
            <Radio size={20} />
            Go Live
          </button>
        ) : null}
        <div className="mx-auto mt-5 h-1.5 w-[90px] shrink-0 rounded-full bg-white/35" />
      </main>
      <style>{`
        @keyframes omv-pre-ride-slide-down {
          from { transform: translateY(-105%); }
          to { transform: translateY(0); }
        }
        @keyframes omv-pre-ride-slide-up {
          from { transform: translateY(0); }
          to { transform: translateY(-105%); }
        }
      `}</style>
    </div>
  );
}
