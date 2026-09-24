import { useMemo, useState, useEffect } from "react";
import { CheckCircle2, Layers, Loader2 } from "lucide-react";
import {
  sortStops,
  cumulativeDistances,
  cumulativeMinutes,
  buildDefaultZoneConfig,
  validateZoneConfig,
  stopIndexById,
} from "../utils/zoneLogic";
import { fetchRoutes, fetchRouteDetail } from "../data/zoneRoutes";
import ZoneHeader from "../components/zones/ZoneHeader";
import RouteSelector from "../components/zones/RouteSelector";
import RouteSummary from "../components/zones/RouteSummary";
import RouteTimeline from "../components/zones/RouteTimeline";
import ZoneCountSelector from "../components/zones/ZoneCountSelector";
import ZoneConfiguration from "../components/zones/ZoneConfiguration";
import FareExamples from "../components/zones/FareExamples";

const DEFAULT_ZONE_COUNT = 3;
const STORAGE_KEY = "vayy_admin_zone_config_v1";

export default function Zones() {
  const [routes, setRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [route, setRoute] = useState(null);
  const [stops, setStops] = useState([]);
  const [loadingStops, setLoadingStops] = useState(false);
  const [zoneCount, setZoneCount] = useState(DEFAULT_ZONE_COUNT);
  const [zones, setZones] = useState([]);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);

  // Load real route data (falls back to mock adapter when API is down).
  useEffect(() => {
    let active = true;
    fetchRoutes().then((data) => {
      if (!active) return;
      setRoutes(data);
      setLoadingRoutes(false);
    });
    return () => { active = false; };
  }, []);

  const orderedStops = useMemo(() => sortStops(stops), [stops]);
  const distances = useMemo(
    () => cumulativeDistances(orderedStops, route?.total_distance_meters),
    [orderedStops, route]
  );
  const minutes = useMemo(() => cumulativeMinutes(orderedStops, distances), [orderedStops, distances]);

  const validation = useMemo(() => validateZoneConfig(orderedStops, zones), [orderedStops, zones]);

  const dirty = useMemo(() => {
    const key = [route?.id, zoneCount, JSON.stringify(zones)].join("|");
    return key !== saved;
  }, [route, zoneCount, zones, saved]);

  const handleRouteChange = async (selected) => {
    setRoute(selected);
    setStops([]);
    setZones([]);
    if (!selected) return;
    setLoadingStops(true);
    const detail = await fetchRouteDetail(selected.id);
    const nextStops = detail?.stops || [];
    setStops(nextStops);
    setZoneCount(DEFAULT_ZONE_COUNT);
    setZones(buildDefaultZoneConfig(nextStops, DEFAULT_ZONE_COUNT));
    setSaved(null);
    setLoadingStops(false);
  };

  const handleZoneCountChange = (count) => {
    setZoneCount(count);
    setZones(buildDefaultZoneConfig(orderedStops, count));
  };

  // Changing a zone's end stop pushes the next zone's start automatically and
  // heals any following zone that would otherwise end before its new start, so
  // sequential coverage (no gaps / overlaps / unassigned stops) is preserved.
  const handleZoneChange = (zoneIndex, patch) => {
    setZones((prev) => {
      const next = prev.map((z, i) => (i === zoneIndex ? { ...z, ...patch } : z));
      if (patch.endStopId !== undefined && zoneIndex + 1 < next.length) {
        let prevEndIdx = stopIndexById(orderedStops, patch.endStopId);
        for (let i = zoneIndex + 1; i < next.length; i++) {
          const startIdx = prevEndIdx + 1;
          const curEndIdx = stopIndexById(orderedStops, next[i].endStopId);
          const healedEndIdx = Math.max(startIdx, curEndIdx);
          next[i] = {
            ...next[i],
            startStopId: orderedStops[startIdx]?.id,
            endStopId: orderedStops[healedEndIdx]?.id,
          };
          prevEndIdx = healedEndIdx;
        }
        next[next.length - 1].endStopId = orderedStops[orderedStops.length - 1].id;
      }
      return next;
    });
  };

  const handleReset = () => {
    setZoneCount(DEFAULT_ZONE_COUNT);
    setZones(buildDefaultZoneConfig(orderedStops, DEFAULT_ZONE_COUNT));
    setSaved(null);
  };

  const handleSave = () => {
    if (!validation.valid || !route || !orderedStops.length) return;
    setSaving(true);

    // TEMPORARY frontend persistence — stored locally only. This will later be
    // replaced by a real Zone API call; no backend change is part of this task.
    const config = {
      routeId: route.id,
      routeName: route.name,
      totalZonesCount: zoneCount,
      zones: zones.map((z) => ({
        id: z.id,
        name: z.name.trim(),
        startStopId: z.startStopId,
        endStopId: z.endStopId,
        flatFareINR: Number(z.flatFareINR),
      })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));

    setSaved([route.id, zoneCount, JSON.stringify(zones)].join("|"));
    window.setTimeout(() => setSaving(false), 400);
  };

  return (
    <div className="pt-3 pb-4 px-6 md:pt-5 md:pb-8 md:px-8 h-full overflow-y-auto">
      <ZoneHeader
        dirty={dirty}
        valid={validation.valid}
        saving={saving}
        onSave={handleSave}
        onReset={handleReset}
      />

      {saving && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 pl-4 pr-5 py-3 rounded-xl text-white shadow-lg" style={{ background: "linear-gradient(135deg, var(--accent-blue), var(--accent-blue-light))" }}>
          <CheckCircle2 size={18} />
          <span className="font-medium text-sm">Zone configuration saved</span>
        </div>
      )}

      <div className="space-y-6 max-w-[1200px]">
        <RouteSelector routes={routes} value={route?.id} onChange={handleRouteChange} disabled={loadingRoutes} />

        {loadingRoutes && (
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin text-slate-500" />
          </div>
        )}

        {!loadingRoutes && !route && (
          <div className="glass-card bg-white/80 p-12 text-center">
            <div className="w-14 h-14 mx-auto bg-indigo-50 text-slate-500 rounded-xl flex items-center justify-center">
              <Layers size={26} />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-800">Select a route to begin</h3>
            <p className="mt-1 text-sm text-slate-500 font-medium max-w-md mx-auto">
              Choose a route above to divide it into stop-based fare zones. Boundaries always
              align to physical stops — never free-form kilometer ranges.
            </p>
          </div>
        )}

        {route && (
          <>
            {loadingStops ? (
              <div className="flex justify-center py-16">
                <Loader2 size={24} className="animate-spin text-slate-500" />
              </div>
            ) : orderedStops.length >= 2 ? (
              <>
                <RouteSummary route={route} stops={orderedStops} distances={distances} minutes={minutes} />

                <ZoneCountSelector
                  value={zoneCount}
                  onChange={handleZoneCountChange}
                  maxStops={orderedStops.length}
                />

                <RouteTimeline stops={orderedStops} zones={zones} distances={distances} minutes={minutes} />

                <ZoneConfiguration
                  stops={orderedStops}
                  zones={zones}
                  distances={distances}
                  onZoneChange={handleZoneChange}
                />

                <FareExamples stops={orderedStops} zones={zones} />

                {!validation.valid && (
                  <div className="bg-red-50/70 border border-red-200 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-red-500">Fix the following before saving:</h3>
                    <ul className="mt-2 space-y-1">
                      {validation.errors.map((err, i) => (
                        <li key={i} className="text-xs font-medium text-red-500/80 flex items-start gap-2">
                          <span className="mt-1 w-1 h-1 rounded-full bg-red-500 shrink-0" />
                          {err}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center">
                <h3 className="text-lg font-semibold text-slate-800">No stops on this route</h3>
                <p className="mt-1 text-sm text-slate-500 font-medium">
                  Zones are defined by stops. Add stops to this route first.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
