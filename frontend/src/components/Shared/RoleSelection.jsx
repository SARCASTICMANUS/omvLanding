import React from "react";
import { Car, User } from "lucide-react";

const RoleSelection = ({ onSelect }) => {
  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
        {/* Driver Card */}
        <button
          onClick={() => onSelect("driver")}
          className="group relative bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-transparent hover:border-blue-500 flex flex-col items-center gap-4"
        >
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
            <Car size={40} className="text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">I am a Driver</h2>
          <p className="text-gray-500 text-center">
            Set your route from A to B and see passengers along the way.
          </p>
        </button>

        {/* Passenger Card */}
        <button
          onClick={() => onSelect("passenger")}
          className="group relative bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-transparent hover:border-green-500 flex flex-col items-center gap-4"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
            <User size={40} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">I am a Passenger</h2>
          <p className="text-gray-500 text-center">
            Find a vehicle passing within 10 meters of your location.
          </p>
        </button>
      </div>
    </div>
  );
};

export default RoleSelection;
