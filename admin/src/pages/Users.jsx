import { useState, useEffect } from "react";
import { Users as UsersIcon, UserCheck, Search, Mail, ShieldCheck } from "lucide-react";
import api from "../api/client";

export default function Users() {
  const [tab, setTab] = useState("passengers");
  const [passengers, setPassengers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
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
  }, []);

  const users = tab === "passengers" ? passengers : drivers;
  const filtered = users.filter((u) =>
    `${u.first_name} ${u.last_name} ${u.email}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

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
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-64 pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-600/20 outline-none"
          />
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-brand-50 text-brand-600 rounded-lg flex items-center justify-center text-sm font-bold uppercase">
                        {(u.first_name?.[0] || u.email[0])}
                      </div>
                      <span className="font-semibold text-slate-800">
                        {u.first_name} {u.last_name || ""}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-500 flex items-center gap-2">
                      <Mail size={14} /> {u.email}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 uppercase">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {u.is_verified ? (
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <ShieldCheck size={14} /> Verified
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">Pending</span>
                    )}
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
    </div>
  );
}
