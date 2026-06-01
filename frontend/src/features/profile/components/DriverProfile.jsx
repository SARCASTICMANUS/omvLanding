import React from "react";
import { useNavigate } from "react-router-dom";
import { User, Mail, Phone, MapPin, CreditCard, Star, Route, CheckCircle, BadgeCheck } from "lucide-react";

const DriverProfile = ({ profile }) => {
  const navigate = useNavigate();
  const p = profile || {};
  const prof = p.profile || {};

  const userFullName = `${p.first_name || ""} ${p.last_name || ""}`.trim() || prof.display_name || "New Driver";
  
  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-6">
              <div className="h-24 w-24 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 border-4 border-white shadow-md">
                <User size={40} />
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">{userFullName}</h2>
                  {prof.is_verified && (
                    <CheckCircle size={18} className="text-green-500" fill="currentColor" />
                  )}
                </div>
                <p className="text-sm text-gray-500">{p.email}</p>
                <div className="mt-2 flex gap-2">
                  <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 capitalize">
                    {p.role}
                  </div>
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    <Star size={12} fill="currentColor" />
                    {prof.rating || "5.0"}
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={() => navigate("/driver/profile/update")}
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

              {prof.bio && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Bio</label>
                  <p className="text-sm text-gray-600 leading-relaxed italic">
                    "{prof.bio}"
                  </p>
                </div>
              )}
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
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">License Number</label>
                <div className="flex items-center gap-3 text-gray-700 font-medium">
                  <CreditCard size={18} className="text-gray-400" />
                  {prof.license_number || "Pending Verification"}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">City</label>
                <div className="flex items-center gap-3 text-gray-700 font-medium">
                  <MapPin size={18} className="text-gray-400" />
                  {p.city_name || "Not set"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Trips</label>
                  <div className="flex items-center gap-2 text-indigo-600 font-bold text-lg">
                    <Route size={20} />
                    {prof.total_trips || "0"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Info Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          Vehicle Information
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Vehicle Number</label>
            <div className="text-gray-900 font-bold text-xl">
              {prof.vehicle_number || "Not set"}
            </div>
            
            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Vehicle Type</label>
              <p className="text-sm text-gray-500 capitalize">
                {prof.vehicle_type || "N/A"}
              </p>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Active Route</label>
            <div className="text-gray-700 font-medium">
              {prof.assigned_route_name || "Standby"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverProfile;
