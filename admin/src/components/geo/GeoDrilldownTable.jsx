import { useState } from "react";
import { DataTable } from "../charts";
import { ChevronRight, ChevronDown } from "lucide-react";

export default function GeoDrilldownTable({ countryBreakdown = [], regionBreakdown = [], cityBreakdown = [] }) {
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);

  const filteredRegions = selectedCountry
    ? regionBreakdown.filter((r) => r.country === selectedCountry)
    : [];

  const filteredCities = selectedRegion
    ? cityBreakdown.filter((c) => c.country === selectedCountry)
    : [];

  const countryColumns = [
    {
      label: "Country",
      key: "country",
      render: (val, row) => (
        <button
          onClick={() => {
            setSelectedCountry(selectedCountry === val ? null : val);
            setSelectedRegion(null);
          }}
          className="flex items-center gap-1 text-left font-medium text-slate-800 hover:text-accent-primary transition-colors"
        >
          {selectedCountry === val ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span>{val}</span>
          {row.country_code && <span className="text-slate-400 ml-1">({row.country_code})</span>}
        </button>
      ),
    },
    { label: "Events", key: "count", align: "right", render: (val) => val?.toLocaleString() },
    { label: "%", key: "percentage", align: "right", render: (val) => `${val}%` },
  ];

  const regionColumns = [
    {
      label: "Region",
      key: "region",
      render: (val) => (
        <button
          onClick={() => setSelectedRegion(selectedRegion === val ? null : val)}
          className="flex items-center gap-1 text-left font-medium text-slate-800 hover:text-accent-primary transition-colors"
        >
          {selectedRegion === val ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span>{val}</span>
        </button>
      ),
    },
    { label: "Events", key: "count", align: "right", render: (val) => val?.toLocaleString() },
    { label: "%", key: "percentage", align: "right", render: (val) => `${val}%` },
  ];

  const cityColumns = [
    { label: "City", key: "city", render: (val) => <span className="font-medium text-slate-800">{val}</span> },
    { label: "Events", key: "count", align: "right", render: (val) => val?.toLocaleString() },
    { label: "%", key: "percentage", align: "right", render: (val) => `${val}%` },
  ];

  return (
    <div className="space-y-4">
      <DataTable columns={countryColumns} rows={countryBreakdown} emptyMessage="No country data" />

      {selectedCountry && filteredRegions.length > 0 && (
        <div className="ml-4 border-l-2 border-accent-primary/20 pl-4">
          <p className="glass-label text-[10px] mb-2">Regions in {selectedCountry}</p>
          <DataTable columns={regionColumns} rows={filteredRegions} emptyMessage="No region data" />
        </div>
      )}

      {selectedRegion && filteredCities.length > 0 && (
        <div className="ml-8 border-l-2 border-accent-primary/20 pl-4">
          <p className="glass-label text-[10px] mb-2">Cities in {selectedRegion}</p>
          <DataTable columns={cityColumns} rows={filteredCities} emptyMessage="No city data" />
        </div>
      )}
    </div>
  );
}
