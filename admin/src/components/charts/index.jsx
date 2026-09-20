export function StatCard({ icon, label, value, color, sub }) {
  return (
    <div className="memphis-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`memphis-icon-tile ${color}`}>
          {icon}
        </div>
        <div>
          <p className="memphis-label">{label}</p>
          <p className="text-2xl font-black text-memphis-ink" style={{ fontFamily: "Archivo Black, sans-serif" }}>{value?.toLocaleString() ?? "—"}</p>
        </div>
      </div>
      {sub && <p className="text-xs text-memphis-purple font-medium">{sub}</p>}
    </div>
  );
}

export function BarChart({ data, labelKey, valueKey, color = "bg-memphis-pink", maxItems = 7 }) {
  if (!data || data.length === 0) {
    return <div className="text-center py-8 text-memphis-purple/50 text-sm">No data</div>;
  }
  const items = data.slice(0, maxItems);
  const maxVal = Math.max(...items.map((d) => d[valueKey] || 0), 1);

  return (
    <div className="space-y-2">
      {items.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs font-semibold text-memphis-ink w-28 truncate text-right">{d[labelKey]}</span>
          <div className="flex-1 bg-memphis-ink/10 rounded-full h-5 overflow-hidden border border-memphis-ink/20">
            <div
              className={`h-full rounded-full ${color} transition-all duration-500`}
              style={{ width: `${((d[valueKey] || 0) / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-xs font-bold text-memphis-ink w-12 text-right">{(d[valueKey] || 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({ data, labelKey, valueKey, colors, centerLabel, centerValue }) {
  if (!data || data.length === 0) {
    return <div className="text-center py-8 text-memphis-purple/50 text-sm">No data</div>;
  }
  const total = data.reduce((s, d) => s + (d[valueKey] || 0), 0);
  let cum = 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative">
        <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
          {data.map((d, i) => {
            const pct = total > 0 ? ((d[valueKey] || 0) / total) * 100 : 0;
            const offset = cum;
            cum += pct;
            return (
              <circle
                key={i}
                cx="18"
                cy="18"
                r="15.915"
                fill="none"
                stroke={colors[i % colors.length]}
                strokeWidth="3.5"
                strokeDasharray={`${pct} ${100 - pct}`}
                strokeDashoffset={`${-offset}`}
              />
            );
          })}
        </svg>
        {centerLabel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-black text-memphis-ink">{centerValue ?? "—"}</span>
            <span className="memphis-label text-[9px]">{centerLabel}</span>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border border-memphis-ink/30" style={{ background: colors[i % colors.length] }} />
            <span className="text-xs font-semibold text-memphis-ink">{d[labelKey]}</span>
            <span className="text-xs font-bold text-memphis-ink ml-auto">{(d[valueKey] || 0).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProgressBar({ segments, height = "h-3" }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <div className={`bg-memphis-ink/10 rounded-full ${height}`} />;

  return (
    <div className={`flex rounded-full overflow-hidden ${height} border border-memphis-ink/20`}>
      {segments.map((seg, i) => (
        <div
          key={i}
          className="transition-all duration-500"
          style={{ width: `${(seg.value / total) * 100}%`, backgroundColor: seg.color }}
          title={`${seg.label}: ${seg.value}`}
        />
      ))}
    </div>
  );
}

export function DataTable({ columns, rows, emptyMessage = "No data" }) {
  if (!rows || rows.length === 0) {
    return <div className="text-center py-8 text-memphis-purple/50 text-sm">{emptyMessage}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b-2 border-memphis-ink/10">
            {columns.map((col, i) => (
              <th key={i} className={`py-2 px-3 memphis-label ${col.align === "right" ? "text-right" : "text-left"}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="memphis-table-row">
              {columns.map((col, j) => (
                <td key={j} className={`py-2 px-3 font-semibold text-memphis-ink ${col.align === "right" ? "text-right" : ""}`}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
