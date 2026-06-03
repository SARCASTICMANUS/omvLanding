import React, { useState, useEffect, useRef } from "react";
import api from "../../lib/api";
import { Search, RefreshCw } from "lucide-react";

// Debounce hook to prevent API spam
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

const defaultInputClassName =
  "w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none shadow-sm text-sm";

const LocationSearch = ({
  placeholder,
  onSelect,
  initialValue = "",
  className = "",
}) => {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const selectedQueryRef = useRef(initialValue ? initialValue.split(",")[0] : "");

  // Sync with initialValue if it changes externally (e.g., from dragging a marker)
  useEffect(() => {
    if (initialValue) {
      const nextQuery = initialValue.split(",")[0];
      selectedQueryRef.current = nextQuery;
      const timeout = setTimeout(() => {
        setQuery(nextQuery);
        setResults([]);
        setIsOpen(false);
      }, 0);

      return () => clearTimeout(timeout);
    }
  }, [initialValue]);

  useEffect(() => {
    if (debouncedQuery === selectedQueryRef.current) {
      return;
    }

    // Only search if user typed 3+ chars and it's not the initial value sync
    if (debouncedQuery.length > 2 && debouncedQuery !== (initialValue ? initialValue.split(",")[0] : "")) {
      let ignore = false;
      setIsLoading(true);

      // Using the global search API
      api
        .get(`/api/global-search/?q=${encodeURIComponent(debouncedQuery)}`)
        .then((res) => {
          setIsLoading(false);
          if (ignore || debouncedQuery === selectedQueryRef.current) return;
          const nextResults = Array.isArray(res.data) ? res.data : [];
          setResults(nextResults);
          setIsOpen(nextResults.length > 0);
        })
        .catch((err) => {
          setIsLoading(false);
          if (ignore) return;
          setResults([]);
          setIsOpen(false);
          if (err?.response?.status !== 401) {
            console.error("Search failed", err);
          }
        });

      return () => {
        ignore = true;
      };
    } else {
        setIsLoading(false);
    }
  }, [debouncedQuery, initialValue]);

  const handleSelect = (item) => {
    const nextQuery = item.display_name.split(",")[0];
    selectedQueryRef.current = nextQuery;
    setQuery(nextQuery); // Keep it short
    setResults([]);
    setIsOpen(false);
    onSelect(item);
  };

  const handleChange = (e) => {
    const nextQuery = e.target.value;
    if (nextQuery !== selectedQueryRef.current) {
      selectedQueryRef.current = "";
    }
    if (nextQuery.length < 3) {
      setResults([]);
      setIsOpen(false);
    }
    if (!nextQuery) {
        onSelect(null);
    }
    setQuery(nextQuery);
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          type="text"
          className={className || defaultInputClassName}
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
        />
        {isLoading ? (
            <RefreshCw className="absolute left-3 top-3.5 text-emerald-500 animate-spin" size={18} />
        ) : (
            <Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul className="absolute w-full bg-white mt-1 rounded-lg shadow-xl border border-gray-100 max-h-60 overflow-y-auto z-[2000]">
          {results.map((item, idx) => (
            <li
              key={idx}
              onClick={() => handleSelect(item)}
              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-0 text-sm text-gray-700"
            >
              <div className="font-medium text-gray-900">
                {item.display_name.split(",")[0]}
              </div>
              <div className="text-xs text-gray-400 truncate">
                {item.display_name}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LocationSearch;
