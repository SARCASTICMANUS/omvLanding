import React, { useEffect, useState } from "react";
/* eslint-disable react-hooks/set-state-in-effect */
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchProfile, fetchVerificationStatus, updateDriverProfile, clearProfileError } from "../features/profile/profileSlice";
import { AlertCircle, Camera, CheckCircle2, ChevronLeft, Loader2, Save, Upload, User } from "lucide-react";
import MobileBackButton from "../components/Layout/MobileBackButton";
import { StickyCTA, VayyButton } from "../components/vayy";
import api from "../lib/api";
import { API_PATHS } from "../constants/apiPaths";

const LABEL_CLS =
  "mb-2 block text-[11px] font-semibold uppercase tracking-[0.5px] text-[#6B7280]";
const INPUT_CLS =
  "block h-[52px] w-full rounded-[14px] border border-[#E5E7EB] bg-white px-4 text-[15px] text-[#111827] outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#009849]";
const TEXTAREA_CLS =
  "block w-full resize-y rounded-[14px] border border-[#E5E7EB] bg-white px-4 py-3 text-[15px] leading-[22px] text-[#111827] outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#009849]";
const VEHICLE_INPUT_CLS =
  "block h-[52px] w-full rounded-[14px] border-[1.5px] border-[#E5E7EB] bg-[#FAFAFA] px-4 text-[15px] text-[#111827] outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#009849] focus:bg-[#F0FAF2]";
const SECTION_CARD_CLS =
  "rounded-[24px] border-[1.5px] border-[#E5E7EB] bg-white p-5 shadow-v-sm sm:p-7";

const REGISTRATION_DOCUMENTS = [
  { key: "dlFront", title: "Driving Licence · Front", type: "LICENSE" },
  { key: "dlBack", title: "Driving Licence · Back", type: "LICENSE" },
  { key: "rcFront", title: "RC Book · Front", type: "RC" },
  { key: "rcBack", title: "RC Book · Back", type: "RC" },
  { key: "insuranceFront", title: "Vehicle Insurance · Front", type: "INSURANCE" },
  { key: "insuranceBack", title: "Vehicle Insurance · Back", type: "INSURANCE" },
  { key: "aadhaarFront", title: "Aadhaar Card · Front", type: "IDENTITY" },
  { key: "aadhaarBack", title: "Aadhaar Card · Back", type: "IDENTITY" },
  { key: "selfie", title: "Selfie Verification", type: "IDENTITY" },
];

const emptyRegistrationDocs = () => Object.fromEntries(
  REGISTRATION_DOCUMENTS.map(({ key }) => [key, { id: "", name: "", status: "idle" }]),
);

const unwrap = (response) => response?.data?.data ?? response?.data ?? null;

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function DriverRegistrationCompletion({ mode = "complete" }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth || {});
  const isManage = mode === "manage";
  const [registrationDraft] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("OMV_DRIVER_ONBOARDING_DRAFT") || "null") || {};
    } catch {
      return {};
    }
  });
  const [form, setForm] = useState({
    fullName: registrationDraft.fullName || user?.full_name || user?.name || "",
    phone: registrationDraft.phone || "",
    dob: registrationDraft.dob || "",
    gender: registrationDraft.gender || "",
    vehicleType: registrationDraft.vehicleType || (user?.role === "autodriver" ? "auto" : "bike"),
    vehicleNumber: "",
    rcNumber: "",
    vehiclePhoto: "",
    holderName: "",
    accountNumber: "",
    ifsc: "",
    upi: "",
  });
  const [vehiclePhotoName, setVehiclePhotoName] = useState("");
  const [documents, setDocuments] = useState(emptyRegistrationDocs);
  const [errors, setErrors] = useState({});
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requestError, setRequestError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get(API_PATHS.auth.driverProfile).catch(() => null),
      api.get(API_PATHS.auth.driverDocuments).catch(() => null),
      api.get(API_PATHS.auth.driverBankDetails).catch(() => null),
    ]).then(([profileResponse, documentsResponse, bankResponse]) => {
      if (!active) return;
      const profile = unwrap(profileResponse) || {};
      const bank = unwrap(bankResponse) || {};
      const rawDocs = unwrap(documentsResponse);
      const docList = Array.isArray(rawDocs) ? rawDocs : Array.isArray(rawDocs?.results) ? rawDocs.results : [];
      const docs = emptyRegistrationDocs();
      const fallbackSlots = {
        LICENSE: ["dlFront", "dlBack"],
        RC: ["rcFront", "rcBack"],
        INSURANCE: ["insuranceFront", "insuranceBack"],
        IDENTITY: ["aadhaarFront", "aadhaarBack", "selfie"],
      };
      const fallbackIndex = { LICENSE: 0, RC: 0, INSURANCE: 0, IDENTITY: 0 };
      docList.forEach((doc) => {
        const slots = fallbackSlots[doc.document_type] || [];
        const key = doc.doc_key && docs[doc.doc_key]
          ? doc.doc_key
          : slots[fallbackIndex[doc.document_type]++];
        if (key && docs[key]) docs[key] = { id: doc.id || "", name: doc.file_name || "Uploaded document", status: "success" };
      });
      setDocuments(docs);
      setForm((current) => ({
        ...current,
        fullName: profile.display_name || profile.first_name || current.fullName,
        phone: profile.phone_number || current.phone,
        dob: profile.dob || current.dob,
        gender: profile.gender || current.gender,
        vehicleType: profile.vehicle_type || current.vehicleType,
        vehicleNumber: profile.vehicle_number || "",
        rcNumber: profile.rc_number || "",
        vehiclePhoto: profile.vehicle_photo || "",
        holderName: bank.holder_name || "",
        accountNumber: bank.account_number || "",
        ifsc: bank.ifsc || "",
        upi: bank.upi || "",
      }));
    }).finally(() => {
      if (active) setLoadingExisting(false);
    });
    return () => { active = false; };
  }, []);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const uploadDocument = async (key, documentType, file) => {
    if (!file) return;
    setUploading(true);
    setRequestError("");
    setDocuments((current) => ({ ...current, [key]: { ...current[key], name: file.name, status: "uploading" } }));
    const body = new FormData();
    body.append("document_type", documentType);
    body.append("doc_key", key);
    body.append("file", file);
    try {
      const response = await api.post(API_PATHS.auth.driverDocuments, body);
      const uploaded = unwrap(response) || {};
      if (!uploaded.id) throw new Error("The server did not return a document ID.");
      setDocuments((current) => ({ ...current, [key]: { id: uploaded.id, name: file.name, status: "success" } }));
      setErrors((current) => ({ ...current, [key]: "" }));
      dispatch(fetchVerificationStatus());
    } catch (error) {
      setDocuments((current) => ({ ...current, [key]: { ...current[key], status: "error" } }));
      setRequestError(error.response?.data?.message || error.message || "Document upload failed. Please retry.");
    } finally {
      setUploading(false);
    }
  };

  const handleVehiclePhoto = async (file) => {
    if (!file) return;
    try {
      update("vehiclePhoto", await readFileAsBase64(file));
      setVehiclePhotoName(file.name);
      setErrors((current) => ({ ...current, vehiclePhoto: "" }));
    } catch {
      setErrors((current) => ({ ...current, vehiclePhoto: "Could not read that photo. Please select it again." }));
    }
  };

  const validate = () => {
    const nextErrors = {};
    if (!isManage) {
      if (!form.fullName.trim()) nextErrors.fullName = "Enter your full name.";
      if (!/^\d{10}$/.test(form.phone)) nextErrors.phone = "Enter a valid 10-digit mobile number.";
      if (!form.dob) nextErrors.dob = "Select your date of birth.";
      if (!form.gender) nextErrors.gender = "Select your gender.";
    }
    if (!/^[A-Z0-9 -]{6,15}$/i.test(form.vehicleNumber.trim())) nextErrors.vehicleNumber = "Enter a valid vehicle number.";
    if (form.rcNumber.trim().length < 6) nextErrors.rcNumber = "Enter a valid RC number (at least 6 characters).";
    REGISTRATION_DOCUMENTS.forEach(({ key }) => {
      if (!documents[key]?.id) nextErrors[key] = "Upload this document to continue.";
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || uploading || !validate()) return;
    setSubmitting(true);
    setRequestError("");
    try {
      const bankHasAnyValue = form.holderName || form.accountNumber || form.ifsc || form.upi;
      const bankDetails = bankHasAnyValue
        ? { holder_name: form.holderName, account_number: form.accountNumber, ifsc: form.ifsc, upi: form.upi }
        : {};
      if (isManage) {
        await api.post(API_PATHS.operations.vehicleRegister, {
          vehicle_number: form.vehicleNumber.trim().toUpperCase(),
          vehicle_type: form.vehicleType,
          vehicle_photo: form.vehiclePhoto,
        });
        await api.put(API_PATHS.auth.driverProfile, { rc_number: form.rcNumber.trim().toUpperCase() });
        if (bankHasAnyValue) await api.post(API_PATHS.auth.driverBankDetails, bankDetails);
        await Promise.all([dispatch(fetchProfile()), dispatch(fetchVerificationStatus())]);
        navigate("/profile", { replace: true });
        return;
      }

      const payload = {
        display_name: form.fullName.trim(),
        phone_number: form.phone.trim(),
        dob: form.dob,
        gender: form.gender,
        vehicle_type: form.vehicleType,
        vehicle_number: form.vehicleNumber.trim().toUpperCase(),
        vehicle_photo: form.vehiclePhoto,
        rc_number: form.rcNumber.trim().toUpperCase(),
        document_ids: REGISTRATION_DOCUMENTS.map(({ key }) => documents[key].id),
        bank_details: bankDetails,
        role: form.vehicleType === "auto" ? "autodriver" : "bikedriver",
      };
      await api.post(API_PATHS.auth.completeRegistration, payload);
      sessionStorage.removeItem("OMV_DRIVER_ONBOARDING_DRAFT");
      await Promise.all([dispatch(fetchProfile()), dispatch(fetchVerificationStatus())]);
      setSubmitted(true);
    } catch (error) {
      setRequestError(error.response?.data?.message || error.response?.data?.detail || "Could not submit driver onboarding. Please review the fields and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingExisting) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#009849]" /></div>;
  }

  if (submitted) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <CheckCircle2 size={56} className="text-[#009849]" />
        <h1 className="mt-4 text-[24px] font-extrabold text-[#111827]">Application Submitted</h1>
        <p className="mt-2 text-[14px] leading-5 text-[#6B7280]">Your vehicle and documents are being reviewed.</p>
        <button type="button" onClick={() => navigate("/", { replace: true })} className="mt-6 h-12 rounded-[16px] bg-[#009849] px-8 font-bold text-white">Continue</button>
      </div>
    );
  }

  const inputClass = "h-[52px] w-full rounded-[14px] border border-[#E5E7EB] bg-white px-4 text-[14px] text-[#111827] outline-none focus:border-[#009849]";
  const completedDocs = REGISTRATION_DOCUMENTS.filter(({ key }) => documents[key]?.id).length;
  return (
    <div className="min-h-screen bg-[#F8FAF9] px-4 pb-36 pt-5 font-sans sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} aria-label="Go back" className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#111827] shadow-sm"><ChevronLeft size={22} /></button>
          <div>
            <h1 className="text-[22px] font-black text-[#111827]">{isManage ? "Vehicle & Documents" : "Complete Driver Profile"}</h1>
            <p className="text-[13px] text-[#6B7280]">{isManage ? "Update vehicle details and verification files" : "Add your vehicle and documents to start driving"}</p>
          </div>
        </div>

        {requestError ? <div role="alert" className="mb-4 rounded-[14px] border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">{requestError}</div> : null}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isManage ? (
            <section className={SECTION_CARD_CLS}>
              <h2 className="mb-4 text-[16px] font-extrabold text-[#111827]">Personal Details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className={LABEL_CLS}>Full Name</span><input className={inputClass} value={form.fullName} onChange={(event) => update("fullName", event.target.value)} required />{errors.fullName && <span className="mt-1 block text-xs text-red-600">{errors.fullName}</span>}</label>
                <label className="block"><span className={LABEL_CLS}>Phone Number</span><input className={inputClass} inputMode="numeric" maxLength={10} value={form.phone} onChange={(event) => update("phone", event.target.value.replace(/\D/g, "").slice(0, 10))} required />{errors.phone && <span className="mt-1 block text-xs text-red-600">{errors.phone}</span>}</label>
                <label className="block"><span className={LABEL_CLS}>Date of Birth</span><input className={inputClass} type="date" value={form.dob} onChange={(event) => update("dob", event.target.value)} required />{errors.dob && <span className="mt-1 block text-xs text-red-600">{errors.dob}</span>}</label>
                <label className="block"><span className={LABEL_CLS}>Gender</span><select className={inputClass} value={form.gender} onChange={(event) => update("gender", event.target.value)} required><option value="">Select gender</option><option>Male</option><option>Female</option><option>Other</option></select>{errors.gender && <span className="mt-1 block text-xs text-red-600">{errors.gender}</span>}</label>
              </div>
            </section>
          ) : null}

          <section className={SECTION_CARD_CLS}>
            <h2 className="mb-4 text-[16px] font-extrabold text-[#111827]">Vehicle Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className={LABEL_CLS}>Vehicle Type</span><select className={inputClass} value={form.vehicleType} onChange={(event) => update("vehicleType", event.target.value)}><option value="bike">Bike</option><option value="auto">Auto</option></select></label>
              <label className="block"><span className={LABEL_CLS}>Vehicle Number</span><input className={inputClass} placeholder="UP32AB1234" value={form.vehicleNumber} onChange={(event) => update("vehicleNumber", event.target.value.toUpperCase())} required />{errors.vehicleNumber && <span className="mt-1 block text-xs text-red-600">{errors.vehicleNumber}</span>}</label>
              <label className="block"><span className={LABEL_CLS}>RC Number</span><input className={inputClass} value={form.rcNumber} onChange={(event) => update("rcNumber", event.target.value.toUpperCase())} required />{errors.rcNumber && <span className="mt-1 block text-xs text-red-600">{errors.rcNumber}</span>}</label>
              <label className="block"><span className={LABEL_CLS}>{form.vehicleType === "auto" ? "Auto Photo" : "Bike Photo"}</span><span className="flex h-[52px] items-center gap-2 rounded-[14px] border border-dashed border-[#009849] bg-[#F0FAF2] px-3 text-[13px] text-[#009849]"><Camera size={17} /><span className="truncate">{vehiclePhotoName || (form.vehiclePhoto ? "Photo uploaded" : "Choose a photo")}</span><input className="sr-only" type="file" accept="image/*" onChange={(event) => handleVehiclePhoto(event.target.files?.[0])} /></span>{errors.vehiclePhoto && <span className="mt-1 block text-xs text-red-600">{errors.vehiclePhoto}</span>}</label>
            </div>
          </section>

          <section className={SECTION_CARD_CLS}>
            <div className="mb-4 flex items-center justify-between gap-2"><div><h2 className="text-[16px] font-extrabold text-[#111827]">Documents</h2><p className="text-[13px] text-[#6B7280]">Upload both sides of each required document.</p></div><span className="rounded-full bg-[#F0FAF2] px-3 py-1 text-xs font-bold text-[#009849]">{completedDocs}/9</span></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {REGISTRATION_DOCUMENTS.map(({ key, title, type }) => (
                <label key={key} className="flex min-h-[76px] cursor-pointer items-center gap-3 rounded-[16px] border border-[#E5E7EB] bg-[#FAFAFA] p-3 transition hover:border-[#009849]/50">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#F0FAF2] text-[#009849]">{documents[key].status === "success" ? <CheckCircle2 size={19} /> : <Upload size={18} />}</span>
                  <span className="min-w-0 flex-1"><span className="block text-[12px] font-bold text-[#111827]">{title}</span><span className="block truncate text-[11px] text-[#6B7280]">{documents[key].name || (documents[key].id ? "Uploaded" : "Tap to upload")}</span>{errors[key] && <span className="block text-[11px] text-red-600">{errors[key]}</span>}</span>
                  <input className="sr-only" type="file" accept="image/*" onChange={(event) => uploadDocument(key, type, event.target.files?.[0])} />
                </label>
              ))}
            </div>
          </section>

          <section className={SECTION_CARD_CLS}>
            <h2 className="text-[16px] font-extrabold text-[#111827]">Bank Details <span className="text-[12px] font-medium text-[#9CA3AF]">(Optional)</span></h2>
            <p className="mb-4 text-[13px] text-[#6B7280]">Add payout information when you are ready.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className={LABEL_CLS}>Account Holder Name</span><input className={inputClass} value={form.holderName} onChange={(event) => update("holderName", event.target.value)} /></label>
              <label className="block"><span className={LABEL_CLS}>Account Number</span><input className={inputClass} inputMode="numeric" value={form.accountNumber} onChange={(event) => update("accountNumber", event.target.value.replace(/\D/g, ""))} /></label>
              <label className="block"><span className={LABEL_CLS}>IFSC Code</span><input className={inputClass} maxLength={11} value={form.ifsc} onChange={(event) => update("ifsc", event.target.value.toUpperCase())} /></label>
              <label className="block"><span className={LABEL_CLS}>UPI ID (Optional)</span><input className={inputClass} value={form.upi} onChange={(event) => update("upi", event.target.value)} /></label>
            </div>
          </section>

          <StickyCTA type="submit" disabled={submitting || uploading} className="bottom-[96px] lg:bottom-0">
            {(submitting || uploading) && <Loader2 size={16} className="animate-spin" />}
            {isManage ? "Save & Update" : "Submit Registration"}
          </StickyCTA>
        </form>
      </div>
    </div>
  );
}

const DriverProfileUpdate = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const completionMode = searchParams.get("mode");
  const { data: profile, loading, updateLoading, updateError } = useSelector((state) => state.profile);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    display_name: "",
    phone_number: "",
    bio: "",
    license_number: "",
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
      const profileResult = await dispatch(updateDriverProfile({
        data: {
          first_name: formData.first_name,
          last_name: formData.last_name,
          display_name: formData.display_name,
          phone_number: formData.phone_number,
          bio: formData.bio,
          license_number: formData.license_number,
        },
      }));
      if (updateDriverProfile.rejected.match(profileResult)) return;

      // Re-fetch the merged user and driver profile after the save.
      await dispatch(fetchProfile());

      navigate("/profile");
    } catch (err) {
      console.error("Update failed", err);
    }
  };

  if (completionMode === "complete" || completionMode === "manage") {
    return <DriverRegistrationCompletion mode={completionMode} />;
  }

  if (loading && !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#009849]" />
      </div>
    );
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
            {avatarPhoto ? (
              <img
                src={avatarPhoto}
                alt={fullName}
                className="h-[76px] w-[76px] rounded-full border-[3px] border-white/50 object-cover"
              />
            ) : (
              <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-[3px] border-white/50 bg-white/15 text-[26px] font-black text-white">
                {initials}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-6 w-full max-w-3xl px-4 sm:px-6">
        <form onSubmit={handleSubmit}>
          <div className="space-y-5">
            {updateError && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] p-3.5 text-[13px] text-[#EF4444]"
              >
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold">Update Failed</p>
                  <p>{typeof updateError === 'string' ? updateError : JSON.stringify(updateError)}</p>
                </div>
              </div>
            )}

            {/* Section: Personal Info */}
            <section className={SECTION_CARD_CLS}>
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F0FAF2]">
                  <User size={20} className="text-[#009849]" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[16px] font-extrabold text-[#111827]">
                    Personal Information
                  </h2>
                  <p className="text-[13px] text-[#6B7280]">
                    Your basic account details
                  </p>
                </div>
              </div>

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
                    rows={3}
                    className={TEXTAREA_CLS}
                  />
                </div>
              </div>
            </section>

            {/* Section: Vehicle & License */}
            <section className={SECTION_CARD_CLS}>
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F0FAF2]">
                  <User size={20} className="text-[#009849]" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[16px] font-extrabold text-[#111827]">
                    License Details
                  </h2>
                  <p className="text-[13px] text-[#6B7280]">
                    Your driving licence number
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label htmlFor="license_number" className={LABEL_CLS}>License Number</label>
                  <input
                    type="text"
                    id="license_number"
                    name="license_number"
                    value={formData.license_number}
                    onChange={handleInputChange}
                    placeholder="Enter license number"
                    className={VEHICLE_INPUT_CLS}
                  />
                </div>
              </div>
            </section>

            <div>
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
      </main>
    </div>
  );
};

export default DriverProfileUpdate;
