import { Globe, MapPin, Layers, Clock } from "lucide-react";

const ICON_STYLES = [
  { background: "rgb(var(--accent-blue-rgb) / 0.1)", color: "var(--accent-blue)" },
  { background: "rgb(var(--accent-blue-rgb) / 0.12)", color: "var(--accent-blue-light)" },
  { background: "rgb(var(--accent-blue-rgb) / 0.08)", color: "var(--accent-blue-light)" },
  { background: "rgb(var(--accent-blue-rgb) / 0.1)", color: "var(--accent-blue-dark)" },
];

function MiniStat({ icon, label, value, idx }) {
  const style = ICON_STYLES[idx % ICON_STYLES.length];
  const accent = style.color;
  return (
    <div className="glass-card p-4 relative overflow-hidden flex flex-col animate-glass-fade-in">
      {/* Very subtle ambient blue/lavender wash */}
      <div
        className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full"
        style={{ background: "radial-gradient(closest-side, rgb(var(--accent-blue-rgb) / 0.10), transparent)" }}
      />
      {/* Label — subtle, above the metric */}
      <p className="relative z-10 text-[10px] font-medium uppercase tracking-wider text-slate-500 truncate mb-3">
        {label}
      </p>
      {/* Metric + small secondary visual on the right */}
      <div className="relative z-10 flex items-center justify-between gap-3">
        <span className="text-[26px] font-bold leading-none truncate whitespace-nowrap brand-heading">
          {value?.toLocaleString() ?? "—"}
        </span>
        <span className="shrink-0 opacity-90" style={{ color: accent }}>
          {icon}
        </span>
      </div>
      {/* Quiet supporting area keeps equal heights */}
      <div className="relative z-10 flex-1" />
    </div>
  );
}

export default function GeoStatsCards({ data }) {
  const items = [
    { icon: <Globe size={18} />, label: "Countries", value: data?.unique_countries },
    { icon: <MapPin size={18} />, label: "Cities", value: data?.unique_cities },
    { icon: <Layers size={18} />, label: "Regions", value: data?.unique_regions },
    { icon: <Clock size={18} />, label: "Timezones", value: data?.timezone_distribution?.length },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item, i) => (
        <MiniStat key={item.label} {...item} idx={i} />
      ))}
    </div>
  );
}
