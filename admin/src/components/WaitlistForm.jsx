import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import api from "../api/client";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function WaitlistForm({
  submitLabel = "Join Waitlist",
  submittingLabel = "Joining…",
  placeholder = "you@example.com",
  successTitle = "You're on the waitlist.",
  successBody = "We'll email you when VAYY launches near you.",
  addAnotherLabel = "Add another email",
  duplicateError = "This email is already on the waitlist.",
  genericError = "Something went wrong. Please try again.",
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const value = email.trim();
    if (!value) {
      setError("Please enter your email.");
      return;
    }
    if (value.length > 255) {
      setError("Email is too long.");
      return;
    }
    if (!EMAIL_REGEX.test(value)) {
      setError("Enter a valid email address.");
      return;
    }

    setStatus("submitting");
    try {
      await api.post("/communication/waitlist/", { email: value.toLowerCase() });
      setStatus("success");
      setEmail("");
    } catch (err) {
      setStatus("error");
      if (err.response?.status === 409) {
        setError(duplicateError);
      } else {
        setError(
          err.response?.data?.email?.[0] ||
            err.response?.data?.message ||
            genericError
        );
      }
    }
  };

  if (status === "success") {
    return (
      <div className="animate-lang-fade mx-auto flex max-w-[300px] flex-col items-center gap-2 rounded-2xl border border-[#009849]/20 bg-[#009849]/5 px-5 py-4 text-center md:max-w-md md:px-6 md:py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#009849] text-white md:h-10 md:w-10">
          <CheckCircle2 size={18} className="md:hidden" />
          <CheckCircle2 size={20} className="hidden md:block" />
        </div>
        <p className="text-xs font-medium text-neutral-900 md:text-sm">{successTitle}</p>
        <p className="text-[11px] text-neutral-600 md:text-xs">{successBody}</p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-1 text-[11px] font-medium text-[#009849] hover:underline md:text-xs"
        >
          {addAnotherLabel}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto w-full max-w-[200px] md:max-w-md">
      {/* Mobile: stacked vertical. Desktop: pill-shaped inline. */}
      <div className={`flex flex-col gap-2 md:flex-row md:items-center md:gap-1.5 md:rounded-full md:border md:bg-white md:p-1.5 md:shadow-[0_10px_40px_-20px_rgba(0,0,0,0.2)] md:focus-within:border-neutral-400 ${error ? "md:border-red-300" : "md:border-neutral-200"}`}>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={placeholder}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") {
              setStatus("idle");
              setError("");
            }
          }}
          aria-invalid={status === "error"}
          aria-describedby="waitlist-error"
          disabled={status === "submitting"}
          className="h-12 w-full rounded-full border border-neutral-200 bg-white px-4 text-sm text-neutral-900 shadow-[0_6px_24px_-12px_rgba(0,0,0,0.18)] placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none disabled:opacity-60 md:h-auto md:flex-1 md:border-0 md:shadow-none md:focus:border-0"
          maxLength={255}
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          aria-busy={status === "submitting"}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#009849] px-5 text-sm font-medium text-white shadow-[0_6px_20px_-6px_rgba(0,152,73,0.6)] transition-all hover:bg-[#007a3a] disabled:cursor-not-allowed disabled:opacity-80 md:h-10 md:w-auto md:min-w-[7.5rem] md:shrink-0 md:px-5 md:text-sm md:shadow-[0_6px_20px_-8px_rgba(0,152,73,0.7)]"
        >
          {status === "submitting" ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden />
              <span>{submittingLabel}</span>
            </>
          ) : (
            submitLabel
          )}
        </button>
      </div>
      <p
        id="waitlist-error"
        className={`mt-2 h-4 text-center text-xs transition-opacity ${
          error ? "text-red-600 opacity-100" : "opacity-0"
        }`}
        role={error ? "alert" : undefined}
      >
        {error || "placeholder"}
      </p>
    </form>
  );
}
