import { useState, useEffect, useCallback } from "react";
import {
  BarChart3, Users, MapPin, Route, Bus, Activity, Globe, Smartphone, Monitor,
  TrendingUp, ArrowUpRight, MousePointerClick, Repeat, Car, UserPlus,
  CalendarCheck, MapPinned, RefreshCw, Target, BarChart2,
  Flame, CircleDot, Palette, Layers, Clock, ChevronDown,
} from "lucide-react";
import api from "../api/client";
import { getBluePalette, getBluePrimary, SPECTRUM_PALETTE } from "../colors";
import Loader from "../components/Loader";
import { StatCard, LineChart, DonutChart, ProgressBar, DataTable } from "../components/charts";
import MapLibreMap from "../components/geo/LeafletMap";
import HeatmapLayer from "../components/geo/HeatmapLayer";
import useAccentTick from "../hooks/useAccentTick";
import CityScatter from "../components/geo/CityScatter";
import ChoroplethMap from "../components/geo/ChoroplethMap";
import GeoStatsCards from "../components/geo/GeoStatsCards";
import GeoDrilldownTable from "../components/geo/GeoDrilldownTable";
import GeoTrendsChart from "../components/geo/GeoTrendsChart";

// ─── Geo Analytics Section ──────────────────────────────
function GeoSection() {
  useAccentTick();
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
      <div className="glass-divider my-4" />
      <div className="flex items-center gap-2 mb-6">
        <Globe size={18} className="shrink-0" style={{ color: "var(--accent-blue)" }} />
        <div>
          <h2 className="glass-section-title text-xl">Geo Analytics</h2>
          <p className="glass-label">Geographic visitor distribution</p>
        </div>
      </div>

      {/* Source + Days + View tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <div className="glass-tab-group">
            {["geoevent", "pageview"].map((s) => (
              <button key={s} onClick={() => setSource(s)}
                className={source === s ? "glass-tab-active" : "glass-tab"}>
                {s === "geoevent" ? "GeoEvent" : "PageView"}
              </button>
            ))}
          </div>
          <div className="glass-tab-group">
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={days === d ? "glass-tab-active" : "glass-tab"}>
                {d}d
              </button>
            ))}
          </div>
        </div>
        <div className="glass-tab-group">
          {[
            { id: "map", label: "Map", icon: <MapPin size={14} /> },
            { id: "trends", label: "Trends", icon: <BarChart3 size={14} /> },
            { id: "drilldown", label: "Drill-down", icon: <Layers size={14} /> },
          ].map((t) => (
            <button key={t.id} onClick={() => setGeoView(t.id)}
              className={geoView === t.id ? "glass-tab-active" : "glass-tab"}>
              <span className="flex items-center gap-1.5">{t.icon} {t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <GeoStatsCards data={data} />

      {geoView === "map" && (
        <div className="space-y-4 mt-6">
          <div className="glass-tab-group w-fit">
            {[
              { id: "heatmap", label: "Heatmap", icon: <Flame size={14} /> },
              { id: "scatter", label: "Scatter", icon: <CircleDot size={14} /> },
              { id: "choropleth", label: "Choropleth", icon: <Palette size={14} /> },
            ].map((t) => (
              <button key={t.id} onClick={() => setMapType(t.id)}
                className={mapType === t.id ? "glass-tab-active" : "glass-tab"}>
                <span className="flex items-center gap-1.5">{t.icon} {t.label}</span>
              </button>
            ))}
          </div>
          <div className="glass-card overflow-hidden" style={{ borderRadius: "20px" }}>
            <MapLibreMap height="420px" onMapLoad={handleMapLoad}>
              {mapInstance && mapType === "heatmap" && <HeatmapLayer map={mapInstance} points={mapPoints} />}
              {mapInstance && mapType === "scatter" && <CityScatter map={mapInstance} cities={cityData} />}
              {mapInstance && mapType === "choropleth" && <ChoroplethMap map={mapInstance} countryData={countryData} />}
            </MapLibreMap>
          </div>
          {mapPoints.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-2">No geo data yet. Data appears as requests come in.</p>
          )}
        </div>
      )}

      {geoView === "trends" && (
        <div className="space-y-6 mt-6">
          <GeoTrendsChart dailyByCountry={dailyByCountry} height={260} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h3 className="glass-label mb-3">Timezone Distribution</h3>
              <LineChart data={tzData} labelKey="timezone" valueKey="count" color={getBluePalette()[4]} maxItems={10} />
            </div>
            <div className="glass-card p-5">
              <h3 className="glass-label mb-3">Top Timezones</h3>
              <DonutChart data={tzData.slice(0, 6)} labelKey="timezone" valueKey="count" colors={SPECTRUM_PALETTE} centerLabel="zones" centerValue={tzData.length} />
            </div>
          </div>
        </div>
      )}

      {geoView === "drilldown" && (
        <div className="space-y-6 mt-6">
          <div className="glass-card p-5">
            <h3 className="glass-label mb-3">Geographic Drill-down</h3>
            <p className="text-xs text-slate-500 mb-4">Click a country to see regions, then click a region to see cities.</p>
            <GeoDrilldownTable countryBreakdown={countryData} regionBreakdown={regionData} cityBreakdown={cityData} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h3 className="glass-label mb-3">Top Countries</h3>
              <DataTable columns={[
                { label: "Country", key: "country", render: (v, r) => (
                  <span className="font-medium">{v} {r.country_code && <span className="text-slate-500">({r.country_code})</span>}</span>
                )},
                { label: "Events", key: "count", align: "right", render: (v) => v?.toLocaleString() },
                { label: "%", key: "percentage", align: "right", render: (v) => `${v}%` },
              ]} rows={countryData.slice(0, 10)} />
            </div>
            <div className="glass-card p-5">
              <h3 className="glass-label mb-3">Top Cities</h3>
              <LineChart data={cityData} labelKey="city" valueKey="count" color={getBluePalette()[6]} maxItems={10} />
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
        <StatCard icon={<ArrowUpRight size={20} />} label="Total Visits" value={s.total_visits} color="var(--accent-blue-light)" sub={`Last ${data?.period_days || 30} days`} />
        <StatCard icon={<Users size={20} />} label="Unique Visitors" value={s.unique_visitors} color="var(--accent-blue-light)" sub={`${s.avg_views_per_visitor || 0} avg views/visitor`} />
        <StatCard icon={<MousePointerClick size={20} />} label="Bounce Rate" value={`${s.bounce_rate || 0}%`} color="var(--accent-blue)" sub="Single-page sessions" />
        <StatCard icon={<Repeat size={20} />} label="Avg Views / Visitor" value={s.avg_views_per_visitor} color="var(--accent-blue-dark)" sub="Pages per session" />
        <StatCard icon={<RefreshCw size={20} />} label="Returning Visitors" value={`${s.returning_visitor_ratio || 0}%`} color="var(--accent-blue)" sub="Return visitor ratio" />
        <StatCard icon={<Target size={20} />} label="Engagement Rate" value={`${s.engagement_rate || 0}%`} color="var(--accent-blue-light)" sub="100% − Bounce Rate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><TrendingUp size={16} style={{ color: "var(--accent-blue)" }} /> Daily Visits</h3>
          <LineChart data={data?.daily?.map((d) => ({ label: d.day, views: d.views }))} labelKey="label" valueKey="views" />
        </div>
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><Globe size={16} style={{ color: "var(--accent-blue-light)" }} /> Top Pages</h3>
          <LineChart data={data?.top_pages?.map((p) => ({ label: p.page || "/", views: p.views }))} labelKey="label" valueKey="views" color={getBluePalette()[4]} />
        </div>
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><Monitor size={16} style={{ color: "var(--accent-blue-dark)" }} /> Device Breakdown</h3>
          <DonutChart data={data?.device_stats?.map((d) => ({ label: d.device_type || "Unknown", views: d.views }))} labelKey="label" valueKey="views" colors={SPECTRUM_PALETTE} />
        </div>
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><ArrowUpRight size={16} style={{ color: "var(--accent-blue)" }} /> Top Referrers</h3>
          <LineChart data={data?.referrer_stats?.map((r) => { let label = r.referrer; try { label = new URL(r.referrer).hostname; } catch {} return { label, views: r.views }; })} labelKey="label" valueKey="views" color={getBluePalette()[5]} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><Target size={16} style={{ color: "var(--accent-blue)" }} /> UTM Sources</h3>
          {data?.utm_source_stats?.length ? (
            <LineChart data={data.utm_source_stats.map((s) => ({ label: s.utm_source, views: s.views }))} labelKey="label" valueKey="views" color={getBluePrimary()} />
          ) : (
            <p className="text-xs text-slate-500">No UTM data yet</p>
          )}
        </div>
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><Layers size={16} style={{ color: "var(--accent-blue-light)" }} /> UTM Medium</h3>
          {data?.utm_medium_stats?.length ? (
            <LineChart data={data.utm_medium_stats.map((s) => ({ label: s.utm_medium, views: s.views }))} labelKey="label" valueKey="views" color={getBluePalette()[4]} />
          ) : (
            <p className="text-xs text-slate-500">No UTM data yet</p>
          )}
        </div>
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><Flame size={16} style={{ color: "var(--accent-blue)" }} /> UTM Campaigns</h3>
          {data?.utm_campaign_stats?.length ? (
            <LineChart data={data.utm_campaign_stats.map((s) => ({ label: s.utm_campaign, views: s.views }))} labelKey="label" valueKey="views" color={getBluePalette()[5]} />
          ) : (
            <p className="text-xs text-slate-500">No UTM data yet</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><Globe size={16} style={{ color: "var(--accent-blue)" }} /> Browser Breakdown</h3>
          <DonutChart data={data?.browser_stats?.map((d) => ({ label: d.browser, views: d.views }))} labelKey="label" valueKey="views" colors={SPECTRUM_PALETTE} />
        </div>
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><Monitor size={16} style={{ color: "var(--accent-blue-light)" }} /> OS Breakdown</h3>
          <DonutChart data={data?.os_stats?.map((d) => ({ label: d.os, views: d.views }))} labelKey="label" valueKey="views" colors={SPECTRUM_PALETTE} />
        </div>
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><MapPin size={16} style={{ color: "var(--accent-blue-light)" }} /> Top Countries</h3>
          <DataTable columns={[
            { key: "country", label: "Country" },
            { key: "views", label: "Views", align: "right" },
            { key: "percentage", label: "%", align: "right", render: (v) => `${v}%` },
          ]} rows={data?.country_stats?.slice(0, 8)} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {data?.city_stats?.length > 0 && (
          <div className="glass-card p-6">
            <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><MapPin size={16} style={{ color: "var(--accent-blue)" }} /> Top Cities</h3>
            <LineChart data={data.city_stats} labelKey="city" valueKey="views" color={getBluePrimary()} maxItems={10} />
          </div>
        )}
        {data?.region_stats?.length > 0 && (
          <div className="glass-card p-6">
            <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><Layers size={16} style={{ color: "var(--accent-blue-light)" }} /> Top Regions</h3>
            <LineChart data={data.region_stats} labelKey="region" valueKey="views" color={getBluePalette()[4]} maxItems={10} />
          </div>
        )}
      </div>

      {data?.timezone_stats?.length > 0 && (
        <div className="glass-card p-6 mb-8">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><Clock size={16} style={{ color: "var(--accent-blue)" }} /> Timezone Distribution</h3>
          <LineChart data={data.timezone_stats} labelKey="timezone" valueKey="views" color={getBluePalette()[5]} maxItems={10} />
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
        <StatCard icon={<Users size={20} />} label="Total Users" value={s.total_users} color="var(--accent-blue-light)" sub={`${s.total_passengers} passengers, ${totalDriverCount} drivers`} />
        <StatCard icon={<UserPlus size={20} />} label="New Users" value={s.new_users_period} color="var(--accent-blue-light)" sub={`Last ${data?.period_days || 30} days`} />
        <StatCard icon={<Bus size={20} />} label="Completed Trips" value={s.total_trips} color="var(--accent-blue-dark)" sub={`${s.trips_period} in period`} />
        <StatCard icon={<MapPinned size={20} />} label="Active Trips" value={s.active_trips} color="var(--accent-blue)" sub="Happening now" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Route size={20} />} label="Routes" value={s.total_routes} color="var(--accent-blue)" sub={`${s.total_stops} stops`} />
        <StatCard icon={<MapPin size={20} />} label="Cities" value={s.total_cities} color="var(--accent-blue-light)" sub={`${s.total_schedules} schedules`} />
        <StatCard icon={<Car size={20} />} label="Vehicles" value={s.total_vehicles} color="var(--accent-blue)" sub={`${s.active_vehicles} active`} />
        <StatCard icon={<CalendarCheck size={20} />} label="Boardings" value={s.total_boardings} color="var(--accent-blue)" sub={`${s.boardings_period} in period`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><Users size={16} style={{ color: "var(--accent-blue-light)" }} /> User Breakdown</h3>
          <ProgressBar segments={[
            { label: "Passengers", value: ub.passengers || 0, color: SPECTRUM_PALETTE[0] },
            { label: "Bike Drivers", value: ub.bike_drivers || 0, color: SPECTRUM_PALETTE[1] },
            { label: "Auto Drivers", value: ub.auto_drivers || 0, color: SPECTRUM_PALETTE[3] },
          ]} />
          <div className="flex items-center gap-4 mt-3">
            {[
              { label: "Passengers", value: ub.passengers, color: SPECTRUM_PALETTE[0] },
              { label: "Bike Drivers", value: ub.bike_drivers, color: SPECTRUM_PALETTE[1] },
              { label: "Auto Drivers", value: ub.auto_drivers, color: SPECTRUM_PALETTE[3] },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                <span className="glass-label text-[11px]">{item.label}: {item.value || 0}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><Target size={16} style={{ color: "var(--accent-blue-dark)" }} /> Trip Fulfillment</h3>
          <DonutChart data={data?.trip_status?.map((d) => ({ label: d.status, count: d.count }))} labelKey="label" valueKey="count" colors={SPECTRUM_PALETTE} centerLabel="Completion" centerValue={`${s.completion_rate || 0}%`} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><TrendingUp size={16} style={{ color: "var(--accent-blue)" }} /> Daily Trips</h3>
          <LineChart data={data?.daily_trips?.map((d) => ({ label: d.day, trips: d.trips }))} labelKey="label" valueKey="trips" />
        </div>
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><UserPlus size={16} style={{ color: "var(--accent-blue-light)" }} /> Daily New Users</h3>
          <LineChart data={data?.daily_users?.map((d) => ({ label: d.day, users: d.users }))} labelKey="label" valueKey="users" />
        </div>
      </div>

      <div className="glass-card p-6 mb-8">
        <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><BarChart2 size={16} style={{ color: "var(--accent-blue-dark)" }} /> City Performance</h3>
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
  useAccentTick();
  const [platform, setPlatform] = useState("web");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("pagesubtitle", {
        detail: {
          tab: "kpi",
          text: platform === "web" ? "Landing page visitor metrics" : "Transit app performance metrics",
        },
      })
    );
  }, [platform]);

  useEffect(() => {
    setLoading(true);
    api.get(`/kpi/overview/?platform=${platform}&days=${days}`)
      .then((r) => setData(r.data?.data || r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [platform, days]);

  return (
    <div className="pt-4 pb-6 px-6 md:pt-5 md:pb-8 md:px-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="glass-tab-group">
          {[
            { id: "web", label: "Website", icon: <Globe size={14} />, desc: "Landing page & waitlist" },
            { id: "app", label: "Mobile App", icon: <Smartphone size={14} />, desc: "Transit product" },
          ].map((p) => (
            <button key={p.id} onClick={() => setPlatform(p.id)}
              className={platform === p.id ? "glass-tab-active" : "glass-tab"}>
              <span className="flex items-center gap-1.5">{p.icon} {p.label}</span>
            </button>
          ))}
        </div>
        <div className="relative shrink-0">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="glass-input w-auto appearance-none pl-4 pr-10 py-2.5 text-sm font-semibold outline-none cursor-pointer">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
          <ChevronDown
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
        </div>
      </div>

      {platform === "web" ? (
        <WebMetrics data={data} loading={loading} />
      ) : (
        <AppMetrics data={data} loading={loading} />
      )}

      {platform === "web" && <GeoSection />}
    </div>
  );
}
