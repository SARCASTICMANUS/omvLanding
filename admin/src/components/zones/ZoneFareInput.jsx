export default function ZoneFareInput({ value, onChange, invalid }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-memphis-ink/40 font-bold pointer-events-none">
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
        className={`memphis-input w-full pl-8 pr-3 py-3 text-sm font-bold outline-none transition ${
          invalid ? "border-memphis-coral focus:ring-memphis-coral/20" : ""
        }`}
      />
    </div>
  );
}
