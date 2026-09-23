export default function ZoneFareInput({ value, onChange, invalid }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium pointer-events-none">
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
        className={`glass-input w-full pl-8 pr-3 py-3 text-sm font-semibold outline-none transition ${
          invalid ? "border-red-400 focus:ring-red-400/20" : ""
        }`}
      />
    </div>
  );
}
