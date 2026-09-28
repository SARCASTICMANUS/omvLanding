import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Bike,
  Bell,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Navigation,
  MapPin,
  Phone,
  User,
} from "lucide-react";

import { APP_ROUTES } from "../constants/routes";
import { API_PATHS } from "../constants/apiPaths";
import { PASSWORD_RULES } from "../features/auth/validators";
import {
  loginUser,
  registerUser,
  resendOtp,
  resendRegistrationOtp,
  sendRegistrationOtp,
  verifyAndRegister,
  verifyOtp,
} from "../features/auth/authSlice";
import { OTPInput, StickyCTA } from "../components/vayy";
import api from "../lib/api";

/* Role selection mirrors vayy_app/src/auth/screens/RoleSelectionScreen.jsx */
const ROLE_OPTIONS = [
  {
    value: "passenger",
    title: "Buddy",
    subtitle: "I want to find rides.",
    icon: User,
  },
  {
    value: "bikedriver",
    title: "Marshal",
    subtitle: "I want to drive and earn.",
    icon: Navigation,
  },
  {
    value: "autodriver",
    title: "Auto Marshal",
    subtitle: "I want to drive an auto and earn.",
    icon: Bike,
  },
];

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const NAME_RE = /^[A-Za-z\s]{3,50}$/;
const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;
const DRIVER_ONBOARDING_DRAFT_KEY = "OMV_DRIVER_ONBOARDING_DRAFT";

const extractError = (payload, fallback) => {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload.slice(0, 160);
  if (Array.isArray(payload.non_field_errors)) return payload.non_field_errors[0];
  if (Array.isArray(payload.email)) return payload.email[0];
  if (Array.isArray(payload.password)) return payload.password[0];
  if (Array.isArray(payload.otp)) return payload.otp[0];
  if (Array.isArray(payload.role)) return payload.role[0];
  return payload.message || payload.detail || payload.error || fallback;
};

/* ── Mobile replica primitives ─────────────────────────────
   vayy_app/src/auth/screens/RoleSelectionScreen.jsx back hit-box,
   PassengerStep1Basic header, components/ProgressBar.jsx. */

const BackButton = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Go back"
    className="ml-4 mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#111827] transition-opacity active:opacity-60"
  >
    <ArrowLeft size={22} />
  </button>
);

const PROGRESS_FILLS = ["w-0", "w-1/4", "w-1/2", "w-3/4", "w-full"];

const ProgressBar = ({ current, total }) => {
  const fill =
    PROGRESS_FILLS[Math.round((current / total) * 4)] || "w-full";
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-[#e5e7eb]">
        <div className={`h-full rounded-[3px] bg-[#009849] ${fill}`} />
      </div>
      <span className="text-[12px] font-semibold text-[#6B7280]">
        Step {current} of {total}
      </span>
    </div>
  );
};

const FieldLabel = ({ htmlFor, children }) => (
  <label
    htmlFor={htmlFor}
    className="mb-1.5 mt-2 block text-[13px] font-semibold text-[#333333]"
  >
    {children}
  </label>
);

/* PassengerStep1Basic styles.inputWrap / inputFocused parity */
const inputShellClass = (isFocused) =>
  `mb-3.5 flex h-[52px] items-center gap-2.5 rounded-[14px] border-[1.5px] px-3.5 transition-colors ${
    isFocused
      ? "border-[#009849] bg-[#f0faf2]"
      : "border-[#e5e7eb] bg-[#fafafa]"
  }`;

const inputClass =
  "h-full min-w-0 flex-1 bg-transparent text-[15px] text-[#111827] outline-none placeholder:text-[#aaaaaa]";

export default function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state) => state.auth || {});

  const [step, setStep] = useState(1); // 1 role · 2 details · 3 verify · 4 done
  const [role, setRole] = useState(null);
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [permissions, setPermissions] = useState({ location: false, notifications: false });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [focused, setFocused] = useState(null);

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [resendTimer, setResendTimer] = useState(RESEND_SECONDS);
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const otpStep = role === "passenger" ? 4 : 3;

  const otpContainerRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated) navigate(APP_ROUTES.root, { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (step !== otpStep || resendTimer <= 0) return undefined;
    const id = window.setInterval(
      () => setResendTimer((t) => (t > 0 ? t - 1 : 0)),
      1000,
    );
    return () => window.clearInterval(id);
  }, [step, otpStep, resendTimer]);

  useEffect(() => {
    if (step === otpStep) {
      otpContainerRef.current?.querySelector("input")?.focus();
    }
  }, [step, otpStep]);

  const passwordRules = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(password) })),
    [password],
  );

  const validateDetails = () => {
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) return "Full name is required";
    if (!NAME_RE.test(trimmedName)) return "Enter at least 3 letters";
    if (!/^\d{10}$/.test(mobile)) return "Enter a valid 10-digit mobile number";
    if (!dob) return "Date of birth is required";
    if (!gender) return "Select your gender";
    if (!trimmedEmail) return "Email is required";
    if (!EMAIL_RE.test(trimmedEmail)) return "Enter a valid email";
    if (!password) return "Password is required";
    if (password.length < 8) return "Password must be at least 8 characters";
    if (password !== confirmPassword) return "Passwords do not match";
    if (!tosAccepted) return "Please accept the Terms of Service to continue";
    return "";
  };

  const startOtpTimer = () => setResendTimer(RESEND_SECONDS);

  const handleDetailsSubmit = async (event) => {
    event.preventDefault();
    const validationError = validateDetails();
    setFormError(validationError);
    if (validationError) return;

    setLoading(true);
    setFormError("");

    const payload = {
      email: email.trim().toLowerCase(),
      password,
      role,
      first_name: fullName.trim().split(/\s+/)[0] || "",
      last_name:
        fullName.trim().split(/\s+/).slice(1).join(" ") || "",
    };

    const action =
      role === "passenger"
        ? await dispatch(registerUser(payload))
        : await dispatch(sendRegistrationOtp(payload));

    const fulfilled = role === "passenger"
      ? registerUser.fulfilled.match(action)
      : sendRegistrationOtp.fulfilled.match(action);

    setLoading(false);

    if (!fulfilled) {
      setFormError(
        extractError(
          action.payload,
          role === "passenger"
            ? "Registration failed. Please try again."
            : "Failed to send Safety Code",
        ),
      );
      return;
    }

    setOtp(["", "", "", "", "", ""]);
    setOtpError("");
    startOtpTimer();
    setStep(3);
  };

  const verifyCode = async (code) => {
    if (code.length !== OTP_LENGTH) return;

    setLoading(true);
    setOtpError("");

    const action =
      role === "passenger"
        ? await dispatch(verifyOtp({ email, otp: code }))
        : await dispatch(verifyAndRegister({ email, otp: code }));

    const fulfilled = role === "passenger"
      ? verifyOtp.fulfilled.match(action)
      : verifyAndRegister.fulfilled.match(action);

    if (!fulfilled) {
      setLoading(false);
      setOtpError(
        extractError(action.payload, "Invalid Safety Code. Try again."),
      );
      return;
    }

    // Driver accounts are created by verify-and-register → sign them straight in
    // (vayy_app DriverRegistrationScreen.handleOtpVerified parity).
    if (role !== "passenger") {
      sessionStorage.setItem(DRIVER_ONBOARDING_DRAFT_KEY, JSON.stringify({
        fullName: fullName.trim(),
        phone: mobile,
        dob,
        gender,
        vehicleType: role === "autodriver" ? "auto" : "bike",
      }));
      const loginAction = await dispatch(
        loginUser({ email, password }),
      );
      setLoading(false);

      if (loginUser.fulfilled.match(loginAction)) {
        navigate(`${APP_ROUTES.driverProfileUpdate}?mode=complete`, { replace: true });
      } else {
        setOtpError(
          "Account created but sign in failed. Please sign in manually.",
        );
      }
      return;
    }

    try {
      await api.put(API_PATHS.auth.passengerProfile, {
        phone_number: mobile,
        dob,
        gender,
      });
    } catch {
      // The mobile app treats this profile update as non-blocking after OTP.
    }
    setLoading(false);
    setStep(5);
  };

  /* Design-system OTPInput (vayy_app OTPInput parity) drives the boxes;
     this keeps the page state + error reset on every keystroke. */
  const handleOtpChange = (next) => {
    setOtp(next);
    setOtpError("");
  };

  const handleResend = async () => {
    if (resendTimer > 0 || loading) return;
    setLoading(true);
    setOtpError("");

    const action =
      role === "passenger"
        ? await dispatch(resendOtp(email))
        : await dispatch(resendRegistrationOtp(email));

    setLoading(false);

    if (
      role === "passenger"
        ? resendOtp.fulfilled.match(action)
        : resendRegistrationOtp.fulfilled.match(action)
    ) {
      setOtp(["", "", "", "", "", ""]);
      startOtpTimer();
      otpContainerRef.current?.querySelector("input")?.focus();
    } else {
      setOtpError(extractError(action.payload, "Failed to resend Safety Code"));
    }
  };

  const otpValue = otp.join("");
  const isDriver = role !== "passenger";

  /* ─────────────── STEP 4 · SUCCESS ─────────────── */
  if (step === 5) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-white px-8 py-10">
        <div className="flex w-full max-w-md flex-col items-center">
          <div className="mb-6 flex h-[100px] w-[100px] items-center justify-center rounded-full bg-[rgba(0,152,73,0.1)]">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f0faf2]">
              <Check size={32} strokeWidth={3} className="text-[#009849]" />
            </div>
          </div>
          <h1 className="mb-2 text-center text-[24px] font-extrabold text-[#111827]">
            Welcome to OMV!
          </h1>
          <p className="mb-8 text-center text-[15px] leading-[22px] text-[#6B7280]">
            Your account is ready. Sign in to start finding rides.
          </p>
          <button
            type="button"
            onClick={() => navigate(APP_ROUTES.login)}
            className="flex h-[54px] items-center justify-center rounded-[18px] bg-[#009849] px-10 text-[16px] font-bold text-white shadow-[0_4px_12px_rgba(0,152,73,0.35)] transition-colors hover:bg-[#007A3B] active:opacity-90"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  /* ─────────────── STEP 1 · ROLE SELECTION ─────────────── */
  if (step === 1) {
    const selectedRole = ROLE_OPTIONS.find((option) => option.value === role);
    const ctaLabel = selectedRole
      ? `Continue as ${selectedRole.title}`
      : "Select your role";

    return (
      <div className="flex min-h-dvh flex-col bg-white">
        <BackButton onClick={() => navigate(APP_ROUTES.login)} />

        <div className="flex flex-1 flex-col justify-center px-6 pb-4">
          <div className="mx-auto w-full max-w-md">
            <h1 className="mb-2 text-[28px] font-black leading-tight tracking-[-0.5px] text-[#111827]">
              How will you use OMV?
            </h1>
            <p className="mb-8 text-[15px] text-[#6B7280]">
              Choose your role to get started
            </p>

            <div className="flex flex-col gap-4">
              {ROLE_OPTIONS.map((option) => {
                const active = role === option.value;
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRole(option.value)}
                    className={`relative flex min-h-[130px] w-full flex-col items-center justify-center rounded-[18px] bg-white px-6 py-6 text-center transition-all ${
                      active
                        ? "border-2 border-[#009849] shadow-[0_4px_12px_rgba(0,152,73,0.15)]"
                        : "border-[1.5px] border-[#e5e7eb] shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:border-[#009849]/40"
                    }`}
                  >
                    {active && (
                      <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#009849]">
                        <Check size={14} strokeWidth={3} className="text-white" />
                      </span>
                    )}
                    <span className="mb-3">
                      <Icon
                        size={36}
                        className={active ? "text-[#009849]" : "text-[#9ca3af]"}
                      />
                    </span>
                    <span
                      className={`mb-1 text-[20px] font-extrabold ${
                        active ? "text-[#009849]" : "text-[#111827]"
                      }`}
                    >
                      {option.title}
                    </span>
                    <span className="text-[14px] text-[#6B7280]">
                      {option.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-6 text-center text-[13px] text-[#888888]">
              Already have an account?{" "}
              <Link
                to={APP_ROUTES.login}
                className="font-bold text-[#009849] hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* RoleSelectionScreen footer CTA (gray while disabled) */}
        <div className="px-6 pb-4">
          <button
            type="button"
            disabled={!role}
            onClick={() => setStep(2)}
            className={`mx-auto flex h-14 w-full max-w-md items-center justify-center rounded-[18px] text-[16px] font-bold transition-all ${
              role
                ? "bg-[#009849] text-white shadow-[0_4px_12px_rgba(0,152,73,0.35)] active:opacity-90"
                : "bg-[#d1d5db] text-[#9ca3af]"
            }`}
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    );
  }

  /* ─────────────── STEP 2 · ACCOUNT DETAILS ─────────────── */
  if (step === 2) {
    return (
      <div className="flex min-h-dvh flex-col bg-white">
        <BackButton
          onClick={() => {
            setStep(1);
            setFormError("");
          }}
        />

        <div className="px-6">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-2">
              <h1 className="text-[24px] font-extrabold tracking-[-0.5px] text-[#111827]">
                Create Account
              </h1>
              <p className="mt-0.5 text-[14px] text-[#6B7280]">
                Let&#39;s start with the basics
              </p>
            </div>
          </div>
        </div>

        <ProgressBar current={1} total={isDriver ? 2 : 3} />

        <form onSubmit={handleDetailsSubmit} noValidate className="px-6 pb-32">
          <div className="mx-auto w-full max-w-md">
            {formError && (
              <div
                role="alert"
                className="mb-3 rounded-[10px] border border-[#fecaca] bg-[#fef2f2] p-3 text-[12px] text-[#ef4444]"
              >
                {formError}
              </div>
            )}

            <FieldLabel htmlFor="reg-name">Full Name</FieldLabel>
            <div className={inputShellClass(focused === "name")}>
              <User
                size={18}
                className={`shrink-0 ${
                  focused === "name" ? "text-[#009849]" : "text-[#9ca3af]"
                }`}
              />
              <input
                id="reg-name"
                type="text"
                autoComplete="name"
                placeholder="John Doe"
                value={fullName}
                onFocus={() => setFocused("name")}
                onBlur={() => setFocused(null)}
                onChange={(event) => setFullName(event.target.value)}
                className={inputClass}
              />
            </div>

            <FieldLabel htmlFor="reg-mobile">Mobile Number</FieldLabel>
            <div className={inputShellClass(focused === "mobile")}>
              <Phone
                size={18}
                className={`shrink-0 ${focused === "mobile" ? "text-[#009849]" : "text-[#9ca3af]"}`}
              />
              <input
                id="reg-mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                placeholder="9876543210"
                value={mobile}
                onFocus={() => setFocused("mobile")}
                onBlur={() => setFocused(null)}
                onChange={(event) => setMobile(event.target.value.replace(/\D/g, "").slice(0, 10))}
                className={inputClass}
              />
            </div>

            <div className="mb-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="reg-dob">Date of Birth</FieldLabel>
                <input
                  id="reg-dob"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={dob}
                  onChange={(event) => setDob(event.target.value)}
                  className="h-[52px] w-full rounded-[14px] border-[1.5px] border-[#e5e7eb] bg-[#fafafa] px-3.5 text-[15px] text-[#111827] outline-none focus:border-[#009849] focus:bg-[#f0faf2]"
                />
              </div>
              <div>
                <FieldLabel htmlFor="reg-gender">Gender</FieldLabel>
                <select
                  id="reg-gender"
                  value={gender}
                  onChange={(event) => setGender(event.target.value)}
                  className="h-[52px] w-full rounded-[14px] border-[1.5px] border-[#e5e7eb] bg-[#fafafa] px-3.5 text-[15px] text-[#111827] outline-none focus:border-[#009849] focus:bg-[#f0faf2]"
                >
                  <option value="">Select gender</option>
                  {["Male", "Female", "Other"].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>

            <FieldLabel htmlFor="reg-email">Email</FieldLabel>
            <div className={inputShellClass(focused === "email")}>
              <Mail
                size={18}
                className={`shrink-0 ${
                  focused === "email" ? "text-[#009849]" : "text-[#9ca3af]"
                }`}
              />
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                placeholder="email@example.com"
                value={email}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
              />
            </div>

            <FieldLabel htmlFor="reg-password">Password</FieldLabel>
            <div className={inputShellClass(focused === "password")}>
              <Lock
                size={18}
                className={`shrink-0 ${
                  focused === "password" ? "text-[#009849]" : "text-[#9ca3af]"
                }`}
              />
              <input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Create a strong password"
                value={password}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="shrink-0 text-[#888888] transition-colors active:opacity-60"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* PasswordChecklist parity */}
            <ul className="mb-4 flex flex-col gap-1.5">
              {passwordRules.map((rule) => (
                <li key={rule.key} className="flex items-center gap-2">
                  <span
                    className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                      rule.passed
                        ? "border-[#009849] bg-[#009849]"
                        : "border-[#d1d5db]"
                    }`}
                  >
                    {rule.passed && (
                      <Check size={10} strokeWidth={4} className="text-white" />
                    )}
                  </span>
                  <span
                    className={`text-[12px] ${
                      rule.passed
                        ? "font-semibold text-[#009849]"
                        : "text-[#6B7280]"
                    }`}
                  >
                    {rule.label}
                  </span>
                </li>
              ))}
            </ul>

            <FieldLabel htmlFor="reg-confirm">Confirm Password</FieldLabel>
            <div className={inputShellClass(focused === "confirm")}>
              <Lock
                size={18}
                className={`shrink-0 ${
                  focused === "confirm" ? "text-[#009849]" : "text-[#9ca3af]"
                }`}
              />
              <input
                id="reg-confirm"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onFocus={() => setFocused("confirm")}
                onBlur={() => setFocused(null)}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="shrink-0 text-[#888888] transition-colors active:opacity-60"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="mt-1.5 text-[12px] font-semibold text-[#ef4444]">
                Passwords do not match
              </p>
            )}

            <label className="mt-5 flex cursor-pointer items-start gap-3 text-[12px] leading-5 text-[#6B7280]">
              <input
                type="checkbox"
                checked={tosAccepted}
                onChange={() => setTosAccepted((value) => !value)}
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-[#d1d5db] accent-[#009849]"
              />
              <span>
                I agree to the{" "}
                <a
                  href={APP_ROUTES.terms}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-[#009849] underline underline-offset-2 hover:text-[#007A3B]"
                >
                  Terms of Service
                </a>
              </span>
            </label>

            <p className="mt-5 text-center text-[13px] text-[#888888]">
              Already have an account?{" "}
              <Link
                to={APP_ROUTES.login}
                className="font-bold text-[#009849] hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>

          {/* BottomStickyButton parity */}
          <StickyCTA type="submit" disabled={loading}>
            {loading && <Loader2 size={16} className="animate-spin" />}
            {isDriver ? "Continue to Safety Code" : "Create Account"}
          </StickyCTA>
        </form>
      </div>
    );
  }

  /* ─────────────── STEP 3 · SAFETY CODE ─────────────── */
  if (step === 3 && role === "passenger") {
    const permissionOptions = [
      {
        key: "location",
        title: "Enable Location",
        description: "OMV uses location to find rides near you.",
        Icon: MapPin,
      },
      {
        key: "notifications",
        title: "Notifications",
        description: "Get notified when your ride arrives.",
        Icon: Bell,
      },
    ];

    return (
      <div className="flex min-h-dvh flex-col bg-white">
        <BackButton onClick={() => setStep(2)} />
        <div className="px-6">
          <div className="mx-auto w-full max-w-md">
            <h1 className="text-[24px] font-extrabold tracking-[-0.5px] text-[#111827]">Permissions</h1>
            <p className="mt-1 text-[14px] text-[#6B7280]">Enable these to get the best experience</p>
          </div>
        </div>
        <div className="mx-auto mt-5 w-full max-w-md flex-1 px-6">
          <ProgressBar current={2} total={3} />
          <div className="mt-6 flex flex-col gap-3">
            {permissionOptions.map(({ key, title, description, Icon }) => {
              const enabled = permissions[key];
              return (
                <div key={key} className="flex items-center justify-between gap-4 rounded-[18px] border border-[#e5e7eb] bg-white p-4 shadow-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#f0faf2] text-[#009849]">
                      <Icon size={22} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-bold text-[#111827]">{title}</span>
                      <span className="mt-0.5 block text-[12px] leading-4 text-[#6B7280]">{description}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={title}
                    onClick={() => setPermissions((current) => ({ ...current, [key]: !current[key] }))}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${enabled ? "bg-[#009849]" : "bg-[#d1d5db]"}`}
                  >
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-center text-[12px] text-[#9ca3af]">You can change these anytime in Settings.</p>
        </div>
        <StickyCTA onClick={() => setStep(4)}>Continue</StickyCTA>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <BackButton
        onClick={() => {
          setStep(2);
          setOtpError("");
        }}
      />

      <div className="px-6">
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-[24px] font-extrabold tracking-[-0.5px] text-[#111827]">
            Verify Safety Code
          </h1>
          <p className="mt-1 text-[14px] text-[#6B7280]">
            Enter the code sent to{" "}
            <span className="font-bold text-[#111827]">{email}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              setStep(2);
              setOtpError("");
            }}
            className="mt-1 text-[13px] font-semibold text-[#009849] hover:underline"
          >
            Edit email?
          </button>
        </div>
      </div>

      <ProgressBar current={isDriver ? 2 : 3} total={isDriver ? 2 : 3} />

      <div
        ref={otpContainerRef}
        className="flex flex-1 flex-col justify-center px-6 pb-32"
      >
        <div className="mx-auto w-full max-w-md">
          <OTPInput
            length={OTP_LENGTH}
            value={otp}
            onChange={handleOtpChange}
            onComplete={(code) => verifyCode(code)}
            error={Boolean(otpError)}
          />

          {otpError ? (
            <p className="mb-4 mt-2 text-center text-[13px] text-[#ef4444]">
              {otpError}
            </p>
          ) : null}

          <p
            className={`text-center text-[13px] ${
              otpError ? "mt-2" : "mt-8"
            } text-[#6B7280]`}
          >
            {resendTimer > 0 ? (
              `Resend Safety Code in 00:${String(resendTimer).padStart(2, "0")}`
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="font-bold text-[#009849] hover:underline disabled:opacity-60"
              >
                Resend Safety Code
              </button>
            )}
          </p>
        </div>
      </div>

      {/* BottomStickyButton parity */}
      <StickyCTA
        onClick={() => verifyCode(otpValue)}
        disabled={loading || otpValue.length !== OTP_LENGTH}
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        Verify Safety Code
      </StickyCTA>
    </div>
  );
}
