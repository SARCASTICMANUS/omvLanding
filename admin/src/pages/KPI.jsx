import { useState, useEffect, useCallback } from "react";
import {
  BarChart3, Users, MapPin, Route, Bus, Activity, Globe, Smartphone, Monitor,
  TrendingUp, ArrowUpRight, MousePointerClick, Repeat, Car, UserPlus,
  CalendarCheck, MapPinned, RefreshCw, Target, BarChart2, Ban, Database,
  Flame, CircleDot, Palette, Layers, Clock, ChevronDown,
} from "lucide-react";
import api from "../api/client";
import { getBluePalette, getBluePrimary, SPECTRUM_PALETTE } from "../colors";
import Loader from "../components/Loader";
import { StatCard, LineChart, BarChart, DonutChart, ProgressBar, DataTable } from "../components/charts";
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
              <BarChart data={tzData} labelKey="timezone" valueKey="count" color={getBluePalette()[4]} maxItems={8} />
            </div>
            <div className="glass-card p-5">
              <h3 className="glass-label mb-3">Top Timezones</h3>
              {/* slice(0, 6) of up to 20 timezones — total_events is the true
                  denominator so the rest shows as "Other / Unknown" rather than
                  the top 6 silently rendering as 100%. centreValue used to be
                  tzData.length (a count of zones) under a full ring. */}
              <DonutChart data={tzData.slice(0, 6)} labelKey="timezone" valueKey="count" colors={SPECTRUM_PALETTE} centerLabel="events" total={data?.total_events} />
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
              <BarChart data={cityData} labelKey="city" valueKey="count" color={getBluePalette()[6]} maxItems={8} />
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
          {/* `visitors` came back from /kpi/overview/ but was dropped here. Two
              LineCharts instead of one overlay because LineChart renders a
              single valueKey series. Distinct valueKeys also keep the generated
              SVG gradient ids (mg-${valueKey}) unique on the page. */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div>
              <p className="glass-label mb-2">Page views</p>
              <LineChart data={data?.daily?.map((d) => ({ label: d.day, views: d.views }))} labelKey="label" valueKey="views" />
            </div>
            <div>
              <p className="glass-label mb-2">Unique visitors</p>
              <LineChart data={data?.daily?.map((d) => ({ label: d.day, visitors: d.visitors }))} labelKey="label" valueKey="visitors" color={getBluePalette()[5]} />
            </div>
          </div>
        </div>
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><Globe size={16} style={{ color: "var(--accent-blue-light)" }} /> Top Pages</h3>
          <BarChart data={data?.top_pages?.map((p) => ({ label: p.page || "/", views: p.views }))} labelKey="label" valueKey="views" color={getBluePalette()[4]} maxItems={10} />
        </div>
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><Monitor size={16} style={{ color: "var(--accent-blue-dark)" }} /> Device Breakdown</h3>
          {/* total = summary.total_visits so the API's top-10 cap surfaces as an
              "Other / Unknown" slice instead of the top rows reading as 100%. */}
          <DonutChart data={data?.device_stats?.map((d) => ({ label: d.device_type || "Unknown", views: d.views }))} labelKey="label" valueKey="views" colors={SPECTRUM_PALETTE} centerLabel="views" total={s.total_visits} />
        </div>
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><ArrowUpRight size={16} style={{ color: "var(--accent-blue)" }} /> Top Referrers</h3>
          <BarChart data={data?.referrer_stats?.map((r) => { let label = r.referrer; try { label = new URL(r.referrer).hostname; } catch {} return { label, views: r.views }; })} labelKey="label" valueKey="views" color={getBluePalette()[5]} maxItems={10} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><Target size={16} style={{ color: "var(--accent-blue)" }} /> UTM Sources</h3>
          {data?.utm_source_stats?.length ? (
            <BarChart data={data.utm_source_stats.map((s) => ({ label: s.utm_source, views: s.views }))} labelKey="label" valueKey="views" color={getBluePrimary()} maxItems={8} />
          ) : (
            <p className="text-xs text-slate-500">No UTM data yet</p>
          )}
        </div>
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><Layers size={16} style={{ color: "var(--accent-blue-light)" }} /> UTM Medium</h3>
          {data?.utm_medium_stats?.length ? (
            <BarChart data={data.utm_medium_stats.map((s) => ({ label: s.utm_medium, views: s.views }))} labelKey="label" valueKey="views" color={getBluePalette()[4]} maxItems={8} />
          ) : (
            <p className="text-xs text-slate-500">No UTM data yet</p>
          )}
        </div>
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><Flame size={16} style={{ color: "var(--accent-blue)" }} /> UTM Campaigns</h3>
          {data?.utm_campaign_stats?.length ? (
            <BarChart data={data.utm_campaign_stats.map((s) => ({ label: s.utm_campaign, views: s.views }))} labelKey="label" valueKey="views" color={getBluePalette()[5]} maxItems={8} />
          ) : (
            <p className="text-xs text-slate-500">No UTM data yet</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><Globe size={16} style={{ color: "var(--accent-blue)" }} /> Browser Breakdown</h3>
          {/* Parsed from at most the first 500 user agents of TODAY, so these
              are sample-relative shares, not totals for the selected range.
              No `total` prop is passed deliberately — anchoring the ring to a
              true total would imply sample precision the API does not have. */}
          <DonutChart data={data?.browser_stats?.map((d) => ({ label: d.browser, views: d.views }))} labelKey="label" valueKey="views" colors={SPECTRUM_PALETTE} />
          <p className="glass-label mt-3">Sampled from up to 500 requests today, not the full range.</p>
        </div>
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><Monitor size={16} style={{ color: "var(--accent-blue-light)" }} /> OS Breakdown</h3>
          <DonutChart data={data?.os_stats?.map((d) => ({ label: d.os, views: d.views }))} labelKey="label" valueKey="views" colors={SPECTRUM_PALETTE} />
          <p className="glass-label mt-3">Sampled from up to 500 requests today, not the full range.</p>
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
            <BarChart data={data.city_stats} labelKey="city" valueKey="views" color={getBluePrimary()} maxItems={10} />
          </div>
        )}
        {data?.region_stats?.length > 0 && (
          <div className="glass-card p-6">
            <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><Layers size={16} style={{ color: "var(--accent-blue-light)" }} /> Top Regions</h3>
            <BarChart data={data.region_stats} labelKey="region" valueKey="views" color={getBluePalette()[4]} maxItems={10} />
          </div>
        )}
      </div>

      {data?.timezone_stats?.length > 0 && (
        <div className="glass-card p-6 mb-8">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><Clock size={16} style={{ color: "var(--accent-blue)" }} /> Timezone Distribution</h3>
          <BarChart data={data.timezone_stats} labelKey="timezone" valueKey="views" color={getBluePalette()[5]} maxItems={10} />
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
  // The backend sends total_bike_drivers / total_auto_drivers directly
  // (kpi/api/views.py _app_metrics) and they were being thrown away in favour of
  // re-deriving the sum from users_breakdown. Prefer the direct values and fall
  // back to the breakdown so an older deploy degrades instead of showing 0.
  const bikeDrivers = s.total_bike_drivers ?? ub.bike_drivers ?? 0;
  const autoDrivers = s.total_auto_drivers ?? ub.auto_drivers ?? 0;
  const totalDriverCount = bikeDrivers + autoDrivers;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard icon={<Users size={20} />} label="Total Users" value={s.total_users ?? 0} color="var(--accent-blue-light)" sub={`${s.total_passengers ?? 0} passengers, ${totalDriverCount} drivers`} />
        <StatCard icon={<UserPlus size={20} />} label="New Users" value={s.new_users_period ?? 0} color="var(--accent-blue-light)" sub={`Last ${data?.period_days || 30} days`} />
        <StatCard icon={<Bus size={20} />} label="Completed Trips" value={s.total_trips ?? 0} color="var(--accent-blue-dark)" sub={`${s.trips_period ?? 0} in period`} />
        <StatCard icon={<MapPinned size={20} />} label="Active Trips" value={s.active_trips ?? 0} color="var(--accent-blue)" sub="Happening now" />
        {/* summary.cancelled_trips was always computed and sent, never rendered. */}
        <StatCard icon={<Ban size={20} />} label="Cancelled Trips" value={s.cancelled_trips ?? 0} color="var(--accent-blue)" sub="All time" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Route size={20} />} label="Routes" value={s.total_routes ?? 0} color="var(--accent-blue)" sub={`${s.total_stops ?? 0} stops`} />
        <StatCard icon={<MapPin size={20} />} label="Cities" value={s.total_cities ?? 0} color="var(--accent-blue-light)" sub={`${s.total_schedules ?? 0} schedules`} />
        <StatCard icon={<Car size={20} />} label="Vehicles" value={s.total_vehicles ?? 0} color="var(--accent-blue)" sub={`${s.active_vehicles ?? 0} active`} />
        <StatCard icon={<CalendarCheck size={20} />} label="Boardings" value={s.total_boardings ?? 0} color="var(--accent-blue)" sub={`${s.boardings_period ?? 0} in period`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><Users size={16} style={{ color: "var(--accent-blue-light)" }} /> User Breakdown</h3>
          <ProgressBar segments={[
            { label: "Passengers", value: ub.passengers || 0, color: SPECTRUM_PALETTE[0] },
            { label: "Bike Drivers", value: bikeDrivers, color: SPECTRUM_PALETTE[1] },
            { label: "Auto Drivers", value: autoDrivers, color: SPECTRUM_PALETTE[3] },
          ]} />
          <div className="flex items-center gap-4 mt-3">
            {[
              { label: "Passengers", value: ub.passengers, color: SPECTRUM_PALETTE[0] },
              { label: "Bike Drivers", value: bikeDrivers, color: SPECTRUM_PALETTE[1] },
              { label: "Auto Drivers", value: autoDrivers, color: SPECTRUM_PALETTE[3] },
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

// ─── Snapshot Trends (KPISnapshot history) ──────────────
// GET /kpi/snapshots/ had no consumer anywhere in the admin app. It returns one
// KPISnapshot row per day, written nightly by kpi.tasks.create_daily_kpi_snapshot.
//
// NOTE on column semantics (see kpi/models.py): web_visits / app_visits are true
// per-day deltas, but total_users / total_trips / total_routes / total_stops /
// total_cities / total_passengers / total_drivers are LIFETIME counts snapshotted
// onto a daily row. The charts below are labelled accordingly so the cumulative
// ones are not misread as daily activity.
function SnapshotTrends({ snapshots, loading, days }) {
  if (loading) return <Loader />;

  const rows = snapshots || [];
  if (rows.length === 0) {
    return (
      <>
        <div className="glass-divider my-4" />
        <div className="flex items-center gap-2 mb-6">
          <Database size={18} className="shrink-0" style={{ color: "var(--accent-blue)" }} />
          <div>
            <h2 className="glass-section-title text-xl">Snapshot Trends</h2>
            <p className="glass-label">Daily rollup history</p>
          </div>
        </div>
        <div className="glass-card p-6">
          <p className="text-sm text-slate-500">
            No snapshots recorded for the last {days} days. Snapshots are written nightly at 01:00 by the{" "}
            <span className="font-semibold">create_daily_kpi_snapshot</span> Celery task, so the most recent
            available day is always yesterday.
          </p>
        </div>
      </>
    );
  }

  // API returns Meta.ordering = ["-date"] (newest first); charts read left→right
  // in time, so flip to chronological.
  const chronological = [...rows].reverse();
  const latest = rows[0];

  return (
    <>
      <div className="glass-divider my-4" />
      <div className="flex items-center gap-2 mb-6">
        <Database size={18} className="shrink-0" style={{ color: "var(--accent-blue)" }} />
        <div>
          <h2 className="glass-section-title text-xl">Snapshot Trends</h2>
          <p className="glass-label">Daily rollup history · {rows.length} day{rows.length === 1 ? "" : "s"} recorded</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<CalendarCheck size={20} />} label="Latest Snapshot" value={latest?.date || "—"} color="var(--accent-blue-light)" sub={`${rows.length} day${rows.length === 1 ? "" : "s"} in range`} />
        <StatCard icon={<Users size={20} />} label="Cumulative Users" value={latest?.total_users ?? 0} color="var(--accent-blue)" sub="All-time at snapshot" />
        <StatCard icon={<Bus size={20} />} label="Cumulative Trips" value={latest?.total_trips ?? 0} color="var(--accent-blue-dark)" sub="All-time completed" />
        <StatCard icon={<Globe size={20} />} label="Cumulative Visits" value={(latest?.web_visits ?? 0) + (latest?.app_visits ?? 0)} color="var(--accent-blue-light)" sub="Web + app, all-time" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-1 flex items-center gap-2"><Globe size={16} style={{ color: "var(--accent-blue)" }} /> Daily Visits by Platform</h3>
          <p className="glass-label mb-4">True per-day deltas from the snapshot rollup</p>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div>
              <p className="glass-label mb-2">Website</p>
              <LineChart data={chronological.map((r) => ({ label: r.date, snap_web: r.web_visits ?? 0 }))} labelKey="label" valueKey="snap_web" height={170} />
            </div>
            <div>
              <p className="glass-label mb-2">Mobile app</p>
              <LineChart data={chronological.map((r) => ({ label: r.date, snap_app: r.app_visits ?? 0 }))} labelKey="label" valueKey="snap_app" color={getBluePalette()[5]} height={170} />
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="glass-section-title text-base mb-1 flex items-center gap-2"><TrendingUp size={16} style={{ color: "var(--accent-blue-light)" }} /> Cumulative Growth</h3>
          <p className="glass-label mb-4">Lifetime totals captured at each daily snapshot</p>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div>
              <p className="glass-label mb-2">Total users</p>
              <LineChart data={chronological.map((r) => ({ label: r.date, snap_users: r.total_users ?? 0 }))} labelKey="label" valueKey="snap_users" color={getBluePalette()[4]} height={170} />
            </div>
            <div>
              <p className="glass-label mb-2">Total trips</p>
              <LineChart data={chronological.map((r) => ({ label: r.date, snap_trips: r.total_trips ?? 0 }))} labelKey="label" valueKey="snap_trips" color={getBluePalette()[6]} height={170} />
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-6 mb-8">
        <h3 className="glass-section-title text-base mb-4 flex items-center gap-2"><BarChart2 size={16} style={{ color: "var(--accent-blue-dark)" }} /> Snapshot Rollup (oldest → newest)</h3>
        <DataTable
          columns={[
            { key: "date", label: "Date" },
            { key: "total_users", label: "Users", align: "right" },
            { key: "total_passengers", label: "Passengers", align: "right" },
            { key: "total_drivers", label: "Drivers", align: "right" },
            { key: "total_routes", label: "Routes", align: "right" },
            { key: "total_stops", label: "Stops", align: "right" },
            { key: "total_cities", label: "Cities", align: "right" },
            { key: "total_trips", label: "Trips", align: "right" },
            { key: "web_visits", label: "Web Visits", align: "right" },
            { key: "app_visits", label: "App Visits", align: "right" },
          ]}
          rows={chronological}
          emptyMessage="No snapshots recorded yet"
        />
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
  const [snapshots, setSnapshots] = useState([]);
  const [snapLoading, setSnapLoading] = useState(true);

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

  // Snapshot history is platform-agnostic (each KPISnapshot row holds both
  // web_visits and app_visits), so it is keyed on `days` only.
  useEffect(() => {
    setSnapLoading(true);
    api.get(`/kpi/snapshots/?days=${days}`)
      .then((r) => setSnapshots(r.data?.data || r.data || []))
      .catch(() => setSnapshots([]))
      .finally(() => setSnapLoading(false));
  }, [days]);

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

      <SnapshotTrends snapshots={snapshots} loading={snapLoading} days={days} />

      {platform === "web" && <GeoSection />}
    </div>
  );
}
