import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { APP_ROUTES } from "../../constants/routes";
import { emitVerificationInvalidated } from "./verificationEvents";

/**
 * Document upload / review screen (route /kyc).
 *
 * Read-only while the documents are under review — no upload controls there.
 * On rejection the per-document reason is shown and re-uploading the same slot
 * replaces it, which puts the account back into docs_pending so it can be
 * submitted again.
 *
 * The server block is refetched after every mutation; nothing is inferred
 * locally.
 */

const API_KYC = "/api/accounts/kyc/";
const API_DOCS = "/api/accounts/kyc/documents/";
const API_SUBMIT = "/api/accounts/kyc/submit/";

const LABELS = {
  license_front: "Driving License — front",
  license_back: "Driving License — back",
  rc_front: "Registration Certificate — front",
  rc_back: "Registration Certificate — back",
};

const CHIP = {
  missing: "bg-slate-100 text-slate-500",
  draft: "bg-blue-100 text-blue-700",
  submitted: "bg-amber-100 text-amber-700",
  verified: "bg-emerald-100 text-emerald-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

function KycScreen() {
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.get(API_KYC);
      setState(res.data?.data ?? null);
      setError("");
      return res.data?.data ?? null;
    } catch {
      setError("Could not load your verification status.");
      return null;
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">{error || "Loading…"}</p>
      </div>
    );
  }

  const underReview = state.stage === "docs_under_review";
  const approved = state.can_use_app;
  const missing = state.missing_docs || [];

  const onPick = async (docType, file) => {
    if (!file) return;
    setBusy(docType);
    setError("");
    const fd = new FormData();
    fd.append("doc_type", docType);
    fd.append("file", file);
    try {
      const res = await api.post(API_DOCS, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setState(res.data?.data ?? null);
      setNotice("Upload saved.");
    } catch (e) {
      setError(
        e?.response?.data?.message ||
          "Upload failed. Please check the file and try again."
      );
    } finally {
      setBusy(null);
    }
  };

  const onSubmit = async () => {
    setBusy("submit");
    setError("");
    setNotice("");
    try {
      const res = await api.post(API_SUBMIT);
      setState(res.data?.data ?? null);
      setNotice("Sent for review.");
      emitVerificationInvalidated("kyc-submitted");
    } catch (e) {
      const body = e?.response?.data;
      if (body?.code === "missing_docs") {
        const left = (body?.data?.missing_docs || [])
          .map((d) => LABELS[d] || d)
          .join(", ");
        setError(`Still required: ${left}`);
        setState(body.data ?? null);
      } else {
        setError(body?.message || "Could not submit for review.");
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-900">
          {approved ? "Documents approved" : "Verify your documents"}
        </h1>
        {/* Server copy, verbatim. */}
        <p className="mt-2 text-sm text-slate-600">{state.title ? `${state.title}. ` : ""}{state.message}</p>

        {error && (
          <p data-testid="kyc-error" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {notice}
          </p>
        )}

        <ul className="mt-6 space-y-3">
          {(state.required_docs || []).map((docType) => {
            const info = (state.uploaded_docs_detail || []).find(
              (d) => d.doc_type === docType
            );
            const isMissing = missing.includes(docType);
            const chip = info?.status || (isMissing ? "missing" : "draft");
            return (
              <li
                key={docType}
                data-testid={`kyc-row-${docType}`}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {LABELS[docType] || docType}
                    </p>
                    {info?.rejection_reason && (
                      <p className="mt-1 text-xs text-rose-600">
                        Rejected: {info.rejection_reason}
                      </p>
                    )}
                    {info?.file_name && !info?.rejection_reason && (
                      <p className="mt-1 text-xs text-slate-400">{info.file_name}</p>
                    )}
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${CHIP[chip] || CHIP.draft}`}>
                    {chip}
                  </span>
                </div>

                {/* Read-only under review and once approved. */}
                {!underReview && !approved && (
                  <label className="mt-3 inline-block cursor-pointer rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200">
                    {busy === docType ? "Uploading…" : "Choose file"}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,application/pdf"
                      disabled={busy === docType}
                      onChange={(e) => onPick(docType, e.target.files?.[0])}
                    />
                  </label>
                )}
              </li>
            );
          })}
        </ul>

        {underReview && (
          <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {state.message}
          </p>
        )}

        {approved && (
          <button
            type="button"
            onClick={() => navigate(APP_ROUTES.root)}
            className="mt-6 w-full rounded-xl bg-[#2E5CFF] px-4 py-3 text-sm font-semibold text-white"
          >
            Continue to OMV
          </button>
        )}

        {!underReview && !approved && (
          <button
            type="button"
            data-testid="kyc-submit"
            disabled={missing.length > 0 || busy === "submit"}
            onClick={onSubmit}
            className="mt-6 w-full rounded-xl bg-[#2E5CFF] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy === "submit" ? "Submitting…" : "Submit for review"}
          </button>
        )}
      </div>
    </div>
  );
}

export default KycScreen;