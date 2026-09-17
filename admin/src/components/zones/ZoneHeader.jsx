import { RotateCcw } from "lucide-react";

// Page header: title, description, unsaved-changes indicator, and the
// primary Save / secondary Reset actions.
export default function ZoneHeader({ dirty, valid, saving, onSave, onReset }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl font-black text-slate-800">Zone Management</h1>
        <p className="text-slate-500 mt-1 font-medium">
          Configure stop-based fuel share zones for your routes.
        </p>
        <div className="mt-2 flex items-center gap-2">
          {dirty && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Unsaved changes
            </span>
          )}
          {!dirty && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
              All changes saved
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 transition"
        >
          <RotateCcw size={16} /> Reset
        </button>
        <button
          onClick={onSave}
          disabled={!valid || saving}
          className="flex items-center gap-2 bg-brand-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-brand-700 transition shadow-lg shadow-brand-600/25 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save Configuration"}
        </button>
      </div>
    </div>
  );
}
