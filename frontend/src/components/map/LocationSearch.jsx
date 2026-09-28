import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
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
  iconPosition = "left",
}) => {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const selectedQueryRef = useRef(initialValue ? initialValue.split(",")[0] : "");
  const containerRef = useRef(null);
  const dismissedRef = useRef(false);

  // Close dropdown when clicking/tapping outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        dismissedRef.current = true;
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen]);

  // Sync with initialValue if it changes externally (e.g., from dragging a marker)
  useEffect(() => {
    if (initialValue) {
      const nextQuery = initialValue.split(",")[0];
      selectedQueryRef.current = nextQuery;
      const timeout = setTimeout(() => {
        setQuery(nextQuery);
        setResults([]);
        setSearched(false);
        setIsLoading(false);
        dismissedRef.current = true;
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
      const loadingTimer = setTimeout(() => setIsLoading(true), 0);

      // Using Nominatim (OpenStreetMap) for geocoding autocomplete
      axios
        .get(`https://nominatim.openstreetmap.org/search`, {
          params: {
            q: debouncedQuery,
            format: "json",
            limit: 5,
            addressdetails: 1,
          },
          headers: {
            "Accept-Language": "en",
          },
        })
        .then((res) => {
          setIsLoading(false);
          if (ignore || debouncedQuery === selectedQueryRef.current) return;
          const rawResults = Array.isArray(res.data) ? res.data : [];
          const nextResults = rawResults.map((item) => ({
            display_name: item.display_name,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
          }));
          setResults(nextResults);
          setSearched(true);
          if (!dismissedRef.current) setIsOpen(true);
        })
        .catch((err) => {
          setIsLoading(false);
          if (ignore) return;
          setResults([]);
          setSearched(true);
          if (!dismissedRef.current) setIsOpen(true);
          if (err?.response?.status !== 401) {
            console.error("Search failed", err);
          }
        });

      return () => {
        ignore = true;
        clearTimeout(loadingTimer);
      };
    } else {
        const clearTimer = setTimeout(() => setIsLoading(false), 0);
        return () => clearTimeout(clearTimer);
    }
  }, [debouncedQuery, initialValue]);

  const handleSelect = (item) => {
    const nextQuery = item.display_name.split(",")[0];
    selectedQueryRef.current = nextQuery;
    setQuery(nextQuery); // Keep it short
    setResults([]);
    setSearched(false);
    setIsLoading(false);
    dismissedRef.current = true;
    setIsOpen(false);
    onSelect(item);
  };

  const handleChange = (e) => {
    const nextQuery = e.target.value;
    if (nextQuery !== selectedQueryRef.current) {
      selectedQueryRef.current = "";
    }
    setSearched(false);
    if (nextQuery.length < 3) {
      setResults([]);
      setIsOpen(false);
    } else {
      // Keep the dropdown open while typing so it never flickers closed
      dismissedRef.current = false;
      setIsOpen(true);
    }
    if (!nextQuery) {
        onSelect(null);
    }
    setQuery(nextQuery);
  };

  const pending = query !== debouncedQuery;
  const spinnerActive = isLoading || (pending && query.length > 2);
  const searchIconPosition = iconPosition === "right"
    ? "right-3 left-auto"
    : "left-3";
  const searchIconStyle = iconPosition === "right"
    ? { top: "50%", right: "12px", left: "auto", transform: "translateY(-50%)" }
    : { top: "50%", left: "12px", transform: "translateY(-50%)" };
  const showPanel =
    isOpen && (results.length > 0 || spinnerActive || searched);

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          className={className || defaultInputClassName}
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              dismissedRef.current = true;
              setIsOpen(false);
            }
          }}
        />
        {spinnerActive ? (
            <RefreshCw
              className={`pointer-events-none absolute z-10 ${searchIconPosition} animate-spin text-emerald-500`}
              style={searchIconStyle}
              size={18}
            />
        ) : (
            <Search
              className={`pointer-events-none absolute z-10 ${searchIconPosition} text-gray-400`}
              style={searchIconStyle}
              size={18}
            />
        )}
      </div>

      {showPanel && (
        <ul className="absolute w-full bg-white mt-1 rounded-lg shadow-xl border border-gray-100 max-h-60 overflow-y-auto z-[2000]">
          {results.length > 0 ? (
            results.map((item, idx) => (
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
            ))
          ) : spinnerActive ? (
            <li className="px-4 py-3 text-sm font-medium text-gray-500">
              Searching...
            </li>
          ) : (
            <li className="px-4 py-3 text-sm">
              <div className="font-semibold text-gray-600">No results found</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {`No matches for "${query}". Try a different search.`}
              </div>
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default LocationSearch;
