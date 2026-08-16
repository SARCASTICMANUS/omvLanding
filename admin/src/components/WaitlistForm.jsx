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
      <div className="animate-lang-fade mx-auto flex max-w-md flex-col items-center gap-2 rounded-2xl border border-[#009849]/20 bg-[#009849]/5 px-6 py-5 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#009849] text-white">
          <CheckCircle2 size={20} />
        </div>
        <p className="text-sm font-medium text-neutral-900">{successTitle}</p>
        <p className="text-xs text-neutral-600">{successBody}</p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-1 text-xs font-medium text-[#009849] hover:underline"
        >
          {addAnotherLabel}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto w-full max-w-md">
      <div
        className={`flex items-center gap-1.5 rounded-full border bg-white p-1.5 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.2)] transition-colors ${
          error ? "border-red-300" : "border-neutral-200 focus-within:border-neutral-400"
        }`}
      >
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
          className="flex-1 bg-transparent px-4 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none disabled:opacity-60"
          maxLength={255}
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          aria-busy={status === "submitting"}
          className="inline-flex h-10 min-w-[7.5rem] items-center justify-center gap-2 rounded-full bg-[#009849] px-5 text-sm font-medium text-white shadow-[0_6px_20px_-8px_rgba(0,152,73,0.7)] transition-all hover:bg-[#007a3a] disabled:cursor-not-allowed disabled:opacity-80"
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
