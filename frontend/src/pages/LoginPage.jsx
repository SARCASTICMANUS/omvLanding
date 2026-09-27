import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import { loginUser } from "../features/auth/authSlice";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Loader, Lock, Mail } from "lucide-react";
import { APP_ROUTES } from "../constants/routes";
import { ADMIN_ROLES, DRIVER_ROLES } from "../constants/roles";
import { normalizeRole } from "../utils/roles";
import loginVayyImage from "../assets/loginVayy.png";

// Mobile parity: vayy_app/src/auth/screens/LoginPage.jsx error box copy.
const resolveErrorMessage = (error) => {
  if (!error) return "";
  if (typeof error === "string") return error.slice(0, 100);
  if (Array.isArray(error?.non_field_errors)) return error.non_field_errors[0];
  if (Array.isArray(error?.email)) return error.email[0];
  if (Array.isArray(error?.password)) return error.password[0];
  return (
    error.detail ||
    error.error ||
    error.message ||
    (error.email && !Array.isArray(error.email) ? error.email : "") ||
    "Invalid email or password."
  );
};

const LoginPage = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const { loading, error, isAuthenticated, user } = useSelector(
    (state) => state.auth,
  );

  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Role-based landing (mobile AppNavigator parity: admin / driver / passenger)
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const role = normalizeRole(user.role);
    if (ADMIN_ROLES.includes(role)) navigate(APP_ROUTES.admin, { replace: true });
    else if (DRIVER_ROLES.includes(role))
      navigate(APP_ROUTES.driverLive, { replace: true });
    else navigate(APP_ROUTES.root, { replace: true });
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(loginUser(formData));
  };

  const inputShellClass =
    "mb-3.5 flex h-[52px] items-center gap-2.5 rounded-[14px] border-[1.5px] border-[#e5e5e5] bg-[#fafafa] px-3.5 transition-colors focus-within:border-[#009849] focus-within:bg-[#f0faf2]";
  const inputClass =
    "h-full min-w-0 flex-1 bg-transparent text-[15px] text-[#111111] outline-none placeholder:text-[#aaaaaa]";

  return (
    <div className="flex min-h-dvh flex-col bg-[#0d1f0f]">
      {/* ── Hero image (mobile heroContainer / heroImage / heroOverlay) ── */}
      <div className="relative h-[48vh] min-h-[260px] overflow-hidden bg-[#053D24]">
        <img
          src={loginVayyImage}
          alt=""
          className="absolute left-0 top-0 h-[140%] w-full object-cover"
        />
        <button
          type="button"
          onClick={() => navigate(APP_ROUTES.root)}
          aria-label="Back to home"
          className="absolute left-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[#111827] shadow-md transition active:scale-95"
        >
          <ArrowLeft size={21} />
        </button>
        <div className="relative flex h-full flex-col items-center justify-end px-6 pb-[22px]">
          <p className="text-center text-[36px] font-black leading-[1.15] tracking-[-1px] text-white">
            OMV
            <br />
            onmyvayy
          </p>
          <p className="mt-[1px] text-center text-[14px] font-normal text-white/70">
            Your Ride. Your Route.
          </p>
        </div>
      </div>

      {/* ── Bottom sheet (mobile bottomSheet / dragHandle) ── */}
      <div className="flex flex-1 flex-col rounded-t-[28px] bg-white px-6 pb-6 pt-6">
        <div className="mx-auto mb-5 h-1 w-10 shrink-0 rounded-full bg-[#e0e0e0]" />

        <div className="mx-auto w-full max-w-md">
          <h1 className="mb-1 text-[26px] font-extrabold tracking-[-0.5px] text-[#111111]">
            Welcome Back
          </h1>
          <p className="mb-3 text-[13px] font-normal text-[#888888]">
            Sign in to your OMV account
          </p>

          {error ? (
            <div
              role="alert"
              className="mb-4 rounded-[10px] border border-[#fecaca] bg-[#fef2f2] p-3 text-[13px] text-[#ef4444]"
            >
              {resolveErrorMessage(error)}
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <label
              htmlFor="login-email"
              className="mb-1.5 block text-[13px] font-semibold text-[#333333]"
            >
              Email Address
            </label>
            <div className={inputShellClass}>
              <Mail size={20} className="shrink-0 text-[#888888]" />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className={inputClass}
              />
            </div>

            {/* Password */}
            <label
              htmlFor="login-password"
              className="mb-1.5 block text-[13px] font-semibold text-[#333333]"
            >
              Password
            </label>
            <div className={inputShellClass}>
              <Lock size={20} className="shrink-0 text-[#888888]" />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="shrink-0 text-[#888888] transition-colors active:opacity-60"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {/* Remember me + Forgot password */}
            <div className="mb-5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setRememberMe((v) => !v)}
                aria-pressed={rememberMe}
                className="flex items-center"
              >
                <span
                  className={`mr-2 flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border-[1.5px] ${
                    rememberMe
                      ? "border-[#009849] bg-[#009849]"
                      : "border-[#cccccc] bg-white"
                  }`}
                >
                  {rememberMe && (
                    <Check size={11} strokeWidth={3.5} className="text-white" />
                  )}
                </span>
                <span className="text-[13px] font-medium text-[#444444]">
                  Remember me
                </span>
              </button>
              <Link
                to={APP_ROUTES.forgotPassword}
                className="text-[13px] font-semibold text-[#009849] hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            {/* Sign in */}
            <button
              type="submit"
              disabled={loading}
              className="mb-5 flex h-[54px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#009849] text-[16px] font-bold tracking-[0.3px] text-white shadow-[0_4px_12px_rgba(0,152,73,0.35)] transition-colors hover:bg-[#007A3B] disabled:opacity-70"
            >
              {loading ? (
                <Loader size={20} className="animate-spin" />
              ) : (
                <>
                  Sign In <ArrowRight size={18} strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>

          {/* Create account */}
          <p className="flex items-center justify-center text-[13px] text-[#888888]">
            Don&#39;t have an account?
            <Link
              to={APP_ROUTES.register}
              className="ml-1 text-[13px] font-bold text-[#009849] hover:underline"
            >
              Create free account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
