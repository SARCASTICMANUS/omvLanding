import React, { useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Bell, Info, ShieldAlert, Bus, Trash2 } from "lucide-react";
import { MobileBackButton } from "../components/Layout";
import { clearPassengerNotifications } from "../redux/slices/passengerSlice";

export default function NotificationsPage() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth || {});
  const passengerNotifications = useSelector(
    (state) => state.passenger?.notifications || []
  );

  const handleClearAll = () => {
    if (user?.role !== "driver") {
      dispatch(clearPassengerNotifications());
    }
  };

  const mockAlerts = useMemo(() => [
    {
      id: "mock-1",
      createdAt: Date.now() - 1000 * 60 * 5,
      title: "System Update",
      message: "Multi-city transit maps have been updated with new active routes.",
      type: "system",
    },
    {
      id: "mock-2",
      createdAt: Date.now() - 1000 * 60 * 30,
      title: "Kalman Smoothing",
      message: "GPS smoothing has been upgraded to Kalman Filter v2 for lower jitter.",
      type: "info",
    },
    {
      id: "mock-3",
      createdAt: Date.now() - 1000 * 60 * 120,
      title: "Safety Shield Active",
      message: "Vayy Safe-Trip monitoring is fully active for all live transits.",
      type: "safety",
    },
  ], []);

  const allNotifications = useMemo(() => [...passengerNotifications, ...mockAlerts], [passengerNotifications, mockAlerts]);

  const getAlertIcon = (type) => {
    switch (type) {
      case "trip_started":
      case "bus_nearby":
        return <Bus size={20} className="text-[#009849]" />;
      case "proximity_alert":
      case "safety":
        return <ShieldAlert size={20} className="text-amber-500" />;
      case "system":
        return <Info size={20} className="text-[#00E676]" />;
      default:
        return <Bell size={20} className="text-gray-500" />;
    }
  };

  const getAlertBg = (type) => {
    switch (type) {
      case "trip_started":
      case "bus_nearby":
        return "bg-green-50 border-green-100";
      case "proximity_alert":
      case "safety":
        return "bg-amber-50 border-amber-100";
      case "system":
        return "bg-emerald-50 border-emerald-100";
      default:
        return "bg-slate-50 border-slate-100";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24 lg:pb-0">
      <MobileBackButton />

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between mt-12 lg:mt-0">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">
              Transit Alerts
            </h1>
            <p className="text-gray-500 mt-1 text-sm font-medium">
              Real-time updates and notification history
            </p>
          </div>
          
          {passengerNotifications.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-150 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors bg-white"
            >
              <Trash2 size={13} />
              Clear
            </button>
          )}
        </div>

        <div className="space-y-4">
          {allNotifications.map((alert) => (
            <div
              key={alert.id}
              className={`p-5 rounded-[18px] border bg-white shadow-sm flex items-start gap-4 transition-all duration-200 hover:shadow-md ${getAlertBg(
                alert.type
              )}`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm border border-slate-100">
                {getAlertIcon(alert.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-gray-900 truncate">
                    {alert.title || "Notification"}
                  </h3>
                  <span className="text-[11px] font-bold text-gray-400 shrink-0">
                    {new Date(alert.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 font-semibold text-gray-600">
                  {alert.message || alert.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
