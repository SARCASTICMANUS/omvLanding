import React, { useState, useEffect } from "react";
import { AlertCircle, X, Loader, Footprints } from "lucide-react";
import axios from "axios";

const OSRM_HOST = "http://localhost:5000";

const ProximityAlertModal = ({ alert, onClose }) => {
  const [walkingEta, setWalkingEta] = useState(null);

  useEffect(() => {
    if (alert && alert.lat && alert.lon) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userLat = pos.coords.latitude;
          const userLon = pos.coords.longitude;
          const url = `${OSRM_HOST}/route/v1/foot/${userLon},${userLat};${alert.lon},${alert.lat}?overview=false`;
          axios.get(url).then((res) => {
            if (res.data.code === "Ok" && res.data.routes.length > 0) {
              const durationMin = Math.ceil(res.data.routes[0].duration / 60);
              setWalkingEta(durationMin);
            }
          }).catch(() => setWalkingEta(null));
        },
        () => setWalkingEta(null),
      );
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
            <Footprints size={20} className="text-blue-500" />
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
