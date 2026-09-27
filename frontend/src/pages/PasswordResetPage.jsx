import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Lock, Mail } from "lucide-react";
import api from "../lib/api";
import { API_PATHS } from "../constants/apiPaths";
import { APP_ROUTES } from "../constants/routes";
import { StickyCTA } from "../components/vayy";

/**
 * Password reset (mobile PasswordResetPage parity, completed end-to-end):
 *  1. email  → POST /api/accounts/forgot-password/  (sends safety code)
 *  2. otp + new password → POST /api/accounts/reset-password/
 *  3. success → back to sign in
 */
export default function PasswordResetPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = request code, 2 = enter code + new password
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const requestCode = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post(API_PATHS.auth.forgotPassword, { email: trimmed });
      setStep(2);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.detail ||
          "Could not send the safety code. Please check your email and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    if (!otp || otp.trim().length !== 6) {
      setError("Enter the 6-digit safety code from your email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post(API_PATHS.auth.resetPassword, {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        password,
      });
      setSuccess(true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.detail ||
          "Could not reset the password. The code may have expired.",
      );
    } finally {
      setLoading(false);
    }
  };

  const inputShellClass =
    "mb-6 flex h-[52px] items-center gap-2.5 rounded-[12px] border-[1.5px] border-[#e5e5e5] bg-[#fafafa] px-3.5 transition-colors focus-within:border-[#009849] focus-within:bg-[#f0faf2]";

  return (
    <div className="min-h-dvh bg-white">
      <div className="mx-auto w-full max-w-md px-6 pb-32 pt-5">
        {/* Header row (mobile headerRow / backButton / title) */}
        <div className="mb-6 flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              if (step === 2) {
                setStep(1);
                setError(null);
              } else {
                navigate(APP_ROUTES.login);
              }
            }}
            aria-label="Back to Sign In"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f5f5f5] text-[#111111] transition-opacity active:opacity-60"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-[24px] font-extrabold tracking-[-0.5px] text-[#111111]">
            Reset Password
          </h1>
        </div>

        {success ? (
          /* Mobile successBox parity */
          <div className="rounded-[12px] border border-[#bbf7d0] bg-[#f0fdf4] p-5 text-center">
            <p className="mb-2 text-[18px] font-extrabold text-[#166534]">
              Password reset successful
            </p>
            <p className="mb-5 text-[14px] leading-5 text-[#166534]">
              Your password has been updated. Sign in with your new password.
            </p>
            <button
              type="button"
              onClick={() => navigate(APP_ROUTES.login)}
              className="rounded-[8px] bg-[#166534] px-5 py-2.5 text-[14px] font-bold text-white transition-opacity active:opacity-90"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <>
            <p className="mb-8 text-[15px] leading-[22px] text-[#666666]">
              Enter your email address and we&#39;ll send you a safety code to
              reset your password.
            </p>

            {error ? (
              <div
                role="alert"
                className="mb-5 rounded-[10px] border border-[#fecaca] bg-[#fff1f1] p-3.5 text-[13px] font-medium text-[#dc2626]"
              >
                {error}
              </div>
            ) : null}

            {step === 1 ? (
              <form onSubmit={requestCode} noValidate>
                <label
                  htmlFor="reset-email"
                  className="mb-2 block text-[14px] font-semibold text-[#333333]"
                >
                  Email Address
                </label>
                <div className={inputShellClass}>
                  <Mail size={18} className="shrink-0 text-[#888888]" />
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-[#111111] outline-none placeholder:text-[#aaaaaa]"
                  />
                </div>

                {/* BottomStickyButton styling for the CTA */}
                <StickyCTA type="submit" disabled={loading}>
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  Send Safety Code
                </StickyCTA>
              </form>
            ) : (
              <form onSubmit={resetPassword} noValidate>
                <p className="mb-4 text-[14px] leading-[22px] text-[#666666]">
                  Enter the 6-digit safety code sent to{" "}
                  <span className="font-bold text-[#111111]">{email}</span> and
                  choose a new password.
                </p>

                <label
                  htmlFor="reset-otp"
                  className="mb-2 block text-[14px] font-semibold text-[#333333]"
                >
                  Safety Code
                </label>
                <input
                  id="reset-otp"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                  className="mb-6 h-[52px] w-full rounded-[12px] border-[1.5px] border-[#e5e5e5] bg-[#fafafa] px-4 text-center text-[18px] font-bold tracking-[0.4em] text-[#111111] outline-none transition-colors placeholder:text-[#aaaaaa] focus:border-[#009849] focus:bg-[#f0faf2]"
                />

                <label
                  htmlFor="reset-password"
                  className="mb-2 block text-[14px] font-semibold text-[#333333]"
                >
                  New Password
                </label>
                <div className={inputShellClass}>
                  <Lock size={18} className="shrink-0 text-[#888888]" />
                  <input
                    id="reset-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-[#111111] outline-none placeholder:text-[#aaaaaa]"
                  />
                </div>

                <label
                  htmlFor="reset-confirm"
                  className="mb-2 block text-[14px] font-semibold text-[#333333]"
                >
                  Confirm Password
                </label>
                <div className={inputShellClass}>
                  <Lock size={18} className="shrink-0 text-[#888888]" />
                  <input
                    id="reset-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat the new password"
                    className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-[#111111] outline-none placeholder:text-[#aaaaaa]"
                  />
                </div>

                {/* BottomStickyButton styling for the CTA */}
                <StickyCTA type="submit" disabled={loading}>
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  Reset Password
                </StickyCTA>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="mt-3 block w-full text-center text-[13px] font-bold text-[#6B7280] hover:text-[#009849]"
                >
                  Use a different email
                </button>
              </form>
            )}

            <p className="mt-6 text-center text-[12px] text-[#6B7280]">
              Need help?{" "}
              <Link
                to={APP_ROUTES.contact}
                className="font-bold text-[#009849] hover:underline"
              >
                Contact support
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
