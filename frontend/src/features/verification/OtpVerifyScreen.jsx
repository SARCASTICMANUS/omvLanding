import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { APP_ROUTES } from "../../constants/routes";
import { verifyOtp as verifyOtpThunk, resendOtp, clearOtpSent } from "../../features/auth/authSlice";
import { emitVerificationInvalidated } from "./verificationEvents";

/**
 * Email confirmation (route /verify-email).
 *
 * The legacy SPA had no OTP screen — authSlice set isOtpSent but nothing read
 * it — so part 1 of verification had no destination. This is that screen.
 * On success it invalidates the gate so the overlay re-reads the server rather
 * than trusting anything held in the client.
 */
function OtpVerifyScreen() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const otpEmail = useSelector((s) => s.auth?.otpEmail);

  const [email, setEmail] = useState(otpEmail || "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (otpEmail) setEmail(otpEmail);
  }, [otpEmail]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      // Uses the existing authSlice thunk so this screen behaves identically to
      // the register/login flow (same envelope unwrapping, same error shape).
      await dispatch(verifyOtpThunk({ email: email.trim().toLowerCase(), otp: code.trim() })).unwrap();
      dispatch(clearOtpSent());
      emitVerificationInvalidated("email-verified");
      navigate(APP_ROUTES.root, { replace: true });
    } catch (err) {
      setError(
        err?.response?.data?.message || "That code did not work. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const onResend = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await dispatch(resendOtp(email.trim().toLowerCase())).unwrap();
      setNotice("We sent a new code.");
    } catch (err) {
      setError(err?.payload?.error || "Could not resend the code.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h1 className="text-xl font-bold text-slate-900">Verify your email</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter the code we sent you.
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500" htmlFor="otp-email">
              Email
            </label>
            <input
              id="otp-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500" htmlFor="otp-code">
              Safety code
            </label>
            <input
              id="otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest"
              placeholder="000000"
            />
          </div>

          {error && (
            <p data-testid="otp-error" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || code.trim().length < 4}
            className="w-full rounded-xl bg-[#2E5CFF] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Checking…" : "Confirm code"}
          </button>
        </form>

        <button
          type="button"
          onClick={onResend}
          disabled={busy || !email}
          className="mt-4 w-full text-center text-xs text-slate-500 underline disabled:opacity-40"
        >
          Resend code
        </button>
      </div>
    </div>
  );
}

export default OtpVerifyScreen;