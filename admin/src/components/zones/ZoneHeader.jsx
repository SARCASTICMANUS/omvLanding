import { RotateCcw } from "lucide-react";

// Page header: title, description, unsaved-changes indicator, and the
// primary Save / secondary Reset actions.
export default function ZoneHeader({ dirty, valid, saving, onSave, onReset }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
      <div>
        <div className="mt-1 flex items-center gap-2">
          {dirty && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full text-amber-600" style={{ background: "rgba(251,191,36,0.15)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Unsaved changes
            </span>
          )}
          {!dirty && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full text-teal-600" style={{ background: "rgba(123,224,173,0.18)" }}>
              All changes saved
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onReset}
          className="glass-btn-secondary flex items-center gap-2 px-5 py-3 rounded-xl font-semibold"
        >
          <RotateCcw size={16} /> Reset
        </button>
        <button
          onClick={onSave}
          disabled={!valid || saving}
          className="glass-btn-primary flex items-center gap-2 px-6 py-3 rounded-xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save Configuration"}
        </button>
      </div>
    </div>
  );
}
