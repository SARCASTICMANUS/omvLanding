import { Minus, Plus } from "lucide-react";
import { MIN_ZONES, MAX_ZONES } from "../../utils/zoneLogic";

export default function ZoneCountSelector({ value, onChange, maxStops }) {
  const max = Math.min(MAX_ZONES, maxStops || MAX_ZONES);

  const dec = () => onChange(Math.max(MIN_ZONES, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Number of Zones</h3>
          <p className="text-xs text-slate-400 font-medium mt-1">
            {MIN_ZONES}–{MAX_ZONES} zones allowed · {value} zones will split {maxStops || 0} stops
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={dec}
            disabled={value <= MIN_ZONES}
            aria-label="Decrease zones"
            className="w-11 h-11 flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 font-bold hover:bg-slate-100 hover:text-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Minus size={18} />
          </button>
          <span className="w-12 text-center text-2xl font-black text-slate-800">{value}</span>
          <button
            onClick={inc}
            disabled={value >= max}
            aria-label="Increase zones"
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-brand-600 text-white font-bold shadow-lg shadow-brand-600/25 hover:bg-brand-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
