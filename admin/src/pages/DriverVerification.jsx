import { useState, useEffect, cloneElement } from "react";
import {
  ShieldCheck,
  Search,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  FileText,
  Car,
  User,
  Mail,
  Phone,
  CreditCard,
  AlertTriangle,
  CalendarClock,
  ExternalLink,
} from "lucide-react";
import api from "../api/client";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import PageToolbar from "../components/PageToolbar";

const API_BASE = import.meta.env.VITE_API_URL || "";

const mimeFor = (name) => {
  const ext = (name || "").split(".").pop().toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "pdf") return "application/pdf";
  return "image/jpeg";
};

const imgSrc = (v) => {
  if (!v) return null;
  if (v.startsWith("data:") || v.startsWith("http")) return v;
  return `data:image/jpeg;base64,${v}`;
};

const docSrc = (doc) => {
  if (!doc?.file_data) return null;
  return `data:${mimeFor(doc.file_name)};base64,${doc.file_data}`;
};

function InfoCard({ icon, label, value }) {
  return (
    <div className="glass-card p-3 relative overflow-hidden flex flex-col">
      {/* Very subtle ambient blue/lavender wash */}
      <div
        className="pointer-events-none absolute -top-8 -right-8 h-16 w-16 rounded-full"
        style={{ background: "radial-gradient(closest-side, rgb(var(--accent-blue-rgb) / 0.12), transparent)" }}
      />
      {/* Label + small secondary visual */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">{label}</span>
        <span className="shrink-0" style={{ color: "var(--accent-blue)" }}>
          {cloneElement(icon, { size: 13, strokeWidth: 2 })}
        </span>
      </div>
      {/* Value — primary focus */}
      <p className="relative z-10 mt-1 text-sm font-semibold text-slate-800 truncate">{value}</p>
      {/* Quiet supporting area keeps equal heights */}
      <div className="relative z-10 flex-1" />
    </div>
  );
}

export default function DriverVerification() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [processing, setProcessing] = useState(null);

  useEffect(() => { fetchDrivers(); }, []);

  const fetchDrivers = () => {
    setLoading(true);
    api
      .get("/operations/admin/drivers/pending/")
      .then((res) => {
        const data = res.data?.data || res.data || [];
        setDrivers(Array.isArray(data) ? data : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleDriverAction = async (driverId, action) => {
    setProcessing(driverId);
    try {
      await api.patch(`/operations/admin/drivers/${driverId}/verify/`, { action });
      setDrivers((prev) => prev.filter((d) => d.id !== driverId));
      if (expanded === driverId) setExpanded(null);
    } catch (err) { console.error("Verification error:", err); alert("Verification failed"); } finally {
      setProcessing(null);
    }
  };

  const handleDocAction = async (docId, action) => {
    let payload = { action };
    if (action === "reject") {
      const reason = window.prompt("Rejection reason (shown to the driver):", "");
      if (reason === null) return;
      payload = { action, rejection_reason: reason };
    }
    setProcessing(docId);
    try {
      await api.patch(`/operations/admin/documents/${docId}/verify/`, payload);
      setDrivers((prev) =>
        prev.map((d) => ({
          ...d,
          documents: d.documents.map((doc) =>
            doc.id === docId ? { ...doc, status: action === "approve" ? "VERIFIED" : "REJECTED" } : doc
          ),
        }))
      );
    } catch (err) { console.error("Verification error:", err); alert("Verification failed"); } finally {
      setProcessing(null);
    }
  };

  const filtered = drivers.filter(
    (d) =>
      `${d.first_name} ${d.last_name} ${d.email} ${d.profile?.vehicle_number || ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  const docStatusLabel = (status) => {
    if (status === "VERIFIED" || status === "verified")
      return <span className="glass-badge-success text-[10px]"><CheckCircle size={10} className="inline mr-1" />Verified</span>;
    if (status === "REJECTED" || status === "rejected")
      return <span className="glass-badge-danger text-[10px]"><XCircle size={10} className="inline mr-1" />Rejected</span>;
    return <span className="glass-badge-warning text-[10px]"><AlertTriangle size={10} className="inline mr-1" />Pending</span>;
  };

  return (
    <div className="pt-4 pb-6 px-6 md:pt-5 md:pb-8 md:px-8 h-full overflow-y-auto">
      <PageToolbar>
        <div className="relative w-72 max-w-full">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drivers..."
            className="glass-input pl-10 w-full"
          />
        </div>
      </PageToolbar>

      {loading ? (
        <Loader />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No pending verifications"
          description="All drivers have been reviewed."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((driver, index) => (
            <div key={driver.id} className="glass-card overflow-hidden animate-glass-fade-in"
              style={{ animationDelay: `${index * 60}ms` }}>
              <div
                className="flex items-center justify-between p-6 cursor-pointer hover:bg-white/30 transition-all duration-200"
                onClick={() => setExpanded(expanded === driver.id ? null : driver.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold uppercase"
                    style={{ background: "rgb(var(--accent-blue-rgb) / 0.08)", border: "1px solid rgb(var(--accent-blue-rgb) / 0.15)", color: "var(--accent-blue)" }}>
                    {(driver.first_name?.[0] || driver.email[0])}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{driver.first_name} {driver.last_name || ""}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-500 flex items-center gap-1"><Mail size={12} /> {driver.email}</span>
                      <span className="glass-badge uppercase text-[10px]">{driver.role}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {driver.vehicle && (
                    <span className="glass-badge-success text-[10px]">
                      <Car size={10} className="inline mr-1" />{driver.vehicle.vehicle_number}
                    </span>
                  )}
                  {expanded === driver.id ? <ChevronUp size={20} className="text-slate-500" /> : <ChevronDown size={20} className="text-slate-500" />}
                </div>
              </div>

              {expanded === driver.id && (
                <div className="border-t border-slate-200/60 p-6 space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <InfoCard icon={<User size={16} />} label="Display Name" value={driver.profile?.display_name || "\u2014"} />
                    <InfoCard icon={<Phone size={16} />} label="Phone" value={driver.profile?.phone_number || "\u2014"} />
                    <InfoCard icon={<CreditCard size={16} />} label="License" value={driver.profile?.license_number || "\u2014"} />
                    <InfoCard icon={<Car size={16} />} label="Vehicle Type" value={driver.profile?.vehicle_type || "\u2014"} />
                    <InfoCard icon={<CreditCard size={16} />} label="RC Number" value={driver.profile?.rc_number || "\u2014"} />
                    <InfoCard icon={<User size={16} />} label="Gender" value={driver.profile?.gender || "\u2014"} />
                    <InfoCard icon={<User size={16} />} label="DOB" value={driver.profile?.dob || "\u2014"} />
                    <InfoCard icon={<CalendarClock size={16} />} label="Joined" value={driver.date_joined ? new Date(driver.date_joined).toLocaleDateString() : "\u2014"} />
                  </div>

                  {driver.profile?.bio && (
                    <p className="text-sm text-slate-600 glass-card-subtle rounded-xl px-4 py-2">{driver.profile.bio}</p>
                  )}

                  {driver.vehicle && (
                    <div className="glass-card-subtle rounded-xl p-4">
                      <h4 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2"><Car size={14} /> Vehicle Details</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div><span className="text-slate-500">Number:</span> <span className="font-semibold">{driver.vehicle.vehicle_number}</span></div>
                        <div><span className="text-slate-500">Type:</span> <span className="font-semibold capitalize">{driver.vehicle.vehicle_type}</span></div>
                        <div>
                          <span className="text-slate-500">Status:</span>{" "}
                          <span className="font-semibold capitalize">{String(driver.vehicle.status).replace("_", " ")}</span>
                          {driver.vehicle.is_active === false && (
                            <span className="glass-badge-danger text-[10px] ml-2">Inactive</span>
                          )}
                        </div>
                      </div>
                      {imgSrc(driver.vehicle.vehicle_photo) && (
                        <img
                          src={imgSrc(driver.vehicle.vehicle_photo)}
                          alt="Vehicle registration"
                          className="mt-3 max-h-40 rounded-xl border border-slate-200/60 object-contain"
                        />
                      )}
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2"><FileText size={14} /> Documents</h4>
                    {driver.documents.length === 0 ? (
                      <p className="text-sm text-slate-500">No documents uploaded</p>
                    ) : (
                      <div className="space-y-2">
                        {driver.documents.map((doc) => (
                          <div key={doc.id} className="glass-card-subtle rounded-xl px-4 py-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <FileText size={16} style={{ color: "var(--accent-blue)" }} />
                                <div>
                                  <span className="text-sm font-semibold text-slate-800">{doc.document_type}</span>
                                  {doc.rejection_reason && <p className="text-xs text-red-500 mt-0.5">{doc.rejection_reason}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {docStatusLabel(doc.status)}
                                {(doc.status === "PENDING" || doc.status === "pending") && (
                                  <div className="flex gap-1">
                                    <button disabled={processing === doc.id} onClick={() => handleDocAction(doc.id, "approve")} className="glass-btn-success px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
                                      Approve
                                    </button>
                                    <button disabled={processing === doc.id} onClick={() => handleDocAction(doc.id, "reject")} className="glass-btn-danger px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
                                      Reject
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            {doc.file_data && (
                              <div className="mt-3">
                                <a href={`${API_BASE}/operations/admin/documents/${doc.id}/file/`} target="_blank" rel="noopener noreferrer" className="block">
                                  {mimeFor(doc.file_name) === "application/pdf" ? (
                                    <div className="flex items-center gap-2 glass-card-subtle rounded-xl px-4 py-3 text-xs hover:bg-white/50 transition-all duration-200">
                                      <FileText size={14} /><span className="font-semibold text-slate-800">{doc.file_name || "Document"}</span>
                                      <span className="flex items-center gap-1 ml-auto">Open file <ExternalLink size={10} /></span>
                                    </div>
                                  ) : (
                                    <img
                                      src={docSrc(doc)}
                                      alt={doc.document_type}
                                      className="max-h-48 rounded-xl border border-slate-200/60 object-contain hover:shadow-lg transition-all duration-200 cursor-pointer"
                                    />
                                  )}
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      disabled={processing === driver.id}
                      onClick={() => handleDriverAction(driver.id, "approve")}
                      className="glass-btn-success px-6 py-3 font-semibold disabled:opacity-50 flex items-center gap-2"
                    >
                      <CheckCircle size={16} />
                      {processing === driver.id ? "Processing..." : "Approve Driver"}
                    </button>
                    <button
                      disabled={processing === driver.id}
                      onClick={() => handleDriverAction(driver.id, "reject")}
                      className="glass-btn-danger px-6 py-3 font-semibold disabled:opacity-50 flex items-center gap-2"
                    >
                      <XCircle size={16} />
                      Reject Driver
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
