import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import api from "../utils/api";
import {
  Mail,
  Lock,
  User,
  KeyRound,
  Car,
  Bus,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Phone,
  ShieldCheck,
  FileText,
} from "lucide-react";

const ROLES = [
  {
    id: "passenger",
    icon: User,
    label: "Passenger",
    desc: "Track public buses near you",
    color: "indigo",
  },
  {
    id: "driver",
    icon: Car,
    label: "Driver",
    desc: "Share your live location",
    color: "emerald",
  },
];

const VEHICLE_TYPES = [
  { value: "bus", label: "Transit Bus" },
  { value: "minibus", label: "Minibus" },
  { value: "van", label: "Shuttle Van" },
  { value: "auto", label: "Auto-Rickshaw" },
  { value: "tempo", label: "Tempo Traveller" },
  { value: "car", label: "Car" },
];

const InputField = ({ icon: Icon, className = "", ...props }) => (
  <div className="relative group">
    {Icon && (
      <Icon
        className="absolute left-4 top-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
        size={18}
      />
    )}
    <input
      className={`w-full ${
        Icon ? "pl-12" : "pl-4"
      } pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium text-slate-700 text-sm placeholder:text-slate-400 ${className}`}
      {...props}
    />
  </div>
);

const RegisterPage = () => {
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
    if (isAuthenticated) navigate("/");
    fetchCities();
  }, [isAuthenticated, navigate]);

  const fetchCities = async () => {
    try {
      const res = await api.get("/api/cities/");
      // Handle DRF paginated response (returns { results: [] }) or direct array
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setCities(data);
    } catch (e) {
      console.warn("Could not load cities");
    }
  };

  const set = (key, val) => setFormData((f) => ({ ...f, [key]: val }));

  const handleSendOTP = async () => {
    setError("");
    if (!formData.email) return setError("Email is required");
    setLoading(true);
    try {
      await api.post("/api/auth/send-otp/", { email: formData.email });
      setStep(2);
    } catch (e) {
      setError("Failed to send OTP. Please check your email and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setError("");
    if (!formData.otp) return setError("Enter the OTP sent to your email");
    setLoading(true);
    try {
      await api.post("/api/auth/verify-otp/", {
        email: formData.email,
        otp: formData.otp,
      });
      setStep(3);
    } catch (e) {
      setError("Invalid or expired OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError("");
    if (!formData.first_name) return setError("Please enter your name");
    if (!formData.password || formData.password.length < 6)
      return setError("Password must be at least 6 characters");
    setLoading(true);
    try {
      await api.post("/api/auth/register/", {
        email: formData.email,
        password: formData.password,
        role: formData.role,
        city: formData.city || undefined,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone_number: formData.phone_number,
        ...(formData.role === "driver" && {
          license_number: formData.license_number,
          vehicle_type: formData.vehicle_type,
        }),
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-4 font-sans">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center">
        <div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-2xl shadow-indigo-500/40 mb-3">
          V
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">
          Join Vayy
        </h1>
        <p className="text-indigo-300 text-sm font-medium mt-1">
          Public Transport Tracking · Open to Everyone
        </p>
      </div>

      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden">
        {/* Step progress */}
        <div className="bg-slate-50 px-12 py-5 border-b flex justify-between">
          {[
            { n: 1, label: "Email" },
            { n: 2, label: "Verify" },
            { n: 3, label: "Profile" },
          ].map(({ n, label }) => (
            <div key={n} className="flex flex-col items-center gap-1.5">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black transition-all duration-500 ${
                  step >= n
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110"
                    : "bg-slate-200 text-slate-400"
                }`}
              >
                {step > n ? <CheckCircle2 size={18} /> : n}
              </div>
              <span
                className={`text-[10px] uppercase tracking-widest font-black ${
                  step >= n ? "text-indigo-600" : "text-slate-400"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="p-10 min-h-[400px] flex flex-col justify-center">
          {/* STEP 1: Email */}
          {step === 1 && (
            <div className="space-y-7">
              <div className="text-center">
                <h3 className="text-2xl font-black text-slate-800">
                  Get started
                </h3>
                <p className="text-slate-500 text-sm mt-1">
                  Enter your email to receive a verification code
                </p>
              </div>

              {/* Role picker at the very top */}
              <div className="grid grid-cols-2 gap-3">
                {ROLES.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => set("role", r.id)}
                    className={`border-2 rounded-2xl p-4 flex flex-col items-center gap-2 text-left transition-all ${
                      formData.role === r.id
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 scale-[1.02] shadow-md"
                        : "border-slate-100 bg-slate-50 hover:border-slate-300 text-slate-500"
                    }`}
                  >
                    <r.icon size={22} />
                    <span className="font-black text-sm">{r.label}</span>
                    <span className="text-[11px] text-center leading-tight opacity-70">
                      {r.desc}
                    </span>
                  </button>
                ))}
              </div>

              <InputField
                icon={Mail}
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => set("email", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
              />

              {error && (
                <p className="text-red-500 text-xs font-semibold text-center">
                  {error}
                </p>
              )}

              <button
                onClick={handleSendOTP}
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-xl hover:shadow-indigo-500/30 flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {loading ? "Sending..." : <>Continue <ChevronRight size={18} /></>}
              </button>
            </div>
          )}

          {/* STEP 2: OTP */}
          {step === 2 && (
            <div className="space-y-7">
              <div className="text-center">
                <h3 className="text-2xl font-black text-slate-800">
                  Check your inbox
                </h3>
                <p className="text-slate-500 text-sm mt-1">
                  Code sent to{" "}
                  <span className="text-indigo-600 font-bold">
                    {formData.email}
                  </span>
                </p>
              </div>

              <InputField
                icon={KeyRound}
                placeholder="6-digit code"
                maxLength={6}
                value={formData.otp}
                onChange={(e) => set("otp", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyOTP()}
                className="text-center tracking-[0.5em] text-2xl"
              />

              {error && (
                <p className="text-red-500 text-xs font-semibold text-center">
                  {error}
                </p>
              )}

              <button
                onClick={handleVerifyOTP}
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify Code"}
              </button>
              <button
                onClick={() => { setStep(1); setError(""); }}
                className="w-full text-slate-400 text-xs font-bold hover:text-indigo-600 transition"
              >
                Wrong email? Go back
              </button>
            </div>
          )}

          {/* STEP 3: Profile details */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="text-center">
                <h3 className="text-2xl font-black text-slate-800">
                  {formData.role === "driver" ? "Driver Profile" : "Your Profile"}
                </h3>
                <p className="text-slate-500 text-sm mt-1">
                  A few more details and you're in
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    First Name
                  </label>
                  <InputField
                    placeholder="John"
                    value={formData.first_name}
                    onChange={(e) => set("first_name", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Last Name
                  </label>
                  <InputField
                    placeholder="Doe"
                    value={formData.last_name}
                    onChange={(e) => set("last_name", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Phone
                  </label>
                  <InputField
                    icon={Phone}
                    placeholder="+91 98765..."
                    type="tel"
                    value={formData.phone_number}
                    onChange={(e) => set("phone_number", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Password
                  </label>
                  <InputField
                    icon={Lock}
                    type="password"
                    placeholder="Min 6 chars"
                    value={formData.password}
                    onChange={(e) => set("password", e.target.value)}
                  />
                </div>
              </div>

              {/* Optional city */}
              {cities.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    City (optional)
                  </label>
                  <div className="relative">
                    <MapPin
                      className="absolute left-4 top-4 text-slate-400"
                      size={18}
                    />
                    <select
                      value={formData.city}
                      onChange={(e) => set("city", e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm appearance-none text-slate-700"
                    >
                      <option value="">Select your city...</option>
                      {cities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.state ? `, ${c.state}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Driver-specific fields */}
              {formData.role === "driver" && (
                <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Bus size={14} className="text-emerald-600" />
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                      Driver Details
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Vehicle Type
                      </label>
                      <select
                        className="w-full p-3 border border-slate-200 rounded-xl bg-white text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                        value={formData.vehicle_type}
                        onChange={(e) => set("vehicle_type", e.target.value)}
                      >
                        {VEHICLE_TYPES.map((v) => (
                          <option key={v.value} value={v.value}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        License No.
                      </label>
                      <div className="relative">
                        <FileText
                          className="absolute left-3 top-3 text-slate-400"
                          size={16}
                        />
                        <input
                          className="w-full pl-9 pr-3 py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                          placeholder="DL-1234567890"
                          value={formData.license_number}
                          onChange={(e) =>
                            set("license_number", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <p className="text-red-500 text-xs font-semibold text-center">
                  {error}
                </p>
              )}

              <button
                onClick={handleRegister}
                disabled={loading}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-xl hover:shadow-emerald-500/30 disabled:opacity-50"
              >
                {loading ? "Creating account..." : "Complete Setup ✓"}
              </button>
            </div>
          )}
        </div>

        {step === 1 && (
          <div className="bg-slate-50 p-5 text-center text-xs font-bold text-slate-500 border-t">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-indigo-600 font-black hover:underline ml-1"
            >
              Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegisterPage;
