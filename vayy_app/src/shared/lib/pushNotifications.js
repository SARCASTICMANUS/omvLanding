import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

import api from "./api";
import { AUTH, STORAGE_KEYS } from "../../constants";

/**
 * Push notification layer.
 *
 * Three things live here, all of them previously missing:
 *
 *  1. `configureNotificationHandler` — without it iOS never displays a
 *     notification while the app is in the foreground, and Android ignores the
 *     sound/badge entirely.
 *  2. A background task registered through `expo-task-manager`. The app used
 *     to have no background entry point at all, so a notification that woke the
 *     app from the killed state was never handled.
 *  3. `registerPushToken` — token registration used to live inline in
 *     BikeFindPassengerScreen only, so autodrivers never registered and
 *     PushService found `User.push_token` empty and delivered nothing.
 *
 * The backend sends `data` = `Notification.metadata` (see
 * communication/consumers/notification_consumer.py), so tap routing keys are
 * read from that payload.
 */

export const PUSH_BACKGROUND_TASK = "vayy-push-notification-task";
export const PUSH_CHANNEL_ID = "vayy-default";

const LOG_TAG = "[PushNotifications]";
const PUSH_QUEUE_MAX = 30;

let _handlerConfigured = false;
let _backgroundTaskRegistered = false;
let _tokenRequest = null;

function isPushSupported() {
  return Platform.OS !== "web";
}

/**
 * app.json nests the EAS project id one level deeper than usual
 * (`expo.extra.extra.projectId`), so both shapes are accepted.
 */
export function getEasProjectId() {
  const extra = Constants?.expoConfig?.extra || {};
  return (
    extra?.extra?.projectId ||
    extra?.projectId ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    null
  );
}

/**
 * Foreground behaviour. While the app is in the foreground the in-app toast is
 * the presentation layer, so the OS banner is suppressed to avoid showing the
 * same message twice; backgrounded/killed, the OS banner is shown as usual.
 */
export function configureNotificationHandler() {
  if (_handlerConfigured || !isPushSupported()) return;
  _handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const inForeground = AppState.currentState === "active";
      return {
        shouldShowBanner: !inForeground,
        shouldShowList: !inForeground,
        shouldPlaySound: true,
        shouldSetBadge: true,
      };
    },
  });
  console.log(`${LOG_TAG} notification handler configured`);
}

export async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
      name: "Ride updates",
      importance: Notifications.AndroidImportance?.HIGH ?? 4,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#009849",
    });
  } catch (err) {
    console.warn(`${LOG_TAG} channel setup failed:`, err?.message);
  }
}

/**
 * Unwraps an incoming notification into the shape the rest of the app uses.
 * Handles both a remote push (title/body/data) and a locally scheduled one.
 */
export function toNotificationPayload(notification) {
  if (!notification) return null;
  const content = notification.request?.content || {};
  const data = content.data || {};
  return {
    title: content.title || content.body || "Vayy",
    message: content.body || "",
    // Expo puts top-level fields in `data` too; merge so a tap always sees
    // trip_id/request_id regardless of how the sender nested them.
    data: { ...data, title: data.title || content.title, message: data.message || content.body },
  };
}

async function readQueue() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.pushQueue);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`${LOG_TAG} could not read push queue:`, err?.message);
    return [];
  }
}

async function writeQueue(queue) {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.pushQueue, JSON.stringify(queue));
  } catch (err) {
    console.warn(`${LOG_TAG} could not write push queue:`, err?.message);
  }
}

async function enqueueBackgroundNotification(payload) {
  const queue = await readQueue();
  queue.push({ ...payload, queuedAt: Date.now() });
  while (queue.length > PUSH_QUEUE_MAX) queue.shift();
  await writeQueue(queue);
  console.log(`${LOG_TAG} background notification queued depth=${queue.length}`);
}

/**
 * Returns notifications that arrived while the app was not running and clears
 * the queue, so a cold start still surfaces what the user missed.
 */
export async function drainBackgroundNotifications() {
  const queue = await readQueue();
  if (queue.length === 0) return [];
  await writeQueue([]);
  return queue;
}

/**
 * Installs the background task body. This runs at module scope on purpose: a
 * notification that wakes the app from the killed state executes before React
 * mounts, so a defineTask buried in a component effect is too late and the
 * notification is dropped.
 */
function defineBackgroundTask() {
  if (!isPushSupported()) return;
  try {
    if (TaskManager.isTaskDefined(PUSH_BACKGROUND_TASK)) return;
    TaskManager.defineTask(PUSH_BACKGROUND_TASK, async ({ data, error }) => {
      if (error) {
        console.warn(`${LOG_TAG} background task error:`, error?.message);
        return;
      }
      if (!data) return;
      // This task runs in its own JS context, so it cannot reach the mounted
      // store. Persist instead; the foreground listener drains the queue.
      await enqueueBackgroundNotification({
        title: data.title || "Vayy",
        message: data.message || "",
        data,
      });
    });
  } catch (err) {
    console.warn(`${LOG_TAG} background task definition failed:`, err?.message);
  }
}

/**
 * Registers the background handler with the OS. The task body is defined at
 * module scope; this only performs the async registration and is safe to call
 * repeatedly.
 */
export async function registerBackgroundHandler() {
  if (!isPushSupported() || _backgroundTaskRegistered) return;
  _backgroundTaskRegistered = true;

  try {
    defineBackgroundTask();

    const isRegistered = await TaskManager.isTaskRegisteredAsync(PUSH_BACKGROUND_TASK);
    if (!isRegistered) {
      await Notifications.registerTaskAsync(PUSH_BACKGROUND_TASK);
    }
    console.log(`${LOG_TAG} background handler registered`);
  } catch (err) {
    _backgroundTaskRegistered = false;
    console.warn(`${LOG_TAG} background handler registration failed:`, err?.message);
  }
}

/**
 * The stored registration is a `{ token, userId }` envelope rather than a bare
 * token. Values written by the old inline bike-screen code are a bare string,
 * so those are reported with an unknown owner and get re-registered once.
 */
function readStoredRegistration(raw) {
  if (!raw) return { token: null, userId: null };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.token === "string") {
      return { token: parsed.token, userId: parsed.userId ?? null };
    }
  } catch (_err) {
    // Legacy bare-token value, fall through.
  }
  return { token: raw, userId: null };
}

/**
 * Requests permission if needed, resolves the Expo token and registers it
 * against the authenticated user. Safe to call repeatedly: the POST is skipped
 * only when the same token was already registered for the same user.
 *
 * @param {object} [options]
 * @param {string|number} [options.userId] owner of the registration; a change
 *   forces a re-POST so a newly signed-in user on the same device is covered.
 * @param {boolean} [options.force]
 * @returns {Promise<string|null>} the token, or null when unavailable.
 */
export async function registerPushToken({ userId = null, force = false } = {}) {
  if (!isPushSupported()) return null;
  // Collapse concurrent callers (mount + auth change) onto one request.
  if (_tokenRequest) return _tokenRequest;

  _tokenRequest = (async () => {
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let status = existing;
      if (status !== "granted") {
        const requested = await Notifications.requestPermissionsAsync();
        status = requested?.status;
      }
      if (status !== "granted") {
        console.log(`${LOG_TAG} push permission not granted (${status})`);
        return null;
      }

      const projectId = getEasProjectId();
      const tokenData = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();
      const token = tokenData?.data || tokenData;
      if (!token) return null;

      // The Expo token belongs to the device, not the account, so comparing the
      // token alone would skip registration for a second user signing in on the
      // same phone and leave them with no push channel at all.
      const stored = readStoredRegistration(
        await AsyncStorage.getItem(STORAGE_KEYS.pushToken)
      );
      if (!force && stored.token === token && stored.userId === userId) {
        console.log(`${LOG_TAG} push token already registered for user ${userId}`);
        return token;
      }

      // Backend accepts "token" or "push_token"; keep the existing spelling.
      await api.post(AUTH.pushToken, { push_token: token });
      await AsyncStorage.setItem(
        STORAGE_KEYS.pushToken,
        JSON.stringify({ token, userId })
      );
      console.log(`${LOG_TAG} push token registered for user ${userId}`);
      return token;
    } catch (err) {
      // getExpoPushTokenAsync throws in Expo Go on Android, and a build without
      // google-services.json has no FirebaseApp at all. Both are EXPECTED until
      // the owner supplies the FCM credentials (ledger M-T6), so this path must
      // fail quietly: no crash, no retry loop, and no console.warn - a warn on
      // every cold start raises a LogBox toast that floats over the UI and
      // swallows taps on the home screen.
      // The WebSocket channel still delivers live events.
      console.log(`${LOG_TAG} push token unavailable (expected without FCM config):`, err?.message);
      return null;
    } finally {
      _tokenRequest = null;
    }
  })();

  return _tokenRequest;
}

// Module-scope side effects. The OS can hand the app a notification before
// React mounts, so both the foreground handler and the background task body
// have to be installed as soon as this module is evaluated.
configureNotificationHandler();
defineBackgroundTask();
