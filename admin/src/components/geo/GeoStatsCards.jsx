import { Globe, MapPin, Layers, Clock } from "lucide-react";

function MiniStat({ icon, label, value, color }) {
  return (
    <div className="memphis-card p-4 flex items-center gap-3">
      <div className={`memphis-icon-tile ${color}`}>{icon}</div>
      <div>
        <p className="memphis-label text-[10px]">{label}</p>
        <p className="text-xl font-black text-memphis-ink" style={{ fontFamily: "Archivo Black, sans-serif" }}>
          {value?.toLocaleString() ?? "—"}
        </p>
      </div>
    </div>
  );
}

export default function GeoStatsCards({ data }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MiniStat icon={<Globe size={16} />} label="Countries" value={data?.unique_countries} color="memphis-icon-pink" />
      <MiniStat icon={<MapPin size={16} />} label="Cities" value={data?.unique_cities} color="memphis-icon-teal" />
      <MiniStat icon={<Layers size={16} />} label="Regions" value={data?.unique_regions} color="memphis-icon-purple" />
      <MiniStat icon={<Clock size={16} />} label="Timezones" value={data?.timezone_distribution?.length} color="memphis-icon-yellow" />
    </div>
  );
}
