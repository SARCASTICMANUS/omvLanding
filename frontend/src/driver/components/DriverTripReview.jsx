// VAYY | DriverTripReview.jsx
// Light theme — matches web + mobile reference exactly.
// All original props preserved: route, source, destination, onBack, onStartTrip, starting

import React, { useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BusFront,
  Clock3,
  Eye,
  GitMerge,
  MapPin,
  Pencil,
  Play,
  Route,
  Users,
} from "lucide-react";
import { buildRouteSummary } from "./driverFlowUtils";

/* ─────────────────────────────────────────────
   CSS
───────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

  .dtr { font-family: 'Plus Jakarta Sans', sans-serif; }
  .dtr * { box-sizing: border-box; }

  .dtr-line { display: flex; align-items: center; margin: 12px 0 10px; }
  .dtr-dot-g {
    width: 13px; height: 13px; border-radius: 50%;
    background: #009849; flex-shrink: 0;
    box-shadow: 0 0 0 3px rgba(0,152,73,0.18);
  }
  .dtr-dot-r {
    width: 13px; height: 13px; border-radius: 50%;
    background: #ef4444; flex-shrink: 0;
    box-shadow: 0 0 0 3px rgba(239,68,68,0.18);
  }
  .dtr-dash {
    flex: 1; height: 2.5px;
    background-image: repeating-linear-gradient(
      to right,
      #009849 0, #009849 8px,
      #ef4444 8px, #ef4444 11px,
      transparent 11px, transparent 15px
    );
  }

  .dtr-card {
    background: white; border-radius: 18px;
    border: 1px solid #f0f0f0;
    box-shadow: 0 2px 14px rgba(0,0,0,0.06);
    overflow: hidden;
  }

  .dtr-met { flex: 1; padding: 18px 20px; }
  .dtr-met + .dtr-met { border-left: 1px solid #f0f0f0; }

  .dtr-srow {
    display: grid;
    grid-template-columns: 72px 20px 1fr auto;
    gap: 0 14px;
    align-items: center;
    padding: 11px 0;
    border-bottom: 1px solid #f9f9f9;
  }
  .dtr-srow:last-child { border-bottom: none; }
  .dtr-srow.cur {
    background: #f0fdf4 !important;
    border-radius: 12px;
    padding: 11px 10px !important;
    margin: 2px -10px;
    border-bottom: none;
  }

  .dtr-sumrow {
    display: flex; align-items: center;
    justify-content: space-between;
    padding: 14px 24px;
    border-bottom: 1px solid #f5f5f5;
  }
  .dtr-sumrow:last-child { border-bottom: none; }

  .dtr-cta {
    width: 100%; height: 56px; border: none; border-radius: 18px;
    background: #009849; color: white;
    font-weight: 800; font-size: 16px; font-family: inherit;
    cursor: pointer; display: flex; align-items: center;
    justify-content: center; gap: 12px;
    box-shadow: 0 4px 20px rgba(0,152,73,0.28);
    transition: background 0.15s, transform 0.1s;
  }
  .dtr-cta:hover:not(:disabled) { background: #007a3d; transform: translateY(-1px); }
  .dtr-cta:disabled { background: #d1d5db; box-shadow: none; cursor: not-allowed; }

  .dtr-edit {
    display: inline-flex; align-items: center; gap: 7px;
    border: 1.5px solid #bbf7d0; border-radius: 12px;
    background: white; color: #009849;
    padding: 9px 16px; font-size: 13px; font-weight: 700;
    font-family: inherit; cursor: pointer; white-space: nowrap;
  }
  .dtr-edit:hover { background: #f0fdf4; }

  .dtr-mapbtn {
    display: inline-flex; align-items: center; gap: 7px;
    border: 1.5px solid #bbf7d0; border-radius: 10px;
    background: #f0fdf4; color: #009849;
    padding: 7px 14px; font-size: 13px; font-weight: 700;
    font-family: inherit; cursor: pointer;
  }
  .dtr-mapbtn:hover { background: #dcfce7; }

  .dtr-scroll { overflow-y: auto; }
  .dtr-scroll::-webkit-scrollbar { width: 3px; }
  .dtr-scroll::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 3px; }

  @media (min-width: 1024px) {
    .dtr-2col   { display: grid  !important; }
    .dtr-mob    { display: none  !important; }
    .dtr-desk   { display: flex  !important; }
    .dtr-mobcta { display: none  !important; }
  }
  @media (max-width: 1023px) {
    .dtr-2col   { display: none !important; }
    .dtr-mob    { display: flex  !important; }
    .dtr-desk   { display: none  !important; }
    .dtr-mobcta { display: flex  !important; }
  }
`;

/* ─────────────────────────────────────────────
   ROUTE LINE
───────────────────────────────────────────── */
function DashedLine() {
  return (
    <div className="dtr-line">
      <span className="dtr-dot-g" />
      <span className="dtr-dash" />
      <span className="dtr-dot-r" />
    </div>
  );
}

/* ─────────────────────────────────────────────
   ROUTE OVERVIEW CARD
───────────────────────────────────────────── */
function RouteOverviewCard({ summary }) {
  const eta     = summary.durationText   || "--";
  const dist    = summary.distanceText   || "--";
  const vehicle = summary.vehicleNumber  || summary.bus_number || "--";
  const from    = summary.startLabel     || "--";
  const to      = summary.endLabel       || "--";
  const startT  = summary.startTimeLabel || "--";
  const endT    = summary.endTimeLabel   || "--";

  return (
    <div className="dtr-card">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch" }}>

        {/* Route visual */}
        <div style={{
          flex: "1 1 260px", padding: "20px 24px",
          borderRight: "1px solid #f0f0f0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, background: "#f0fdf4",
              border: "1.5px solid #bbf7d0",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Route size={15} color="#009849" strokeWidth={2} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>Route Overview</span>
          </div>
          <DashedLine />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#111827" }}>{from}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{startT}</div>
            </div>
            <ArrowRight size={18} color="#9ca3af" strokeWidth={2} style={{ marginTop: 4, flexShrink: 0 }} />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#111827" }}>{to}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{endT}</div>
            </div>
          </div>
        </div>

        {/* Metric cells */}
        <div style={{ display: "flex", flex: "2 1 360px", flexWrap: "wrap", alignItems: "stretch" }}>
          <div className="dtr-met">
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Clock3 size={14} color="#6b7280" strokeWidth={2} />
              <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>ETA</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#009849", lineHeight: 1 }}>{eta}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 5 }}>Total estimated time</div>
          </div>

          <div className="dtr-met">
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <MapPin size={14} color="#6b7280" strokeWidth={2} />
              <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Total Distance</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#009849", lineHeight: 1 }}>{dist}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 5 }}>Total travel distance</div>
          </div>

          <div className="dtr-met">
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <BusFront size={14} color="#6b7280" strokeWidth={2} />
              <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Vehicle</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#009849", lineHeight: 1 }}>{vehicle}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 5 }}>Vehicle Number</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ROUTE STOPS CARD
───────────────────────────────────────────── */
function RouteStopsCard({ summary }) {
  const rows = useMemo(() => {
    const raw = summary.stops || summary.rawStops || [];
    return raw.map((s, i) => ({
      id:        s.id || i,
      arrival:   s.arrival_time   || s.arrivalLabel    || "--",
      departure: s.departure_time || s.departureLabel  || "--",
      name:      s.name || (i === 0 ? "Start" : i === raw.length - 1 ? "Stop" : `Stop ${i}`),
      sub:       s.label || s.address || (i === 0 ? summary.startLabel : i === raw.length - 1 ? summary.endLabel : ""),
      isStart:   i === 0,
      isEnd:     i === raw.length - 1,
      isActive:  !!(s.is_current || s.isCurrent),
    }));
  }, [summary]);

  const activeIdx = rows.findIndex(r => r.isActive);

  return (
    <div className="dtr-card" style={{ display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "18px 24px 14px", borderBottom: "1px solid #f0f0f0",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, background: "#f0fdf4",
            border: "1.5px solid #bbf7d0",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <GitMerge size={15} color="#009849" strokeWidth={2} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>Route Stops</span>
        </div>
        <button type="button" className="dtr-mapbtn">
          <Eye size={14} color="#009849" /> View on Map
        </button>
      </div>

      {/* Column labels */}
      <div style={{
        display: "grid", gridTemplateColumns: "72px 20px 1fr auto",
        gap: "0 14px", padding: "8px 24px", borderBottom: "1px solid #f5f5f5",
      }}>
        <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700 }}>Arrival</span>
        <span />
        <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700 }}>Stop Details</span>
        <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700 }}>Departure</span>
      </div>

      {/* Rows */}
      <div className="dtr-scroll" style={{ padding: "4px 24px 14px", maxHeight: 440 }}>
        {rows.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "#6b7280", fontSize: 14 }}>
            No stops information available
          </div>
        ) : rows.map((row, i) => {
          const cur     = row.isActive;
          const isLast  = row.isEnd || i === rows.length - 1;
          const dotSize = row.isStart || cur ? 16 : 12;
          const dotBg   = row.isStart ? "#009849" : isLast ? "#ef4444" : cur ? "white" : "#d1d5db";
          const spine   = (activeIdx >= 0 && i < activeIdx) ? "#009849" : "#e5e7eb";

          return (
            <div
              key={row.id}
              className={`dtr-srow${cur ? " cur" : ""}`}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>{row.arrival}</span>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  width: dotSize, height: dotSize, borderRadius: "50%",
                  background: dotBg,
                  border: cur ? "3px solid #009849" : "none",
                  boxShadow: cur ? "0 0 0 4px rgba(0,152,73,0.15)" : "none",
                  flexShrink: 0, marginTop: dotSize === 12 ? 2 : 0,
                }} />
                {!isLast && (
                  <div style={{ width: 2, flex: 1, minHeight: 22, marginTop: 3, background: spine }} />
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: cur ? "#009849" : "#111827" }}>
                  {row.name}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{row.sub}</div>
              </div>

              <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textAlign: "right" }}>
                {row.departure}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TRIP SUMMARY CARD
───────────────────────────────────────────── */
function TripSummaryCard({ summary, onStartTrip, starting, showCta }) {
  const rows = [
    { icon: Users,    label: "Total Stops",    value: summary.stopsCount || 0 },
    { icon: MapPin,   label: "Distance",       value: summary.distanceText || "--" },
    { icon: Clock3,   label: "Estimated Time", value: summary.durationText || "--" },
    { icon: BusFront, label: "Vehicle Number", value: summary.vehicleNumber || summary.bus_number || "--" },
    { icon: GitMerge, label: "Route",          value: (summary.startLabel && summary.endLabel) ? `${summary.startLabel} → ${summary.endLabel}` : "--" },
  ];

  return (
    <div className="dtr-card" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid #f0f0f0" }}>
        <span style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>Trip Summary</span>
      </div>

      {/* Desktop: ready to start visual */}
      <div className="dtr-desk" style={{
        display: "none", flexDirection: "column", alignItems: "center",
        padding: "24px 24px 16px", borderBottom: "1px solid #f0f0f0",
        gap: 12, textAlign: "center",
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "#f0fdf4", border: "1.5px solid #bbf7d0",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <BusFront size={32} color="#009849" strokeWidth={2} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>Ready to Start?</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6, lineHeight: 1.55 }}>
            Please review all stops and trip details<br />before starting your journey.
          </div>
        </div>
      </div>

      <div>
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="dtr-sumrow">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon size={16} color="#6b7280" strokeWidth={1.8} />
              <span style={{ fontSize: 14, color: "#374151", fontWeight: 600 }}>{label}</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>{value}</span>
          </div>
        ))}
      </div>

      {showCta && (
        <div style={{ padding: "16px 24px 20px" }}>
          <button type="button" onClick={onStartTrip} disabled={starting} className="dtr-cta">
            <Play size={18} style={{ fill: "white" }} />
            {starting ? "Starting Trip..." : "Confirm & Start Trip"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN EXPORT
───────────────────────────────────────────── */
export default function DriverTripReview({
  route,
  source,
  destination,
  onBack,
  onStartTrip,
  starting = false,
}) {
  const summary = buildRouteSummary(route);

  return (
    <>
      <style>{CSS}</style>
      <div className="dtr" style={{ minHeight: "100vh", background: "#F8FAF9", paddingBottom: 80 }}>
        <div style={{
          maxWidth: 1360, width: "100%", margin: "0 auto",
          padding: "28px 20px 32px",
          display: "flex", flexDirection: "column", gap: 20,
        }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <button type="button" onClick={onBack} style={{
                width: 40, height: 40, borderRadius: "50%",
                border: "1.5px solid #e5e7eb", background: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0, marginTop: 4,
                boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
              }}>
                <ArrowLeft size={18} color="#374151" strokeWidth={2.2} />
              </button>
              <div>
                <h1 style={{ fontSize: "clamp(20px,3.5vw,28px)", fontWeight: 900, color: "#111827", margin: 0 }}>
                  Trip Review
                </h1>
                <p style={{ fontSize: 14, color: "#6b7280", marginTop: 6 }}>
                  Review your route, stops and trip details
                </p>
              </div>
            </div>
            <button type="button" onClick={onBack} className="dtr-edit" style={{ marginTop: 4 }}>
              <Pencil size={14} color="#009849" /> Edit Route
            </button>
          </div>

          {/* Route overview */}
          <RouteOverviewCard summary={summary} />

          {/* Desktop 2-col */}
          <div className="dtr-2col" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>
            <RouteStopsCard summary={summary} />
            <TripSummaryCard summary={summary} onStartTrip={onStartTrip} starting={starting} showCta={true} />
          </div>

          {/* Mobile stacked */}
          <div className="dtr-mob" style={{ display: "none", flexDirection: "column", gap: 16 }}>
            <RouteStopsCard summary={summary} />
            <TripSummaryCard summary={summary} onStartTrip={onStartTrip} starting={starting} showCta={false} />
          </div>
        </div>

        {/* Mobile sticky CTA */}
        <div className="dtr-mobcta" style={{
          display: "none", position: "fixed", bottom: 0, left: 0, right: 0,
          padding: "12px 20px 24px", background: "white",
          borderTop: "1px solid #f0f0f0", zIndex: 99,
        }}>
          <button type="button" onClick={onStartTrip} disabled={starting} className="dtr-cta">
            <Play size={18} style={{ fill: "white" }} />
            {starting ? "Starting Trip..." : "Confirm & Start Trip"}
          </button>
        </div>
      </div>
    </>
  );
}
