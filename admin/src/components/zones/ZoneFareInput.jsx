export default function ZoneFareInput({ value, onChange, invalid }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold pointer-events-none">
        ₹
      </span>
      <input
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className={`w-full pl-8 pr-3 py-3 bg-slate-50 border rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-brand-600/20 transition ${
          invalid ? "border-red-300 focus:ring-red-500/20" : "border-slate-200"
        }`}
      />
    </div>
  );
}
