import { useState, useEffect } from "react";
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
} from "lucide-react";
import api from "../api/client";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";

const API_BASE = import.meta.env.VITE_API_URL || "";
const MEDIA_BASE = API_BASE.replace(/\/api\/?$/, "") || "";

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
    } catch {} finally {
      setProcessing(null);
    }
  };

  const handleDocAction = async (docId, action) => {
    setProcessing(docId);
    try {
      await api.patch(`/operations/admin/documents/${docId}/verify/`, { action });
      setDrivers((prev) =>
        prev.map((d) => ({
          ...d,
          documents: d.documents.map((doc) =>
            doc.id === docId ? { ...doc, status: action === "approve" ? "VERIFIED" : "REJECTED" } : doc
          ),
        }))
      );
    } catch {} finally {
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
      return <span className="memphis-badge bg-memphis-mint/20 text-memphis-ink border-memphis-mint text-[10px]"><CheckCircle size={10} className="inline mr-1" />Verified</span>;
    if (status === "REJECTED" || status === "rejected")
      return <span className="memphis-badge bg-memphis-coral/20 text-memphis-ink border-memphis-coral text-[10px]"><XCircle size={10} className="inline mr-1" />Rejected</span>;
    return <span className="memphis-badge bg-memphis-yellow/20 text-memphis-ink border-memphis-yellow text-[10px]"><AlertTriangle size={10} className="inline mr-1" />Pending</span>;
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="memphis-title">Driver Verification</h1>
          <p className="text-memphis-purple mt-2 font-medium">{drivers.length} pending verification(s)</p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-memphis-purple" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drivers..."
            className="memphis-input pl-10 w-72"
          />
        </div>
      </div>

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
          {filtered.map((driver) => (
            <div key={driver.id} className="memphis-card overflow-hidden">
              <div
                className="flex items-center justify-between p-6 cursor-pointer hover:bg-memphis-ink/5 transition-all duration-200"
                onClick={() => setExpanded(expanded === driver.id ? null : driver.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="memphis-icon-tile bg-memphis-pink">
                    <span className="text-sm font-bold text-memphis-ink uppercase">
                      {(driver.first_name?.[0] || driver.email[0])}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-memphis-ink">{driver.first_name} {driver.last_name || ""}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-memphis-purple flex items-center gap-1"><Mail size={12} /> {driver.email}</span>
                      <span className="memphis-badge bg-memphis-ink/5 text-memphis-ink border-memphis-ink/30 uppercase text-[10px]">{driver.role}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {driver.vehicle && (
                    <span className="memphis-badge bg-memphis-teal/20 text-memphis-ink border-memphis-teal text-[10px]">
                      <Car size={10} className="inline mr-1" />{driver.vehicle.vehicle_number}
                    </span>
                  )}
                  {expanded === driver.id ? <ChevronUp size={20} className="text-memphis-purple" /> : <ChevronDown size={20} className="text-memphis-purple" />}
                </div>
              </div>

              {expanded === driver.id && (
                <div className="border-t-2 border-memphis-ink/10 p-6 space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <InfoCard icon={<User size={16} />} label="Display Name" value={driver.profile?.display_name || "—"} />
                    <InfoCard icon={<Phone size={16} />} label="Phone" value={driver.profile?.phone_number || "—"} />
                    <InfoCard icon={<CreditCard size={16} />} label="License" value={driver.profile?.license_number || "—"} />
                    <InfoCard icon={<Car size={16} />} label="Vehicle Type" value={driver.profile?.vehicle_type || "—"} />
                  </div>

                  {driver.vehicle && (
                    <div className="bg-memphis-ink/5 rounded-xl p-4 border-2 border-memphis-ink/10">
                      <h4 className="text-sm font-bold text-memphis-ink mb-2 flex items-center gap-2"><Car size={14} /> Vehicle Details</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div><span className="text-memphis-purple">Number:</span> <span className="font-semibold">{driver.vehicle.vehicle_number}</span></div>
                        <div><span className="text-memphis-purple">Type:</span> <span className="font-semibold capitalize">{driver.vehicle.vehicle_type}</span></div>
                        <div><span className="text-memphis-purple">Status:</span> <span className="font-semibold capitalize">{driver.vehicle.status.replace("_", " ")}</span></div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-bold text-memphis-ink mb-3 flex items-center gap-2"><FileText size={14} /> Documents</h4>
                    {driver.documents.length === 0 ? (
                      <p className="text-sm text-memphis-purple/50">No documents uploaded</p>
                    ) : (
                      <div className="space-y-2">
                        {driver.documents.map((doc) => (
                          <div key={doc.id} className="bg-memphis-ink/5 rounded-xl px-4 py-3 border-2 border-memphis-ink/10">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <FileText size={16} className="text-memphis-purple" />
                                <div>
                                  <span className="text-sm font-semibold text-memphis-ink">{doc.document_type}</span>
                                  {doc.rejection_reason && <p className="text-xs text-memphis-coral mt-0.5">{doc.rejection_reason}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {docStatusLabel(doc.status)}
                                {(doc.status === "PENDING" || doc.status === "pending") && (
                                  <div className="flex gap-1">
                                    <button disabled={processing === doc.id} onClick={() => handleDocAction(doc.id, "approve")} className="memphis-btn px-3 py-1.5 text-xs font-bold bg-memphis-mint text-memphis-ink border-memphis-ink/30 shadow-memphis-sm disabled:opacity-50">
                                      Approve
                                    </button>
                                    <button disabled={processing === doc.id} onClick={() => handleDocAction(doc.id, "reject")} className="memphis-btn px-3 py-1.5 text-xs font-bold bg-memphis-coral text-white border-memphis-ink/30 shadow-memphis-sm disabled:opacity-50">
                                      Reject
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            {doc.file && (
                              <div className="mt-3">
                                <a href={doc.file.startsWith("http") ? doc.file : `${MEDIA_BASE}${doc.file}`} target="_blank" rel="noopener noreferrer" className="block">
                                  <img
                                    src={doc.file.startsWith("http") ? doc.file : `${MEDIA_BASE}${doc.file}`}
                                    alt={doc.document_type}
                                    className="max-h-48 rounded-lg border-2 border-memphis-ink/20 object-contain hover:shadow-memphis-sm transition-all duration-200 cursor-pointer"
                                    onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
                                  />
                                  <div className="hidden items-center gap-2 mt-2 text-xs text-memphis-purple">
                                    <FileText size={14} /><span>File: {doc.file.split("/").pop()}</span>
                                  </div>
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
                      className="memphis-btn bg-memphis-mint text-memphis-ink px-6 py-3 font-bold disabled:opacity-50 flex items-center gap-2"
                    >
                      <CheckCircle size={16} />
                      {processing === driver.id ? "Processing..." : "Approve Driver"}
                    </button>
                    <button
                      disabled={processing === driver.id}
                      onClick={() => handleDriverAction(driver.id, "reject")}
                      className="memphis-btn bg-memphis-coral text-white px-6 py-3 font-bold disabled:opacity-50 flex items-center gap-2"
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

function InfoCard({ icon, label, value }) {
  return (
    <div className="bg-memphis-ink/5 rounded-xl p-3 border-2 border-memphis-ink/10">
      <div className="flex items-center gap-1.5 text-memphis-purple mb-1">
        {icon}
        <span className="memphis-label">{label}</span>
      </div>
      <p className="text-sm font-semibold text-memphis-ink">{value}</p>
    </div>
  );
}
