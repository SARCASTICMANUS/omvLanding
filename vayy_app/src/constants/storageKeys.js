export const STORAGE_KEYS = {
  token: "token",
  accessToken: "access_token",
  refreshToken: "refresh_token",
  user: "user",
  pendingEmail: "pending_email",
  onboardingDone: "@vayy_onboarding_done",
  // Storage version for one-time silent wipe on app launch.
  // Bump this value when a versioned wipe is due; the app will clear all
  // keys stored under a previous version automatically.
  storageVersion: "@vayy_storage_version",
  // Last Expo push token successfully POSTed to /api/accounts/push-token/.
  // Kept so a cold start does not re-register on every launch, and so a token
  // rotation is detected without a round trip.
  pushToken: "@vayy_push_token",
  // Notifications that arrived while the app was backgrounded or killed and
  // have not been surfaced in the UI yet.
  pushQueue: "@vayy_push_queue",
  // Last resolved service city (id + name + centroid + resolvedAt), so the
  // dynamic-preview call can send an explicit city_id instead of relying on
  // the backend to guess one from the pickup coordinate.
  serviceCity: "@vayy_service_city",
};

export default STORAGE_KEYS;
