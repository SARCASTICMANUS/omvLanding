import { useState, useEffect, useMemo } from "react";
import { Plus, Save, X, IndianRupee, Route, Clock, BadgeCheck } from "lucide-react";
import api from "../api/client";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import PageToolbar from "../components/PageToolbar";

const VEHICLE_LABELS = {
  auto: "Auto-Rickshaw",
  bike: "Bike",
};

const EMPTY_FORM = { vehicle_type: "auto", base_fare: "", per_km_rate: "" };

const formatINR = (paise) =>
  (Number(paise || 0) / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  });

const toPaise = (rupees) => Math.round(Number(rupees) * 100);

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const errorMessage = (err, fallback) =>
  err?.response?.data?.message || err?.response?.data?.detail || fallback;

export default function FareConfigurations() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => { fetchConfigs(); }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await api.get("/operations/fare-configurations/");
      // The endpoint answers { results: [...], count: n }; the old
      // `res.data?.data` read matched nothing, so this table rendered empty.
      const body = res.data;
      setConfigs(
        Array.isArray(body) ? body : body?.results || body?.data || []
      );
    } catch (err) {
      alert(errorMessage(err, "Failed to load fare configurations"));
    }
    setLoading(false);
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setModal(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/operations/fare-configurations/", {
        vehicle_type: form.vehicle_type,
        base_fare: toPaise(form.base_fare),
        per_km_rate: toPaise(form.per_km_rate),
        is_active: true,
      });
      setModal(false);
      fetchConfigs();
    } catch (err) {
      alert(errorMessage(err, "Failed to save fare configuration"));
    }
    setSaving(false);
  };

  const activeConfigs = useMemo(() => configs.filter((c) => c.is_active), [configs]);
  const totalVehiclesCovered = activeConfigs.length;

  return (
    <div data-scroll className="pt-4 pb-6 px-6 md:pt-5 md:pb-8 md:px-8 h-full overflow-y-auto">
      <PageToolbar>
        <button onClick={openCreate} className="glass-btn-primary flex items-center gap-2">
          <Plus size={18} /> Add Configuration
        </button>
      </PageToolbar>

      {loading ? (
        <Loader />
      ) : (
        <>
          <div className="glass-card-subtle p-4 mb-5">
            <p className="text-xs text-slate-500 leading-relaxed">
              <strong className="text-slate-700">Superseded — use Dynamic Routing → Fares.</strong>{" "}
              Pricing on this backend is a per-city block (<span className="glass-mono">fare_per_km
              / platform_fee / rounding_rule</span>), which is what the fare engine actually reads
              and what trips are charged from. This page&apos;s per-vehicle-type shape
              (<span className="glass-mono">vehicle_type / base_fare / per_km_rate</span>) is not
              implemented server-side, so saving here will not change any fare.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
            <div className="glass-card-subtle p-5 relative overflow-hidden">
              <div className="gradient-blob blob-primary w-16 h-16 -top-4 -right-4" />
              <div className="relative z-10 flex items-center gap-3">
                <div className="glass-icon-tile">
                  <Route size={18} style={{ color: "var(--accent-blue)" }} />
                </div>
                <div className="min-w-0">
                  <p className="glass-label">Configurations</p>
                  <p className="glass-title-sm mt-0.5">{configs.length}</p>
                </div>
              </div>
            </div>

            <div className="glass-card-subtle p-5 relative overflow-hidden">
              <div className="gradient-blob blob-sky w-16 h-16 -top-4 -right-4" />
              <div className="relative z-10 flex items-center gap-3">
                <div className="glass-icon-tile">
                  <BadgeCheck size={18} style={{ color: "var(--accent-blue)" }} />
                </div>
                <div className="min-w-0">
                  <p className="glass-label">Active</p>
                  <p className="glass-title-sm mt-0.5">{activeConfigs.length}</p>
                </div>
              </div>
            </div>

            <div className="glass-card-subtle p-5 relative overflow-hidden">
              <div className="gradient-blob blob-indigo w-16 h-16 -top-4 -right-4" />
              <div className="relative z-10 flex items-center gap-3">
                <div className="glass-icon-tile">
                  <IndianRupee size={18} style={{ color: "var(--accent-blue)" }} />
                </div>
                <div className="min-w-0">
                  <p className="glass-label">Vehicle Types Covered</p>
                  <p className="glass-title-sm mt-0.5">{totalVehiclesCovered}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200/60">
                  <th className="px-6 py-4 text-left glass-label">Vehicle Type</th>
                  <th className="px-6 py-4 text-left glass-label">Base Fare</th>
                  <th className="px-6 py-4 text-left glass-label">Per KM Rate</th>
                  <th className="px-6 py-4 text-left glass-label">Effective From</th>
                  <th className="px-6 py-4 text-left glass-label">Status</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((c) => (
                  <tr key={c.id} className="glass-table-row">
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-800">
                        {VEHICLE_LABELS[c.vehicle_type] || c.vehicle_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="glass-mono text-sm text-slate-700">
                        {formatINR(c.base_fare)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="glass-mono text-sm text-slate-700">
                        {formatINR(c.per_km_rate)}<span className="text-slate-400">/km</span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 text-sm text-slate-500">
                        <Clock size={14} className="opacity-60" />
                        {formatDate(c.effective_from)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={c.is_active ? "glass-badge-success" : "glass-badge-warning"}>
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {configs.length === 0 && (
              <EmptyState
                icon={IndianRupee}
                title="No fare configurations yet"
                description="Set base fares and per-km rates for each vehicle type."
              />
            )}
          </div>
        </>
      )}

      {modal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card-strong w-full max-w-md animate-glass-fade-in" style={{ borderRadius: "24px" }}>
            <div className="flex items-center justify-between p-6 border-b border-slate-200/60">
              <h2 className="text-xl font-semibold text-slate-800">New Fare Configuration</h2>
              <button
                onClick={() => setModal(false)}
                className="p-2 hover:bg-white/60 rounded-xl text-slate-500 hover:text-slate-800 transition-all duration-200"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="glass-label">Vehicle Type</label>
                <select
                  name="vehicle_type"
                  value={form.vehicle_type}
                  onChange={handleChange}
                  required
                  className="glass-select"
                >
                  <option value="auto">Auto-Rickshaw</option>
                  <option value="bike">Bike</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="glass-label">Base Fare (₹)</label>
                  <input
                    name="base_fare"
                    type="number"
                    min="0"
                    step="1"
                    value={form.base_fare}
                    onChange={handleChange}
                    placeholder="e.g. 15"
                    required
                    className="glass-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="glass-label">Per KM Rate (₹)</label>
                  <input
                    name="per_km_rate"
                    type="number"
                    min="0"
                    step="1"
                    value={form.per_km_rate}
                    onChange={handleChange}
                    placeholder="e.g. 6"
                    required
                    className="glass-input"
                  />
                </div>
              </div>
              <div className="glass-card-subtle p-4">
                <p className="text-xs text-slate-500 font-medium">
                  Amounts are stored in the smallest currency unit (paise). Enter rupees here and they
                  will be converted automatically.
                </p>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full glass-btn-primary py-3.5 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Save size={16} /> {saving ? "Saving..." : "Create Configuration"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
