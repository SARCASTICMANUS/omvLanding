import { useSocketSubscription } from "../../hooks/useSocketSubscription";
import { createSocketPath, socketKeys } from "../../sockets/subscriptions";

export const useDriverManifestSocket = ({ vehicleId, enabled = true, onManifestUpdate }) =>
  useSocketSubscription({
    key: vehicleId ? socketKeys.driverManifest(vehicleId) : null,
    path: vehicleId ? createSocketPath.driverManifest(vehicleId) : null,
    enabled: enabled && Boolean(vehicleId),
    onMessage: (message) => {
      if (message?.type === "manifest_update") {
        onManifestUpdate?.(message);
      }
    },
  });

