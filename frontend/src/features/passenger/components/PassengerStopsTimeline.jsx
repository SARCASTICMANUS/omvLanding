import React from "react";
import {
  ArrowLeft,
  ArrowRight,
  BusFront,
  Check,
  Clock3,
  Globe2,
  MapPin,
  ShieldCheck,
  TrendingUp,
  Bell,
  ChevronDown,
  User,
} from "lucide-react";

/* ─────────────────────────────────────────────
   HELPER — derive display values from selectedTrip
───────────────────────────────────────────── */
function shortPlace(point, fallback) {
  return (
    point?.name ||
    point?.display_name?.split(",")?.[0] ||
    point?.address ||
    fallback
  );
}
function shortState(point, fallback) {
  const parts = point?.display_name?.split(",") || [];
  return parts[1]?.trim() || fallback;
}

/* ─────────────────────────────────────────────
   BUS MINI SVG — used in "Safe. Reliable." card
───────────────────────────────────────────── */
function BusMini() {
  return (
    <svg viewBox="0 0 160 80" style={{ width: "100%", height: "100%" }}>
      {/* dashed route trail */}
      <path
        d="M10 55 Q50 30 90 40 Q120 48 145 30"
        fill="none"
        stroke="#009849"
        strokeWidth="2"
        strokeDasharray="5,4"
        strokeLinecap="round"
        opacity="0.6"
      />
      {/* pin */}
      <path
        d="M145 20 C145 13 138 8 130 8 C122 8 115 13 115 20 C115 30 130 42 130 42 S145 30 145 20Z"
        fill="#009849"
        opacity="0.8"
      />
      <circle cx="130" cy="20" r="4" fill="white" />
      {/* bus body */}
      <rect x="30" y="38" width="78" height="30" rx="5" fill="#009849" />
      <rect x="30" y="38" width="78" height="7" rx="5" fill="#00b85a" opacity="0.5" />
      {/* windows */}
      <rect x="36" y="43" width="12" height="10" rx="2" fill="black" opacity="0.5" />
      <rect x="52" y="43" width="12" height="10" rx="2" fill="black" opacity="0.5" />
      <rect x="68" y="43" width="12" height="10" rx="2" fill="black" opacity="0.5" />
      <rect x="84" y="43" width="18" height="10" rx="2" fill="black" opacity="0.5" />
      {/* wheels */}
      <circle cx="46" cy="70" r="7" fill="#064e2a" />
      <circle cx="46" cy="70" r="3" fill="#009849" />
      <circle cx="92" cy="70" r="7" fill="#064e2a" />
      <circle cx="92" cy="70" r="3" fill="#009849" />
      {/* headlight */}
      <ellipse cx="32" cy="58" rx="5" ry="3" fill="#fef3c7" opacity="0.9" />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   STOP STATUS — returns label + colors
───────────────────────────────────────────── */
function getStopStatus(stop, index, stops) {
  if (stop.status === "completed" || stop.is_completed)
    return { label: "Completed", type: "completed" };
  if (stop.status === "boarding" || stop.is_boarding)
    return { label: "Boarding Stop", type: "boarding" };
  if (index === stops.length - 1 || stop.status === "dropoff" || stop.is_dropoff)
    return { label: "Drop-off Stop", type: "dropoff" };
  return { label: "Upcoming", type: "upcoming" };
}

function getDotColor(stop, index, stops) {
  const { type } = getStopStatus(stop, index, stops);
  if (type === "completed" || type === "boarding") return "#009849";
  if (type === "dropoff") return "#ef4444";
  return "#9ca3af";
}

/* ─────────────────────────────────────────────
   FEATURE ROW — right panel item
───────────────────────────────────────────── */
function FeatureRow({ icon: Icon, title, desc }) {
  return (
    <div style={{
      display: "flex", alignItems: "center",
      justifyContent: "space-between",
      padding: "16px 20px",
      borderBottom: "1px solid #f0f0f0",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          border: "1.5px solid #e5e7eb", background: "white",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Icon size={19} color="#374151" strokeWidth={1.8} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{title}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{desc}</div>
        </div>
      </div>
      <span style={{
        width: 11, height: 11, borderRadius: "50%",
        background: "#009849", flexShrink: 0,
      }} />
    </div>
  );
}

/* ─────────────────────────────────────────────
   MOBILE FEATURE GRID — 2×2 inside one card
───────────────────────────────────────────── */
function MobileFeatureGrid() {
  const items = [
    { icon: MapPin,     title: "Live Tracking",   desc: "Real-time location of your bus" },
    { icon: Clock3,     title: "On Time",          desc: "Smart ETA and timely updates" },
    { icon: Bell,       title: "Notifications",    desc: "Get notified at every stop" },
    { icon: ShieldCheck,title: "Secure Journey",   desc: "Your safety is our priority" },
  ];
  return (
    <div style={{
      background: "white", borderRadius: 18,
      border: "1px solid #f0f0f0",
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      display: "grid", gridTemplateColumns: "1fr 1fr",
      overflow: "hidden",
    }}>
      {items.map(({ icon: Icon, title, desc }, i) => (
        <div key={title} style={{
          padding: "16px 14px",
          borderRight: i % 2 === 0 ? "1px solid #f0f0f0" : "none",
          borderBottom: i < 2 ? "1px solid #f0f0f0" : "none",
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: "50%",
            border: "1.5px solid #e5e7eb", background: "#f9fafb",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Icon size={17} color="#374151" strokeWidth={1.8} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{title}</span>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#009849", flexShrink: 0 }} />
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3, lineHeight: 1.4 }}>{desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   TRIP SUMMARY CARD
───────────────────────────────────────────── */
function TripSummaryCard({ selectedTrip, pickup, destination }) {
  const busNo     = selectedTrip?.bus_number || selectedTrip?.vehicle_number || "UP 32 DC 0003";
  const seatType  = selectedTrip?.seat_type  || selectedTrip?.vehicle_type  || "AC Seater";
  const eta       = selectedTrip?.eta_minutes || 5;
  const fromCity  = shortPlace(pickup, selectedTrip?.pickup_name || "Noida");
  const fromState = shortState(pickup, "UP");
  const toCity    = shortPlace(destination, selectedTrip?.destination_name || "Delhi");
  const toState   = shortState(destination, "Delhi");
  const startTime = selectedTrip?.start_time || "7:00 AM";
  const endTime   = selectedTrip?.end_time   || "8:00 AM";
  const distKm    = selectedTrip?.distance_km || selectedTrip?.distance_text || "45 km";
  const duration  = selectedTrip?.duration_text || selectedTrip?.eta_text   || "45 min";
  const stopsCount= Array.isArray(selectedTrip?.stops)
    ? selectedTrip.stops.length
    : selectedTrip?.stops_count || 8;

  return (
    <div style={{
      background: "white", borderRadius: 18,
      border: "1px solid #f0f0f0",
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      padding: "20px 20px 0", overflow: "hidden",
    }}>
      {/* Section label */}
      <div style={{
        fontSize: 11, fontWeight: 800, color: "#009849",
        letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 14,
      }}>
        Your Trip
      </div>

      {/* Bus identity row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "#f0fdf4", border: "1.5px solid #bbf7d0",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <BusFront size={28} color="#009849" strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#111827", lineHeight: 1.1 }}>{busNo}</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>{seatType}</div>
          </div>
        </div>
        {/* ETA badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "#f0fdf4", border: "1px solid #bbf7d0",
          borderRadius: 20, padding: "6px 12px",
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#009849" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>
            Arrives in {eta} min
          </span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "#f0f0f0", marginBottom: 16 }} />

      {/* From → To */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <MapPin size={16} color="#009849" style={{ marginTop: 3, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#111827" }}>
              {fromCity}, {fromState}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{startTime}</div>
          </div>
        </div>
        <ArrowRight size={20} color="#374151" strokeWidth={2} />
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, textAlign: "right" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#111827" }}>
              {toCity}, {toState}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{endTime}</div>
          </div>
          <MapPin size={16} color="#009849" style={{ marginTop: 3, flexShrink: 0 }} />
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "#f0f0f0", marginBottom: 0 }} />

      {/* Metrics strip */}
      <div style={{ display: "flex", alignItems: "stretch" }}>
        {[
          { icon: TrendingUp, value: typeof distKm === "number" ? `${distKm} km` : distKm, label: "Distance" },
          { icon: Clock3,     value: duration,     label: "Duration" },
          { icon: BusFront,   value: stopsCount,   label: "Stops" },
        ].map(({ icon: Icon, value, label }, i) => (
          <div key={label} style={{
            flex: 1, display: "flex", alignItems: "center", gap: 10,
            padding: "14px 12px",
            borderRight: i < 2 ? "1px solid #f0f0f0" : "none",
          }}>
            <Icon size={18} color="#374151" strokeWidth={1.8} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>{value}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   JOURNEY STOPS CARD
───────────────────────────────────────────── */
function JourneyStopsCard({ stops, onPrev, onNext }) {
  if (!stops || stops.length === 0) {
    return (
      <div style={{
        background: "white", borderRadius: 18,
        border: "1px solid #f0f0f0",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        padding: 20,
        display: "flex", alignItems: "center", gap: 10,
        fontSize: 14, color: "#9ca3af",
      }}>
        <MapPin size={16} /> No stops found for this trip.
      </div>
    );
  }

  return (
    <div style={{
      background: "white", borderRadius: 18,
      border: "1px solid #f0f0f0",
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      overflow: "hidden",
    }}>
      {/* Card header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 20px 14px",
        borderBottom: "1px solid #f5f5f5",
      }}>
        <span style={{
          fontSize: 12, fontWeight: 800, color: "#009849",
          letterSpacing: 0.8, textTransform: "uppercase",
        }}>
          Journey Stops
        </span>
        {/* Prev / Next nav */}
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { onClick: onPrev, icon: ArrowLeft,  label: "Previous" },
            { onClick: onNext, icon: ArrowRight, label: "Next" },
          ].map(({ onClick, icon: Icon, label }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              aria-label={label}
              style={{
                width: 34, height: 34, borderRadius: 10,
                border: "1.5px solid #e5e7eb", background: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "border-color 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#009849"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#e5e7eb"}
            >
              <Icon size={15} color="#374151" strokeWidth={2.2} />
            </button>
          ))}
        </div>
      </div>

      {/* Stop rows */}
      <div style={{ padding: "8px 20px 12px" }}>
        {stops.map((stop, index) => {
          const { label, type } = getStopStatus(stop, index, stops);
          const dotColor        = getDotColor(stop, index, stops);
          const isBoarding      = type === "boarding";
          const isCompleted     = type === "completed";
          const isDropoff       = type === "dropoff";
          const isLast          = index === stops.length - 1;
          const time            = stop.arrival_time || stop.departure_time || "";

          return (
            <div
              key={stop.id || index}
              style={{
                display: "flex", alignItems: "flex-start", gap: 0,
                paddingTop: index === 0 ? 10 : 0,
              }}
            >
              {/* Time col */}
              <div style={{
                width: 70, flexShrink: 0, paddingTop: 2,
                fontSize: 13, fontWeight: 600, color: "#6b7280",
                textAlign: "right", paddingRight: 14,
              }}>
                {time}
              </div>

              {/* Timeline spine */}
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                flexShrink: 0, width: 20,
              }}>
                {/* Dot */}
                <div style={{
                  width: isBoarding ? 16 : 12,
                  height: isBoarding ? 16 : 12,
                  borderRadius: "50%",
                  background: isBoarding ? "white" : dotColor,
                  border: isBoarding
                    ? `3px solid ${dotColor}`
                    : isCompleted
                    ? "2.5px solid white"
                    : "none",
                  boxShadow: isBoarding
                    ? `0 0 0 3px ${dotColor}33`
                    : "none",
                  marginTop: 3,
                  flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {isCompleted && (
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%", background: dotColor,
                    }} />
                  )}
                </div>
                {/* Line connector */}
                {!isLast && (
                  <div style={{
                    width: 2,
                    flex: 1,
                    minHeight: 28,
                    background: isCompleted || isBoarding ? "#009849" : "#e5e7eb",
                    marginTop: 3,
                  }} />
                )}
              </div>

              {/* Stop info */}
              <div style={{
                flex: 1, paddingLeft: 12, paddingBottom: isLast ? 10 : 20,
                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              }}>
                <div style={{
                  fontSize: 14, fontWeight: isBoarding ? 800 : 600,
                  color: isBoarding ? "#009849" : "#111827",
                }}>
                  {stop.name || `Stop ${index + 1}`}
                </div>

                {/* Status badge */}
                {type === "completed" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Completed</span>
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: "#009849",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Check size={12} color="white" strokeWidth={3} />
                    </div>
                  </div>
                )}
                {type === "boarding" && (
                  <div style={{
                    background: "#009849", color: "white",
                    fontSize: 12, fontWeight: 800,
                    padding: "4px 10px", borderRadius: 20, flexShrink: 0,
                  }}>
                    Boarding Stop
                  </div>
                )}
                {type === "dropoff" && (
                  <div style={{
                    background: "#fef2f2", color: "#ef4444",
                    fontSize: 12, fontWeight: 800,
                    padding: "4px 10px", borderRadius: 20,
                    border: "1px solid #fecaca", flexShrink: 0,
                  }}>
                    Drop-off Stop
                  </div>
                )}
                {type === "upcoming" && (
                  <span style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500, flexShrink: 0 }}>
                    Upcoming
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SAFE RELIABLE BANNER CARD (right panel top)
───────────────────────────────────────────── */
function SafeReliableCard() {
  return (
    <div style={{
      background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
      borderRadius: 18, border: "1px solid #bbf7d0",
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      padding: "20px 20px 0", overflow: "hidden",
      position: "relative", minHeight: 140,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 8 }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: "#009849",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <ShieldCheck size={24} color="white" strokeWidth={2} />
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#111827", lineHeight: 1.2 }}>
            Safe. Reliable. On Time.
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            Live tracking & real-time updates
          </div>
        </div>
      </div>
      {/* Bus mini illustration */}
      <div style={{ height: 80, marginTop: 4 }}>
        <BusMini />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MOBILE SAFE RELIABLE BANNER
───────────────────────────────────────────── */
function MobileSafeBanner() {
  return (
    <div style={{
      background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
      borderRadius: 18, border: "1px solid #bbf7d0",
      padding: "16px 16px 0", overflow: "hidden",
      display: "flex", alignItems: "flex-end", justifyContent: "space-between",
      minHeight: 110,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, paddingBottom: 16 }}>
        <div style={{
          width: 42, height: 42, borderRadius: "50%", background: "#009849",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <ShieldCheck size={21} color="white" strokeWidth={2} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>Safe. Reliable. On Time.</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>Live tracking & real-time updates</div>
        </div>
      </div>
      <div style={{ width: 110, height: 80, flexShrink: 0 }}>
        <BusMini />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   CONFIRM BUTTON
───────────────────────────────────────────── */
function ConfirmBtn({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%", height: 56, borderRadius: 18, border: "none",
        background: "#009849", color: "white",
        fontWeight: 800, fontSize: 16, fontFamily: "inherit",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
        cursor: "pointer",
        boxShadow: "0 4px 20px rgba(0,152,73,0.30)",
        transition: "background 0.18s, transform 0.12s",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "#007a3d"}
      onMouseLeave={e => e.currentTarget.style.background = "#009849"}
    >
      Confirm &amp; Track Bus
      <ArrowRight size={20} strokeWidth={2.5} />
    </button>
  );
}

/* ─────────────────────────────────────────────
   MAIN EXPORT — PassengerStopsTimeline
   All original props preserved + unchanged
───────────────────────────────────────────── */
export default function PassengerStopsTimeline({
  selectedTrip,
  pickup,
  destination,
  onBack,
  onTrackNow,
  onEditRoute,
}) {
  const stops = selectedTrip?.stops || [];

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
    .pst-root { font-family: 'Plus Jakarta Sans', sans-serif; }
    .pst-root * { box-sizing: border-box; }

    /* Layout switch */
    @media (min-width: 1024px) {
      .pst-mobile-header { display: none  !important; }
      .pst-desktop-wrap  { display: grid  !important; }
      .pst-mobile-wrap   { display: none  !important; }
    }
    @media (max-width: 1023px) {
      .pst-mobile-header { display: flex  !important; }
      .pst-desktop-wrap  { display: none  !important; }
      .pst-mobile-wrap   { display: flex  !important; }
    }
  `;

  return (
    <>
      <style>{css}</style>
      <div
        className="pst-root"
        style={{
          minHeight: "100vh",
          background: "#F8FAF9",
          display: "flex",
          flexDirection: "column",
        }}
      >

        {/* ══════════════════════════════════
            MOBILE NAVBAR
        ══════════════════════════════════ */}
        <nav
          className="pst-mobile-header"
          style={{
            display: "none",
            alignItems: "center", justifyContent: "space-between",
            padding: "12px 20px", background: "white",
            borderBottom: "1px solid #f0f0f0",
            position: "sticky", top: 0, zIndex: 100,
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              width: 36, height: 36, borderRadius: "50%",
              border: "1.5px solid #e5e7eb", background: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
            }}
          >
            <ArrowLeft size={18} color="#374151" strokeWidth={2.2} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 32, height: 32, background: "#009849", borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 900, fontSize: 16, color: "white",
            }}>V</div>
            <span style={{ fontWeight: 900, fontSize: 18, color: "#111827" }}>VAYY</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" style={{
              display: "flex", alignItems: "center", gap: 5,
              border: "1px solid #e5e7eb", borderRadius: 20,
              padding: "5px 10px", background: "white",
              fontSize: 13, fontWeight: 600, color: "#374151",
              cursor: "pointer", fontFamily: "inherit",
            }}>
              <Globe2 size={13} /> English <ChevronDown size={11} />
            </button>
            <button type="button" style={{
              width: 34, height: 34, borderRadius: "50%",
              border: "1.5px solid #e5e7eb", background: "#f9fafb",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}>
              <User size={16} color="#009849" />
            </button>
          </div>
        </nav>

        {/* ══════════════════════════════════
            SHARED PAGE HEADING
        ══════════════════════════════════ */}
        <div style={{ padding: "24px 24px 0", maxWidth: 1400, width: "100%", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            {/* Back btn — desktop only (mobile uses navbar) */}
            <button
              type="button"
              onClick={onBack}
              className="pst-mobile-header"
              style={{
                display: "none", /* shown only desktop via CSS override below */
                width: 40, height: 40, borderRadius: "50%",
                border: "1.5px solid #e5e7eb", background: "white",
                alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0,
                boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
              }}
            >
              <ArrowLeft size={18} color="#374151" strokeWidth={2.2} />
            </button>

            {/* Desktop back btn */}
            <button
              type="button"
              onClick={onBack}
              className="pst-desktop-back"
              style={{
                width: 40, height: 40, borderRadius: "50%",
                border: "1.5px solid #e5e7eb", background: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0,
                boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
              }}
            >
              <ArrowLeft size={18} color="#374151" strokeWidth={2.2} />
            </button>

            <div>
              <h1 style={{ fontSize: 28, fontWeight: 900, color: "#111827", lineHeight: 1, margin: 0 }}>
                Confirm Your <span style={{ color: "#009849" }}>Trip</span>
              </h1>
              <p style={{ fontSize: 14, color: "#6b7280", margin: "6px 0 0" }}>
                Review your journey details
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════
            DESKTOP — 2-column grid
        ══════════════════════════════════ */}
        <div
          className="pst-desktop-wrap"
          style={{
            display: "none",
            gridTemplateColumns: "1fr 380px",
            gap: 20,
            padding: "0 24px 32px",
            maxWidth: 1400,
            width: "100%",
            margin: "0 auto",
            alignItems: "start",
          }}
        >
          {/* LEFT col */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <TripSummaryCard
              selectedTrip={selectedTrip}
              pickup={pickup}
              destination={destination}
            />
            <JourneyStopsCard
              stops={stops}
              onPrev={() => {}}
              onNext={() => {}}
            />
          </div>

          {/* RIGHT col */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <SafeReliableCard />

            {/* Feature rows card */}
            <div style={{
              background: "white", borderRadius: 18,
              border: "1px solid #f0f0f0",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              overflow: "hidden",
            }}>
              <FeatureRow
                icon={MapPin}
                title="Live Tracking"
                desc="Real-time location of your bus"
              />
              <FeatureRow
                icon={Clock3}
                title="On Time"
                desc="Smart ETA and timely updates"
              />
              <FeatureRow
                icon={Bell}
                title="Notifications"
                desc="Get notified at every stop"
              />
              <div style={{ borderBottom: "none" }}>
                <FeatureRow
                  icon={ShieldCheck}
                  title="Secure Journey"
                  desc="Your safety is our priority"
                />
              </div>
            </div>

            {/* CTA */}
            <ConfirmBtn onClick={onTrackNow} />
          </div>
        </div>

        {/* ══════════════════════════════════
            MOBILE — single column
        ══════════════════════════════════ */}
        <div
          className="pst-mobile-wrap"
          style={{
            display: "none",
            flexDirection: "column",
            gap: 14,
            padding: "0 16px 100px", /* 100px for sticky CTA */
            maxWidth: 480,
            width: "100%",
            margin: "0 auto",
          }}
        >
          <TripSummaryCard
            selectedTrip={selectedTrip}
            pickup={pickup}
            destination={destination}
          />

          <MobileSafeBanner />

          <JourneyStopsCard
            stops={stops}
            onPrev={() => {}}
            onNext={() => {}}
          />

          <MobileFeatureGrid />
        </div>

        {/* ══════════════════════════════════
            MOBILE STICKY CTA
        ══════════════════════════════════ */}
        <div
          className="pst-mobile-header"
          style={{
            display: "none",
            position: "fixed", bottom: 0, left: 0, right: 0,
            padding: "12px 16px 20px",
            background: "white",
            borderTop: "1px solid #f0f0f0",
            zIndex: 99,
          }}
        >
          <ConfirmBtn onClick={onTrackNow} />
        </div>

        {/* Hide desktop back btn on mobile */}
        <style>{`
          @media (max-width: 1023px) {
            .pst-desktop-back { display: none !important; }
          }
        `}</style>
      </div>
    </>
  );
}