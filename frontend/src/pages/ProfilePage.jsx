import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchProfile } from "../features/profile/profileSlice";
import DriverProfile from "../features/profile/components/DriverProfile";
import PassengerProfile from "../features/profile/components/PassengerProfile";
import { User, Shield, Car, Loader2 } from "lucide-react";

const ProfilePage = () => {
  const dispatch = useDispatch();
  const { data: profile, loading, error } = useSelector((state) => state.profile);

  // Force re-fetch on every mount to ensure we have the latest data from the server
  useEffect(() => {
    dispatch(fetchProfile());
  }, [dispatch]);

  if (loading && !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#009849] mx-auto" />
          <p className="mt-4 text-gray-500 font-medium tracking-tight">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="mx-auto max-w-md mt-10 p-8 bg-red-50 rounded-2xl border border-red-100 text-center">
        <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
          <User size={24} />
        </div>
        <p className="text-red-600 font-bold text-lg">Error loading profile</p>
        <p className="text-red-500/80 text-sm mt-1">We couldn't reach the server. Please check your connection.</p>
        <button 
          onClick={() => dispatch(fetchProfile())}
          className="mt-6 w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition shadow-lg shadow-red-100"
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
        <h1 className="text-2xl lg:text-3xl font-black text-gray-900 tracking-tight">Account Settings</h1>
        <p className="text-gray-500 mt-2 text-sm lg:text-base">Manage your profile and account preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full lg:w-1/4">
          <nav className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 scrollbar-hide">
            <button className="flex items-center gap-3 px-4 py-2 text-sm font-black text-[#009849] bg-green-50 rounded-xl whitespace-nowrap">
              <User size={18} />
              Personal Info
            </button>
            <button className="flex items-center gap-3 px-4 py-2 text-sm font-black text-gray-600 hover:bg-gray-100 rounded-xl transition whitespace-nowrap">
              <Shield size={18} />
              Security
            </button>
            {profile.role === "driver" && (
              <button className="flex items-center gap-3 px-4 py-2 text-sm font-black text-gray-600 hover:bg-gray-100 rounded-xl transition whitespace-nowrap">
                <Car size={18} />
                Vehicle Info
              </button>
            )}
          </nav>
        </div>

        {/* Content */}
        <div className="w-full lg:w-3/4">
          <div className="bg-white rounded-2xl border border-gray-100 p-2 lg:p-6 shadow-sm">
            {/* Using a key here forces the component to completely re-render when the data changes */}
            {profile.role === "driver" ? (
              <DriverProfile 
                key={`${profile.id}-${JSON.stringify(profile.profile)}-${profile.first_name}`} 
                profile={profile} 
              />
            ) : (
              <PassengerProfile 
                key={`${profile.id}-${JSON.stringify(profile.profile)}-${profile.first_name}`} 
                profile={profile} 
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
