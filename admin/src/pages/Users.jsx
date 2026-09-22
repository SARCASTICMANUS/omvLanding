import { useState, useEffect } from "react";
import { Users as UsersIcon, UserCheck, Search, Mail, ShieldCheck, Eye, Phone, MapPin, Wallet, Truck, Star, Settings, Plus, Edit3, Trash2, Save, X, FileText, ExternalLink } from "lucide-react";
import api from "../api/client";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";

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
      <span className="memphis-label flex items-center gap-1">
        {icon && <span>{icon}</span>}
        {label}
      </span>
      <span className="text-sm font-semibold text-memphis-ink">{value}</span>
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
    <div className="p-6 md:p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="memphis-title">Users</h1>
          <p className="text-memphis-purple mt-2 font-medium">
            {tab === "passengers" ? `${passengers.length} passenger(s)` : `${drivers.length} driver(s)`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-memphis-purple" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="memphis-input pl-10 w-64"
            />
          </div>
          <button onClick={openCreate} className="memphis-btn-primary flex items-center gap-2">
            <Plus size={18} /> Add User
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 bg-memphis-ink/5 p-1.5 border-2 border-memphis-ink rounded-lg w-fit">
        <button
          onClick={() => setTab("passengers")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
            tab === "passengers"
              ? "bg-memphis-pink text-memphis-ink shadow-memphis-sm"
              : "text-memphis-purple hover:text-memphis-ink"
          }`}
        >
          <UsersIcon size={16} /> Passengers
        </button>
        <button
          onClick={() => setTab("drivers")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
            tab === "drivers"
              ? "bg-memphis-teal text-memphis-ink shadow-memphis-sm"
              : "text-memphis-purple hover:text-memphis-ink"
          }`}
        >
          <UserCheck size={16} /> Drivers
        </button>
      </div>

      {loading ? (
        <Loader />
      ) : (
        <div className="memphis-card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-memphis-ink/5 border-b-2 border-memphis-ink">
                <th className="px-6 py-4 text-left memphis-label">User</th>
                <th className="px-6 py-4 text-left memphis-label">Email</th>
                <th className="px-6 py-4 text-left memphis-label">Role</th>
                <th className="px-6 py-4 text-left memphis-label">Verified</th>
                <th className="px-6 py-4 text-left memphis-label">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="memphis-table-row">
                  <td className="px-6 py-4 cursor-pointer" onClick={() => openUserDetails(u.id)}>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-memphis-pink/20 text-memphis-ink rounded-lg border-2 border-memphis-ink flex items-center justify-center text-sm font-bold uppercase">
                        {(u.first_name?.[0] || u.email[0])}
                      </div>
                      <span className="font-semibold text-memphis-ink">
                        {u.first_name} {u.last_name || ""}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 cursor-pointer" onClick={() => openUserDetails(u.id)}>
                    <span className="text-sm text-memphis-purple flex items-center gap-2">
                      <Mail size={14} /> {u.email}
                    </span>
                  </td>
                  <td className="px-6 py-4 cursor-pointer" onClick={() => openUserDetails(u.id)}>
                    <span className="memphis-badge bg-memphis-ink/5 text-memphis-ink border-memphis-ink/30 uppercase">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 cursor-pointer" onClick={() => openUserDetails(u.id)}>
                    {u.is_verified ? (
                      <span className="text-xs font-bold text-memphis-mint flex items-center gap-1">
                        <ShieldCheck size={14} /> Verified
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-memphis-purple/50">Pending</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); openUserDetails(u.id); }} className="p-2 hover:bg-memphis-ink/5 rounded-lg text-memphis-purple hover:text-memphis-pink transition-all duration-200" title="View">
                        <Eye size={15} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); openEdit(u); }} className="p-2 hover:bg-memphis-ink/5 rounded-lg text-memphis-purple hover:text-memphis-teal transition-all duration-200" title="Edit">
                        <Edit3 size={15} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(u.id); }} className="p-2 hover:bg-memphis-coral/10 rounded-lg text-memphis-purple hover:text-memphis-coral transition-all duration-200" title="Delete">
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
        <div className="fixed inset-0 bg-memphis-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-memphis-paper border-2 border-memphis-ink rounded-xl w-full max-w-md shadow-memphis-lg">
            <div className="flex items-center justify-between p-6 border-b-2 border-memphis-ink">
              <h2 className="text-xl font-bold text-memphis-ink">{editing ? "Edit User" : "New User"}</h2>
              <button onClick={() => setModal(false)} className="text-memphis-purple hover:text-memphis-ink transition-all duration-200">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="memphis-label">First Name</label>
                  <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required className="memphis-input" />
                </div>
                <div className="space-y-1">
                  <label className="memphis-label">Last Name</label>
                  <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="memphis-input" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="memphis-label">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required disabled={!!editing} className="memphis-input disabled:opacity-50" />
              </div>
              <div className="space-y-1">
                <label className="memphis-label">
                  Password {editing && <span className="text-memphis-purple/50 normal-case">(leave blank to keep current)</span>}
                </label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} minLength={8} className="memphis-input" />
              </div>
              <div className="space-y-1">
                <label className="memphis-label">Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="memphis-input">
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="is_staff" checked={form.is_staff} onChange={(e) => setForm({ ...form, is_staff: e.target.checked })} className="w-4 h-4 rounded border-2 border-memphis-ink text-memphis-pink focus:ring-memphis-pink" />
                <label htmlFor="is_staff" className="text-sm font-semibold text-memphis-ink cursor-pointer">Admin access (staff)</label>
              </div>
              <button type="submit" disabled={saving} className="w-full memphis-btn-primary py-4 flex items-center justify-center gap-2 disabled:opacity-50">
                <Save size={16} /> {saving ? "Saving..." : editing ? "Update" : "Create"}
              </button>
            </form>
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-memphis-ink/60 backdrop-blur-sm p-4">
          <div className="bg-memphis-paper border-2 border-memphis-ink rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-memphis-lg">
            {detailsLoading ? (
              <div className="p-8 text-center">
                <Loader />
                <p className="mt-4 text-memphis-purple">Loading user details...</p>
              </div>
            ) : userDetails && (
              <>
                <div className="p-6 border-b-2 border-memphis-ink flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-memphis-ink" style={{ fontFamily: "Archivo Black, sans-serif" }}>User Details</h2>
                  <button onClick={closeUserDetails} className="text-memphis-purple hover:text-memphis-ink transition-all duration-200">
                    <X size={24} />
                  </button>
                </div>
                <div className="p-6 space-y-6">
                  <div className="bg-memphis-ink/5 rounded-xl p-4 border-2 border-memphis-ink/10">
                    <h3 className="text-lg font-bold text-memphis-ink mb-4 flex items-center gap-2">
                      <UsersIcon size={20} /> Basic Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <InfoRow label="Name" value={`${userDetails.first_name} ${userDetails.last_name || ""}`} />
                      <InfoRow label="Email" value={userDetails.email} />
                      <InfoRow label="Role" value={
                        <span className={`memphis-badge ${
                          userDetails.role === "passenger" ? "bg-memphis-teal/20 text-memphis-ink border-memphis-teal" :
                          userDetails.role === "bikedriver" ? "bg-memphis-mint/20 text-memphis-ink border-memphis-mint" :
                          "bg-memphis-purple/20 text-memphis-ink border-memphis-purple"
                        }`}>
                          {userDetails.role}
                        </span>
                      } />
                      <InfoRow label="Verified" value={
                        userDetails.is_verified ? (
                          <span className="text-memphis-mint font-semibold flex items-center gap-1">
                            <ShieldCheck size={14} /> Yes
                          </span>
                        ) : (
                          <span className="text-memphis-purple/50">No</span>
                        )
                      } />
                      {userDetails.city_name && <InfoRow label="City" value={userDetails.city_name} />}
                      <InfoRow label="Joined" value={userDetails.date_joined ? new Date(userDetails.date_joined).toLocaleDateString() : "—"} />
                    </div>
                  </div>

                  {userDetails.role === "passenger" && userDetails.phone_number !== undefined && (
                    <div className="bg-memphis-teal/10 rounded-xl p-4 border-2 border-memphis-teal/30">
                      <h3 className="text-lg font-bold text-memphis-ink mb-4 flex items-center gap-2">
                        <UsersIcon size={20} /> Passenger Profile
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <InfoRow label="Phone" value={userDetails.phone_number || "—"} icon={<Phone size={16} />} />
                        <InfoRow label="Display Name" value={userDetails.display_name || "—"} />
                        <InfoRow label="Home Location" value={userDetails.home_location ? `${userDetails.home_location.lat?.toFixed?.(4)}, ${userDetails.home_location.lng?.toFixed?.(4)}` : "—"} icon={<MapPin size={16} />} />
                        <InfoRow label="Current Location" value={userDetails.current_location ? `${userDetails.current_location.lat?.toFixed?.(4)}, ${userDetails.current_location.lng?.toFixed?.(4)}` : "—"} icon={<MapPin size={16} />} />
                        <InfoRow label="Wallet Balance" value={userDetails.wallet?.balance !== undefined ? `₹${userDetails.wallet.balance}` : "—"} icon={<Wallet size={16} />} />
                        <InfoRow label="Saved Routes" value={userDetails.saved_routes?.length !== undefined ? userDetails.saved_routes.length : "—"} icon={<MapPin size={16} />} />
                        <InfoRow label="Last Active" value={userDetails.last_active_at ? new Date(userDetails.last_active_at).toLocaleString() : "—"} />
                        <InfoRow label="Joined" value={userDetails.date_joined ? new Date(userDetails.date_joined).toLocaleDateString() : "—"} />
                      </div>
                      {userDetails.bio && (
                        <p className="mt-3 text-sm text-memphis-ink/70 bg-memphis-paper rounded-lg px-4 py-2 border-2 border-memphis-ink/10">{userDetails.bio}</p>
                      )}
                      {imgSrc(userDetails.profile_photo) && (
                        <div className="mt-3">
                          <p className="memphis-label mb-1">Profile Photo</p>
                          <img src={imgSrc(userDetails.profile_photo)} alt="Profile" className="max-h-40 rounded-lg border-2 border-memphis-ink/20 object-contain" />
                        </div>
                      )}
                    </div>
                  )}

                  {(userDetails.role === "bikedriver" || userDetails.role === "autodriver") && userDetails.phone_number !== undefined && (
                    <div className="bg-memphis-mint/10 rounded-xl p-4 border-2 border-memphis-mint/30">
                      <h3 className="text-lg font-bold text-memphis-ink mb-4 flex items-center gap-2">
                        <UserCheck size={20} /> Driver Profile
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <InfoRow label="Phone" value={userDetails.phone_number || "—"} icon={<Phone size={16} />} />
                        <InfoRow label="Display Name" value={userDetails.display_name || "—"} />
                        <InfoRow label="License Number" value={userDetails.license_number || "—"} icon={<Settings size={16} />} />
                        <InfoRow label="Vehicle Number" value={userDetails.vehicle_number || "—"} icon={<Truck size={16} />} />
                        <InfoRow label="Vehicle Type" value={userDetails.vehicle_type || "—"} />
                        <InfoRow label="RC Number" value={userDetails.rc_number || "—"} />
                        <InfoRow label="DOB" value={userDetails.dob || "—"} />
                        <InfoRow label="Gender" value={userDetails.gender || "—"} />
                        <InfoRow label="Rating" value={userDetails.rating !== undefined ? `${userDetails.rating} ⭐` : "—"} icon={<Star size={16} />} />
                        <InfoRow label="Total Trips" value={userDetails.total_trips !== undefined ? userDetails.total_trips : "—"} icon={<Truck size={16} />} />
                        <InfoRow label="Wallet Balance" value={userDetails.wallet?.balance !== undefined ? `₹${userDetails.wallet.balance}` : "—"} icon={<Wallet size={16} />} />
                      </div>
                      {userDetails.bio && (
                        <p className="mt-3 text-sm text-memphis-ink/70 bg-memphis-paper rounded-lg px-4 py-2 border-2 border-memphis-ink/10">{userDetails.bio}</p>
                      )}
                      {imgSrc(userDetails.vehicle_photo) && (
                        <div className="mt-3">
                          <p className="memphis-label mb-1">Vehicle Photo</p>
                          <img src={imgSrc(userDetails.vehicle_photo)} alt="Vehicle" className="max-h-40 rounded-lg border-2 border-memphis-ink/20 object-contain" />
                        </div>
                      )}
                    </div>
                  )}

                  {userDetails.documents?.length > 0 && (
                    <div className="bg-memphis-ink/5 rounded-xl p-4 border-2 border-memphis-ink/10">
                      <h3 className="text-lg font-bold text-memphis-ink mb-4 flex items-center gap-2">
                        <ShieldCheck size={20} /> KYC Documents
                      </h3>
                      <div className="space-y-3">
                        {userDetails.documents.map((doc) => {
                          const st = String(doc.status || "").toLowerCase();
                          return (
                            <div key={doc.id} className="bg-memphis-paper rounded-xl border-2 border-memphis-ink/20 overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-memphis-ink/5 rounded-lg flex items-center justify-center">
                                    <FileText size={16} className="text-memphis-purple" />
                                  </div>
                                  <div>
                                    <span className="font-semibold text-memphis-ink">{doc.document_type}</span>
                                    <p className="text-xs text-memphis-purple">{doc.file_name || "Document"}</p>
                                  </div>
                                </div>
                                <span className={`memphis-badge ${
                                  st === "verified" ? "bg-memphis-mint/20 text-memphis-ink border-memphis-mint" :
                                  st === "rejected" ? "bg-memphis-coral/20 text-memphis-ink border-memphis-coral" :
                                  "bg-memphis-yellow/20 text-memphis-ink border-memphis-yellow"
                                }`}>
                                  {doc.status}
                                </span>
                              </div>
                              {doc.file_data && (
                                <div className="px-4 pb-3">
                                  <a href={`${API_BASE}/operations/admin/documents/${doc.id}/file/`} target="_blank" rel="noopener noreferrer" className={`block ${mimeFor(doc.file_name) === "application/pdf" ? "" : "w-fit"}`}>
                                    {mimeFor(doc.file_name) === "application/pdf" ? (
                                      <div className="flex items-center gap-2 rounded-lg border-2 border-memphis-ink/20 px-4 py-2 text-xs text-memphis-purple hover:bg-memphis-ink/5 transition-all duration-200">
                                        <FileText size={14} /><span className="font-semibold text-memphis-ink">{doc.file_name || "Document"}</span>
                                        <span className="flex items-center gap-1 ml-auto">Open file <ExternalLink size={10} /></span>
                                      </div>
                                    ) : (
                                      <img
                                        src={docSrc(doc)}
                                        alt={doc.document_type}
                                        className="max-h-40 rounded-lg border-2 border-memphis-ink/20 object-contain hover:shadow-memphis-sm transition-all duration-200 cursor-pointer"
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
