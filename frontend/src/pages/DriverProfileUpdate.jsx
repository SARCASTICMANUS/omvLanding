import React, { useEffect, useState } from "react";
/* eslint-disable react-hooks/set-state-in-effect */
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchProfile, updateDriverProfile, updateUser, clearProfileError } from "../features/profile/profileSlice";
import { Loader2, ArrowLeft, Save, User, Phone, CreditCard, Bus, AlertCircle } from "lucide-react";
import MobileBackButton from "../components/Layout/MobileBackButton";

const DriverProfileUpdate = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { data: profile, loading, updateLoading, updateError } = useSelector((state) => state.profile);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    display_name: "",
    phone_number: "",
    bio: "",
    license_number: "",
    vehicle_number: "",
    vehicle_type: "bus",
  });

  useEffect(() => {
    if (!profile) {
      dispatch(fetchProfile());
    } else {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        display_name: profile.profile?.display_name || "",
        phone_number: profile.profile?.phone_number || profile.phone_number || "",
        bio: profile.profile?.bio || "",
        license_number: profile.profile?.license_number || "",
        vehicle_number: profile.profile?.vehicle_number || "",
        vehicle_type: profile.profile?.vehicle_type || "bus",
      });
    }
  }, [profile, dispatch]);

  useEffect(() => {
    return () => {
      dispatch(clearProfileError());
    };
  }, [dispatch]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!profile) return;

    try {
      // 1. Update User model
      const userResult = await dispatch(updateUser({ 
        id: profile.id, 
        data: { 
          first_name: formData.first_name, 
          last_name: formData.last_name 
        } 
      }));

      if (updateUser.rejected.match(userResult)) return;

      // 2. Update Driver Profile model
      if (profile.profile?.id) {
        const profileResult = await dispatch(updateDriverProfile({ 
          id: profile.profile.id, 
          data: {
            display_name: formData.display_name,
            phone_number: formData.phone_number,
            bio: formData.bio,
            license_number: formData.license_number,
            vehicle_number: formData.vehicle_number,
            vehicle_type: formData.vehicle_type,
          } 
        }));

        if (updateDriverProfile.rejected.match(profileResult)) return;
      }

      // 3. Re-fetch full profile
      await dispatch(fetchProfile());

      navigate("/profile");
    } catch (err) {
      console.error("Update failed", err);
    }
  };

  if (loading && !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#009849]" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <MobileBackButton />
      <button 
        onClick={() => navigate(-1)}
        className="mb-6 hidden lg:flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-xl font-bold text-gray-900">Update Driver Profile</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage your personal and vehicle information.
          </p>
        </div>

        {updateError && (
          <div className="m-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Update Failed</p>
              <p>{typeof updateError === 'string' ? updateError : JSON.stringify(updateError)}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Section: Personal Info */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-[#009849] uppercase tracking-wider">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">First Name</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  required
                  className="block w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#009849] focus:border-transparent text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Last Name</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  required
                  className="block w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#009849] focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Display Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    name="display_name"
                    value={formData.display_name}
                    onChange={handleInputChange}
                    className="block w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#009849] focus:border-transparent text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="tel"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleInputChange}
                    required
                    className="block w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#009849] focus:border-transparent text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Bio</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                rows={3}
                className="block w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#009849] focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Section: Professional Info */}
          <div className="space-y-6 pt-6 border-t border-gray-100">
            <h3 className="text-sm font-bold text-[#009849] uppercase tracking-wider">Vehicle & License</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">License Number</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    name="license_number"
                    value={formData.license_number}
                    onChange={handleInputChange}
                    className="block w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#009849] focus:border-transparent text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Vehicle Number</label>
                <div className="relative">
                  <Bus className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    name="vehicle_number"
                    value={formData.vehicle_number}
                    onChange={handleInputChange}
                    className="block w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#009849] focus:border-transparent text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Vehicle Type</label>
              <select
                name="vehicle_type"
                value={formData.vehicle_type}
                onChange={handleInputChange}
                className="block w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#009849] focus:border-transparent text-sm appearance-none bg-white"
              >
                <option value="bus">Bus</option>
                <option value="van">Van</option>
                <option value="minibus">Minibus</option>
                <option value="car">Car</option>
                <option value="auto">Auto-Rickshaw</option>
                <option value="tempo">Tempo Traveller</option>
              </select>
            </div>
          </div>

          <div className="pt-6 flex items-center justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateLoading}
              className="flex items-center gap-2 px-8 py-2.5 text-sm font-bold text-white bg-[#009849] rounded-xl hover:bg-[#007a3d] transition-colors disabled:opacity-50 shadow-lg shadow-green-100"
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

export default DriverProfileUpdate;
