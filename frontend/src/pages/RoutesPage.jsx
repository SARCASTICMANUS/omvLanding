import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { API_PATHS } from '../constants/apiPaths';

export default function RoutesPage() {
  const [routes, setRoutes] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedRoute, setSelectedRoute] = useState(null);

  useEffect(() => {
    // Fetch cities
    api.get(API_PATHS.cities.list)
      .then(res => {
        console.log("Cities fetched:", res.data);
        setCities(Array.isArray(res.data) ? res.data : []);
      })
      .catch(err => console.error("Failed to fetch cities", err));
  }, []);

  useEffect(() => {
    // Fetch routes, optionally filtered by city
    const url = selectedCity ? `${API_PATHS.transport.routes}?city=${selectedCity}` : API_PATHS.transport.routes;
    api.get(url)
      .then(res => {
        console.log("Routes fetched:", res.data);
        setRoutes(Array.isArray(res.data) ? res.data : []);
      })
      .catch(err => {
        console.error("Failed to fetch routes", err);
      });
  }, [selectedCity]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Available Routes</h1>
        <select 
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium outline-none"
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
        >
          <option value="">All Cities</option>
          {Array.isArray(cities) && cities.map(city => (
            <option key={city.id} value={city.id}>{city.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {routes.map(route => (
          <div key={route.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold mb-2">{route.name}</h2>
            <p className="text-gray-500 text-sm mb-4">Bus: {route.bus_number}</p>
            <div className="text-xs text-gray-600 mb-4">
              {route.start_name} → {route.end_name}
            </div>
            <button 
              onClick={() => setSelectedRoute(route)}
              className="text-emerald-600 font-medium hover:underline text-sm"
            >
              View {route.stops_count} Stops
            </button>
          </div>
        ))}
      </div>
      {selectedRoute && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full">
            <h2 className="text-2xl font-bold mb-4">{selectedRoute.name} - Stops</h2>
            <ul className="space-y-2">
              {selectedRoute.stops.map((stop, index) => (
                <li key={index} className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">
                    {index + 1}
                  </div>
                  {stop.name}
                </li>
              ))}
            </ul>
            <button 
              onClick={() => setSelectedRoute(null)}
              className="mt-6 w-full py-2 bg-gray-900 text-white rounded-lg font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
