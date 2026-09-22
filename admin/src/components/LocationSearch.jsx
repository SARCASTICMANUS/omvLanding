import { useState, useEffect, useRef } from "react";
import { Search, Loader2, MapPin } from "lucide-react";
import api from "../api/client";

const useDebounce = (value, delay) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

export default function LocationSearch({ placeholder, onSelect, initialValue = "", className = "" }) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounce(query, 400);
  const selectedRef = useRef(initialValue);
  const ref = useRef(null);

  useEffect(() => {
    if (initialValue && initialValue !== selectedRef.current) {
      selectedRef.current = initialValue;
      setQuery(initialValue.split(",")[0]);
    }
  }, [initialValue]);

  useEffect(() => {
    if (!debounced || debounced.length < 3 || debounced === selectedRef.current.split(",")[0]) {
      setResults([]);
      setOpen(false);
      return;
    }
    let ignore = false;
    setLoading(true);
    api
      .get(`/transport/geocode/search/?q=${encodeURIComponent(debounced)}&limit=8&countrycodes=in`)
      .then((res) => {
        if (ignore) return;
        const data = res.data;
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => { ignore = true; };
  }, [debounced]);

  useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const handleSelect = (item) => {
    const short = item.display_name.split(",")[0];
    selectedRef.current = short;
    setQuery(short);
    setResults([]);
    setOpen(false);
    onSelect({
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      display_name: item.display_name,
    });
  };

  return (
    <div ref={ref} className="relative w-full">
      <div className="relative">
        {loading ? (
          <Loader2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2E5CFF] animate-spin" />
        ) : (
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value) {
              setResults([]);
              setOpen(false);
              onSelect(null);
            }
          }}
          onFocus={() => { if (results.length) setOpen(true); }}
          placeholder={placeholder}
          className={`glass-input pl-9 ${className}`}
        />
      </div>
      {open && results.length > 0 && (
        <ul className="glass-card-strong absolute top-full left-0 right-0 mt-1 rounded-xl shadow-lg max-h-60 overflow-y-auto z-50">
          {results.map((item, i) => (
            <li
              key={i}
              onClick={() => handleSelect(item)}
              className="px-4 py-3 hover:bg-white/70 cursor-pointer border-b last:border-0 border-slate-200/60 transition-all duration-200"
            >
              <div className="flex items-start gap-3">
                <MapPin size={16} className="mt-0.5 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {item.display_name.split(",")[0]}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{item.display_name}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
