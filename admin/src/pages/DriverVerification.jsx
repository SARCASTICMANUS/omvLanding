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

const API_BASE = import.meta.env.VITE_API_URL || "";
const MEDIA_BASE = API_BASE.replace(/\/api\/?$/, "") || "";

export default function DriverVerification() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    fetchDrivers();
  }, []);

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
      await api.patch(`/operations/admin/drivers/${driverId}/verify/`, {
        action,
      });
      setDrivers((prev) => prev.filter((d) => d.id !== driverId));
      if (expanded === driverId) setExpanded(null);
    } catch {
    } finally {
      setProcessing(null);
    }
  };

  const handleDocAction = async (docId, action) => {
    setProcessing(docId);
    try {
      await api.patch(`/operations/admin/documents/${docId}/verify/`, {
        action,
      });
      setDrivers((prev) =>
        prev.map((d) => ({
          ...d,
          documents: d.documents.map((doc) =>
            doc.id === docId
              ? { ...doc, status: action === "approve" ? "VERIFIED" : "REJECTED" }
              : doc
          ),
        }))
      );
    } catch {
    } finally {
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
      return (
        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
          <CheckCircle size={12} /> Verified
        </span>
      );
    if (status === "REJECTED" || status === "rejected")
      return (
        <span className="text-xs font-bold text-red-600 flex items-center gap-1">
          <XCircle size={12} /> Rejected
        </span>
      );
    return (
      <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
        <AlertTriangle size={12} /> Pending
      </span>
    );
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800">
            Driver Verification
          </h1>
          <p className="text-slate-500 mt-1 font-medium">
            {drivers.length} pending verification(s)
          </p>
        </div>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drivers..."
            className="w-72 pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-600/20 outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <ShieldCheck size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium text-lg">
            No pending verifications
          </p>
          <p className="text-slate-400 text-sm mt-1">
            All drivers have been reviewed
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((driver) => (
            <div
              key={driver.id}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
            >
              {/* Driver header */}
              <div
                className="flex items-center justify-between p-6 cursor-pointer hover:bg-slate-50/50 transition"
                onClick={() =>
                  setExpanded(expanded === driver.id ? null : driver.id)
                }
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center text-lg font-bold uppercase">
                    {(driver.first_name?.[0] || driver.email[0])}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">
                      {driver.first_name} {driver.last_name || ""}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Mail size={12} /> {driver.email}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
                        {driver.role}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {driver.vehicle && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">
                      <Car size={12} className="inline mr-1" />
                      {driver.vehicle.vehicle_number}
                    </span>
                  )}
                  {expanded === driver.id ? (
                    <ChevronUp size={20} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={20} className="text-slate-400" />
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {expanded === driver.id && (
                <div className="border-t border-slate-100 p-6 space-y-6">
                  {/* Profile info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <InfoCard
                      icon={<User size={16} />}
                      label="Display Name"
                      value={driver.profile?.display_name || "—"}
                    />
                    <InfoCard
                      icon={<Phone size={16} />}
                      label="Phone"
                      value={driver.profile?.phone_number || "—"}
                    />
                    <InfoCard
                      icon={<CreditCard size={16} />}
                      label="License"
                      value={driver.profile?.license_number || "—"}
                    />
                    <InfoCard
                      icon={<Car size={16} />}
                      label="Vehicle Type"
                      value={driver.profile?.vehicle_type || "—"}
                    />
                  </div>

                  {/* Vehicle info */}
                  {driver.vehicle && (
                    <div className="bg-slate-50 rounded-xl p-4">
                      <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <Car size={14} /> Vehicle Details
                      </h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500">Number:</span>{" "}
                          <span className="font-semibold">
                            {driver.vehicle.vehicle_number}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Type:</span>{" "}
                          <span className="font-semibold capitalize">
                            {driver.vehicle.vehicle_type}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Status:</span>{" "}
                          <span className="font-semibold capitalize">
                            {driver.vehicle.status.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Documents */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                      <FileText size={14} /> Documents
                    </h4>
                    {driver.documents.length === 0 ? (
                      <p className="text-sm text-slate-400">
                        No documents uploaded
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {driver.documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="bg-slate-50 rounded-xl px-4 py-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <FileText size={16} className="text-slate-400" />
                                <div>
                                  <span className="text-sm font-semibold text-slate-700">
                                    {doc.document_type}
                                  </span>
                                  {doc.rejection_reason && (
                                    <p className="text-xs text-red-500 mt-0.5">
                                      {doc.rejection_reason}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {docStatusLabel(doc.status)}
                                {(doc.status === "PENDING" || doc.status === "pending") && (
                                  <div className="flex gap-1">
                                    <button
                                      disabled={processing === doc.id}
                                      onClick={() =>
                                        handleDocAction(doc.id, "approve")
                                      }
                                      className="px-3 py-1.5 text-xs font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      disabled={processing === doc.id}
                                      onClick={() =>
                                        handleDocAction(doc.id, "reject")
                                      }
                                      className="px-3 py-1.5 text-xs font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            {doc.file && (
                              <div className="mt-3">
                                <a
                                  href={doc.file.startsWith("http") ? doc.file : `${MEDIA_BASE}${doc.file}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block"
                                >
                                  <img
                                    src={doc.file.startsWith("http") ? doc.file : `${MEDIA_BASE}${doc.file}`}
                                    alt={doc.document_type}
                                    className="max-h-48 rounded-lg border border-slate-200 object-contain hover:shadow-md transition cursor-pointer"
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                      e.target.nextSibling.style.display = "flex";
                                    }}
                                  />
                                  <div className="hidden items-center gap-2 mt-2 text-xs text-slate-500">
                                    <FileText size={14} />
                                    <span>File: {doc.file.split("/").pop()}</span>
                                  </div>
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      disabled={processing === driver.id}
                      onClick={() => handleDriverAction(driver.id, "approve")}
                      className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 disabled:opacity-50 transition shadow-sm"
                    >
                      <CheckCircle size={16} />
                      {processing === driver.id ? "Processing..." : "Approve Driver"}
                    </button>
                    <button
                      disabled={processing === driver.id}
                      onClick={() => handleDriverAction(driver.id, "reject")}
                      className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 disabled:opacity-50 transition shadow-sm"
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
    <div className="bg-slate-50 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
        {icon}
        <span className="text-[11px] font-medium uppercase">{label}</span>
      </div>
      <p className="text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}
