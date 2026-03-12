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
  ChevronLeft,
  School,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";

const RegisterPage = () => {
  const [step, setStep] = useState(1);
  const [universities, setUniversities] = useState([]);
  const [formData, setFormData] = useState({
    email: "",
    otp: "",
    password: "",
    role: "student",
    university: "",
    vehicle_type: "bus",
    vehicle_number: "",
    first_name: "",
    last_name: "",
  });
  const [loading, setLoading] = useState(false);

  const { isAuthenticated } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate("/");
    fetchUniversities();
  }, [isAuthenticated, navigate]);

  const fetchUniversities = async () => {
    try {
      const res = await api.get("/api/universities/");
      setUniversities(res.data);
    } catch (e) {
      console.error("Failed to load universities");
    }
  };

  const handleSendOTP = async () => {
    if (!formData.email) return alert("Email required");
    setLoading(true);
    try {
      await api.post("/api/auth/send-otp/", { email: formData.email });
      setStep(2);
    } catch (e) {
      alert("Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!formData.otp) return alert("OTP required");
    setLoading(true);
    try {
      await api.post("/api/auth/verify-otp/", {
        email: formData.email,
        otp: formData.otp,
      });
      setStep(3);
    } catch (e) {
      alert("Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!formData.university && formData.role !== "passenger") {
      return alert("Please select your University");
    }
    setLoading(true);
    try {
      await api.post("/api/auth/register/", formData);
      navigate("/login");
    } catch (err) {
      alert("Registration Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
      {/* Header Logo */}
      <div className="mb-8 flex flex-col items-center">
        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-2xl mb-3 rotate-3">
          V
        </div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">
          Join the Network
        </h1>
        <p className="text-slate-500 text-sm font-medium">
          University Transit & Ride Sharing
        </p>
      </div>

      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 ring-1 ring-slate-200/50">
        {/* Progress Bar */}
        <div className="bg-slate-50/50 p-6 border-b flex justify-between px-12">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black transition-all duration-500 ${
                  step >= s
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110"
                    : "bg-slate-200 text-slate-400"
                }`}
              >
                {step > s ? <CheckCircle2 size={20} /> : s}
              </div>
              <span
                className={`text-[10px] uppercase tracking-[0.2em] font-black ${step >= s ? "text-indigo-600" : "text-slate-400"}`}
              >
                {s === 1 ? "Start" : s === 2 ? "Verify" : "Details"}
              </span>
            </div>
          ))}
        </div>

        <div className="p-10 min-h-[450px] flex flex-col justify-center">
          {/* STEP 1: Email */}
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-slate-800">
                  Welcome aboard!
                </h3>
                <p className="text-slate-500 text-sm font-medium">
                  Enter your email to verify your identity.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  University or Personal Email
                </label>
                <div className="relative group">
                  <Mail
                    className="absolute left-4 top-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors"
                    size={20}
                  />
                  <input
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium text-slate-700"
                    placeholder="name@university.edu"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
              </div>
              <button
                onClick={handleSendOTP}
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition shadow-xl hover:shadow-indigo-500/30 flex justify-center items-center gap-3 disabled:bg-slate-200 disabled:shadow-none"
              >
                {loading ? (
                  "Initiating..."
                ) : (
                  <>
                    Continue <ChevronRight size={20} />
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 2: OTP */}
          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-slate-800">
                  Check your mail
                </h3>
                <p className="text-slate-500 text-sm font-medium">
                  We've sent a code to{" "}
                  <span className="text-indigo-600 font-bold">
                    {formData.email}
                  </span>
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  6-Digit Verification Code
                </label>
                <div className="relative">
                  <KeyRound
                    className="absolute left-4 top-4 text-slate-400"
                    size={20}
                  />
                  <input
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all tracking-[0.5em] font-black text-2xl text-slate-800 text-center"
                    placeholder="••••••"
                    maxLength={6}
                    value={formData.otp}
                    onChange={(e) =>
                      setFormData({ ...formData, otp: e.target.value })
                    }
                  />
                </div>
              </div>
              <button
                onClick={handleVerifyOTP}
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition shadow-xl hover:shadow-indigo-500/30"
              >
                {loading ? "Authenticating..." : "Verify Identity"}
              </button>
              <button
                onClick={() => setStep(1)}
                className="w-full text-slate-400 text-xs font-bold hover:text-indigo-600 hover:underline transition"
              >
                Wait, I entered the wrong email
              </button>
            </div>
          )}

          {/* STEP 3: Details */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Name & Password */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Full Name
                  </label>
                  <input
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                    placeholder="John Doe"
                    onChange={(e) =>
                      setFormData({ ...formData, first_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Secure Password
                  </label>
                  <input
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                    type="password"
                    placeholder="••••••••"
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Who are you?
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "student", icon: GraduationCap, label: "Student" },
                    { id: "driver", icon: Car, label: "Driver" },
                    {
                      id: "university_admin",
                      icon: ShieldCheck,
                      label: "Admin",
                    },
                    { id: "passenger", icon: User, label: "Public" },
                  ].map((role) => (
                    <div
                      key={role.id}
                      onClick={() =>
                        setFormData({ ...formData, role: role.id })
                      }
                      className={`cursor-pointer border-2 rounded-2xl p-3 flex flex-col items-center gap-2 transition-all ${formData.role === role.id ? "border-indigo-600 bg-indigo-50 text-indigo-700 scale-105 shadow-md" : "border-slate-100 hover:border-slate-300 text-slate-400 bg-slate-50/50"}`}
                    >
                      <role.icon size={20} />
                      <span className="font-black text-[9px] uppercase tracking-tighter">
                        {role.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* University Selection (Only for specific roles) */}
              {formData.role !== "passenger" && (
                <div className="space-y-2 animate-in fade-in duration-300">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Your College
                  </label>
                  <div className="relative">
                    <School
                      className="absolute left-4 top-4 text-slate-400"
                      size={18}
                    />
                    <select
                      value={formData.university}
                      onChange={(e) =>
                        setFormData({ ...formData, university: e.target.value })
                      }
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm appearance-none"
                    >
                      <option value="">Select University...</option>
                      {universities.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Driver Specifics */}
              {formData.role === "driver" && (
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 animate-in zoom-in-95 duration-300 shadow-inner">
                  <div className="flex items-center gap-2 mb-1">
                    <Bus size={14} className="text-indigo-600" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Bus Details
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      className="p-3 border rounded-xl bg-white text-xs font-bold"
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          vehicle_type: e.target.value,
                        })
                      }
                    >
                      <option value="bus">Transit Bus</option>
                      <option value="van">Shuttle Van</option>
                      <option value="car">Staff Car</option>
                    </select>
                    <input
                      className="p-3 border rounded-xl placeholder:text-slate-400 text-xs font-bold"
                      placeholder="Bus Number (e.g. B-704)"
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          vehicle_number: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleRegister}
                disabled={loading}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 transition shadow-xl hover:shadow-emerald-500/30"
              >
                {loading ? "Finalizing Profile..." : "Complete Setup"}
              </button>
            </div>
          )}
        </div>

        {step === 1 && (
          <div className="bg-slate-50/50 p-6 text-center text-xs font-bold text-slate-500 border-t border-slate-100">
            Already a member?{" "}
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
