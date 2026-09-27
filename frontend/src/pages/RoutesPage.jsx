import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, MapPin, Navigation, X } from 'lucide-react';
import api from '../lib/api';
import { API_PATHS } from '../constants/apiPaths';
import { BottomSheet, MetricChip, ScreenHeader, VayyButton } from '../components/vayy';

const unwrapList = (payload) => {
  const data = payload?.data ?? payload;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const formatDistance = (meters) => {
  const value = Number(meters);
  if (!Number.isFinite(value) || value <= 0) return '—';
  return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`;
};

/**
 * Route card: badge chips, pickup/drop-off
 * timeline preview, MetricChip stats and a stops action.
 */
function RouteCard({ route, index, onOpenRoute }) {
  const stopsCount = route.stops_count ?? route.stops?.length ?? 0;
  const code = route.route_code || `R-${index + 1}`;

  return (
    <article className="flex h-full flex-col rounded-[16px] border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_14px_rgba(0,0,0,0.09)]">
      {/* Badge chips */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-[8px] bg-[#374151] px-2 py-1 text-[11px] font-black tracking-[0.5px] text-white">
          {code}
        </span>
        {route.city_name ? (
          <span className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-1 text-[11px] font-bold text-[#6B7280]">
            {route.city_name}
          </span>
        ) : null}
      </div>

      <h2 className="mb-2 truncate text-[15px] font-extrabold text-[#111827]" title={route.name}>
        {route.name}
      </h2>

      {/* Stops preview: pickup / drop-off timeline */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full border-[2.5px] border-[#009849]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-[#111827]">
              {route.start_name || '—'}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-[#6B7280]">Pickup</p>
          </div>
        </div>
        <div className="flex h-4 items-center pl-[5px]">
          <span aria-hidden="true" className="h-4 border-l-2 border-dashed border-[#D1D5DB]" />
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full border-[2.5px] border-[#F59E0B]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-[#111827]">
              {route.end_name || '—'}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-[#6B7280]">Drop-off</p>
          </div>
        </div>
      </div>

      {/* MetricChip stats */}
      <div className="mt-3 flex flex-wrap gap-2">
        <MetricChip icon={Navigation} label="Distance" value={formatDistance(route.total_distance_meters)} />
        <MetricChip icon={MapPin} label="Stops" value={String(stopsCount)} />
      </div>

      <button
        type="button"
        onClick={() => onOpenRoute(route)}
        className="mt-3 flex w-full items-center justify-center gap-1 rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-2.5 text-[12px] font-bold text-[#374151] transition-colors hover:border-[#009849] hover:text-[#009849] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#009849]"
      >
        Stops ({stopsCount})
        <ChevronRight size={14} aria-hidden="true" />
      </button>
    </article>
  );
}

/**
 * Routes grid for one city. Keyed by city so state resets when the city
 * changes (loading starts true, all updates happen in async callbacks).
 */
function RoutesGrid({ selectedCity, onOpenRoute }) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const url = selectedCity
      ? `${API_PATHS.transport.routes}?city=${selectedCity}`
      : API_PATHS.transport.routes;
    api.get(url)
      .then(res => {
        if (!cancelled) setRoutes(unwrapList(res.data));
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load routes. Please check your connection and try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedCity]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-[16px] border border-[#E5E7EB] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
          >
            <div className="mb-3 h-5 w-20 rounded-[8px] bg-[#E5E7EB]" />
            <div className="mb-4 h-4 w-2/3 rounded bg-[#E5E7EB]" />
            <div className="mb-2 h-3 w-1/2 rounded bg-[#F3F4F6]" />
            <div className="mb-4 h-3 w-1/3 rounded bg-[#F3F4F6]" />
            <div className="h-9 rounded-[10px] bg-[#F3F4F6]" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[16px] border border-[#FECACA] bg-[#FEF2F2] p-6 text-[14px] text-[#EF4444]">
        {error}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="ml-3 font-semibold underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <div className="rounded-[16px] border border-[#F0F0F0] bg-white px-6 py-10 text-center">
        <p className="text-[14px] font-semibold text-[#374151]">No routes available</p>
        <p className="mt-1 text-[13px] font-medium text-[#9CA3AF]">
          {selectedCity ? 'No routes found in this city yet.' : 'Routes will appear here once they are published.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2.5 mt-1 text-[13px] font-semibold text-[#6B7280]">
        {routes.length} routes found for your journey
      </p>
      <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
        {routes.map((route, index) => (
          <RouteCard
            key={route.id ?? index}
            route={route}
            index={index}
            onOpenRoute={onOpenRoute}
          />
        ))}
      </div>
    </div>
  );
}

export default function RoutesPage() {
  const navigate = useNavigate();
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [stopsLoading, setStopsLoading] = useState(false);
  const [stopsError, setStopsError] = useState(null);
  const [stops, setStops] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api.get(API_PATHS.cities.list)
      .then(res => {
        if (!cancelled) setCities(unwrapList(res.data));
      })
      .catch(() => {
        /* cities are optional — page still works without them */
      });
    return () => { cancelled = true; };
  }, []);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const openRoute = (route) => {
    setSelectedRoute(route);
    setStopsError(null);
    if (Array.isArray(route.stops) && route.stops.length > 0) {
      setStops(route.stops);
      return;
    }
    if (!route.id) {
      setStops([]);
      setStopsError('Stop details are not available for this route.');
      return;
    }
    setStopsLoading(true);
    api.get(API_PATHS.transport.routeDetail(route.id))
      .then(res => {
        const detail = res.data?.data ?? res.data ?? {};
        const fetched = Array.isArray(detail.stops) ? detail.stops : [];
        setStops(fetched);
        if (fetched.length === 0) setStopsError('No stops found for this route.');
      })
      .catch(() => setStopsError('Unable to load stops for this route.'))
      .finally(() => setStopsLoading(false));
  };

  const closeRoute = () => setSelectedRoute(null);

  const selectedCityName = cities.find(
    (city) => String(city.id) === String(selectedCity)
  )?.name;

  return (
    <div className="min-h-screen bg-[#F8FAF9] pb-24 font-sans lg:pb-16">
      {/* ── Header (PassengerRouteList) ── */}
      <div className="border-b border-[#F0F0F0] bg-white">
        <div className="mx-auto w-full max-w-7xl">
          <ScreenHeader
            title="Available Routes"
            subtitle={selectedCityName || 'All Cities'}
            onBack={handleBack}
          />
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-5 sm:px-6">
        <div className="mb-4 flex justify-end">
          <select
            className="w-full rounded-[14px] border border-[#E5E7EB] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#374151] outline-none focus:border-[#009849] focus:ring-2 focus:ring-[#009849]/30 sm:w-auto"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            aria-label="Filter routes by city"
          >
            <option value="">All Cities</option>
            {cities.map(city => (
              <option key={city.id} value={city.id}>{city.name}</option>
            ))}
          </select>
        </div>

        <RoutesGrid key={selectedCity || 'all'} selectedCity={selectedCity} onOpenRoute={openRoute} />
      </main>

      {/* ── Stops bottom sheet ── */}
      {selectedRoute && (
        <div
          className="fixed inset-0 z-[1100]"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedRoute.name} stops`}
          onClick={(e) => { if (e.target === e.currentTarget) closeRoute(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') closeRoute(); }}
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeRoute}
            aria-hidden="true"
          />
          <BottomSheet className="relative max-h-[75vh] overflow-y-auto">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-[18px] font-extrabold text-[#111827]">
                  {selectedRoute.name} - Stops
                </h2>
                <p className="mt-0.5 text-[12px] font-bold text-[#009849]">
                  {selectedRoute.route_code || 'Route'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeRoute}
                aria-label="Close stops"
                autoFocus
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#374151] transition-colors hover:bg-[#F8FAF9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#009849]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {stopsLoading && (
              <ul className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="h-10 animate-pulse rounded-[12px] bg-[#F3F4F6]" />
                ))}
              </ul>
            )}

            {!stopsLoading && stopsError && (
              <p className="rounded-[14px] border border-[#FDE68A] bg-[#FFFBEB] p-3 text-[13px] font-medium text-[#92400E]">
                {stopsError}
              </p>
            )}

            {!stopsLoading && !stopsError && stops.length > 0 && (
              <ul className="space-y-2">
                {stops.map((stop, index) => {
                  const isFirst = index === 0;
                  const isLast = index === stops.length - 1;
                  return (
                    <li
                      key={stop.id ?? index}
                      className="flex items-center gap-2.5 rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] p-2.5"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${
                          isFirst
                            ? 'bg-[#009849] text-white'
                            : isLast
                              ? 'bg-[#F59E0B] text-white'
                              : 'bg-[#E5E7EB] text-[#374151]'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#111827]">
                        {stop.name || `Stop ${index + 1}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            <VayyButton fullWidth className="mt-5" onClick={closeRoute}>
              Close
            </VayyButton>
          </BottomSheet>
        </div>
      )}
    </div>
  );
}
