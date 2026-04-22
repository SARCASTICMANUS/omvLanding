import React, { useState, useEffect } from "react";
import { AlertCircle, X, Loader, Footprints } from "lucide-react";
import api from "../../utils/api";

const ProximityAlertModal = ({ alert, onClose }) => {
  const [walkingEta, setWalkingEta] = useState(null);

  useEffect(() => {
    if (alert) {
      // Fetch walking ETA using OSRM
      api.post("/api/passenger/walking-eta/", {
        lat: alert.lat,
        lon: alert.lon,
        // ... include user location if available
      }).then(res => setWalkingEta(res.data.eta_minutes));
    }
  }, [alert]);

  if (!alert) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-4">
        <div className="flex justify-between items-start">
          <div className="bg-amber-100 p-3 rounded-full text-amber-600">
            <AlertCircle size={24} />
          </div>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        <h3 className="font-black text-lg text-slate-900">{alert.message}</h3>
        {walkingEta && (
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <Walking size={20} className="text-blue-500" />
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Walking Time</p>
              <p className="text-sm font-bold">{walkingEta} mins to stop</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProximityAlertModal;
