import { cloneElement, useState } from "react";
import { BLUE_PRIMARY } from "../../colors";

// Soft ambient color wash behind graphs — extremely subtle blue haze
function ChartWash({ color = "#3B82F6" }) {
  return (
    <div className="pointer-events-none absolute -inset-3 z-0" aria-hidden>
      <div
        className="absolute left-1/2 top-1/2 h-[80%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: `radial-gradient(closest-side, ${color}10, transparent)` }}
      />
    </div>
  );
}

// Smooth Catmull-Rom → cubic bezier path so the line curves elegantly
function smoothPath(points) {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function StatCard({ icon, label, value, color, sub }) {
  const accent = color || BLUE_PRIMARY;
  return (
    <div className="glass-card p-5 relative overflow-hidden flex flex-col animate-glass-fade-in">
      {/* Very subtle ambient blue/lavender wash */}
      <div
        className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full"
        style={{ background: `radial-gradient(closest-side, ${accent}1A, transparent)` }}
      />
      {/* Label — subtle, above the metric */}
      <p className="relative z-10 text-[11px] font-medium uppercase tracking-wider text-slate-500 truncate mb-4">
        {label}
      </p>
      {/* Metric + small secondary visual on the right */}
      <div className="relative z-10 flex items-center justify-between gap-4">
        <span className="text-[30px] font-bold leading-none whitespace-nowrap" style={{ color: "#16233F" }}>
          {value?.toLocaleString() ?? "\u2014"}
        </span>
        <span className="shrink-0 opacity-90" style={{ color: accent }}>
          {cloneElement(icon, { size: 18, strokeWidth: 2 })}
        </span>
      </div>
      {/* Supporting text — subtle */}
      {sub && <p className="relative z-10 mt-2.5 text-xs font-normal text-slate-500">{sub}</p>}
      {/* Quiet supporting area keeps equal heights */}
      <div className="relative z-10 flex-1" />
    </div>
  );
}

// ─── Ranked categories → soft rounded blue bars ─────────────────────
export function BarChart({ data, labelKey, valueKey, color = BLUE_PRIMARY, maxItems = 7 }) {
  if (!data || data.length === 0) {
    return <div className="text-center py-8 text-slate-500 text-sm">No data</div>;
  }
  const items = data.slice(0, maxItems);
  const maxVal = Math.max(...items.map((d) => d[valueKey] || 0), 1);

  return (
    <div className="relative space-y-3">
      <ChartWash color={color} />
      {items.map((d, i) => (
        <div key={i} className="relative z-10 flex items-center gap-3">
          <span className="w-28 truncate text-right text-xs font-medium text-slate-600">{d[labelKey]}</span>
          <div
            className="flex-1 h-6 overflow-hidden rounded-full"
            style={{ background: "rgba(46,92,255,0.05)", border: "1px solid rgba(46,92,255,0.08)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${((d[valueKey] || 0) / maxVal) * 100}%`,
                background: `linear-gradient(90deg, ${color}99, ${color})`,
                boxShadow: `0 2px 8px ${color}2E`,
              }}
            />
          </div>
          <span className="w-12 text-right text-xs font-semibold text-slate-700">{(d[valueKey] || 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Time series → elegant lightweight area line chart ──────────────
export function LineChart({ data, labelKey, valueKey, color = "#3B82F6", height = 190, maxItems }) {
  const [hover, setHover] = useState(null);

  if (!data || data.length === 0) {
    return <div className="text-center py-8 text-slate-500 text-sm">No data</div>;
  }

  const items = maxItems ? data.slice(-maxItems) : data;
  const width = 620;
  const padding = { top: 12, right: 14, bottom: 26, left: 42 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = Math.max(...items.map((d) => d[valueKey] || 0), 1);

  const coords = items.map((d, i) => ({
    x: padding.left + (items.length === 1 ? chartW / 2 : (i / (items.length - 1)) * chartW),
    y: padding.top + chartH - ((d[valueKey] || 0) / maxVal) * chartH,
    label: d[labelKey],
    value: d[valueKey] || 0,
  }));

  const linePath = smoothPath(coords);
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${padding.top + chartH} L ${coords[0].x} ${padding.top + chartH} Z`;
  const lineColor = color || "#3B82F6";
  const gid = `mg-${valueKey}-${lineColor.replace(/[^a-zA-Z0-9]/g, "")}`;

  const yTicks = 3;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((maxVal / yTicks) * i));
  const labelStep = Math.max(1, Math.ceil(coords.length / 6));

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) * (width / rect.width);
    const idx = Math.round(((svgX - padding.left) / chartW) * (coords.length - 1));
    setHover(Math.max(0, Math.min(coords.length - 1, idx)));
  };

  const hoverPoint = hover !== null ? coords[hover] : null;
  const tooltipLeft = hoverPoint ? Math.min(90, Math.max(10, (hoverPoint.x / width) * 100)) : 0;

  return (
    <div className="relative">
      <ChartWash color={lineColor} />
      <svg viewBox={`0 0 ${width} ${height}`} className="relative z-10 block w-full">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.24" />
            <stop offset="55%" stopColor={lineColor} stopOpacity="0.06" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Subtle grid + y labels */}
        {yTickValues.map((val, i) => {
          const y = padding.top + chartH - (val / maxVal) * chartH;
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="rgba(46,92,255,0.07)" strokeWidth="1" />
              <text x={padding.left - 6} y={y + 3} textAnchor="end" className="fill-slate-400 text-[11px] font-medium">
                {val.toLocaleString()}
              </text>
            </g>
          );
        })}

        {/* Area fade under the line */}
        <path d={areaPath} fill={`url(#${gid})`} />

        {/* Thin elegant line */}
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Hover guides */}
        {hoverPoint && (
          <g>
            <line x1={hoverPoint.x} y1={padding.top} x2={hoverPoint.x} y2={padding.top + chartH} stroke="rgba(46,92,255,0.18)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={hoverPoint.x} cy={hoverPoint.y} r="4.5" fill="#FFFFFF" stroke={lineColor} strokeWidth="2" />
          </g>
        )}

        {/* X labels (thinned) */}
        {coords.map((c, i) =>
          i % labelStep === 0 || i === coords.length - 1 ? (
            <text key={i} x={c.x} y={height - 6} textAnchor="middle" className="fill-slate-400 text-[11px] font-medium">
              {c.label}
            </text>
          ) : null
        )}

        {/* Interactive overlay */}
        <rect x={padding.left} y={padding.top} width={chartW} height={chartH} fill="transparent" onMouseMove={handleMove} onMouseLeave={() => setHover(null)} />
      </svg>

      {/* Glass floating tooltip */}
      {hoverPoint && (
        <div
          className="glass-card-subtle pointer-events-none absolute z-20 rounded-xl px-2.5 py-1.5"
          style={{
            left: `${tooltipLeft}%`,
            top: `${(hoverPoint.y / height) * 100}%`,
            transform: "translate(-50%, -115%)",
            boxShadow: "0 6px 20px rgba(31,38,135,0.12)",
          }}
        >
          <div className="text-[11px] font-semibold text-slate-800">{hoverPoint.label}</div>
          <div className="text-[11px] font-bold" style={{ color: lineColor }}>
            {hoverPoint.value.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

export function DonutChart({ data, labelKey, valueKey, colors, centerLabel, centerValue }) {
  if (!data || data.length === 0) {
    return <div className="text-center py-8 text-slate-500 text-sm">No data</div>;
  }
  const total = data.reduce((s, d) => s + (d[valueKey] || 0), 0);
  let cum = 0;

  return (
    <div className="relative flex items-center gap-6">
      <ChartWash color={colors[0] || BLUE_PRIMARY} />
      <div className="relative z-10">
        <svg viewBox="0 0 36 36" className="h-28 w-28 -rotate-90">
          {data.map((d, i) => {
            const pct = total > 0 ? ((d[valueKey] || 0) / total) * 100 : 0;
            const offset = cum;
            cum += pct;
            return (
              <circle
                key={i}
                cx="18"
                cy="18"
                r="15.4"
                fill="none"
                stroke={colors[i % colors.length]}
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeDasharray={`${Math.max(pct - 1, 0.5)} ${100 - Math.max(pct - 1, 0.5)}`}
                strokeDashoffset={`${-offset}`}
              />
            );
          })}
        </svg>
        {centerLabel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-black text-slate-800">{centerValue ?? "\u2014"}</span>
            <span className="glass-label text-[9px]">{centerLabel}</span>
          </div>
        )}
      </div>
      <div className="relative z-10 space-y-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="h-3 w-3 rounded-full" style={{ background: colors[i % colors.length], boxShadow: `0 0 6px ${colors[i % colors.length]}40` }} />
            <span className="text-xs font-semibold text-slate-700">{d[labelKey]}</span>
            <span className="ml-auto text-xs font-bold text-slate-700">{(d[valueKey] || 0).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProgressBar({ segments, height = "h-3" }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <div className={`glass-progress ${height}`} />;

  return (
    <div className={`flex glass-progress ${height}`}>
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
    return <div className="text-center py-8 text-slate-500 text-sm">{emptyMessage}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200/60">
            {columns.map((col, i) => (
              <th key={i} className={`py-3 px-3 glass-label ${col.align === "right" ? "text-right" : "text-left"}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="glass-table-row">
              {columns.map((col, j) => (
                <td key={j} className={`py-2.5 px-3 font-medium text-slate-800 ${col.align === "right" ? "text-right" : ""}`}>
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