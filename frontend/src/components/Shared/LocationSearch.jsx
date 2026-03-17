import React, { useState, useEffect } from "react";
import axios from "axios";
import { Search } from "lucide-react";

// Debounce hook to prevent API spam
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

const LocationSearch = ({ placeholder, onSelect }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 500);

  useEffect(() => {
    // Only search if user typed 3+ chars
    if (debouncedQuery.length > 2) {
      const token = localStorage.getItem("token");
      // Using the global search API
      axios
        .get(`http://localhost:8000/api/global-search/?q=${debouncedQuery}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => {
          setResults(res.data);
          setIsOpen(true);
        })
        .catch((err) => console.error("Search failed", err));
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [debouncedQuery]);

  const handleSelect = (item) => {
    setQuery(item.display_name.split(",")[0]); // Keep it short
    setIsOpen(false);
    onSelect(item);
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          type="text"
          className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none shadow-sm text-sm"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
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
