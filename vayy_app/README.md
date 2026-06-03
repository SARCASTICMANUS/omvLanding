# VAYY Mobile App (vayy-autos)

This is the mobile client for **VAYY**, a real-time public transit tracking and manifest management system. Built with **React Native** and **Expo**, the app provides tailored experiences for both passengers and drivers.

## 🚀 Key Features

### 👥 Passenger Flow
- **Trip Planner:** Search for routes by pickup and drop-off locations using OpenStreetMap (Nominatim).
- **Live Tracking:** Real-time map view of active buses with live location updates via WebSockets.
- **Accurate ETAs:** Dynamic arrival times and stop-by-stop timelines.
- **Route Discovery:** Browse all active buses and routes in the city.

### 🚛 Driver Flow
- **Trip Management:** Select scheduled routes and initiate active trips.
- **Live Console:** Real-time navigation view showing current speed, next stop, and passenger boarding updates.
- **Manifest Updates:** Receive live signals from passengers (hand-raises) via dedicated WebSocket channels.

### 🛠 Technical Core
- **State Management:** Redux Toolkit (RTK) with asynchronous thunks for authentication and global state.
- **Real-Time Engine:** WebSocket integration for high-frequency delta updates (positions, alerts).
- **Navigation:** Role-based navigation using React Navigation (Stack and Bottom Tab navigators).
- **Geospatial:** Integrated React Native Maps for vehicle and stop visualization.
- **Internationalization:** Multi-language support (English, Hindi, Hinglish) via a custom `LanguageProvider`.

## 📂 Project Structure

```text
vayy_app/
├── assets/             # Static assets (images, icons, splash screens)
└── src/
    ├── components/     # Reusable UI components (Common, Navigation, Passenger)
    ├── constants/      # App-wide constants (colors, spacing, routes, theme)
    ├── features/       # Redux slices and logic (auth)
    ├── hooks/          # Custom React hooks (translation, language)
    ├── i18n/           # Internationalization setup and translations
    ├── lib/            # Core utilities (API client, WebSocket config)
    ├── navigation/     # App navigators for Auth, Driver, and Passenger flows
    ├── screens/        # Functional screens for each user role
    └── store/          # Redux store configuration
```

## 🛠 Tech Stack

- **Framework:** [Expo SDK 54](https://expo.dev/) / [React Native 0.81](https://reactnative.dev/)
- **React:** 19.1.0

## 🏁 Getting Started

### Prerequisites
- Node.js (v18+)
- Expo Go app on your mobile device (or an emulator)

### Installation
1. Navigate to the app directory:
   ```bash
   cd vayy_app
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the App
1. Start the Expo development server:
   ```bash
   npm start
   ```
2. Scan the QR code with your Expo Go app or press `a` for Android / `i` for iOS to open in an emulator.

### Environment Configuration
The app uses `EXPO_PUBLIC_API_URL` to connect to the VAYY backend. Ensure your `.env` or environment variables are configured correctly for local or production environments.

---
*Part of the VAYY ecosystem. See the root GEMINI.md for system-wide architectural mandates.*
