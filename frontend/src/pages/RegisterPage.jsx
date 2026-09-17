import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import {
  Mail,
  User,
  KeyRound,
  Car,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

import PassengerRegisterForm from "../features/passenger/components/PassengerRegisterForm";
import DriverRegisterForm from "../features/driver/components/DriverRegisterForm";
import api from "../lib/api";
import { API_PATHS } from "../constants/apiPaths";

const ROLES = [
  {
    id: "passenger",
    icon: User,
    label: "Passenger",
    desc: "Track public buses near you",
  },
  {
    id: "driver",
    icon: Car,
    label: "Driver",
    desc: "Share your live location",
  },
];

const InputField = ({ icon: Icon, className = "", ...props }) => (
  <div className="group relative">
    {Icon && (
      <Icon
        className="absolute left-4 top-4 text-slate-400 transition-colors group-focus-within:text-indigo-500"
        size={18}
      />
    )}

    <input
      className={`w-full ${
        Icon ? "pl-12" : "pl-4"
      } rounded-2xl border border-slate-200 bg-slate-50 py-4 pr-4 text-sm font-medium text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 ${className}`}
      {...props}
    />
  </div>
);

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [cities, setCities] = useState([]);
  const [formData, setFormData] = useState({
    email: "",
    otp: "",
    password: "",
    role: "passenger",
    city: "",
    phone_number: "",
    first_name: "",
    last_name: "",
    license_number: "",
    vehicle_type: "bus",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { isAuthenticated } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/");
      return;
    }

    fetchCities();
  }, [isAuthenticated, navigate]);

  const fetchCities = async () => {
    try {
      const res = await api.get(API_PATHS.cities.list);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setCities(data);
    } catch {
      console.warn("Could not load cities");
    }
  };

  const updateFormData = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSendOTP = async () => {
    setError("");

    if (!formData.email) {
      setError("Email is required");
      return;
    }

    setLoading(true);

    try {
      await api.post(API_PATHS.auth.resendOtp, {
        email: formData.email,
      });

      setStep(2);
    } catch {
      setError("Failed to send Safety Code. Please check your email and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setError("");

    if (!formData.otp) {
      setError("Enter the Safety Code sent to your email");
      return;
    }

    setLoading(true);

    try {
      await api.post(API_PATHS.auth.verifyOtp, {
        email: formData.email,
        otp: formData.otp,
      });

      setStep(3);
    } catch {
      setError("Invalid or expired Safety Code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePassengerSubmit = async (payload) => {
    setError("");
    setLoading(true);

    try {
      await api.post(API_PATHS.auth.register, {
        email: formData.email,
        password: payload.password,
        role: "passenger",
        city: payload.city || undefined,
        phone_number: payload.phone_number || "",
        first_name: payload.first_name || "",
        last_name: payload.last_name || "",
        gender: payload.gender,
        dob: payload.dob,
        primary_travel_purpose: payload.primary_travel_purpose,
        travel_frequency: payload.travel_frequency,
        usual_travel_time: payload.usual_travel_time,
        same_route_daily: payload.same_route_daily,
        state: payload.state,
      });

      navigate("/login");
    } catch (err) {
      const msg =
        err?.response?.data?.email?.[0] ||
        err?.response?.data?.detail ||
        "Registration failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDriverSubmit = async (payload) => {
    setError("");
    setLoading(true);

    try {
      const submitData = new FormData();

      submitData.append("email", formData.email);
      submitData.append("password", payload.password);
      submitData.append("role", "driver");
      submitData.append("first_name", payload.first_name || "");
      submitData.append("last_name", payload.last_name || "");
      submitData.append("phone_number", payload.phone_number || "");
      submitData.append("gender", payload.gender);
      submitData.append("dob", payload.dob);
      submitData.append("license_number", payload.license_number || "");
      submitData.append("vehicle_type", payload.vehicle_type || "");
      submitData.append("vehicle_no", payload.vehicle_no || "");
      submitData.append(
        "driving_experience",
        payload.driving_experience || "",
      );

      if (payload.dl_file) {
        submitData.append("dl_file", payload.dl_file);
      }

      await api.post(API_PATHS.auth.register, submitData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      navigate("/login");
    } catch (err) {
      const msg =
        err?.response?.data?.email?.[0] ||
        err?.response?.data?.detail ||
        "Registration failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (step === 3) {
    return formData.role === "driver" ? (
      <DriverRegisterForm
        email={formData.email}
        onBack={() => {
          setStep(2);
          setError("");
        }}
        onSubmit={handleDriverSubmit}
        loading={loading}
        error={error}
      />
    ) : (
      <PassengerRegisterForm
        email={formData.email}
        cities={cities}
        onBack={() => {
          setStep(2);
          setError("");
        }}
        onSubmit={handlePassengerSubmit}
        loading={loading}
        error={error}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 font-sans">
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500 text-3xl font-black text-white shadow-2xl shadow-indigo-500/40">
          V
        </div>

        <h1 className="text-3xl font-black tracking-tight text-white">
          Join Vayy
        </h1>

        <p className="mt-1 text-sm font-medium text-indigo-300">
          Public Transport Tracking · Open to Everyone
        </p>
      </div>

      <div className="w-full max-w-xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex justify-between border-b bg-slate-50 px-12 py-5">
          {[
            { n: 1, label: "Email" },
            { n: 2, label: "Verify" },
            { n: 3, label: "Profile" },
          ].map(({ n, label }) => (
            <div key={n} className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-black transition-all duration-500 ${
                  step >= n
                    ? "scale-110 bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                    : "bg-slate-200 text-slate-400"
                }`}
              >
                {step > n ? <CheckCircle2 size={18} /> : n}
              </div>

              <span
                className={`text-[10px] font-black uppercase tracking-widest ${
                  step >= n ? "text-indigo-600" : "text-slate-400"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex min-h-[400px] flex-col justify-center p-10">
          {step === 1 && (
            <div className="space-y-7">
              <div className="text-center">
                <h3 className="text-2xl font-black text-slate-800">
                  Get started
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Enter your email to receive a verification code
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {ROLES.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => updateFormData("role", role.id)}
                    className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-left transition-all ${
                      formData.role === role.id
                        ? "scale-[1.02] border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md"
                        : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <role.icon size={22} />
                    <span className="text-sm font-black">{role.label}</span>
                    <span className="text-center text-[11px] leading-tight opacity-70">
                      {role.desc}
                    </span>
                  </button>
                ))}
              </div>

              <InputField
                icon={Mail}
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => updateFormData("email", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendOTP();
                }}
              />

              {error && (
                <p className="text-center text-xs font-semibold text-red-500">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={handleSendOTP}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl transition-all hover:bg-indigo-700 hover:shadow-indigo-500/30 active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  "Sending..."
                ) : (
                  <>
                    Continue <ChevronRight size={18} />
                  </>
                )}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-7">
              <div className="text-center">
                <h3 className="text-2xl font-black text-slate-800">
                  Check your inbox
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Code sent to{" "}
                  <span className="font-bold text-indigo-600">
                    {formData.email}
                  </span>
                </p>
              </div>

              <InputField
                icon={KeyRound}
                placeholder="6-digit code"
                maxLength={6}
                value={formData.otp}
                onChange={(e) => updateFormData("otp", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleVerifyOTP();
                }}
                className="text-center text-2xl tracking-[0.5em]"
              />

              {error && (
                <p className="text-center text-xs font-semibold text-red-500">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={handleVerifyOTP}
                disabled={loading}
                className="w-full rounded-2xl bg-indigo-600 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl transition-all hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify Code"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setError("");
                }}
                className="w-full text-xs font-bold text-slate-400 transition hover:text-indigo-600"
              >
                Wrong email? Go back
              </button>
            </div>
          )}
        </div>

        {step === 1 && (
          <div className="border-t bg-slate-50 p-5 text-center text-xs font-bold text-slate-500">
            Already have an account?{" "}
            <Link
              to="/login"
              className="ml-1 font-black text-indigo-600 hover:underline"
            >
              Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
