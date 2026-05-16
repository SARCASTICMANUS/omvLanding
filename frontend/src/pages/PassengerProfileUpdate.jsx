import React, { useEffect, useState } from "react";
/* eslint-disable react-hooks/set-state-in-effect */
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchProfile, updatePassengerProfile } from "../features/profile/profileSlice";
import { Loader2, ArrowLeft, Save, User, Phone, Mail, MapPin } from "lucide-react";

const PassengerProfileUpdate = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { data: profile, loading, updateLoading } = useSelector((state) => state.profile);

  const [formData, setFormData] = useState({
    display_name: "",
    phone_number: "",
  });

  useEffect(() => {
    if (!profile) {
      dispatch(fetchProfile());
    } else if (profile.role === "passenger" || profile.role === "student") {
      setFormData({
        display_name: profile.profile?.display_name || "",
        phone_number: profile.profile?.phone_number || "",
      });
    }
  }, [profile, dispatch]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const resultAction = await dispatch(updatePassengerProfile({ id: profile.profile.id, data: formData }));
    if (updatePassengerProfile.fulfilled.match(resultAction)) {
      navigate("/profile");
    }
  };

  if (loading && !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (profile && profile.role !== "passenger" && profile.role !== "student") {
    return <div className="p-8 text-center">Unauthorized. Only passengers can access this page.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button 
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Update Profile</h2>
          <p className="text-sm text-gray-500 mt-1">
            Keep your personal information up to date.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="display_name" className="text-sm font-semibold text-gray-700">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="display_name"
                  name="display_name"
                  value={formData.display_name}
                  onChange={handleInputChange}
                  placeholder="John Doe"
                  required
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="phone_number" className="text-sm font-semibold text-gray-700">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="tel"
                  id="phone_number"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  placeholder="+91 9876543210"
                  required
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 opacity-60">
                <label className="text-sm font-semibold text-gray-700">Email Address (Read-only)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={profile?.email || ""}
                    disabled
                    className="block w-full pl-10 pr-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="space-y-2 opacity-60">
                <label className="text-sm font-semibold text-gray-700">City (Read-only)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={profile?.city || "Not set"}
                    disabled
                    className="block w-full pl-10 pr-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateLoading}
              className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {updateLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save size={18} />
              )}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PassengerProfileUpdate;
