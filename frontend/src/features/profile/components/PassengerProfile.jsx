import React from "react";
import { useNavigate } from "react-router-dom";
import { User, Mail, Phone, MapPin, Camera, Star, ShieldCheck, BadgeCheck } from "lucide-react";

const PassengerProfile = ({ profile }) => {
  const navigate = useNavigate();
  const p = profile || {};
  const prof = p.profile || {};

  const userFullName = `${p.first_name || ""} ${p.last_name || ""}`.trim() || prof.display_name || "New Passenger";

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="h-24 w-24 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 border-4 border-white shadow-md overflow-hidden">
                  {prof.profile_photo ? (
                    <img src={prof.profile_photo} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <User size={40} />
                  )}
                </div>
                <button 
                  onClick={() => navigate("/passenger/profile/update")} 
                  className="absolute -bottom-1 -right-1 p-1.5 bg-white text-emerald-600 rounded-full shadow-md border border-gray-100 hover:scale-110 transition"
                  title="Update photo"
                >
                  <Camera size={14} />
                </button>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">{userFullName}</h2>
                  {(p.role === "student" || p.role === "admin") && (
                    <ShieldCheck size={18} className="text-emerald-500" fill="currentColor" />
                  )}
                </div>
                <p className="text-sm text-gray-500">{p.email}</p>
                <div className="mt-2 flex gap-2">
                  <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 capitalize">
                    {p.role || "passenger"}
                  </div>
                  {prof.rating && (
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      <Star size={12} fill="currentColor" />
                      {prof.rating}/5
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button 
              onClick={() => navigate("/passenger/profile/update")}
              className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              Edit Profile
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Full Name</label>
                <div className="flex items-center gap-3 text-gray-700 font-medium">
                  <User size={18} className="text-gray-400" />
                  {userFullName}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Display Name</label>
                <div className="flex items-center gap-3 text-gray-700 font-medium">
                  <BadgeCheck size={18} className="text-gray-400" />
                  {prof.display_name || "Not set"}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email Address</label>
                <div className="flex items-center gap-3 text-gray-700 font-medium">
                  <Mail size={18} className="text-gray-400" />
                  {p.email}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Phone Number</label>
                <div className="flex items-center gap-3 text-gray-700 font-medium">
                  <Phone size={18} className="text-gray-400" />
                  {prof.phone_number || p.phone_number || "Not set"}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">City</label>
                <div className="flex items-center gap-3 text-gray-700 font-medium">
                  <MapPin size={18} className="text-gray-400" />
                  {p.city_name || "Not set"}
                </div>
              </div>

              {prof.bio && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Bio</label>
                  <p className="text-sm text-gray-600 leading-relaxed italic">
                    "{prof.bio}"
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">
            Last active: {prof.last_active_at ? new Date(prof.last_active_at).toLocaleString() : "Recently"}
          </p>
          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">
            Member since: {prof.joined_at ? new Date(prof.joined_at).toLocaleDateString() : "—"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PassengerProfile;
