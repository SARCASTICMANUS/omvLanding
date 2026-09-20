import { useMemo } from "react";
import { CHART_COLORS_6 } from "../../colors";

export default function GeoTrendsChart({ dailyByCountry = [], height = 200 }) {
  const { countries, days, maxVal } = useMemo(() => {
    const countryMap = {};
    const daySet = new Set();

    dailyByCountry.forEach((d) => {
      daySet.add(d.day);
      if (!countryMap[d.country]) countryMap[d.country] = {};
      countryMap[d.country][d.day] = d.count;
    });

    const sortedDays = [...daySet].sort();
    const countryEntries = Object.entries(countryMap)
      .map(([name, days]) => ({
        name,
        total: Object.values(days).reduce((s, v) => s + v, 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    const activeCountries = countryEntries.map((c) => c.name);
    const maxVal = Math.max(
      ...sortedDays.map((day) =>
        activeCountries.reduce((s, c) => s + (countryMap[c]?.[day] || 0), 0)
      ),
      1
    );

    return { countries: activeCountries, days: sortedDays, maxVal };
  }, [dailyByCountry]);

  if (days.length === 0 || countries.length === 0) {
    return <div className="text-center py-8 text-memphis-purple/50 text-sm">No trend data</div>;
  }

  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const width = 600;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const xStep = chartW / Math.max(days.length - 1, 1);

  const stacks = days.map((day, di) => {
    let cumY = 0;
    const layers = countries.map((country, ci) => {
      const val = dailyByCountry.find((d) => d.day === day && d.country === country)?.count || 0;
      const y0 = cumY;
      cumY += val;
      return { country, val, y0, y1: cumY };
    });
    return { day, di, layers, total: cumY };
  });

  const buildAreaPath = (countryIndex) => {
    const topPoints = [];
    const botPoints = [];

    stacks.forEach((s, si) => {
      const layer = s.layers[countryIndex];
      const x = padding.left + si * xStep;
      const topY = padding.top + chartH - (layer.y1 / maxVal) * chartH;
      const botY = padding.top + chartH - (layer.y0 / maxVal) * chartH;
      topPoints.push(`${si === 0 ? "M" : "L"}${x},${topY}`);
      botPoints.unshift(`${x},${botY}`);
    });

    if (topPoints.length < 2) return "";
    return `${topPoints.join(" ")} ${botPoints.join(" ")} Z`;
  };

  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((maxVal / yTicks) * i));

  return (
    <div className="memphis-card p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        {/* Y axis gridlines */}
        {yTickValues.map((val, i) => {
          const y = padding.top + chartH - (val / maxVal) * chartH;
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#16121F10" strokeWidth="1" />
              <text x={padding.left - 5} y={y + 3} textAnchor="end" className="text-[8px] fill-memphis-purple/60 font-medium">
                {val}
              </text>
            </g>
          );
        })}

        {/* Areas */}
        {countries.map((country, ci) => (
          <path
            key={country}
            d={buildAreaPath(ci)}
            fill={CHART_COLORS_6[ci % CHART_COLORS_6.length]}
            fillOpacity={0.6}
            stroke={CHART_COLORS_6[ci % CHART_COLORS_6.length]}
            strokeWidth={1}
          />
        ))}

        {/* X axis labels */}
        {days.filter((_, i) => i % Math.ceil(days.length / 7) === 0 || i === days.length - 1).map((day, i) => {
          const si = days.indexOf(day);
          const x = padding.left + si * xStep;
          return (
            <text key={i} x={x} y={height - 5} textAnchor="middle" className="text-[7px] fill-memphis-purple/60 font-medium">
              {day.slice(5)}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2 justify-center">
        {countries.map((country, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm border border-memphis-ink/20" style={{ background: CHART_COLORS_6[i % CHART_COLORS_6.length] }} />
            <span className="text-[10px] font-semibold text-memphis-ink">{country}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
