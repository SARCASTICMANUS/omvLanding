import { RotateCcw } from "lucide-react";

// Page header: title, description, unsaved-changes indicator, and the
// primary Save / secondary Reset actions.
export default function ZoneHeader({ dirty, valid, saving, onSave, onReset }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
      <div>
        <h1 className="memphis-title text-3xl font-black text-memphis-ink">Zone Management</h1>
        <p className="text-memphis-ink/60 mt-1 font-medium">
          Configure stop-based fuel share zones for your routes.
        </p>
        <div className="mt-2 flex items-center gap-2">
          {dirty && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-memphis-yellow/20 text-memphis-ink border-2 border-memphis-yellow">
              <span className="w-1.5 h-1.5 rounded-full bg-memphis-yellow animate-pulse" />
              Unsaved changes
            </span>
          )}
          {!dirty && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-memphis-teal/20 text-memphis-ink">
              All changes saved
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onReset}
          className="memphis-btn-secondary flex items-center gap-2 px-5 py-3 rounded-xl font-semibold"
        >
          <RotateCcw size={16} /> Reset
        </button>
        <button
          onClick={onSave}
          disabled={!valid || saving}
          className="memphis-btn-primary flex items-center gap-2 px-6 py-3 rounded-xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save Configuration"}
        </button>
      </div>
    </div>
  );
}
