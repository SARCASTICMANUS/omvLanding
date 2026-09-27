import React, { useEffect, useRef, useState } from "react";
/* eslint-disable react-hooks/set-state-in-effect */
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchProfile, updatePassengerProfile, clearProfileError } from "../features/profile/profileSlice";
import { AlertCircle, Camera, ChevronLeft, Loader2, Save, User } from "lucide-react";
import MobileBackButton from "../components/Layout/MobileBackButton";
import { StickyCTA, VayyButton, VayyCard } from "../components/vayy";

const LABEL_CLS =
  "mb-2 block text-[11px] font-semibold uppercase tracking-[0.5px] text-[#6B7280]";
const INPUT_CLS =
  "block h-[52px] w-full rounded-[14px] border border-[#E5E7EB] bg-white px-4 text-[15px] text-[#111827] outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#009849]";
const TEXTAREA_CLS =
  "block w-full resize-y rounded-[14px] border border-[#E5E7EB] bg-white px-4 py-3 text-[15px] leading-[22px] text-[#111827] outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#009849]";

function resizeProfilePhoto(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, 512 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read this image."));
    };
    image.src = objectUrl;
  });
}

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
    profile_photo: "",
  });
  const photoInputRef = useRef(null);
  const [photoError, setPhotoError] = useState("");

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
        profile_photo: profile.profile?.profile_photo || "",
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

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Choose an image file.");
      event.target.value = "";
      return;
    }
    setPhotoError("");
    try {
      const photo = await resizeProfilePhoto(file);
      setFormData((prev) => ({ ...prev, profile_photo: photo }));
    } catch {
      setPhotoError("Could not read this image. Please choose another.");
    }
    event.target.value = "";
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!profile) return;

    try {
      const profileResult = await dispatch(updatePassengerProfile({
        data: {
          first_name: formData.first_name,
          last_name: formData.last_name,
          display_name: formData.display_name,
          phone_number: formData.phone_number,
          bio: formData.bio,
          profile_photo: formData.profile_photo,
        },
      }));
      if (updatePassengerProfile.rejected.match(profileResult)) return;

      // Re-fetch the merged user and passenger profile after the save.
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

  const avatarPhoto =
    profile?.profile?.profile_photo || profile?.profile_photo || "";
  const fullName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.profile?.display_name ||
    "User";
  const initials =
    fullName
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  return (
    <div className="min-h-screen bg-[#F8FAF9] pb-40 font-sans lg:pb-32">
      <MobileBackButton />

      <header className="relative overflow-hidden rounded-b-[32px] bg-[#009849] px-5 pb-10 pt-5 sm:px-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <span className="absolute -right-10 -top-16 h-[90%] w-[70%] rotate-[25deg] rounded-[120px] bg-[#00B857] opacity-25" />
          <span className="absolute -right-5 -top-20 h-[70%] w-[50%] rotate-[35deg] rounded-[100px] bg-white/10" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <span className="h-11 w-11 shrink-0 lg:hidden" aria-hidden="true" />
          <button
            type="button"
            onClick={handleBack}
            aria-label="Go back"
            className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#111827] shadow-[0_2px_8px_rgba(0,0,0,0.18)] transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white lg:flex"
          >
            <ChevronLeft size={22} strokeWidth={2.5} />
          </button>
          <h1 className="flex-1 text-center text-[20px] font-black leading-tight text-white sm:text-[22px]">
            Edit Profile
          </h1>
          <span className="h-11 w-11 shrink-0" aria-hidden="true" />
        </div>

        <div className="relative z-10 mt-5 flex justify-center">
          <div className="relative">
            {formData.profile_photo || avatarPhoto ? (
              <img
                src={formData.profile_photo || avatarPhoto}
                alt={fullName}
                className="h-[76px] w-[76px] rounded-full border-[3px] border-white/50 object-cover"
              />
            ) : (
              <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-[3px] border-white/50 bg-white/15 text-[26px] font-black text-white">
                {initials}
              </div>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handlePhotoChange}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              aria-label="Change profile photo"
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-[#009849] bg-white text-[#009849] shadow-v-sm"
            >
              <Camera size={13} />
            </button>
          </div>
        </div>
        {photoError && <p className="mt-2 text-center text-xs text-red-100">{photoError}</p>}
      </header>

      <main className="relative z-10 mx-auto -mt-6 w-full max-w-3xl px-4 sm:px-6">
        <VayyCard className="p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#ECFAF1]">
              <User size={20} className="text-[#009849]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[16px] font-extrabold text-[#111827]">
                Personal Information
              </h2>
              <p className="text-[13px] text-[#6B7280]">
                Keep your personal information up to date.
              </p>
            </div>
          </div>

          {updateError && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] p-3.5 text-[13px] text-[#EF4444]"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">Update Failed</p>
                <p>{typeof updateError === 'string' ? updateError : JSON.stringify(updateError)}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="first_name" className={LABEL_CLS}>
                    First Name
                  </label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter first name"
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label htmlFor="last_name" className={LABEL_CLS}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter last name"
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="display_name" className={LABEL_CLS}>
                    Display Name
                  </label>
                  <input
                    type="text"
                    id="display_name"
                    name="display_name"
                    value={formData.display_name}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter display name"
                    className={INPUT_CLS}
                  />
                </div>

                <div>
                  <label htmlFor="phone_number" className={LABEL_CLS}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone_number"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter phone number"
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="bio" className={LABEL_CLS}>
                  Bio
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  placeholder="Tell us about yourself"
                  rows={4}
                  className={TEXTAREA_CLS}
                />
              </div>

              <div className="border-t border-[#F0F0F0] pt-5">
                <VayyButton
                  variant="outline"
                  size="lg"
                  fullWidth
                  onClick={() => navigate(-1)}
                >
                  Cancel
                </VayyButton>
              </div>
            </div>

            <StickyCTA
              type="submit"
              disabled={updateLoading}
              className="bottom-[96px] lg:bottom-0"
            >
              <span className="inline-flex items-center gap-2">
                {updateLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Save Changes
              </span>
            </StickyCTA>
          </form>
        </VayyCard>
      </main>
    </div>
  );
};

export default PassengerProfileUpdate;
