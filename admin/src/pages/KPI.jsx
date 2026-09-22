import { useState, useEffect, useCallback } from "react";
import {
  BarChart3, Users, MapPin, Route, Bus, Activity, Globe, Smartphone, Monitor,
  TrendingUp, ArrowUpRight, MousePointerClick, Repeat, Car, UserPlus,
  CalendarCheck, MapPinned, RefreshCw, Target, BarChart2,
  Flame, CircleDot, Palette, Layers, Clock,
} from "lucide-react";
import api from "../api/client";
import { CHART_COLORS_6 } from "../colors";
import Loader from "../components/Loader";
import { Zigzag } from "../components/MemphisShapes";
import MapLibreMap from "../components/geo/LeafletMap";
import HeatmapLayer from "../components/geo/HeatmapLayer";
import CityScatter from "../components/geo/CityScatter";
import ChoroplethMap from "../components/geo/ChoroplethMap";
import GeoStatsCards from "../components/geo/GeoStatsCards";
import GeoDrilldownTable from "../components/geo/GeoDrilldownTable";
import GeoTrendsChart from "../components/geo/GeoTrendsChart";

function StatCard({ icon, label, value, color, sub }) {
  return (
    <div className="memphis-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`memphis-icon-tile ${color}`}>{icon}</div>
        <div>
          <p className="memphis-label">{label}</p>
          <p className="text-2xl font-black text-memphis-ink" style={{ fontFamily: "Archivo Black, sans-serif" }}>{value?.toLocaleString() ?? "—"}</p>
        </div>
      </div>
      {sub && <p className="text-xs text-memphis-purple font-medium">{sub}</p>}
    </div>
  );
}

function BarChart({ data, labelKey, valueKey, color = "bg-memphis-pink", maxItems = 7 }) {
  if (!data || data.length === 0) {
    return <div className="text-center py-8 text-memphis-purple/50 text-sm">No data</div>;
  }
  const items = data.slice(0, maxItems);
  const maxVal = Math.max(...items.map((d) => d[valueKey] || 0), 1);

  return (
    <div className="space-y-2">
      {items.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs font-semibold text-memphis-ink w-28 truncate text-right">{d[labelKey]}</span>
          <div className="flex-1 bg-memphis-ink/10 rounded-full h-5 overflow-hidden border border-memphis-ink/20">
            <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${((d[valueKey] || 0) / maxVal) * 100}%` }} />
          </div>
          <span className="text-xs font-bold text-memphis-ink w-12 text-right">{(d[valueKey] || 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data, labelKey, valueKey, colors, centerLabel, centerValue }) {
  if (!data || data.length === 0) {
    return <div className="text-center py-8 text-memphis-purple/50 text-sm">No data</div>;
  }
  const total = data.reduce((s, d) => s + (d[valueKey] || 0), 0);
  let cum = 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative">
        <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
          {data.map((d, i) => {
            const pct = total > 0 ? ((d[valueKey] || 0) / total) * 100 : 0;
            const offset = cum;
            cum += pct;
            return (
              <circle key={i} cx="18" cy="18" r="15.915" fill="none" stroke={colors[i % colors.length]}
                strokeWidth="3.5" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={`${-offset}`} />
            );
          })}
        </svg>
        {centerLabel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-black text-memphis-ink">{centerValue ?? "—"}</span>
            <span className="memphis-label text-[9px]">{centerLabel}</span>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border border-memphis-ink/30" style={{ background: colors[i % colors.length] }} />
            <span className="text-xs font-semibold text-memphis-ink">{d[labelKey]}</span>
            <span className="text-xs font-bold text-memphis-ink ml-auto">{(d[valueKey] || 0).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressBar({ segments, height = "h-3" }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <div className={`bg-memphis-ink/10 rounded-full ${height}`} />;

  return (
    <div className={`flex rounded-full overflow-hidden ${height} border border-memphis-ink/20`}>
      {segments.map((seg, i) => (
        <div key={i} className="transition-all duration-500" style={{ width: `${(seg.value / total) * 100}%`, backgroundColor: seg.color }} title={`${seg.label}: ${seg.value}`} />
      ))}
    </div>
  );
}

function DataTable({ columns, rows, emptyMessage = "No data" }) {
  if (!rows || rows.length === 0) {
    return <div className="text-center py-8 text-memphis-purple/50 text-sm">{emptyMessage}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b-2 border-memphis-ink/10">
            {columns.map((col, i) => (
              <th key={i} className={`py-2 px-3 memphis-label ${col.align === "right" ? "text-right" : "text-left"}`}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="memphis-table-row">
              {columns.map((col, j) => (
                <td key={j} className={`py-2 px-3 font-semibold text-memphis-ink ${col.align === "right" ? "text-right" : ""}`}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Geo Analytics Section ──────────────────────────────
function GeoSection() {
  const [source, setSource] = useState("pageview");
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [geoView, setGeoView] = useState("map");
  const [mapType, setMapType] = useState("heatmap");
  const [mapInstance, setMapInstance] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get(`/kpi/geo-stats/?source=${source}&days=${days}`)
      .then((r) => setData(r.data?.data || r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [source, days]);

  const handleMapLoad = useCallback((map) => setMapInstance(map), []);

  if (loading) return <Loader />;

  const countryData = data?.country_breakdown || [];
  const cityData = data?.city_breakdown || [];
  const regionData = data?.region_breakdown || [];
  const tzData = data?.timezone_distribution || [];
  const mapPoints = data?.map_points || [];
  const dailyByCountry = data?.daily_by_country || [];

  return (
    <>
      {/* Divider */}
      <div className="memphis-divider my-4" />
      <div className="flex items-center gap-3 mb-6">
        <div className="memphis-icon-tile memphis-icon-coral"><Globe size={20} /></div>
        <div>
          <h2 className="text-xl font-black text-memphis-ink" style={{ fontFamily: "Archivo Black, sans-serif" }}>Geo Analytics</h2>
          <p className="memphis-label">Geographic visitor distribution</p>
        </div>
      </div>

      {/* Source + Days + View tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <div className="flex bg-memphis-ink/5 rounded-lg p-0.5 border border-memphis-ink/10">
            {["geoevent", "pageview"].map((s) => (
              <button key={s} onClick={() => setSource(s)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${source === s ? "bg-memphis-pink text-memphis-ink shadow-sm" : "text-memphis-purple hover:text-memphis-ink"}`}>
                {s === "geoevent" ? "GeoEvent" : "PageView"}
              </button>
            ))}
          </div>
          <div className="flex bg-memphis-ink/5 rounded-lg p-0.5 border border-memphis-ink/10">
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${days === d ? "bg-memphis-teal text-memphis-ink shadow-sm" : "text-memphis-purple hover:text-memphis-ink"}`}>
                {d}d
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-1 bg-memphis-ink/5 rounded-lg p-0.5 border border-memphis-ink/10">
          {[
            { id: "map", label: "Map", icon: <MapPin size={14} /> },
            { id: "trends", label: "Trends", icon: <BarChart3 size={14} /> },
            { id: "drilldown", label: "Drill-down", icon: <Layers size={14} /> },
          ].map((t) => (
            <button key={t.id} onClick={() => setGeoView(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${geoView === t.id ? "bg-memphis-ink text-white shadow-sm" : "text-memphis-purple hover:text-memphis-ink"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <GeoStatsCards data={data} />

      {/* Map View */}
      {geoView === "map" && (
        <div className="space-y-4 mt-6">
          <div className="flex gap-1 bg-memphis-ink/5 rounded-lg p-0.5 border border-memphis-ink/10 w-fit">
            {[
              { id: "heatmap", label: "Heatmap", icon: <Flame size={14} /> },
              { id: "scatter", label: "Scatter", icon: <CircleDot size={14} /> },
              { id: "choropleth", label: "Choropleth", icon: <Palette size={14} /> },
            ].map((t) => (
              <button key={t.id} onClick={() => setMapType(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${mapType === t.id ? "bg-memphis-coral text-white shadow-sm" : "text-memphis-purple hover:text-memphis-ink"}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <MapLibreMap height="420px" onMapLoad={handleMapLoad}>
            {mapInstance && mapType === "heatmap" && <HeatmapLayer map={mapInstance} points={mapPoints} />}
            {mapInstance && mapType === "scatter" && <CityScatter map={mapInstance} cities={cityData} />}
            {mapInstance && mapType === "choropleth" && <ChoroplethMap map={mapInstance} countryData={countryData} />}
          </MapLibreMap>
          {mapPoints.length === 0 && (
            <p className="text-center text-sm text-memphis-purple/50 py-2">No geo data yet. Data appears as requests come in.</p>
          )}
        </div>
      )}

      {/* Trends View */}
      {geoView === "trends" && (
        <div className="space-y-6 mt-6">
          <GeoTrendsChart dailyByCountry={dailyByCountry} height={260} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="memphis-card p-4">
              <h3 className="memphis-label mb-3">Timezone Distribution</h3>
              <BarChart data={tzData} labelKey="timezone" valueKey="count" color="bg-memphis-teal" maxItems={10} />
            </div>
            <div className="memphis-card p-4">
              <h3 className="memphis-label mb-3">Top Timezones</h3>
              <DonutChart data={tzData.slice(0, 6)} labelKey="timezone" valueKey="count" colors={CHART_COLORS_6} centerLabel="zones" centerValue={tzData.length} />
            </div>
          </div>
        </div>
      )}

      {/* Drill-down View */}
      {geoView === "drilldown" && (
        <div className="space-y-6 mt-6">
          <div className="memphis-card p-4">
            <h3 className="memphis-label mb-3">Geographic Drill-down</h3>
            <p className="text-xs text-memphis-purple/60 mb-4">Click a country to see regions, then click a region to see cities.</p>
            <GeoDrilldownTable countryBreakdown={countryData} regionBreakdown={regionData} cityBreakdown={cityData} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="memphis-card p-4">
              <h3 className="memphis-label mb-3">Top Countries</h3>
              <DataTable columns={[
                { label: "Country", key: "country", render: (v, r) => (
                  <span className="font-bold">{v} {r.country_code && <span className="text-memphis-purple">({r.country_code})</span>}</span>
                )},
                { label: "Events", key: "count", align: "right", render: (v) => v?.toLocaleString() },
                { label: "%", key: "percentage", align: "right", render: (v) => `${v}%` },
              ]} rows={countryData.slice(0, 10)} />
            </div>
            <div className="memphis-card p-4">
              <h3 className="memphis-label mb-3">Top Cities</h3>
              <BarChart data={cityData} labelKey="city" valueKey="count" color="bg-memphis-coral" maxItems={10} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Web Metrics ────────────────────────────────────────
function WebMetrics({ data, loading }) {
  if (loading) return <Loader />;

  const s = data?.summary || {};

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard icon={<ArrowUpRight size={20} />} label="Total Visits" value={s.total_visits} color="bg-memphis-teal" sub={`Last ${data?.period_days || 30} days`} />
        <StatCard icon={<Users size={20} />} label="Unique Visitors" value={s.unique_visitors} color="bg-memphis-mint" sub={`${s.avg_views_per_visitor || 0} avg views/visitor`} />
        <StatCard icon={<MousePointerClick size={20} />} label="Bounce Rate" value={`${s.bounce_rate || 0}%`} color="bg-memphis-yellow" sub="Single-page sessions" />
        <StatCard icon={<Repeat size={20} />} label="Avg Views / Visitor" value={s.avg_views_per_visitor} color="bg-memphis-purple" sub="Pages per session" />
        <StatCard icon={<RefreshCw size={20} />} label="Returning Visitors" value={`${s.returning_visitor_ratio || 0}%`} color="bg-memphis-pink" sub="Return visitor ratio" />
        <StatCard icon={<Target size={20} />} label="Engagement Rate" value={`${s.engagement_rate || 0}%`} color="bg-memphis-coral" sub="100% − Bounce Rate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="memphis-card p-6">
          <h3 className="text-sm font-bold text-memphis-ink mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-memphis-pink" /> Daily Visits</h3>
          <BarChart data={data?.daily?.map((d) => ({ label: d.day, views: d.views }))} labelKey="label" valueKey="views" color="bg-memphis-pink" />
        </div>
        <div className="memphis-card p-6">
          <h3 className="text-sm font-bold text-memphis-ink mb-4 flex items-center gap-2"><Globe size={16} className="text-memphis-teal" /> Top Pages</h3>
          <BarChart data={data?.top_pages?.map((p) => ({ label: p.page || "/", views: p.views }))} labelKey="label" valueKey="views" color="bg-memphis-teal" />
        </div>
        <div className="memphis-card p-6">
          <h3 className="text-sm font-bold text-memphis-ink mb-4 flex items-center gap-2"><Monitor size={16} className="text-memphis-purple" /> Device Breakdown</h3>
          <DonutChart data={data?.device_stats?.map((d) => ({ label: d.device_type || "Unknown", views: d.views }))} labelKey="label" valueKey="views" colors={CHART_COLORS_6} />
        </div>
        <div className="memphis-card p-6">
          <h3 className="text-sm font-bold text-memphis-ink mb-4 flex items-center gap-2"><ArrowUpRight size={16} className="text-memphis-yellow" /> Top Referrers</h3>
          <BarChart data={data?.referrer_stats?.map((r) => { let label = r.referrer; try { label = new URL(r.referrer).hostname; } catch {} return { label, views: r.views }; })} labelKey="label" valueKey="views" color="bg-memphis-yellow" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="memphis-card p-6">
          <h3 className="text-sm font-bold text-memphis-ink mb-4 flex items-center gap-2"><Target size={16} className="text-memphis-pink" /> UTM Sources</h3>
          {data?.utm_source_stats?.length ? (
            <BarChart data={data.utm_source_stats.map((s) => ({ label: s.utm_source, views: s.views }))} labelKey="label" valueKey="views" color="bg-memphis-pink" />
          ) : (
            <p className="text-xs text-memphis-purple/60">No UTM data yet</p>
          )}
        </div>
        <div className="memphis-card p-6">
          <h3 className="text-sm font-bold text-memphis-ink mb-4 flex items-center gap-2"><Layers size={16} className="text-memphis-teal" /> UTM Medium</h3>
          {data?.utm_medium_stats?.length ? (
            <BarChart data={data.utm_medium_stats.map((s) => ({ label: s.utm_medium, views: s.views }))} labelKey="label" valueKey="views" color="bg-memphis-teal" />
          ) : (
            <p className="text-xs text-memphis-purple/60">No UTM data yet</p>
          )}
        </div>
        <div className="memphis-card p-6">
          <h3 className="text-sm font-bold text-memphis-ink mb-4 flex items-center gap-2"><Flame size={16} className="text-memphis-yellow" /> UTM Campaigns</h3>
          {data?.utm_campaign_stats?.length ? (
            <BarChart data={data.utm_campaign_stats.map((s) => ({ label: s.utm_campaign, views: s.views }))} labelKey="label" valueKey="views" color="bg-memphis-yellow" />
          ) : (
            <p className="text-xs text-memphis-purple/60">No UTM data yet</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="memphis-card p-6">
          <h3 className="text-sm font-bold text-memphis-ink mb-4 flex items-center gap-2"><Globe size={16} className="text-memphis-pink" /> Browser Breakdown</h3>
          <DonutChart data={data?.browser_stats?.map((d) => ({ label: d.browser, views: d.views }))} labelKey="label" valueKey="views" colors={CHART_COLORS_6} />
        </div>
        <div className="memphis-card p-6">
          <h3 className="text-sm font-bold text-memphis-ink mb-4 flex items-center gap-2"><Monitor size={16} className="text-memphis-mint" /> OS Breakdown</h3>
          <DonutChart data={data?.os_stats?.map((d) => ({ label: d.os, views: d.views }))} labelKey="label" valueKey="views" colors={CHART_COLORS_6} />
        </div>
        <div className="memphis-card p-6">
          <h3 className="text-sm font-bold text-memphis-ink mb-4 flex items-center gap-2"><MapPin size={16} className="text-memphis-coral" /> Top Countries</h3>
          <DataTable columns={[
            { key: "country", label: "Country" },
            { key: "views", label: "Views", align: "right" },
            { key: "percentage", label: "%", align: "right", render: (v) => `${v}%` },
          ]} rows={data?.country_stats?.slice(0, 8)} />
        </div>
      </div>

      {/* City & Region stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {data?.city_stats?.length > 0 && (
          <div className="memphis-card p-6">
            <h3 className="text-sm font-bold text-memphis-ink mb-4 flex items-center gap-2"><MapPin size={16} className="text-memphis-pink" /> Top Cities</h3>
            <BarChart data={data.city_stats} labelKey="city" valueKey="views" color="bg-memphis-pink" maxItems={10} />
          </div>
        )}
        {data?.region_stats?.length > 0 && (
          <div className="memphis-card p-6">
            <h3 className="text-sm font-bold text-memphis-ink mb-4 flex items-center gap-2"><Layers size={16} className="text-memphis-teal" /> Top Regions</h3>
            <BarChart data={data.region_stats} labelKey="region" valueKey="views" color="bg-memphis-teal" maxItems={10} />
          </div>
        )}
      </div>

      {data?.timezone_stats?.length > 0 && (
        <div className="memphis-card p-6 mb-8">
          <h3 className="text-sm font-bold text-memphis-ink mb-4 flex items-center gap-2"><Clock size={16} className="text-memphis-yellow" /> Timezone Distribution</h3>
          <BarChart data={data.timezone_stats} labelKey="timezone" valueKey="views" color="bg-memphis-yellow" maxItems={10} />
        </div>
      )}
    </>
  );
}

// ─── App Metrics ────────────────────────────────────────
function AppMetrics({ data, loading }) {
  if (loading) return <Loader />;

  const s = data?.summary || {};
  const ub = s.users_breakdown || {};
  const totalDriverCount = (ub.bike_drivers || 0) + (ub.auto_drivers || 0);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Users size={20} />} label="Total Users" value={s.total_users} color="bg-memphis-teal" sub={`${s.total_passengers} passengers, ${totalDriverCount} drivers`} />
        <StatCard icon={<UserPlus size={20} />} label="New Users" value={s.new_users_period} color="bg-memphis-mint" sub={`Last ${data?.period_days || 30} days`} />
        <StatCard icon={<Bus size={20} />} label="Completed Trips" value={s.total_trips} color="bg-memphis-purple" sub={`${s.trips_period} in period`} />
        <StatCard icon={<MapPinned size={20} />} label="Active Trips" value={s.active_trips} color="bg-memphis-yellow" sub="Happening now" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Route size={20} />} label="Routes" value={s.total_routes} color="bg-memphis-pink" sub={`${s.total_stops} stops`} />
        <StatCard icon={<MapPin size={20} />} label="Cities" value={s.total_cities} color="bg-memphis-coral" sub={`${s.total_schedules} schedules`} />
        <StatCard icon={<Car size={20} />} label="Vehicles" value={s.total_vehicles} color="bg-memphis-lime" sub={`${s.active_vehicles} active`} />
        <StatCard icon={<CalendarCheck size={20} />} label="Boardings" value={s.total_boardings} color="bg-memphis-yellow" sub={`${s.boardings_period} in period`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="memphis-card p-6">
          <h3 className="text-sm font-bold text-memphis-ink mb-4 flex items-center gap-2"><Users size={16} className="text-memphis-teal" /> User Breakdown</h3>
          <ProgressBar segments={[
            { label: "Passengers", value: ub.passengers || 0, color: "#2FA97C" },
            { label: "Bike Drivers", value: ub.bike_drivers || 0, color: "#7BE0AD" },
            { label: "Auto Drivers", value: ub.auto_drivers || 0, color: "#FFB020" },
          ]} />
          <div className="flex items-center gap-4 mt-3">
            {[
              { label: "Passengers", value: ub.passengers, color: "bg-memphis-teal" },
              { label: "Bike Drivers", value: ub.bike_drivers, color: "bg-memphis-mint" },
              { label: "Auto Drivers", value: ub.auto_drivers, color: "bg-memphis-yellow" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full border border-memphis-ink/30 ${item.color}`} />
                <span className="memphis-label text-[11px]">{item.label}: {item.value || 0}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="memphis-card p-6">
          <h3 className="text-sm font-bold text-memphis-ink mb-4 flex items-center gap-2"><Target size={16} className="text-memphis-purple" /> Trip Fulfillment</h3>
          <DonutChart data={data?.trip_status?.map((d) => ({ label: d.status, count: d.count }))} labelKey="label" valueKey="count" colors={CHART_COLORS_6} centerLabel="Completion" centerValue={`${s.completion_rate || 0}%`} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="memphis-card p-6">
          <h3 className="text-sm font-bold text-memphis-ink mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-memphis-pink" /> Daily Trips</h3>
          <BarChart data={data?.daily_trips?.map((d) => ({ label: d.day, trips: d.trips }))} labelKey="label" valueKey="trips" color="bg-memphis-pink" />
        </div>
        <div className="memphis-card p-6">
          <h3 className="text-sm font-bold text-memphis-ink mb-4 flex items-center gap-2"><UserPlus size={16} className="text-memphis-mint" /> Daily New Users</h3>
          <BarChart data={data?.daily_users?.map((d) => ({ label: d.day, users: d.users }))} labelKey="label" valueKey="users" color="bg-memphis-mint" />
        </div>
      </div>

      <div className="memphis-card p-6 mb-8">
        <h3 className="text-sm font-bold text-memphis-ink mb-4 flex items-center gap-2"><BarChart2 size={16} className="text-memphis-purple" /> City Performance</h3>
        <DataTable columns={[
          { key: "name", label: "City" },
          { key: "route_count", label: "Routes", align: "right" },
          { key: "schedule_count", label: "Schedules", align: "right" },
          { key: "trips", label: "Trips", align: "right" },
          { key: "boardings", label: "Boardings", align: "right" },
        ]} rows={data?.city_performance} emptyMessage="No city data available" />
      </div>
    </>
  );
}

// ─── Main KPI Page ──────────────────────────────────────
export default function KPI() {
  const [platform, setPlatform] = useState("web");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    api.get(`/kpi/overview/?platform=${platform}&days=${days}`)
      .then((r) => setData(r.data?.data || r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [platform, days]);

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="memphis-title flex items-center gap-3">
            <BarChart3 className="text-memphis-pink" size={32} />
            KPI & Analytics
          </h1>
          <Zigzag className="mt-2 opacity-40" />
          <p className="text-memphis-purple mt-2 font-medium">
            {platform === "web" ? "Landing page visitor metrics" : "Transit app performance metrics"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="memphis-input w-auto px-3 py-2">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-8">
        <div className="flex bg-memphis-ink/5 p-1.5 border-2 border-memphis-ink rounded-lg">
          {[
            { id: "web", label: "Website", icon: <Globe size={14} />, desc: "Landing page & waitlist" },
            { id: "app", label: "Mobile App", icon: <Smartphone size={14} />, desc: "Transit product" },
          ].map((p) => (
            <button key={p.id} onClick={() => setPlatform(p.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${platform === p.id ? "bg-memphis-pink text-memphis-ink shadow-memphis-sm" : "text-memphis-purple hover:text-memphis-ink"}`}>
              {p.icon} {p.label}
            </button>
          ))}
        </div>
      </div>

      {platform === "web" ? (
        <WebMetrics data={data} loading={loading} />
      ) : (
        <AppMetrics data={data} loading={loading} />
      )}

      {/* Geo Analytics — only on web platform */}
      {platform === "web" && <GeoSection />}
    </div>
  );
}
