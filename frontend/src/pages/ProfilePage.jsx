import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchProfile } from "../features/profile/profileSlice";
import DriverProfile from "../features/profile/components/DriverProfile";
import PassengerProfile from "../features/profile/components/PassengerProfile";
import { User, Shield, Car, Loader2 } from "lucide-react";

const ProfilePage = () => {
  const dispatch = useDispatch();
  const { data: profile, loading, error } = useSelector((state) => state.profile);

  useEffect(() => {
    dispatch(fetchProfile());
  }, [dispatch]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md mt-10 p-6 bg-red-50 rounded-xl border border-red-200 text-center">
        <p className="text-red-600 font-medium">Error loading profile</p>
        <button 
          onClick={() => dispatch(fetchProfile())}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-gray-500 mt-1">Manage your profile and account preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <nav className="space-y-1">
            <button className="flex items-center gap-3 w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg">
              <User size={18} />
              Personal Info
            </button>
            <button className="flex items-center gap-3 w-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition">
              <Shield size={18} />
              Security
            </button>
            {profile.role === "driver" && (
              <button className="flex items-center gap-3 w-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition">
                <Car size={18} />
                Vehicle Info
              </button>
            )}
          </nav>
        </div>

        {/* Content */}
        <div className="md:col-span-3">
          {profile.role === "driver" ? (
            <DriverProfile profile={profile} />
          ) : (
            <PassengerProfile profile={profile} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
