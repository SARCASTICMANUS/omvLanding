import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BusFront,
  ChevronRight,
  Clock3,
  Eye,
  GitMerge,
  MapPin,
  Route,
  SearchX,
  ShieldCheck,
  TrafficCone,
  Users,
} from "lucide-react";
import {
  buildRouteSummary,
  estimateStopTimeline,
} from "./driverFlowUtils";

/* ─────────────────────────────────────────────
   CSS
───────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
  .drl-root { font-family: 'Plus Jakarta Sans', sans-serif; }
  .drl-root * { box-sizing: border-box; }

  /* Route card hover */
  .drl-card {
    background: white;
    border: 1.5px solid #e5e7eb;
    border-radius: 18px;
    transition: border-color 0.18s, box-shadow 0.18s;
    overflow: hidden;
  }
  .drl-card:hover {
    border-color: #009849;
    box-shadow: 0 4px 24px rgba(0,152,73,0.10);
  }
  .drl-card.matched {
    border-color: #bbf7d0;
    background: #f0fdf4;
  }

  /* Route line track */
  .drl-route-line {
    display: flex;
    align-items: center;
    gap: 0;
    margin: 10px 0 8px;
  }
  .drl-route-dot-green {
    width: 13px; height: 13px; border-radius: 50%;
    background: #009849; flex-shrink: 0;
    box-shadow: 0 0 0 3px rgba(0,152,73,0.15);
  }
  .drl-route-dot-red {
    width: 13px; height: 13px; border-radius: 50%;
    background: #ef4444; flex-shrink: 0;
    box-shadow: 0 0 0 3px rgba(239,68,68,0.15);
  }
  .drl-route-dashes {
    flex: 1;
    height: 2.5px;
    background-image: repeating-linear-gradient(
      to right,
      #009849 0, #009849 8px,
      transparent 8px, transparent 14px
    );
  }

  /* Metric cell */
  .drl-metric {
    display: flex; align-items: center; gap: 8px;
    padding: 0 16px;
    flex: 1;
  }
  .drl-metric + .drl-metric {
    border-left: 1px solid #f0f0f0;
  }

  /* View Stops btn */
  .drl-view-btn {
    display: inline-flex; align-items: center; gap: 7px;
    border: 1.5px solid #e5e7eb; border-radius: 12px;
    background: white; padding: 10px 16px;
    font-size: 13px; font-weight: 700; color: #374151;
    cursor: pointer; font-family: inherit;
    transition: border-color 0.15s, background 0.15s;
    white-space: nowrap;
  }
  .drl-view-btn:hover { border-color: #009849; background: #f0fdf4; color: #009849; }

  /* Select Route btn */
  .drl-select-btn {
    display: inline-flex; align-items: center; justify-content: center;
    border: none; border-radius: 12px;
    background: #009849; color: white;
    padding: 10px 24px; font-size: 13px; font-weight: 800;
    cursor: pointer; font-family: inherit;
    box-shadow: 0 4px 16px rgba(0,152,73,0.25);
    transition: background 0.15s, transform 0.1s;
    white-space: nowrap;
  }
  .drl-select-btn:hover { background: #007a3d; }

  /* Stop row in expanded */
  .drl-stop-row {
    display: grid;
    grid-template-columns: 32px 1fr 90px 80px;
    gap: 8px;
    align-items: center;
    padding: 10px 14px;
    border-radius: 12px;
    background: #f9fafb;
    border: 1px solid #f0f0f0;
    margin-bottom: 6px;
  }

  /* Count badge */
  .drl-count-badge {
    display: inline-flex; align-items: center; justify-content: center;
    background: #f0fdf4; border: 1px solid #bbf7d0;
    border-radius: 20px; padding: 5px 14px;
    font-size: 12px; font-weight: 800; color: #15803d;
  }

  /* Scrollable list area */
  .drl-scroll {
    overflow-y: auto;
    flex: 1;
    padding: 0 0 24px;
  }
  .drl-scroll::-webkit-scrollbar { width: 4px; }
  .drl-scroll::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }

  /* Responsive */
  @media (min-width: 1024px) {
    .drl-card-body { display: grid !important; grid-template-columns: 1fr auto; gap: 0; }
    .drl-card-actions { display: flex !important; flex-direction: column; align-items: flex-end; justify-content: center; gap: 10px; padding: 20px 20px 20px 0; border-left: 1px solid #f0f0f0; min-width: 220px; }
    .drl-mobile-actions { display: none !important; }
    .drl-metric-strip { display: flex !important; }
  }
  @media (max-width: 1023px) {
    .drl-card-body { display: flex !important; flex-direction: column; }
    .drl-card-actions { display: none !important; }
    .drl-mobile-actions { display: flex !important; }
    .drl-metric-strip { display: flex !important; }
  }
`;

/* ─────────────────────────────────────────────
   ROUTE LINE VISUAL
───────────────────────────────────────────── */
function RouteLine() {
  return (
    <div className="drl-route-line">
      <span className="drl-route-dot-green" />
      <span className="drl-route-dashes" />
      <span className="drl-route-dot-red" />
    </div>
  );
}

/* ─────────────────────────────────────────────
   METRIC CELL
───────────────────────────────────────────── */
function MetricCell({ icon: Icon, value, label }) {
  return (
    <div className="drl-metric">
      <Icon size={16} color="#009849" strokeWidth={2} style={{ flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>{value}</div>
        <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   EXPANDED STOPS PANEL
───────────────────────────────────────────── */
function StopsPanel({ route }) {
  const timeline = useMemo(() => estimateStopTimeline(route), [route]);

  return (
    <div style={{
      borderTop: "1px solid #f0f0f0",
      padding: "16px 20px",
      background: "#f9fafb",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12,
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.6 }}>
          Stops & Arrival Time
        </span>
        <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>
          Start {route.startTimeLabel} · End {route.endTimeLabel}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {timeline.length === 0 ? (
          <div style={{
            borderRadius: 12,
            border: "1px dashed #d1d5db",
            background: "white",
            padding: "16px 14px",
            fontSize: 13,
            color: "#6b7280",
            textAlign: "center",
          }}>
            Stop details are not available for this saved route yet.
          </div>
        ) : (
          timeline.map((stop, index) => (
            <div key={stop.id || `${stop.name}-${index}`} className="drl-stop-row">
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: index === 0 ? "#009849" : index === timeline.length - 1 ? "#ef4444" : "#f3f4f6",
                border: index === 0 || index === timeline.length - 1 ? "none" : "1.5px solid #e5e7eb",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 900,
                color: index === 0 || index === timeline.length - 1 ? "white" : "#6b7280",
              }}>
                {stop.sequence}
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {stop.name || `Stop ${stop.sequence}`}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
                  {stop.isBoardingPoint ? "Boarding" : "Transit"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Arrival</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginTop: 2 }}>{stop.arrivalLabel}</div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Status</div>
                <div style={{
                  fontSize: 12, fontWeight: 700, marginTop: 2,
                  color: index === 0 ? "#009849" : index === timeline.length - 1 ? "#ef4444" : "#6b7280",
                }}>
                  {index === 0 ? "Start" : index === timeline.length - 1 ? "End" : "Upcoming"}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ROUTE CARD
───────────────────────────────────────────── */
function RouteCard({ route, index, expanded, onToggleExpand, onSelect }) {
  const distText = route.distanceText || "--";
  const durText = route.durationText || "--";
  const via = route.viaLabel || route.via || "";
  const fromLabel = route.startLabel || "Start";
  const toLabel = route.endLabel || "End";
  const eta = route.durationText || "--";

  return (
    <div className={`drl-card${route.matchesSearch ? " matched" : ""}`}>

      {/* ── CARD BODY (grid on desktop, stack on mobile) ── */}
      <div className="drl-card-body" style={{ display: "flex" }}>

        {/* Main content */}
        <div style={{ flex: 1, padding: "18px 20px 0" }}>

          {/* Row 1: Bus icon + Number badge + Route name + ETA */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Bus icon */}
              <div style={{
                width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                background: "#f0fdf4", border: "1.5px solid #bbf7d0",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <BusFront size={24} color="#009849" strokeWidth={2} />
              </div>

              {/* Number badge + name */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: "#009849",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 900, color: "white", flexShrink: 0,
                }}>
                  {index + 1}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>
                    {route.title}
                  </div>
                  {route.matchesSearch && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, color: "#15803d",
                      background: "#dcfce7", borderRadius: 20, padding: "2px 8px", marginTop: 2,
                      display: "inline-block",
                    }}>Matching</span>
                  )}
                </div>
              </div>
            </div>

            {/* ETA pill */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 13, color: "#9ca3af", fontWeight: 600 }}>ETA</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: "#009849" }}>{eta}</span>
            </div>
          </div>

          {/* Route dashed line */}
          <RouteLine />

          {/* From → To */}
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between", marginBottom: 4,
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>{fromLabel}</div>
              {via && via !== "—" && (
                <div style={{ fontSize: 12, color: "#009849", fontWeight: 700, marginTop: 2 }}>via {via}</div>
              )}
              {(!via || via === "—") && (
                <div style={{ fontSize: 12, color: "#d1d5db", marginTop: 2 }}>—</div>
              )}
            </div>
            <ArrowRight size={18} color="#374151" strokeWidth={2} />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>{toLabel}</div>
            </div>
          </div>
        </div>

        {/* ── DESKTOP ACTION COLUMN ── */}
        <div className="drl-card-actions" style={{ display: "none" }}>
          <button
            type="button"
            className="drl-view-btn"
            onClick={() => onToggleExpand?.(route.id)}
          >
            <Eye size={15} color="#009849" />
            View Stops
            <ChevronRight size={14} color="#9ca3af" />
          </button>
          <button
            type="button"
            className="drl-select-btn"
            onClick={() => onSelect?.(route)}
          >
            Select Route
          </button>
        </div>
      </div>

      {/* ── METRIC STRIP ── */}
      <div className="drl-metric-strip" style={{
        display: "flex", alignItems: "stretch",
        borderTop: "1px solid #f0f0f0",
        padding: "12px 0",
        marginTop: 12,
      }}>
        <MetricCell icon={MapPin}   value={distText} label="Distance" />
        <MetricCell icon={Clock3}   value={durText}  label="Duration" />
        <MetricCell icon={GitMerge} value={via}      label="Via" />

        {/* View Stops — mobile only */}
        <div className="drl-mobile-actions" style={{
          display: "none", alignItems: "center",
          paddingLeft: 12, paddingRight: 16, flexShrink: 0,
          borderLeft: "1px solid #f0f0f0",
        }}>
          <button
            type="button"
            className="drl-view-btn"
            onClick={() => onToggleExpand?.(route.id)}
            style={{ padding: "8px 12px", fontSize: 12 }}
          >
            <Eye size={14} color="#009849" />
            View Stops
            <ChevronRight size={12} color="#9ca3af" />
          </button>
        </div>
      </div>

      {/* ── MOBILE SELECT BUTTON ── */}
      <div className="drl-mobile-actions" style={{
        display: "none",
        padding: "0 20px 16px",
      }}>
        <button
          type="button"
          className="drl-select-btn"
          onClick={() => onSelect?.(route)}
          style={{ width: "100%", height: 48, fontSize: 15, borderRadius: 14 }}
        >
          Select Route
        </button>
      </div>

      {/* ── EXPANDED STOPS ── */}
      {expanded && <StopsPanel route={route} />}
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN EXPORT — DriverRouteList
   All original props 100% preserved
───────────────────────────────────────────── */
export default function DriverRouteList({
  source,
  destination,
  routes = [],
  allRoutesCount = 0,
  loading = false,
  onBack,
  onSelectRoute,
}) {
  /* ── All original logic untouched ── */
  const normalizedRoutes = useMemo(() => routes.map(buildRouteSummary), [routes]);
  const [expandedRouteId, setExpandedRouteId] = useState(null);

  useEffect(() => {
    if (!normalizedRoutes.some((r) => String(r.id) === String(expandedRouteId))) {
      setExpandedRouteId(null);
    }
  }, [expandedRouteId, normalizedRoutes]);

  /* Derived */
  const fromLabel = source?.name      || source?.display_name?.split(",")?.[0]      || "Start";
  const toLabel   = destination?.name || destination?.display_name?.split(",")?.[0] || "Destination";
  const activeCount = normalizedRoutes.filter((r) => r.status?.active).length;

  return (
    <>
      <style>{CSS}</style>
      <div
        className="drl-root"
        style={{
          minHeight: "100vh",
          background: "#F8FAF9",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{
          maxWidth: 1360, width: "100%", margin: "0 auto",
          padding: "28px 20px 32px",
          display: "flex", flexDirection: "column", gap: 20, flex: 1,
        }}>

          {/* ── PAGE HEADER ── */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>

            {/* Left: back + title */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <button
                type="button"
                onClick={onBack}
                style={{
                  width: 44, height: 44, borderRadius: 14,
                  border: "1.5px solid #e5e7eb", background: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", flexShrink: 0, marginTop: 4,
                  boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                }}
              >
                <ArrowLeft size={20} color="#374151" strokeWidth={2.2} />
              </button>

              <div>
                <h1 style={{ fontSize: "clamp(22px,4vw,32px)", fontWeight: 900, color: "#111827", margin: 0, lineHeight: 1.1 }}>
                  Choose Your Route
                </h1>
                <p style={{ fontSize: 14, color: "#6b7280", marginTop: 6 }}>
                  Select the route you want to drive
                </p>
              </div>
            </div>

            {/* Right: route icon (mobile shows this, desktop hides nothing) */}
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "#f0fdf4", border: "1.5px solid #bbf7d0",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Route size={20} color="#009849" strokeWidth={2} />
            </div>
          </div>

          {/* ── AVAILABLE ROUTES LABEL + COUNT ── */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "#f0fdf4",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Route size={18} color="#009849" strokeWidth={2} />
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>Available Routes</span>
            </div>
            <div className="drl-count-badge">
              {normalizedRoutes.length} Routes Available
            </div>
          </div>

          {/* ── ROUTE LIST ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
            {loading ? (
              <div style={{
                background: "white", borderRadius: 18, border: "1px solid #f0f0f0",
                padding: 48, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, fontWeight: 700, color: "#9ca3af",
              }}>
                Loading routes...
              </div>
            ) : normalizedRoutes.length === 0 ? (
              <div style={{
                background: "white", borderRadius: 18, border: "1.5px dashed #e5e7eb",
                padding: 56, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", textAlign: "center",
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%", background: "#f3f4f6",
                  display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
                }}>
                  <SearchX size={28} color="#9ca3af" />
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: "#111827", margin: "0 0 8px" }}>No Routes Found</h2>
                <p style={{ fontSize: 14, color: "#6b7280", maxWidth: 420, lineHeight: 1.6 }}>
                  No saved operational route currently matches the searched start and destination points.
                </p>
              </div>
            ) : (
              normalizedRoutes.map((route, i) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  index={i}
                  expanded={String(expandedRouteId) === String(route.id)}
                  onToggleExpand={(id) =>
                    setExpandedRouteId((cur) =>
                      String(cur) === String(id) ? null : id
                    )
                  }
                  onSelect={onSelectRoute}
                />
              ))
            )}
          </div>

          {/* ── DRIVE SAFE FOOTER CARD ── */}
          {!loading && normalizedRoutes.length > 0 && (
            <div style={{
              background: "white", borderRadius: 18, border: "1px solid #f0f0f0",
              padding: "16px 20px",
              display: "flex", alignItems: "center", gap: 14,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                border: "1.5px solid #bbf7d0", background: "#f0fdf4",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <ShieldCheck size={20} color="#009849" strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>Drive safe!</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                  Follow traffic rules and ensure passenger safety.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
