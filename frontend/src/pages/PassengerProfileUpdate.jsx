import React, { useEffect, useState } from "react";
/* eslint-disable react-hooks/set-state-in-effect */
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchProfile, updatePassengerProfile, updateUser, clearProfileError } from "../features/profile/profileSlice";
import { Loader2, ArrowLeft, Save, User, Phone, AlignLeft, AlertCircle } from "lucide-react";
import MobileBackButton from "../components/Layout/MobileBackButton";

const PassengerProfileUpdate = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { data: profile, loading, updateLoading, updateError } = useSelector((state) => state.profile);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    display_name: "",
    phone_number: "",
    bio: "",
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
      });
    }
  }, [profile, dispatch]);

  // Clear errors on unmount
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
      // 1. Update User model (Names)
      const userResult = await dispatch(updateUser({ 
        id: profile.id, 
        data: { 
          first_name: formData.first_name, 
          last_name: formData.last_name 
        } 
      }));

      if (updateUser.rejected.match(userResult)) return;

      // 2. Update Profile model
      if (profile.profile?.id) {
        const profileResult = await dispatch(updatePassengerProfile({ 
          id: profile.profile.id, 
          data: {
            display_name: formData.display_name,
            phone_number: formData.phone_number,
            bio: formData.bio
          } 
        }));
        
        if (updatePassengerProfile.rejected.match(profileResult)) return;
      }

      // 3. Re-fetch full profile to ensure Redux state is perfectly in sync
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

  const isPassenger = profile?.role === "passenger" || profile?.role === "student" || profile?.role === "admin";

  if (profile && !isPassenger) {
    return <div className="p-8 text-center">Unauthorized. Only passengers can access this page.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <MobileBackButton />
      <button 
        onClick={() => navigate(-1)}
        className="mb-6 hidden lg:flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
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

        {updateError && (
          <div className="m-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Update Failed</p>
              <p>{typeof updateError === 'string' ? updateError : JSON.stringify(updateError)}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="first_name" className="text-sm font-semibold text-gray-700">
                First Name
              </label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                required
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#009849] focus:border-transparent text-sm"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="last_name" className="text-sm font-semibold text-gray-700">
                Last Name
              </label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                required
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#009849] focus:border-transparent text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="display_name" className="text-sm font-semibold text-gray-700">
                Display Name (Public)
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
                  placeholder="John D."
                  required
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#009849] focus:border-transparent text-sm"
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
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#009849] focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="bio" className="text-sm font-semibold text-gray-700">
              Bio
            </label>
            <div className="relative">
              <div className="absolute top-3 left-3 flex items-start pointer-events-none">
                <AlignLeft className="h-4 w-4 text-gray-400" />
              </div>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                placeholder="Tell us something about yourself..."
                rows={4}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#009849] focus:border-transparent text-sm"
              />
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
              className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-[#009849] rounded-lg hover:bg-[#007a3d] transition-colors disabled:opacity-50"
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
