import React from "react";
import { StatusBadge } from "../../components/vayy";
import { estimateStopTimeline } from "./driverFlowUtils";

const titleCase = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

export default function DriverStopsTimeline({
  route,
  currentStopIndex = -1,
  className = "",
}) {
  const stops = estimateStopTimeline(route);

  if (!stops.length) {
    return (
      <div
        className={`rounded-vayy border border-[#F0F0F0] bg-white p-6 text-sm text-[#6B7280] shadow-v-sm ${className}`}
      >
        No stop timeline is available for this route yet.
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col rounded-vayy border border-[#F0F0F0] bg-white shadow-v-sm ${className}`}
    >
      <div className="border-b border-[#F0F0F6] px-5 py-4">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#9CA3AF]">
          Route Timeline
        </p>
        <h3 className="mt-2 text-lg font-black text-[#111827]">
          Stop sequence and operational timing
        </h3>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-1">
          {stops.map((stop, index) => {
            const isFirst = index === 0;
            const isLast = index === stops.length - 1;
            const completed =
              currentStopIndex > -1 && index < currentStopIndex;
            const isActive =
              currentStopIndex > -1 && index === currentStopIndex;

            const name =
              stop.short_name ||
              stop.name ||
              stop.stop_name ||
              `Stop ${stop.sequence}`;
            const city =
              stop.city ||
              stop.area ||
              (stop.name?.split(",")?.[1]?.trim() || "");
            const arrival =
              stop.arrivalLabel || stop.arrival_time || stop.eta || "--";
            const departure = stop.departure_time || stop.departure || "--";

            const statusLabel = titleCase(stop.status) || "Upcoming";
            const isDropOff = isLast && !completed;

            let badgeLabel = statusLabel;
            let badgeTone = /delay|late/i.test(statusLabel)
              ? "warning"
              : "success";
            if (completed) {
              badgeLabel = "Completed";
              badgeTone = "success";
            } else if (isFirst) {
              badgeLabel = "Boarding";
              badgeTone = "success";
            } else if (isLast) {
              badgeLabel = "Drop-off";
              badgeTone = "error";
            }

            const dotClass = isActive
              ? `flex h-[18px] w-[18px] shrink-0 rounded-full border-[3px] border-[#00E676] ${
                  isDropOff ? "bg-[#EF4444]" : "bg-[#009849]"
                }`
              : `h-3 w-3 shrink-0 rounded-full ${
                  isDropOff ? "bg-[#EF4444]" : "bg-[#009849]"
                }`;

            return (
              <div
                key={stop.id || stop.stop_id || `${stop.name}-${index}`}
                className={`flex min-h-[70px] items-center px-4 ${
                  isActive ? "rounded-v-md bg-[#009849]/[0.08]" : ""
                }`}
              >
                <span className="w-[52px] shrink-0 text-[12px] font-bold text-[#6B7280]">
                  {arrival}
                </span>

                <div className="flex w-[26px] shrink-0 flex-col items-center self-stretch">
                  {!isFirst && (
                    <span className="w-0.5 flex-1 bg-[#E5E7EB]" />
                  )}
                  <span className={dotClass} />
                  {!isLast && (
                    <span className="w-0.5 flex-1 bg-[#E5E7EB]" />
                  )}
                </div>

                <div className="min-w-0 flex-1 px-4">
                  <p
                    className={`truncate text-[14px] font-extrabold leading-snug ${
                      isActive ? "text-[#009849]" : "text-[#111827]"
                    }`}
                  >
                    {name}
                  </p>
                  {city ? (
                    <p className="mt-0.5 truncate text-[12px] text-[#6B7280]">
                      {city}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge tone={badgeTone}>{badgeLabel}</StatusBadge>
                  <span className="whitespace-nowrap text-[11px] font-semibold text-[#9CA3AF]">
                    {departure}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
