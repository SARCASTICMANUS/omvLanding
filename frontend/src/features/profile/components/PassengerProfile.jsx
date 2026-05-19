import React from "react";
import { useNavigate } from "react-router-dom";
import { User, Mail, Phone, MapPin, Camera } from "lucide-react";

const PassengerProfile = ({ profile }) => {
  const navigate = useNavigate();
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 overflow-hidden border-4 border-white shadow-md">
                {profile.profile?.profile_photo ? (
                  <img src={profile.profile.profile_photo} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <User size={40} />
                )}
              </div>
              <button className="absolute bottom-0 right-0 p-1.5 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition">
                <Camera size={14} />
              </button>
            </div>
            
            <div>
              <h2 className="text-xl font-bold text-gray-900">{profile.profile?.display_name || "New Passenger"}</h2>
              <p className="text-sm text-gray-500">{profile.email}</p>
              <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                {profile.role}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Display Name</label>
              <div className="flex items-center gap-3 text-gray-700 font-medium">
                <User size={18} className="text-gray-400" />
                {profile.profile?.display_name || "Not set"}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email Address</label>
              <div className="flex items-center gap-3 text-gray-700 font-medium">
                <Mail size={18} className="text-gray-400" />
                {profile.email}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Phone Number</label>
              <div className="flex items-center gap-3 text-gray-700 font-medium">
                <Phone size={18} className="text-gray-400" />
                {profile.profile?.phone_number || "Not set"}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">City</label>
              <div className="flex items-center gap-3 text-gray-700 font-medium">
                <MapPin size={18} className="text-gray-400" />
                {profile.city || "Not set"}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Last active: {profile.profile?.last_active_at ? new Date(profile.profile.last_active_at).toLocaleString() : "Recently"}
        </p>
      </div>
    </div>
  );
};

export default PassengerProfile;
