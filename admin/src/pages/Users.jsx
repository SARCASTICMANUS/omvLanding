import { useState, useEffect } from "react";
import { Users as UsersIcon, UserCheck, Search, Mail, ShieldCheck, Eye, Phone, MapPin, Wallet, Truck, Star, Settings, Plus, Edit3, Trash2, Save, X, FileText, ExternalLink } from "lucide-react";
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

function InfoRow({ label, value, icon }) {
  return (
    <div className="space-y-1">
      <span className="glass-label flex items-center gap-1">
        {icon && <span>{icon}</span>}
        {label}
      </span>
      <span className="text-sm font-semibold text-slate-800">{value}</span>
    </div>
  );
}

const ROLE_OPTIONS = [
  { label: "Passenger", value: "passenger" },
  { label: "Bike Driver", value: "bikedriver" },
  { label: "Auto Driver", value: "autodriver" },
];

export default function Users() {
  const [tab, setTab] = useState("passengers");
  const [passengers, setPassengers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "", role: "passenger", is_staff: false });
  const [saving, setSaving] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    Promise.all([
      api.get("/accounts/users/?role=passenger"),
      api.get("/accounts/users/?role=bikedriver"),
      api.get("/accounts/users/?role=autodriver"),
    ])
      .then(([pRes, bdRes, adRes]) => {
        const p = Array.isArray(pRes.data) ? pRes.data : pRes.data.results || [];
        const bd = Array.isArray(bdRes.data) ? bdRes.data : bdRes.data.results || [];
        const ad = Array.isArray(adRes.data) ? adRes.data : adRes.data.results || [];
        setPassengers(p);
        setDrivers([...bd, ...ad]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const users = tab === "passengers" ? passengers : drivers;
  const filtered = users.filter((u) =>
    `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ first_name: "", last_name: "", email: "", password: "", role: tab === "drivers" ? "bikedriver" : "passenger", is_staff: false });
    setModal(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      email: u.email || "",
      password: "",
      role: u.role || "passenger",
      is_staff: u.is_staff || false,
    });
    setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (editing && !payload.password) delete payload.password;
      if (editing) {
        await api.patch(`/accounts/users/${editing.id}/`, payload);
      } else {
        await api.post("/accounts/users/", payload);
      }
      setModal(false);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || err.response?.data?.email?.[0] || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this user? This action cannot be undone.")) return;
    try {
      await api.delete(`/accounts/users/${id}/`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete user");
    }
  };

  const fetchUserDetails = async (userId) => {
    setDetailsLoading(true);
    try {
      const user = [...passengers, ...drivers].find((u) => u.id === userId);
      if (!user) return;
      let profileData = {};
      if (user.role === "passenger") {
        const res = await api.get(`/accounts/me/passenger-profile/?user_id=${userId}`);
        profileData = res.data?.data || res.data || {};
      } else if (user.role === "bikedriver" || user.role === "autodriver") {
        const res = await api.get(`/accounts/me/driver-profile/?user_id=${userId}`);
        profileData = res.data?.data || res.data || {};
      }
      if (user.role === "bikedriver" || user.role === "autodriver") {
        try {
          const docsRes = await api.get(`/accounts/driver/documents/?user_id=${userId}`);
          profileData.documents = Array.isArray(docsRes.data) ? docsRes.data : docsRes.data?.data || [];
        } catch {}
      }
      try {
        const walletRes = await api.get(`/accounts/wallet/?user_id=${userId}`);
        const wdata = walletRes.data?.data || walletRes.data || {};
        profileData.wallet = wdata.wallet || wdata || {};
      } catch {}
      setUserDetails({ ...user, ...profileData });
    } catch (err) {
      console.error("Failed to fetch user details:", err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const openUserDetails = (userId) => {
    setSelectedUser(userId);
    fetchUserDetails(userId);
  };

  const closeUserDetails = () => {
    setSelectedUser(null);
    setUserDetails(null);
  };

  return (
    <div className="pt-4 pb-6 px-6 md:pt-5 md:pb-8 md:px-8 h-full overflow-y-auto">
      <PageToolbar>
        <div className="relative w-64 max-w-full">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="glass-input pl-10 w-full"
          />
        </div>
        <button onClick={openCreate} className="glass-btn-primary flex items-center gap-2">
          <Plus size={18} /> Add User
        </button>
      </PageToolbar>

      <div className="glass-tab-group w-fit mb-6">
        <button
          onClick={() => setTab("passengers")}
          className={tab === "passengers" ? "glass-tab-active" : "glass-tab"}
        >
          <span className="flex items-center gap-2"><UsersIcon size={14} /> Passengers</span>
        </button>
        <button
          onClick={() => setTab("drivers")}
          className={tab === "drivers" ? "glass-tab-active" : "glass-tab"}
        >
          <span className="flex items-center gap-2"><UserCheck size={14} /> Drivers</span>
        </button>
      </div>

      {loading ? (
        <Loader />
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200/60">
                <th className="px-6 py-4 text-left glass-label">User</th>
                <th className="px-6 py-4 text-left glass-label">Email</th>
                <th className="px-6 py-4 text-left glass-label">Role</th>
                <th className="px-6 py-4 text-left glass-label">Verified</th>
                <th className="px-6 py-4 text-left glass-label">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="glass-table-row">
                  <td className="px-6 py-4 cursor-pointer" onClick={() => openUserDetails(u.id)}>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold uppercase"
                        style={{ background: "rgba(46,92,255,0.08)", border: "1px solid rgba(46,92,255,0.15)", color: "#2E5CFF" }}>
                        {(u.first_name?.[0] || u.email[0])}
                      </div>
                      <span className="font-semibold text-slate-800">
                        {u.first_name} {u.last_name || ""}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 cursor-pointer" onClick={() => openUserDetails(u.id)}>
                    <span className="text-sm text-slate-500 flex items-center gap-2">
                      <Mail size={14} /> {u.email}
                    </span>
                  </td>
                  <td className="px-6 py-4 cursor-pointer" onClick={() => openUserDetails(u.id)}>
                    <span className="glass-badge uppercase">{u.role}</span>
                  </td>
                  <td className="px-6 py-4 cursor-pointer" onClick={() => openUserDetails(u.id)}>
                    {u.is_verified ? (
                      <span className="text-xs font-semibold text-green-600 flex items-center gap-1">
                        <ShieldCheck size={14} /> Verified
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-500">Pending</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); openUserDetails(u.id); }} className="p-2 hover:bg-white/60 rounded-xl text-slate-500 hover:text-accent-primary transition-all duration-200" title="View">
                        <Eye size={15} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); openEdit(u); }} className="p-2 hover:bg-white/60 rounded-xl text-slate-500 hover:text-accent-primary transition-all duration-200" title="Edit">
                        <Edit3 size={15} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(u.id); }} className="p-2 hover:bg-red-50 rounded-xl text-slate-500 hover:text-red-500 transition-all duration-200" title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState
              icon={UsersIcon}
              title={`No ${tab} found`}
              description="No users match your search criteria."
            />
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card-strong w-full max-w-md animate-glass-fade-in" style={{ borderRadius: "24px" }}>
            <div className="flex items-center justify-between p-6 border-b border-slate-200/60">
              <h2 className="text-xl font-semibold text-slate-800">{editing ? "Edit User" : "New User"}</h2>
              <button onClick={() => setModal(false)} className="p-2 hover:bg-white/60 rounded-xl text-slate-500 hover:text-slate-800 transition-all duration-200">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="glass-label">First Name</label>
                  <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required className="glass-input" />
                </div>
                <div className="space-y-1.5">
                  <label className="glass-label">Last Name</label>
                  <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="glass-input" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="glass-label">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required disabled={!!editing} className="glass-input disabled:opacity-50" />
              </div>
              <div className="space-y-1.5">
                <label className="glass-label">
                  Password {editing && <span className="text-slate-500 normal-case">(leave blank to keep current)</span>}
                </label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} minLength={8} className="glass-input" />
              </div>
              <div className="space-y-1.5">
                <label className="glass-label">Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="glass-select">
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="is_staff" checked={form.is_staff} onChange={(e) => setForm({ ...form, is_staff: e.target.checked })} className="w-4 h-4 rounded-lg border-2 border-accent-primary text-accent-primary focus:ring-accent-primary" />
                <label htmlFor="is_staff" className="text-sm font-semibold text-slate-800 cursor-pointer">Admin access (staff)</label>
              </div>
              <button type="submit" disabled={saving} className="w-full glass-btn-primary py-3.5 flex items-center justify-center gap-2 disabled:opacity-50">
                <Save size={16} /> {saving ? "Saving..." : editing ? "Update" : "Create"}
              </button>
            </form>
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
          <div className="glass-card-strong max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-glass-fade-in" style={{ borderRadius: "24px" }}>
            {detailsLoading ? (
              <div className="p-8 text-center">
                <Loader />
                <p className="mt-4 text-slate-500">Loading user details...</p>
              </div>
            ) : userDetails && (
              <>
                <div className="p-6 border-b border-slate-200/60 flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-slate-800">User Details</h2>
                  <button onClick={closeUserDetails} className="p-2 hover:bg-white/60 rounded-xl text-slate-500 hover:text-slate-800 transition-all duration-200">
                    <X size={24} />
                  </button>
                </div>
                <div className="p-6 space-y-6">
                  <div className="glass-card-subtle rounded-2xl p-5">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <UsersIcon size={20} /> Basic Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <InfoRow label="Name" value={`${userDetails.first_name} ${userDetails.last_name || ""}`} />
                      <InfoRow label="Email" value={userDetails.email} />
                      <InfoRow label="Role" value={
                        <span className={`glass-badge ${
                          userDetails.role === "passenger" ? "glass-badge-success" :
                          userDetails.role === "bikedriver" ? "glass-badge-warning" :
                          "glass-badge-danger"
                        }`}>
                          {userDetails.role}
                        </span>
                      } />
                      <InfoRow label="Verified" value={
                        userDetails.is_verified ? (
                          <span className="text-green-600 font-semibold flex items-center gap-1">
                            <ShieldCheck size={14} /> Yes
                          </span>
                        ) : (
                          <span className="text-slate-500">No</span>
                        )
                      } />
                      {userDetails.city_name && <InfoRow label="City" value={userDetails.city_name} />}
                      <InfoRow label="Joined" value={userDetails.date_joined ? new Date(userDetails.date_joined).toLocaleDateString() : "\u2014"} />
                    </div>
                  </div>

                  {userDetails.role === "passenger" && userDetails.phone_number !== undefined && (
                    <div className="glass-card-subtle rounded-2xl p-5" style={{ background: "rgba(46,92,255,0.05)", borderColor: "rgba(46,92,255,0.12)" }}>
                      <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <UsersIcon size={20} /> Passenger Profile
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <InfoRow label="Phone" value={userDetails.phone_number || "\u2014"} icon={<Phone size={16} />} />
                        <InfoRow label="Display Name" value={userDetails.display_name || "\u2014"} />
                        <InfoRow label="Home Location" value={userDetails.home_location ? `${userDetails.home_location.lat?.toFixed?.(4)}, ${userDetails.home_location.lng?.toFixed?.(4)}` : "\u2014"} icon={<MapPin size={16} />} />
                        <InfoRow label="Current Location" value={userDetails.current_location ? `${userDetails.current_location.lat?.toFixed?.(4)}, ${userDetails.current_location.lng?.toFixed?.(4)}` : "\u2014"} icon={<MapPin size={16} />} />
                        <InfoRow label="Wallet Balance" value={userDetails.wallet?.balance !== undefined ? `\u20B9${userDetails.wallet.balance}` : "\u2014"} icon={<Wallet size={16} />} />
                        <InfoRow label="Saved Routes" value={userDetails.saved_routes?.length !== undefined ? userDetails.saved_routes.length : "\u2014"} icon={<MapPin size={16} />} />
                        <InfoRow label="Last Active" value={userDetails.last_active_at ? new Date(userDetails.last_active_at).toLocaleString() : "\u2014"} />
                        <InfoRow label="Joined" value={userDetails.date_joined ? new Date(userDetails.date_joined).toLocaleDateString() : "\u2014"} />
                      </div>
                      {userDetails.bio && (
                        <p className="mt-3 text-sm text-slate-600 glass-card-subtle rounded-xl px-4 py-2">{userDetails.bio}</p>
                      )}
                      {imgSrc(userDetails.profile_photo) && (
                        <div className="mt-3">
                          <p className="glass-label mb-1">Profile Photo</p>
                          <img src={imgSrc(userDetails.profile_photo)} alt="Profile" className="max-h-40 rounded-xl border border-slate-200/60 object-contain" />
                        </div>
                      )}
                    </div>
                  )}

                  {(userDetails.role === "bikedriver" || userDetails.role === "autodriver") && userDetails.phone_number !== undefined && (
                    <div className="glass-card-subtle rounded-2xl p-5" style={{ background: "rgba(46,92,255,0.05)", borderColor: "rgba(46,92,255,0.12)" }}>
                      <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <UserCheck size={20} /> Driver Profile
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <InfoRow label="Phone" value={userDetails.phone_number || "\u2014"} icon={<Phone size={16} />} />
                        <InfoRow label="Display Name" value={userDetails.display_name || "\u2014"} />
                        <InfoRow label="License Number" value={userDetails.license_number || "\u2014"} icon={<Settings size={16} />} />
                        <InfoRow label="Vehicle Number" value={userDetails.vehicle_number || "\u2014"} icon={<Truck size={16} />} />
                        <InfoRow label="Vehicle Type" value={userDetails.vehicle_type || "\u2014"} />
                        <InfoRow label="RC Number" value={userDetails.rc_number || "\u2014"} />
                        <InfoRow label="DOB" value={userDetails.dob || "\u2014"} />
                        <InfoRow label="Gender" value={userDetails.gender || "\u2014"} />
                        <InfoRow label="Rating" value={userDetails.rating !== undefined ? `${userDetails.rating} \u2B50` : "\u2014"} icon={<Star size={16} />} />
                        <InfoRow label="Total Trips" value={userDetails.total_trips !== undefined ? userDetails.total_trips : "\u2014"} icon={<Truck size={16} />} />
                        <InfoRow label="Wallet Balance" value={userDetails.wallet?.balance !== undefined ? `\u20B9${userDetails.wallet.balance}` : "\u2014"} icon={<Wallet size={16} />} />
                      </div>
                      {userDetails.bio && (
                        <p className="mt-3 text-sm text-slate-600 glass-card-subtle rounded-xl px-4 py-2">{userDetails.bio}</p>
                      )}
                      {imgSrc(userDetails.vehicle_photo) && (
                        <div className="mt-3">
                          <p className="glass-label mb-1">Vehicle Photo</p>
                          <img src={imgSrc(userDetails.vehicle_photo)} alt="Vehicle" className="max-h-40 rounded-xl border border-slate-200/60 object-contain" />
                        </div>
                      )}
                    </div>
                  )}

                  {userDetails.documents?.length > 0 && (
                    <div className="glass-card-subtle rounded-2xl p-5">
                      <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <ShieldCheck size={20} /> KYC Documents
                      </h3>
                      <div className="space-y-3">
                        {userDetails.documents.map((doc) => {
                          const st = String(doc.status || "").toLowerCase();
                          return (
                            <div key={doc.id} className="glass-card-subtle rounded-xl overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                    style={{ background: "rgba(46,92,255,0.08)" }}>
                                    <FileText size={16} style={{ color: "#2E5CFF" }} />
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-800">{doc.document_type}</span>
                                    <p className="text-xs text-slate-500">{doc.file_name || "Document"}</p>
                                  </div>
                                </div>
                                <span className={`glass-badge ${
                                  st === "verified" ? "glass-badge-success" :
                                  st === "rejected" ? "glass-badge-danger" :
                                  "glass-badge-warning"
                                }`}>
                                  {doc.status}
                                </span>
                              </div>
                              {doc.file_data && (
                                <div className="px-4 pb-3">
                                  <a href={`${API_BASE}/operations/admin/documents/${doc.id}/file/`} target="_blank" rel="noopener noreferrer" className={`block ${mimeFor(doc.file_name) === "application/pdf" ? "" : "w-fit"}`}>
                                    {mimeFor(doc.file_name) === "application/pdf" ? (
                                      <div className="flex items-center gap-2 glass-card-subtle rounded-xl px-4 py-2 text-xs hover:bg-white/50 transition-all duration-200">
                                        <FileText size={14} /><span className="font-semibold text-slate-800">{doc.file_name || "Document"}</span>
                                        <span className="flex items-center gap-1 ml-auto">Open file <ExternalLink size={10} /></span>
                                      </div>
                                    ) : (
                                      <img
                                        src={docSrc(doc)}
                                        alt={doc.document_type}
                                        className="max-h-40 rounded-xl border border-slate-200/60 object-contain hover:shadow-lg transition-all duration-200 cursor-pointer"
                                      />
                                    )}
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
