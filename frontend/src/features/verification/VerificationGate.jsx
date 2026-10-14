import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import api from "../../lib/api";
import { APP_ROUTES } from "../../constants/routes";
import { onVerificationInvalidated } from "./verificationEvents";

/**
 * Hard access gate — the user-visible half of two-part verification.
 *
 * The server is the ONLY source of truth: every render derives from
 * GET /api/accounts/me/ -> data.verification. Nothing is cached in
 * localStorage, sessionStorage or persisted redux, so closing the app, hitting
 * back, or a cold reload all land on the same answer.
 *
 * Non-dismissible by construction: fixed inset-0 overlay ABOVE the router
 * outlet, no close button, no backdrop-click handler, no escape handler, and
 * the underlying route can change freely underneath it. The HTTP 403 and the
 * ws 4403 close are the parts that actually hold; this makes them legible.
 */

const STAGE_TO_ROUTE = {
  email_pending: APP_ROUTES.verifyEmail,
  docs_pending: APP_ROUTES.kyc,
  docs_rejected: APP_ROUTES.kyc,
};

const API_ME = "/api/accounts/me/";

const LABELS = {
  license_front: "Driving License — front",
  license_back: "Driving License — back",
  rc_front: "Registration Certificate — front",
  rc_back: "Registration Certificate — back",
};

function VerificationGate() {
  const isAuthenticated = useSelector((s) => s.auth?.isAuthenticated);
  const location = useLocation();
  const navigate = useNavigate();

  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offExempt, setOffExempt] = useState(false);
  const inflight = useRef(false);

  const refetch = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const res = await api.get(API_ME);
      const block = res.data?.data?.verification ?? null;
      setState(block);
      // Defensive: if the server says fully_verified, step out of any
      // verification route so the gate never strands someone on /kyc.
      if (block?.stage === "fully_verified" && offExempt &&
          (location.pathname === APP_ROUTES.kyc ||
           location.pathname === APP_ROUTES.verifyEmail)) {
        setOffExempt(false);
        navigate(APP_ROUTES.root, { replace: true });
      }
    } catch {
      setState(null);
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, [location.pathname, navigate, offExempt]);

  // Revalidate on: mount, route change, window focus, and any invalidation
  // (403 verification_required, ws 4403, system notification).
  useEffect(() => {
    if (!isAuthenticated) {
      setState(null);
      setLoading(false);
      return;
    }
    refetch();
  }, [isAuthenticated, location.pathname, refetch]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const onFocus = () => refetch();
    window.addEventListener("focus", onFocus);
    const unsub = onVerificationInvalidated(() => refetch());
    return () => {
      window.removeEventListener("focus", onFocus);
      unsub();
    };
  }, [isAuthenticated, refetch]);

  // The gate itself must stay reachable while blocked, otherwise the CTAs
  // would dead-end behind the overlay.
  const gateRoutes = [APP_ROUTES.kyc, APP_ROUTES.verifyEmail];
  const onGateScreen = gateRoutes.includes(location.pathname);

  if (!isAuthenticated || loading || !state) return null;
  if (state.can_use_app) return null;
  if (offExempt || onGateScreen) return null;

  const stage = state.stage;
  const target = STAGE_TO_ROUTE[stage];
  const missing = (state.missing_docs || []).map((d) => LABELS[d] || d);

  const go = () => {
    if (target) {
      // Off while the user works inside the gate screen; the server is still
      // re-read on every focus/route change, so nothing is trusted from here.
      setOffExempt(true);
      navigate(target);
    }
  };

  return (
    <div
      data-testid="verification-gate"
      data-stage={stage}
      // Fixed + inset-0 + high z-index => sits above the router outlet.
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 px-4"
      // No onClick, no onKeyDown: there is deliberately no way to dismiss this.
      role="dialog"
      aria-modal="true"
      aria-labelledby="verification-gate-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-2xl">
          {stage === "docs_under_review" ? "⏳" : stage === "docs_rejected" ? "⚠️" : "🔒"}
        </div>

        <h2 id="verification-gate-title" className="text-xl font-bold text-slate-900">
          {state.title}
        </h2>
        {/* Message is rendered VERBATIM from the server. Do not reword here. */}
        <p className="mt-2 text-sm text-slate-600">{state.message}</p>

        {missing.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            {missing.map((label) => (
              <li key={label}>• {label}</li>
            ))}
          </ul>
        )}

        {state.submitted_at && (
          <p className="mt-3 text-xs text-slate-400">
            Submitted {new Date(state.submitted_at).toLocaleString()}
          </p>
        )}

        {stage === "docs_under_review" ? (
          <p className="mt-5 text-center text-xs text-slate-400">
            This screen closes automatically once an admin approves your documents.
          </p>
        ) : (
          <button
            type="button"
            data-testid="verification-gate-cta"
            onClick={go}
            className="mt-6 w-full rounded-xl bg-[#2E5CFF] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {stage === "email_pending"
              ? "Enter code"
              : stage === "docs_rejected"
                ? "Re-upload documents"
                : "Upload documents"}
          </button>
        )}
      </div>
    </div>
  );
}

export default VerificationGate;