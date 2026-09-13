import { useState, useEffect } from "react";
import { Users as UsersIcon, UserCheck, Search, Mail, ShieldCheck, Eye, Phone, MapPin, Wallet, Truck, Star, Settings, Plus, Edit3, Trash2, Save, X, FileText, ExternalLink } from "lucide-react";
import api from "../api/client";

const API_BASE = import.meta.env.VITE_API_URL || "";
const MEDIA_BASE = API_BASE.replace(/\/api\/?$/, "") || "";

function InfoRow({ label, value, icon }) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
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

  // CRUD state
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
    `${u.first_name} ${u.last_name} ${u.email}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  // CRUD handlers
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

  // Detail modal
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

      try {
        const walletRes = await api.get("/accounts/wallet/");
        profileData.wallet = walletRes.data?.data || walletRes.data || {};
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
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800">Users</h1>
          <p className="text-slate-500 mt-1 font-medium">
            {tab === "passengers"
              ? `${passengers.length} passenger(s)`
              : `${drivers.length} driver(s)`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-64 pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-600/20 outline-none"
            />
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-brand-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-brand-700 transition shadow-lg shadow-brand-600/25"
          >
            <Plus size={18} /> Add User
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 bg-slate-100 p-1.5 rounded-xl w-fit">
        <button
          onClick={() => setTab("passengers")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition ${
            tab === "passengers"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <UsersIcon size={16} /> Passengers
        </button>
        <button
          onClick={() => setTab("drivers")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition ${
            tab === "drivers"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <UserCheck size={16} /> Drivers
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Verified</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-6 py-4 cursor-pointer" onClick={() => openUserDetails(u.id)}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-brand-50 text-brand-600 rounded-lg flex items-center justify-center text-sm font-bold uppercase">
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
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 uppercase">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 cursor-pointer" onClick={() => openUserDetails(u.id)}>
                    {u.is_verified ? (
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <ShieldCheck size={14} /> Verified
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">Pending</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); openUserDetails(u.id); }}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-brand-600 transition"
                        title="View"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(u); }}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition"
                        title="Edit"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(u.id); }}
                        className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-400 font-medium">
              No {tab} found.
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold">{editing ? "Edit User" : "New User"}</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">First Name</label>
                  <input
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-600/20 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Last Name</label>
                  <input
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-600/20 outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  disabled={!!editing}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-600/20 outline-none disabled:opacity-50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Password {editing && <span className="text-slate-400 normal-case">(leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editing}
                  minLength={8}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-600/20 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-600/20 outline-none"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_staff"
                  checked={form.is_staff}
                  onChange={(e) => setForm({ ...form, is_staff: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
                />
                <label htmlFor="is_staff" className="text-sm font-medium text-slate-700">Admin access (staff)</label>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold hover:bg-brand-700 transition shadow-lg shadow-brand-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save size={16} /> {saving ? "Saving..." : editing ? "Update" : "Create"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            {detailsLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-600 border-t-transparent mx-auto" />
                <p className="mt-4 text-slate-500">Loading user details...</p>
              </div>
            ) : userDetails && (
              <>
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-slate-800">User Details</h2>
                  <button onClick={closeUserDetails} className="text-slate-400 hover:text-slate-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  <div className="bg-slate-50 rounded-xl p-4">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <UsersIcon size={20} /> Basic Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <InfoRow label="Name" value={`${userDetails.first_name} ${userDetails.last_name || ""}`} />
                      <InfoRow label="Email" value={userDetails.email} />
                      <InfoRow label="Role" value={
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                          userDetails.role === "passenger" ? "bg-blue-100 text-blue-700" :
                          userDetails.role === "bikedriver" ? "bg-green-100 text-green-700" :
                          userDetails.role === "autodriver" ? "bg-purple-100 text-purple-700" :
                          "bg-slate-100 text-slate-700"
                        }`}>
                          {userDetails.role}
                        </span>
                      } />
                      <InfoRow label="Verified" value={
                        userDetails.is_verified ? (
                          <span className="text-emerald-600 font-semibold flex items-center gap-1">
                            <ShieldCheck size={14} /> Yes
                          </span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )
                      } />
                      {userDetails.city_name && <InfoRow label="City" value={userDetails.city_name} />}
                      <InfoRow label="Joined" value={userDetails.date_joined ? new Date(userDetails.date_joined).toLocaleDateString() : "—"} />
                    </div>
                  </div>

                  {userDetails.role === "passenger" && userDetails.phone_number !== undefined && (
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <UsersIcon size={20} /> Passenger Profile
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <InfoRow label="Phone" value={userDetails.phone_number || "—"} icon={<Phone size={16} />} />
                        <InfoRow label="Display Name" value={userDetails.display_name || "—"} />
                        <InfoRow label="Home Location" value={userDetails.home_location || "—"} icon={<MapPin size={16} />} />
                        <InfoRow label="Current Location" value={userDetails.current_location || "—"} icon={<MapPin size={16} />} />
                        <InfoRow label="Wallet Balance" value={userDetails.wallet?.balance !== undefined ? `₹${userDetails.wallet.balance}` : "—"} icon={<Wallet size={16} />} />
                        <InfoRow label="Total Trips" value={userDetails.total_trips !== undefined ? userDetails.total_trips : "—"} icon={<Truck size={16} />} />
                      </div>
                    </div>
                  )}

                  {(userDetails.role === "bikedriver" || userDetails.role === "autodriver") && userDetails.phone_number !== undefined && (
                    <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <UserCheck size={20} /> Driver Profile
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <InfoRow label="Phone" value={userDetails.phone_number || "—"} icon={<Phone size={16} />} />
                        <InfoRow label="Display Name" value={userDetails.display_name || "—"} />
                        <InfoRow label="License Number" value={userDetails.license_number || "—"} icon={<Settings size={16} />} />
                        <InfoRow label="Vehicle Number" value={userDetails.vehicle_number || "—"} icon={<Truck size={16} />} />
                        <InfoRow label="Vehicle Type" value={userDetails.vehicle_type || "—"} />
                        <InfoRow label="KYC Verified" value={
                          userDetails.is_verified ? (
                            <span className="text-emerald-600 font-semibold flex items-center gap-1">
                              <ShieldCheck size={14} /> Verified
                            </span>
                          ) : (
                            <span className="text-amber-600 font-semibold">Pending</span>
                          )
                        } />
                        <InfoRow label="Rating" value={userDetails.rating !== undefined ? `${userDetails.rating} ⭐` : "—"} icon={<Star size={16} />} />
                        <InfoRow label="Total Trips" value={userDetails.total_trips !== undefined ? userDetails.total_trips : "—"} icon={<Truck size={16} />} />
                        <InfoRow label="Wallet Balance" value={userDetails.wallet?.balance !== undefined ? `₹${userDetails.wallet.balance}` : "—"} icon={<Wallet size={16} />} />
                      </div>
                    </div>
                  )}

                  {userDetails.documents?.length > 0 && (
                    <div className="bg-slate-50 rounded-xl p-4">
                      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <ShieldCheck size={20} /> KYC Documents
                      </h3>
                      <div className="space-y-3">
                        {userDetails.documents.map((doc) => (
                          <div key={doc.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                                  <FileText size={16} className="text-slate-400" />
                                </div>
                                <div>
                                  <span className="font-semibold text-slate-800">{doc.document_type}</span>
                                  <p className="text-xs text-slate-500">{doc.file ? "Uploaded" : "Not uploaded"}</p>
                                </div>
                              </div>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                doc.status === "verified" ? "bg-emerald-100 text-emerald-700" :
                                doc.status === "rejected" ? "bg-red-100 text-red-700" :
                                "bg-amber-100 text-amber-700"
                              }`}>
                                {doc.status}
                              </span>
                            </div>
                            {doc.file && (
                              <div className="px-4 pb-3">
                                <a
                                  href={doc.file.startsWith("http") ? doc.file : `${MEDIA_BASE}${doc.file}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block"
                                >
                                  <img
                                    src={doc.file.startsWith("http") ? doc.file : `${MEDIA_BASE}${doc.file}`}
                                    alt={doc.document_type}
                                    className="max-h-40 rounded-lg border border-slate-100 object-contain hover:shadow-md transition cursor-pointer"
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                      e.target.nextSibling.style.display = "flex";
                                    }}
                                  />
                                  <div className="hidden items-center gap-2 mt-1 text-xs text-slate-500">
                                    <FileText size={14} />
                                    <span>{doc.file.split("/").pop()}</span>
                                    <ExternalLink size={10} />
                                  </div>
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
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
