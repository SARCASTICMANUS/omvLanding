import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  IndianRupee,
  MapPin,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import api from "../api/client";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import PageToolbar from "../components/PageToolbar";

/* ------------------------------------------------------------------ helpers */

// The admin API returns three different shapes on purpose, so unwrap in one
// place rather than guessing per call site:
//   list endpoints   -> { results: [...], count: n }
//   single objects   -> the serializer dict
//   action endpoints -> { success, message, data }
const rowsOf = (body) => (Array.isArray(body) ? body : body?.results || []);
const errMsg = (err, fallback) =>
  err?.response?.data?.message || err?.response?.data?.detail || fallback;

const STATUS_STYLES = {
  verified: "glass-badge-success",
  provisional: "glass-badge-warning",
  conflict: "glass-badge-danger",
  unresolved: "glass-badge-muted",
  legacy_synthetic: "glass-badge-muted",
};

const SERVICEABLE_STYLES = {
  true: "glass-badge-success",
  false: "glass-badge-muted",
};

const ROUNDING_RULES = [
  { value: "none", label: "None — 2 decimal places" },
  { value: "nearest_unit", label: "Nearest whole rupee" },
  { value: "ceil_unit", label: "Round up to whole rupee" },
  { value: "floor_unit", label: "Round down to whole rupee" },
];

const fmtNum = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));

function Stat({ icon, label, value, tone }) {
  const Icon = icon;
  return (
    <div className="glass-card-subtle p-5 relative overflow-hidden">
      <div className="gradient-blob blob-primary w-16 h-16 -top-4 -right-4" />
      <div className="relative z-10 flex items-center gap-3">
        <div className="glass-icon-tile">
          <Icon size={18} style={{ color: tone || "var(--accent-blue)" }} />
        </div>
        <div className="min-w-0">
          <p className="glass-label">{label}</p>
          <p className="glass-title-sm mt-0.5">{value}</p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- sub: cities */

function CitiesPanel({ cities, onReload, notify }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  const open = (city) => {
    setEditing(city || {});
    setForm(
      city
        ? {
            name: city.name || "",
            slug: city.slug || "",
            state_name: city.state_name || "",
            country: city.country || "India",
            currency: city.currency || "INR",
            fare_per_km: city.fare_per_km ?? "",
            platform_fee: city.platform_fee ?? "",
            rounding_rule: city.rounding_rule || "none",
            corridor_m: city.corridor_m ?? "",
            max_walk_to_stop_m: city.max_walk_to_stop_m ?? "",
            is_active: city.is_active !== false,
          }
        : {
            name: "",
            slug: "",
            state_name: "",
            country: "India",
            currency: "INR",
            fare_per_km: "8",
            platform_fee: "0",
            rounding_rule: "none",
            corridor_m: "100",
            max_walk_to_stop_m: "1200",
            is_active: true,
          }
    );
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        // Empty string means "leave the server default alone".
        fare_per_km: form.fare_per_km === "" ? undefined : Number(form.fare_per_km),
        platform_fee: form.platform_fee === "" ? undefined : Number(form.platform_fee),
        corridor_m: form.corridor_m === "" ? undefined : Number(form.corridor_m),
        max_walk_to_stop_m:
          form.max_walk_to_stop_m === "" ? undefined : Number(form.max_walk_to_stop_m),
      };
      if (editing?.slug) {
        await api.put(`/transport/admin/cities/${editing.slug}/`, payload);
      } else {
        await api.post("/transport/admin/cities/", payload);
      }
      setEditing(null);
      notify("City saved");
      onReload();
    } catch (err) {
      alert(errMsg(err, "Failed to save the city"));
    }
    setBusy(false);
  };

  const remove = async (city) => {
    if (
      !window.confirm(
        `Delete "${city.name}"?\n\nThis also deletes its ${city.stop_count} stop(s) and ` +
          `${city.route_count} route(s). Existing trips keep working but will have no stops.`
      )
    ) {
      return;
    }
    try {
      await api.delete(`/transport/admin/cities/${city.slug}/`);
      notify(`Deleted ${city.name}`);
      onReload();
    } catch (err) {
      alert(errMsg(err, "Failed to delete the city"));
    }
  };

  return (
    <>
      <PageToolbar>
        <button onClick={() => open(null)} className="glass-btn-primary flex items-center gap-2">
          <Building2 size={18} /> Add City
        </button>
        <button onClick={onReload} className="glass-btn-secondary flex items-center gap-2">
          <RefreshCw size={16} /> Refresh
        </button>
      </PageToolbar>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
        <Stat icon={Building2} label="Cities" value={cities.length} />
        <Stat
          icon={MapPin}
          label="Stops (all)"
          value={cities.reduce((n, c) => n + (c.stop_count || 0), 0)}
          tone="#009849"
        />
        <Stat
          icon={CheckCircle2}
          label="Routable stops"
          value={cities.reduce((n, c) => n + (c.routable_stop_count || 0), 0)}
          tone="#0B7C3E"
        />
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200/60">
              <th className="px-6 py-4 text-left glass-label">City</th>
              <th className="px-6 py-4 text-left glass-label">Slug</th>
              <th className="px-6 py-4 text-left glass-label">Stops</th>
              <th className="px-6 py-4 text-left glass-label">Routable</th>
              <th className="px-6 py-4 text-left glass-label">Fare / km</th>
              <th className="px-6 py-4 text-left glass-label">Last import</th>
              <th className="px-6 py-4 text-left glass-label">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cities.map((c) => (
              <tr key={c.slug} className="glass-table-row">
                <td className="px-6 py-4">
                  <span className="font-semibold text-slate-800">{c.name}</span>
                  <span className="block text-xs text-slate-400">
                    {[c.state_name, c.country].filter(Boolean).join(", ") || "—"}
                  </span>
                </td>
                <td className="px-6 py-4"><span className="glass-mono text-sm text-slate-600">{c.slug}</span></td>
                <td className="px-6 py-4"><span className="glass-mono text-sm">{fmtNum(c.stop_count)}</span></td>
                <td className="px-6 py-4"><span className="glass-mono text-sm">{fmtNum(c.routable_stop_count)}</span></td>
                <td className="px-6 py-4">
                  <span className="glass-mono text-sm text-slate-700">₹{fmtNum(c.fare_per_km)}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs text-slate-500">
                    {c.last_import ? c.last_import.filename : "never"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="flex items-center gap-2">
                    <button
                      onClick={() => open(c)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2 py-1 rounded-lg hover:bg-slate-100 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(c)}
                      className="text-xs font-semibold text-red-600 hover:text-red-800 px-2 py-1 rounded-lg hover:bg-red-50 transition"
                    >
                      Delete
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {cities.length === 0 && (
          <EmptyState
            icon={Building2}
            title="No cities yet"
            description="Add a city here, or upload a corpus file from the Upload tab."
          />
        )}
      </div>

      {editing !== null && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-card-strong w-full max-w-2xl animate-glass-fade-in" style={{ borderRadius: "24px" }}>
            <div className="flex items-center justify-between p-6 border-b border-slate-200/60">
              <h2 className="text-xl font-semibold text-slate-800">
                {editing.slug ? `Edit ${editing.name}` : "New city"}
              </h2>
              <button onClick={() => setEditing(null)} className="p-2 hover:bg-white/60 rounded-xl text-slate-500">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={save} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Name" required>
                <input
                  className="glass-input" required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Lucknow"
                />
              </Field>
              <Field label="Slug" hint="Leave blank to derive from the name">
                <input
                  className="glass-input" value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="lucknow"
                />
              </Field>
              <Field label="State">
                <input
                  className="glass-input" value={form.state_name}
                  onChange={(e) => setForm({ ...form, state_name: e.target.value })}
                />
              </Field>
              <Field label="Country">
                <input
                  className="glass-input" value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </Field>
              <Field label="Fare per km (₹)">
                <input
                  className="glass-input" type="number" step="0.25" min="0"
                  value={form.fare_per_km}
                  onChange={(e) => setForm({ ...form, fare_per_km: e.target.value })}
                />
              </Field>
              <Field label="Platform fee (₹)">
                <input
                  className="glass-input" type="number" step="0.5" min="0"
                  value={form.platform_fee}
                  onChange={(e) => setForm({ ...form, platform_fee: e.target.value })}
                />
              </Field>
              <Field label="Rounding">
                <select
                  className="glass-select" value={form.rounding_rule}
                  onChange={(e) => setForm({ ...form, rounding_rule: e.target.value })}
                >
                  {ROUNDING_RULES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Corridor (m)" hint="How far a stop may sit off the route">
                <input
                  className="glass-input" type="number" min="0" value={form.corridor_m}
                  onChange={(e) => setForm({ ...form, corridor_m: e.target.value })}
                />
              </Field>
              <Field label="Max walk to stop (m)">
                <input
                  className="glass-input" type="number" min="0" value={form.max_walk_to_stop_m}
                  onChange={(e) => setForm({ ...form, max_walk_to_stop_m: e.target.value })}
                />
              </Field>
              <Field label="Currency">
                <input
                  className="glass-input" value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                />
              </Field>
              <div className="md:col-span-2 flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="glass-btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="glass-btn-primary flex items-center gap-2 disabled:opacity-60">
                  <Save size={16} /> {busy ? "Saving…" : "Save city"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------- sub: upload */

function UploadPanel({ cities, onReload, notify }) {
  const [file, setFile] = useState(null);
  const [citySlug, setCitySlug] = useState("");
  const [cityName, setCityName] = useState("");
  const [fare, setFare] = useState("");
  const [mode, setMode] = useState("validate");
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const submit = async (asMode) => {
    if (!file) {
      alert("Choose a file first.");
      return;
    }
    setBusy(true);
    setMode(asMode);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", asMode);
      if (citySlug) fd.append("city_slug", citySlug);
      if (cityName) fd.append("city_name", cityName);
      if (fare) fd.append("fare_per_km", fare);
      const res = await api.post("/transport/admin/onboarding/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setReport(res.data?.data || null);
      if (asMode === "apply") {
        notify(`Imported into ${cityName || citySlug}`);
        setFile(null);
        setCityName("");
        setFare("");
        if (fileRef.current) fileRef.current.value = "";
        onReload();
      }
    } catch (err) {
      setReport(null);
      alert(errMsg(err, "Upload failed"));
    }
    setBusy(false);
  };

  const targetLabel =
    citySlug ? cities.find((c) => c.slug === citySlug)?.name : cityName || "(new city)";

  return (
    <>
      <PageToolbar>
        <button
          onClick={() => submit("validate")}
          disabled={busy || !file}
          className="glass-btn-secondary flex items-center gap-2 disabled:opacity-50"
        >
          <FileSpreadsheet size={16} /> Dry run
        </button>
        <button
          onClick={() => submit("apply")}
          disabled={busy || !file || !report}
          className="glass-btn-primary flex items-center gap-2 disabled:opacity-50"
          title={!report ? "Run a dry run first — it shows exactly what would change" : ""}
        >
          <Upload size={16} /> {mode === "apply" && busy ? "Importing…" : "Apply import"}
        </button>
      </PageToolbar>

      <div className="glass-card p-6 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="File" required hint="CSV, XLSX or JSON · route-corpus format is detected automatically">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xlsm,.json"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setReport(null); }}
              className="glass-input py-2"
            />
          </Field>
          <Field label="Into city" hint="Pick an existing city, or type a new name below">
            <select
              className="glass-select" value={citySlug}
              onChange={(e) => { setCitySlug(e.target.value); if (e.target.value) setCityName(""); }}
            >
              <option value="">— new city —</option>
              {cities.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name} ({c.stop_count} stops)</option>
              ))}
            </select>
          </Field>
          <Field label="New city name" hint={citySlug ? "Ignored — an existing city is selected" : ""}>
            <input
              className="glass-input" value={cityName} disabled={!!citySlug}
              onChange={(e) => setCityName(e.target.value)}
              placeholder="Kanpur"
            />
          </Field>
          <Field label="Fare per km (₹)" hint="Optional — only used when creating a new city">
            <input
              className="glass-input" type="number" step="0.25" min="0" value={fare}
              onChange={(e) => setFare(e.target.value)} placeholder="9"
            />
          </Field>
        </div>

        <div className="glass-card-subtle p-4 mt-5">
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            <strong className="text-slate-700">Dry run first.</strong> It parses the file and
            reports the plan without writing anything — you see conflicts, unresolved rows and how
            many stops already exist before anything changes. Coordinates are never invented: a row
            with no coordinates is kept as an explicit UNRESOLVED record, and an out-of-range or
            (0, 0) pair is rejected outright.
          </p>
        </div>
      </div>

      {report && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-800">
              {report.stage === "applied" ? "Import result" : "Dry-run plan"}
            </h3>
            <span className={report.applied ? "glass-badge-success" : "glass-badge-warning"}>
              {report.applied ? "written" : "nothing written"}
            </span>
          </div>

          <p className="text-xs text-slate-500 mb-4">
            <span className="glass-mono">{report.dataset_kind}</span> ·{" "}
            <span className="glass-mono">{report.source?.file}</span>
            {report.source?.file_sha256 && (
              <> · sha256 <span className="glass-mono">{report.source.file_sha256.slice(0, 12)}…</span></>
            )}
            {report.city?.slug ? <> · <strong>{report.city.slug}</strong></> : null}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <Metric label="Rows read" value={report.report?.rows} />
            <Metric label="Stop instances" value={report.report?.stop_instances} />
            <Metric label="Unique stops" value={report.report?.unique_names} />
            <Metric label="Serviceable" value={report.report?.serviceable} />
            {!report.applied && (
              <>
                <Metric label="Already present" value={report.report?.already_present} />
                <Metric label="Would create" value={report.report?.would_create} />
              </>
            )}
            {report.applied && (
              <>
                <Metric label="Created" value={report.report?.created} />
                <Metric label="Updated" value={report.report?.updated} />
              </>
            )}
            <Metric label="Conflicts" value={(report.report?.conflicts || []).length} />
            <Metric label="Unresolved" value={report.report?.unresolved} />
          </div>

          {report.report?.status_breakdown && (
            <p className="text-xs text-slate-500 mb-4">
              Coordinate status:{" "}
              {Object.entries(report.report.status_breakdown).map(([k, v]) => (
                <span key={k} className="glass-mono ml-2">{k}={v}</span>
              ))}
            </p>
          )}

          <NotesList title="Conflicts (routing is disabled for these)" notes={report.report?.conflicts} />
          <NotesList title="Errors (rows rejected)" notes={report.errors} />
          <NotesList title="Warnings (rows kept but not routable)" notes={report.warnings} />

          <div className="mt-5 glass-card-subtle p-4">
            <p className="text-xs text-slate-500">
              Target: <strong>{targetLabel}</strong>
              {report.applied
                ? " — re-importing is non-destructive: stops are matched on (city, name) so existing trips keep working."
                : " — nothing has been written yet."}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <div className="space-y-1.5">
      <label className="glass-label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-400 leading-snug">{hint}</p>}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="glass-card-subtle px-4 py-3">
      <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{label}</p>
      <p className="glass-mono text-lg text-slate-800 mt-0.5">{fmtNum(value)}</p>
    </div>
  );
}

function NotesList({ title, notes }) {
  if (!notes || notes.length === 0) return null;
  const items = notes.map((n) =>
  typeof n === "string" ? n : n.error || n.warning || JSON.stringify(n)
);
  return (
    <div className="mt-4">
      <p className="glass-label mb-2">{title} ({items.length})</p>
      <ul className="text-xs text-slate-500 space-y-1 max-h-40 overflow-y-auto">
        {items.slice(0, 12).map((n, i) => (
          <li key={i} className="flex gap-2">
            <AlertTriangle size={12} className="shrink-0 mt-0.5 opacity-60" />
            <span>{n}</span>
          </li>
        ))}
        {items.length > 12 && <li className="opacity-60">…and {items.length - 12} more</li>}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------------- sub: stops */

const PAGE_SIZE = 25;

function StopsPanel({ cities }) {
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("");
  const [serviceable, setServiceable] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [stops, setStops] = useState([]);
  const [count, setCount] = useState(0);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (city) params.set("city", city);
      if (status) params.set("coordinate_status", status);
      if (serviceable) params.set("serviceable", serviceable);
      if (search) params.set("q", search);

      const s = new URLSearchParams();
      if (city) s.set("city", city);
      if (status) s.set("coordinate_status", status);
      if (serviceable) s.set("serviceable", serviceable);

      // Both requests at once. Awaited one after the other they took twice as
      // long, and every extra millisecond is extra time the list spends in the
      // loading state.
      const [res, sres] = await Promise.all([
        api.get(`/transport/admin/stops/?${params.toString()}`),
        api.get(`/transport/admin/stops/summary/?${s.toString()}`),
      ]);
      setStops(rowsOf(res.data));
      setCount(res.data?.count ?? 0);
      setSummary(sres.data?.data || sres.data || null);
    } catch (err) {
      alert(errMsg(err, "Failed to load stops"));
    }
    setLoading(false);
  }, [city, status, serviceable, search, offset]);

  // A filter change invalidates the page number, so it resets in the handlers
  // that change the filter. Resetting it from a separate effect fired a second
  // render - and a wasted fetch at the old offset - after every change.
  const changeFilter = (setter) => (value) => {
    setter(value);
    setOffset(0);
  };

  useEffect(() => { load(); }, [load]);

  const chips = [
    { key: "", label: "All" },
    { key: "verified", label: "Verified" },
    { key: "provisional", label: "Provisional" },
    { key: "conflict", label: "Conflict" },
    { key: "unresolved", label: "Unresolved" },
  ];

  return (
    <>
      <PageToolbar>
        <select className="glass-select w-56" value={city} onChange={(e) => changeFilter(setCity)(e.target.value)}>
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <input
          className="glass-input w-64" placeholder="Search stop name…"
          value={search} onChange={(e) => changeFilter(setSearch)(e.target.value)}
        />
        <select
          className="glass-select w-44" value={serviceable}
          onChange={(e) => changeFilter(setServiceable)(e.target.value)}
        >
          <option value="">Any</option>
          <option value="1">Serviceable</option>
          <option value="0">Not serviceable</option>
        </select>
        <button onClick={load} className="glass-btn-secondary flex items-center gap-2">
          <RefreshCw size={16} /> Refresh
        </button>
      </PageToolbar>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => changeFilter(setStatus)(c.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              status === c.key
                ? "bg-slate-800 text-white"
                : "glass-card-subtle text-slate-600 hover:bg-white/70"
            }`}
          >
            {c.label}
            {summary?.by_coordinate_status?.[c.key] !== undefined && (
              <span className="ml-1.5 opacity-70">{summary.by_coordinate_status[c.key]}</span>
            )}
          </button>
        ))}
        {summary && (
          <span className="text-xs text-slate-400 ml-2">
            {summary.total} total · {summary.serviceable} serviceable ·{" "}
            {summary.non_serviceable} not
          </span>
        )}
      </div>

      <div className="glass-card overflow-x-auto relative">
        {/* Spinner only while there is nothing to show yet. Once rows exist they
            stay mounted and just dim, because swapping a full table for a
            spinner collapses the card to a fraction of its height and then
            expands it again - which is the most visible part of the jump. */}
        {loading && stops.length === 0 && <Loader />}
        {stops.length > 0 && (
          <table
            className={`w-full transition-opacity duration-150 ${
              loading ? "opacity-45 pointer-events-none" : "opacity-100"
            }`}
          >
            <thead>
              <tr className="border-b border-slate-200/60">
                <th className="px-6 py-4 text-left glass-label">Stop</th>
                <th className="px-6 py-4 text-left glass-label">City</th>
                <th className="px-6 py-4 text-left glass-label">Coordinates</th>
                <th className="px-6 py-4 text-left glass-label">Coordinate status</th>
                <th className="px-6 py-4 text-left glass-label">Serviceable</th>
                <th className="px-6 py-4 text-left glass-label">Reason</th>
                <th className="px-6 py-4 text-left glass-label">Routable</th>
              </tr>
            </thead>
            <tbody>
              {stops.map((s) => (
                <tr key={s.id} className="glass-table-row">
                  <td className="px-6 py-4">
                    <span className="font-semibold text-slate-800">{s.name}</span>
                    {s.aliases?.length > 1 && (
                      <span className="block text-[11px] text-slate-400">
                        +{s.aliases.length - 1} alias
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4"><span className="text-sm text-slate-600">{s.city_slug}</span></td>
                  <td className="px-6 py-4">
                    <span className="glass-mono text-xs text-slate-600">
                      {s.lat === null ? "no coordinates" : `${Number(s.lat).toFixed(5)}, ${Number(s.lng).toFixed(5)}`}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={STATUS_STYLES[s.coordinate_status] || "glass-badge-muted"}>
                      {s.coordinate_status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={SERVICEABLE_STYLES[String(s.serviceable)]}>
                      {s.serviceable ? "yes" : "no"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-slate-400">{s.serviceability_reason || "—"}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={s.is_routable ? "glass-badge-success" : "glass-badge-muted"}>
                      {s.is_routable ? "yes" : "no"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && stops.length === 0 && (
          <EmptyState
            icon={MapPin}
            title="No stops match"
            description="Try a different city, status or search term."
          />
        )}
      </div>

      {count > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-slate-500">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, count)} of {count}
          </span>
          <span className="flex items-center gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="glass-btn-secondary flex items-center gap-1 disabled:opacity-40"
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= count}
              className="glass-btn-secondary flex items-center gap-1 disabled:opacity-40"
            >
              Next <ChevronRight size={16} />
            </button>
          </span>
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- sub: fares */

function FaresPanel({ onReload, notify }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(null);
  const [probe, setProbe] = useState({ city: "", km: "8" });
  const [quote, setQuote] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/operations/fare-configurations/");
      const list = rowsOf(res.data);
      setRows(list);
      setDrafts(Object.fromEntries(list.map((c) => [c.city, {
        fare_per_km: c.fare_per_km, platform_fee: c.platform_fee,
        rounding_rule: c.rounding_rule, currency: c.currency,
      }])));
      if (!probe.city && list.length) setProbe((p) => ({ ...p, city: list[0].city }));
    } catch (err) {
      alert(errMsg(err, "Failed to load fares"));
    }
    setLoading(false);
  }, [probe.city]);

  useEffect(() => { load(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (slug) => {
    setSaving(slug);
    try {
      await api.post("/operations/fare-configurations/", { city: slug, ...drafts[slug] });
      notify(`Fare updated for ${slug}`);
      onReload();
      load();
    } catch (err) {
      alert(errMsg(err, "Failed to save the fare"));
    }
    setSaving(null);
  };

  const runQuote = async () => {
    try {
      const res = await api.post("/operations/fare-configurations/quote/", {
        city: probe.city, route_distance_m: Number(probe.km) * 1000,
      });
      setQuote(res.data?.data || res.data);
    } catch (err) {
      alert(errMsg(err, "Could not compute a quote"));
    }
  };

  return (
    <>
      <PageToolbar>
        <button onClick={load} className="glass-btn-secondary flex items-center gap-2">
          <RefreshCw size={16} /> Refresh
        </button>
      </PageToolbar>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
        <Stat icon={Building2} label="Cities with pricing" value={rows.length} />
        <Stat
          icon={IndianRupee}
          label="Average rate / km"
          value={rows.length
            ? `₹${(rows.reduce((n, c) => n + Number(c.fare_per_km || 0), 0) / rows.length).toFixed(2)}`
            : "—"}
          tone="#009849"
        />
        <Stat
          icon={AlertTriangle}
          label="Cities at ₹0"
          value={rows.filter((c) => Number(c.fare_per_km) === 0).length}
          tone="#B45309"
        />
      </div>

      {loading ? (
        <Loader />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 glass-card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200/60">
                  <th className="px-6 py-4 text-left glass-label">City</th>
                  <th className="px-6 py-4 text-left glass-label">₹ / km</th>
                  <th className="px-6 py-4 text-left glass-label">Platform fee</th>
                  <th className="px-6 py-4 text-left glass-label">Rounding</th>
                  <th className="px-6 py-4 text-left glass-label">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.city} className="glass-table-row">
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-800">{c.city_name}</span>
                      <span className="block text-xs text-slate-400">{c.city}</span>
                    </td>
                    <td className="px-6 py-4">
                      <input
                        className="glass-input w-24" type="number" step="0.25" min="0"
                        value={drafts[c.city]?.fare_per_km ?? ""}
                        onChange={(e) => setDrafts({ ...drafts, [c.city]: { ...drafts[c.city], fare_per_km: e.target.value } })}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        className="glass-input w-24" type="number" step="0.5" min="0"
                        value={drafts[c.city]?.platform_fee ?? ""}
                        onChange={(e) => setDrafts({ ...drafts, [c.city]: { ...drafts[c.city], platform_fee: e.target.value } })}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <select
                        className="glass-select w-52"
                        value={drafts[c.city]?.rounding_rule || "none"}
                        onChange={(e) => setDrafts({ ...drafts, [c.city]: { ...drafts[c.city], rounding_rule: e.target.value } })}
                      >
                        {ROUNDING_RULES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => save(c.city)}
                        disabled={saving === c.city}
                        className="glass-btn-primary flex items-center gap-1.5 disabled:opacity-60"
                      >
                        <Save size={14} /> {saving === c.city ? "Saving…" : "Save"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <EmptyState icon={IndianRupee} title="No pricing configured" description="Add a city first." />
            )}
          </div>

          <div className="glass-card p-6 self-start">
            <h3 className="text-base font-semibold text-slate-800 mb-1">Fare calculator</h3>
            <p className="text-xs text-slate-400 mb-4">
              Same engine the trip preview calls — the rider is charged exactly this.
            </p>
            <div className="space-y-3">
              <Field label="City">
                <select
                  className="glass-select" value={probe.city}
                  onChange={(e) => { setProbe({ ...probe, city: e.target.value }); setQuote(null); }}
                >
                  {rows.map((c) => (
                    <option key={c.city} value={c.city}>{c.city_name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Distance (km)">
                <input
                  className="glass-input" type="number" step="0.1" min="0" value={probe.km}
                  onChange={(e) => { setProbe({ ...probe, km: e.target.value }); setQuote(null); }}
                />
              </Field>
              <button onClick={runQuote} className="w-full glass-btn-primary py-2.5">
                Calculate
              </button>
            </div>

            {quote && (
              <div className="mt-5 glass-card-subtle p-4 space-y-1.5">
                <Line k="Distance" v={`${quote.distance_km} km`} />
                <Line k="Rate" v={`₹${quote.rate_per_km}/km`} />
                <Line k="Base fare" v={`₹${quote.base_fare}`} />
                <Line k="Platform fee" v={`₹${quote.platform_fee}`} />
                <div className="border-t border-slate-200/60 pt-2 mt-2">
                  <Line k="Rider pays" v={`₹${quote.buddy_fare}`} big />
                </div>
                <Line k="Driver earns" v={`₹${quote.marshal_earning}`} />
                <p className="text-[11px] text-slate-400 pt-2 leading-snug">{quote.formula}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Line({ k, v, big }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{k}</span>
      <span className={big ? "glass-title-sm text-slate-900" : "glass-mono text-slate-700"}>{v}</span>
    </div>
  );
}

/* --------------------------------------------------------------- the page */

const TABS = [
  { id: "cities", label: "Cities", icon: Building2 },
  { id: "upload", label: "Upload stops", icon: Upload },
  { id: "stops", label: "Stops", icon: MapPin },
  { id: "fares", label: "Fares", icon: IndianRupee },
];

export default function DynamicRouting() {
  const [tab, setTab] = useState("cities");
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const scrollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/transport/admin/cities/?all=1");
      setCities(rowsOf(res.data));
    } catch (err) {
      alert(errMsg(err, "Failed to load cities"));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  };

  // Reset to the top when the sub-panel changes. Without this the container keeps
  // the previous panel's scrollTop: a short panel clamps it and a tall one leaves
  // you stranded mid-table, which reads as the whole page jumping. Assigning
  // scrollTop directly (rather than scrollTo with "smooth") is deliberate -
  // smooth would animate the jump instead of removing it.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [tab]);

  if (loading) return <Loader />;

  // The sub-nav is a SIBLING of the scroll box, matching FixedRouting. Wrapping
  // the panels instead would nest a scroll container around the one they already
  // manage, and the two would fight over the wheel.
  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-6 md:px-8 pt-4 md:pt-5 pb-1">
        <div className="flex items-center gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition ${
                active
                  ? "bg-slate-800 text-white shadow-sm"
                  : "glass-card-subtle text-slate-600 hover:bg-white/70"
              }`}
            >
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
        </div>
      </div>

      {/* flex-1 + min-h-0 gives the panels a definite height; min-h stops a short
          panel from shrinking the box and re-clamping scrollTop. */}
      <div
        ref={scrollRef}
        data-scroll
        className="flex-1 min-h-[420px] overflow-y-auto px-6 md:px-8 pt-4 pb-6 md:pb-8"
      >
        {toast && (
          <div className="glass-card-strong px-5 py-3 mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800 animate-glass-fade-in">
            <CheckCircle2 size={16} className="text-emerald-600" /> {toast}
          </div>
        )}

        {tab === "cities" && <CitiesPanel cities={cities} onReload={load} notify={notify} />}
        {tab === "upload" && <UploadPanel cities={cities} onReload={load} notify={notify} />}
        {tab === "stops" && <StopsPanel cities={cities} />}
        {tab === "fares" && <FaresPanel onReload={load} notify={notify} />}
      </div>
    </div>
  );
}