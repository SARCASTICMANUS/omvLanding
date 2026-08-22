// VAYY | src/services/notificationService.js

class NotificationService {
  constructor() {
    this.permission = "default";
    if (typeof window !== "undefined" && "Notification" in window) {
      this.permission = Notification.permission;
    }
  }

  async requestPermission() {
    if (!("Notification" in window)) {
      console.warn("This browser does not support desktop notification");
      return "denied";
    }

    if (Notification.permission !== "denied") {
      this.permission = await Notification.requestPermission();
    }
    return this.permission;
  }

  async notify(title, options = {}) {
    if (this.permission !== "granted") {
      console.warn("Notification permission not granted");
      return null;
    }

    const defaultOptions = {
      icon: "/vite.svg",
      badge: "/vite.svg",
      vibrate: [200, 100, 200],
      timestamp: Date.now(),
      ...options,
    };

    // If Service Worker is available, use it for better background/mobile support
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        registration.showNotification(title, defaultOptions);
        return;
      } catch (e) {
        console.error("SW Notification failed, falling back to window.Notification", e);
      }
    }
    
    try {
      const n = new Notification(title, defaultOptions);
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (e) {
      console.error("Notification failed", e);
    }
  }

  // Specifically for background/Service Worker
  async showBackgroundNotification(title, options = {}) {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification(title, {
        icon: "/vite.svg",
        ...options,
      });
    }
  }
}

const notificationService = new NotificationService();
export default notificationService;
