# VAYY Repository Guidelines

## Project Overview

VAYY is a route-based mobility platform for passengers, auto drivers, and bike riders. The platform focuses on route discovery, live tracking, stop-based boarding, and transit intelligence.

## Tech Stack

* React Native 0.81.5 + Expo SDK 54
* JavaScript (JSX) with TypeScript config
* Redux Toolkit (9 slices)
* React Navigation v6 (Stack + Bottom Tabs)
* Axios (HTTP client with token refresh interceptor)
* MapLibre React Native v11.3.6 (maps)
* OpenStreetMap tiles via MapTiler API
* OSRM (routing)
* Nominatim (geocoding)
* WebSockets (real-time updates)
* expo-location (GPS tracking)
* expo-notifications (push notifications)
* expo-image-picker (camera/gallery)
* @react-native-async-storage/async-storage (token persistence)
* Django Backend (separate repo at backend/vayy/)

## Project Structure

```
vayy_app/
├── App.js                  # Root component: Provider + SafeAreaProvider + LanguageProvider + AppNavigator
├── src/
│   ├── admin/              # Admin panel components & services
│   ├── auth/               # Authentication module (LoginPage, RegisterPage, OTP, PasswordReset)
│   ├── components/         # Legacy shared components
│   ├── constants/          # Centralized constants (apiPaths, wsPaths, roles, theme, etc.)
│   ├── data/               # Mock data
│   ├── driver/             # Driver-side screens (bike-ride/, shared-auto/, screens/)
│   ├── handshake/          # Passenger-driver connection
│   ├── navigation/         # React Navigation (6 navigators)
│   ├── passenger/          # Passenger-side screens (bike-ride/, shared-auto/, screens/)
│   ├── routes/             # Route intelligence layer
│   ├── screens/            # (Empty placeholder)
│   ├── shared/             # Cross-cutting concerns (components, hooks, lib, utils)
│   ├── store/              # Redux state management (9 slices)
│   ├── theme/              # Legacy theme files
│   ├── tracking/           # Live tracking screens
│   └── utils/              # Utility functions
├── docs/                   # Documentation (bike-flow-audit.md)
└── assets/                 # Images (splash, icons, vehicle images)
```

## Design System

* Primary: #009849 (green)
* Live Tracking: #00E676
* Background: #F8FAF9
* Cards: white with borderRadius: 20
* Bottom sheets: borderTopLeftRadius: 32
* Primary button: height 56, borderRadius 18, green shadow
* Typography: headings "800"-"900", body "500"-"700"
* Reusable components: VayyButton, VayyCard, VayyMap, VayyMarker, VehicleIconBadge, MetricChip, StatusBadge, ZoomControls
* Mobile-first
* Clean transit UI
* No unnecessary redesigns

## Navigation Architecture

```
AppNavigator (root)
├── SplashCarousel (onboarding, first-time users)
├── AuthNavigator (unauthenticated)
│   ├── LoginPage
│   ├── RegisterPage
│   ├── OtpVerification
│   └── PasswordReset
├── PassengerNavigator (role = passenger/student)
│   ├── Tabs: Home | Routes | Live Map | Alerts | Actions | Profile
│   └── Stack: BikeMapPreRide, BikeSearching, RiderPopup, RideStats, RideComplete, AutoPreRide, AutoSearching, AutoRideComplete, etc.
└── DriverNavigator (role = bikedriver/autodriver/driver)
    ├── Tabs: Home | Routes | Actions | Profile
    └── Stack: FindPassenger, BikeRideToPickup, BikeOTPEntry, BikeRideToDestination, BikeTripComplete, AheadAlert, BoardedPopup, AutoLiveTracking, etc.
```

## State Management

Redux Toolkit with 9 slices registered in store.jsx:
- **auth**: Login, register, OTP verify/resend, token restore
- **vehicleMode**: Driver mode selection
- **trip**: Trip management
- **wallet**: Wallet operations
- **tracking**: Live location tracking
- **notifications**: Notification management
- **profile**: Fetch/update user profile
- **dispatch**: Dispatch lifecycle (request, accept, reject, arrived, start, complete, cancel)
- **ride**: Ride history, rating submission, fare estimation, driver earnings

## Protected Rules

Do NOT:

* Change business logic
* Rename existing functions
* Change API contracts
* Change Redux state shape
* Break navigation flows
* Remove existing features

## Passenger Flow

Trip Planner
→ Route Match
→ Route Review
→ Live Tracking

## Driver Flow

Driver Trip Planner
→ Route List
→ Route Review
→ Stops Timeline
→ Live Tracking

## Development Rules

* Reuse existing components first
* Edit existing files before creating new files
* Follow existing code patterns
* Keep components modular
* Preserve current functionality

## API Layer

* Centralized `api.jsx` with Axios instance
* Request interceptor adds `Authorization: Bearer <jwt>` header
* Response interceptor handles 401 → token refresh → retry
* All API paths centralized in `constants/apiPaths.js`
* Error normalization via `normalizeApiError()`
* Backend responses wrapped in `{ success, message, data }` format

## WebSocket Pattern

* `useWebSocket` hook: self-contained, one connection per instance, auto-reconnect with exponential backoff
* `socketManager.js`: singleton alternative for shared connections
* All raw `new WebSocket()` calls have been removed; 100% migrated to hook
* Backend WebSocket endpoints:
  - `ws/dispatch/<uuid:dispatch_id>/` (no auth)
  - `ws/tracking/vehicle/<uuid:vehicle_id>/` (JWT auth)
  - `ws/tracking/trip/<uuid:trip_id>/` (JWT auth)
  - `ws/notifications/<uuid:user_id>/` (no auth)

## Location Tracking

* `locationService.js`: singleton wrapping expo-location
* Foreground + background permission handling
* `watchPositionAsync` with configurable accuracy/distance/time intervals
* Real-time pipeline: Driver WS → RabbitMQ → Celery → Channels → Passenger WS

## Maps

* Use MapLibre + OSM
* Use OSRM routing
* Use Nominatim for geocoding
* Preserve existing map behavior

## Output Rules For Agents

* Use minimum tokens
* Return only changed code when possible
* Avoid long explanations
* Keep changes focused
* Do not generate duplicate implementations


CRITICAL:

Before editing any file:

- Read complete file.
- Read imported components used by the file.
- Preserve all business logic.
- Preserve all hooks.
- Preserve all state.
- Preserve all navigation.
- Preserve all API calls.
- Never generate simplified examples.
- Never return placeholder code.
- Never rewrite a screen from scratch unless explicitly requested.

If the file cannot be read, stop and report missing context.

## Session Progress

### Goal
Integrate all backend APIs into the vayy_app frontend according to the mobile app UI and project docs, making changes step-by-step with user approval for new files.

### Constraints & Preferences
- Do it step by step — fix one area at a time, ask before each new integration
- Do NOT change business logic, navigation, hooks, or state patterns
- Do NOT change API contracts/endpoints
- Ask before creating new files
- Respond in the same language as the conversation

### Done
- Fixed auth API paths: `/api/auth/*` → `/api/accounts/*` in authSlice.jsx
- Fixed register flow: backend sends OTP (not JWT); registerUser no longer saves tokens
- Added `verifyOtp` and `resendOtp` thunks in authSlice.jsx with OTP state
- Removed `googleLogin` thunk (backend doesn't have the endpoint)
- Created `OtpVerificationPage.jsx` — 6-digit OTP input screen with resend timer
- Fixed `api.jsx`: token refresh path → `/api/accounts/token/refresh/`; exported `normalizeApiError`
- Fixed `LoginPage.jsx`: removed demo bypass; now dispatches real `loginUser`
- Fixed `RegisterPage.jsx`: navigates to `OtpVerification` on successful register
- Fixed `PasswordResetPage.jsx`: path → `/api/accounts/forgot-password/`
- Registered missing slices (trip, wallet, tracking, notification, profile, dispatch, ride) in store.jsx
- Fixed `AppNavigator.jsx`: driverRoles includes `bikedriver`, `autodriver`, `driver`
- Fixed `endTrip` in both `driverService.jsx` and `tripSlice.js`: uses `PATCH /api/operations/dispatch/{id}/complete/`
- Created `profileSlice.js` with `fetchProfile` and `updateProfile` thunks
- Wired `ProfileScreen.jsx` to fetch real driver/passenger profile; shows rating, vehicle info, phone, total trips
- Fixed `DriverKycScreen.jsx`: installed `expo-image-picker`, real camera/gallery picker, submits all 3 docs (LICENSE, RC, INSURANCE) via `POST /api/accounts/driver/documents/`
- Created `dispatchSlice.js` with lifecycle thunks: request, accept, reject, arrived, start, complete, cancel
- Wired `BikeSearchingScreen.jsx` and `AutoSearchingScreen.jsx` to call `requestDispatch` API with graceful mock fallback
- Updated `MapPreRideScreen.jsx` to pass `route_id` and `pickup_stop_id` to `BikeSearching`
- Created `rideSlice.js` with `fetchRideHistory`, `submitRating`, `getRideEstimate` thunks
- Wired `DriverTripHistoryScreen.jsx` to fetch completed trips from `GET /api/ride/history/`
- Wired `JourneyHistoryScreen.jsx` to show full history list from `GET /api/ride/history/` with FlatList, status badges, empty state
- Wired `RideCompleteScreen.jsx` (passenger bike): reads trip data from route.params, calls `submitRating` API on button press
- Wired `AutoRideCompleteScreen.jsx` (passenger auto): same pattern with param-driven trip data + `submitRating`
- Wired `BikeFindPassengerScreen.jsx` (driver bike): Accept calls `acceptDispatch(dispatchId)`, Ignore calls `rejectDispatch(dispatchId)` from dispatchSlice
- Wired `AutoAheadAlertScreen.jsx` (auto alert): Accept calls `acceptDispatch` → BoardedPopup; Ignore calls `rejectDispatch` → goBack; auto-rejects on countdown expiry
- Wired `AutoBoardedPopupScreen.jsx` (boarding check): "Yes, Boarded" calls `arrivedDispatch(dispatchId)` → navigates to `AutoRideActive`
- Wired `AutoFindPassengerScreen.jsx`: passes `dispatchId` through to `AheadAlert`
- Wired `AutoPreRideScreen.jsx` (shared auto): reads pickup, stopDistance, eta, fare, route_id, pickup_stop_id from params; passes `route_id` + `pickup_stop_id` to `AutoSearching`
- Wired `MapPreRideScreen.jsx` (bike): properly destructures `route` from props; reads pickup, stopDistance, eta, bikesOnRoute from params; passes real values to stat cards and card labels
- Wired `MapPostAcceptScreen.jsx` (bike): reads driverName, vehicle, otpDigits, distanceLabels from route.params
- Wired `RiderPopupScreen.jsx` (bike): reads driverName, vehicle, otpDigits from route.params; passes all trip data to `RideStats` on auto-redirect
- Wired `RideStatsScreen.jsx` (bike): reads destination, eta, distance from params; "End Ride" passes full trip data to `RideComplete`
- Wired `AutoLiveTrackingScreen.jsx` (driver auto): replaced mock `currentTrip` import with route.params (passengersOnboard, nextStop, routeProgress, dispatchId); "End Trip" passes real summary/stats to `TripEndSummary`
- Created `useWebSocket.js` hook at `src/shared/hooks/useWebSocket.js`: wraps socketManager singleton with React lifecycle, auto-connects on mount, disconnects on unmount, exposes `{ send, connectionState, isConnected }`, fires `onMessage` callback
- Created `DestinationSearchScreen.jsx`: OSM Nominatim geocoding, navigates back to PassengerTripPlanner with selected destination
- Created `RouteResultsScreen.jsx`, `RouteSelectionScreen.jsx`, `RouteDetailsScreen.jsx` (stub screens for dev debug list)
- Created `RouteLibraryScreen.jsx` with mock route data list
- Created `RouteCreationScreen.jsx` with form (name + dynamic stops, save alert)
- Created `BikeRequestScreen.jsx` at `driver/bike-ride/BikeRequestScreen.jsx` (was empty file; now a functional stub)
- Created `BikeSearchingScreen.jsx` at `driver/bike-ride/BikeSearchingScreen.jsx` (driver passenger-search waiting screen; fixes missing import in BikeDriverNavigator)
- Removed duplicate `BikeRequestScreen.jsx` from `driver/screens/` (wrong location)
- Added `setDispatchStatus` reducer to `dispatchSlice.js` for WS-driven status updates
- Wired `useWebSocket` in `BikeSearchingScreen.jsx` (passenger): connects to `/ws/dispatch/<dispatchId>/` after dispatch request; listens for `dispatch_accepted`/`dispatch_rejected` events to update Redux status
- Wired `useWebSocket` in `AutoSearchingScreen.jsx` (passenger): same pattern as bike for auto dispatch
- Wired `useWebSocket` in `AutoAheadAlertScreen.jsx` (driver): connects to `/ws/dispatch/<dispatchId>/`; listens for `dispatch_cancelled` to auto-navigate back
- Wired `useWebSocket` in `BikeFindPassengerScreen.jsx` (driver): connects to `/ws/notifications/<userId>/` after pre-flight check; maps `new_dispatch_request` WS events to real buddy data (mock fallback preserved)
- Migrated `PassengerLiveTracking.jsx` from raw `new WebSocket(/ws/public/global/passenger/...)` to `useWebSocket(/ws/tracking/trip/<tripId>/)` via socketManager; all business logic preserved
- Migrated `DriverLiveTracking.jsx` from raw `new WebSocket(/ws/public/<cityId>/driver/...)` to `useWebSocket(/ws/tracking/vehicle/<vehicleId>/)` via socketManager; location sends refactored to use `sendRef`
- Removed all raw `new WebSocket()` usage from `vayy_app/src/` — 0 remaining instances
- Fixed `LoginPage.jsx`: passes `role` to `loginUser({ email, password, role })` (was hardcoded)
- Fixed `RegisterPage.jsx`: role values changed from `["passenger", "driver"]` to `["passenger", "bikedriver", "autodriver"]` to match backend
- Fixed 6 import/export mismatches across navigators: added `default` export to `AutoFindPassengerScreen.jsx`, `FromToScreen.jsx`, `DriverLoginScreen.jsx`, `BikeBookingScreen.jsx`
- Fixed 2 Stack.Screen gaps: added `OTPHandshake` to `DriverNavigator.jsx`, `BikeTracking` to `BikeDriverNavigator.jsx`
- Fixed import syntax in `AutoDriverNavigator.jsx` (`AutoBestMatchRouteScreen` default→named alias) and `DriverNavigator.jsx` (`BuddyRequestPopupScreen` named→default)
- Migrated `PassengerLiveTracking.jsx` and `DriverLiveTracking.jsx` from raw WS to `useWebSocket` hook via socketManager
- Created `RecentSearch` model, serializer, APIView (`GET`/`POST`), and URL at `/api/accounts/recent-searches/` in backend
- Created and applied migration (`accounts.0003_add_recent_search`)
- Fixed `passengerService.jsx`: `getRecentSearches` now calls real API; added `saveRecentSearch`
- Fixed `PassengerTripPlanner.jsx`: fetches from correct URL (`/api/accounts/recent-searches/`); saves search on "Search" button click
- Wired real-time location pipeline: Driver WS → RabbitMQ → Celery → Channels → Passenger WS
  - Uncommented Celery app in `vayy/__init__.py` so workers discover tasks
  - Added `receive()` to `VehicleTrackingConsumer` — driver WS location messages now publish to RabbitMQ via `TrackingEventPublisher`
  - Fixed RabbitMQ queue bindings: added `location.*` wildcard so `location.gps` messages reach `auto.location`/`bike.location` queues
  - Created `consume_location` management command — long-running consumer that listens on RabbitMQ queues and dispatches `process_location_update` Celery tasks
  - Fixed `LocationService.process_location_update()` broadcast payload: now sends `type: "vehicle_update"`, `lat`/`lng`, `next_stop_eta` matching passenger frontend expectations
  - Updated `PassengerLiveTracking.jsx` `handleWsMessage` to read `data.lng || data.lon`
  - Updated docker-compose Celery service to run both `celery worker` + `consume_location` consumer
- Fixed `AutoPreRideScreen.jsx`: `pickup` is an object (not string) — use `pickup?.name || pickup?.display_name` instead of `.replace()`
- Fixed `MapPreRideScreen.jsx` (bike): added missing `mapRef = useRef(null)` and same pickup object fix
- Fixed `MapPostAcceptScreen.jsx` (bike): added missing `mapRef = useRef(null)`, `zoomIn`, `zoomOut`
- Fixed `BikeSearchingScreen.jsx`: added missing `mapRef = useRef(null)`, `zoomIn`, `zoomOut`
- Fixed `AutoSearchingScreen.jsx`: added missing `mapRef = useRef(null)`, `zoomIn`, `zoomOut`
- Fixed `RiderPopupScreen.jsx`: added missing `mapRef = useRef(null)`, `zoomIn`, `zoomOut`
- Fixed `BikeRideToDestinationScreen.jsx`: replaced haversine distance with OSRM `getRoadDistance` for real road distance/ETA
- Fixed `BikeTripCompleteScreen.jsx`: fares + rating fetched from backend `RIDE.tripFare(dispatchId)` API; stars display actual rating dynamically
- Fixed `RideStatsScreen.jsx`: added route polyline from `fetchRouteGeometry`; replaced visual share modal with real `Share.share()`
- Fixed `RideCompleteScreen.jsx`: fare breakdown now fetched from backend `RIDE.tripFare(tripId)` API; `submitRating` verified and preserved
- Verified `BikeOTPEntryScreen.jsx`: buddy params flow through correctly; `startDispatchTrip` endpoint matches backend (`PATCH /api/operations/dispatch/{id}/start/`)
- Fixed duplicate `import api` in `BikeFindPassengerScreen.jsx` (lines 18 & 22)
- Fixed `data.path` extraction in 3 route geometry loads: `data.path.coordinates || data.path` (backend returns GeoJSON geometry object, not raw array)
- Fixed `style` → `paint` on `Layer` components in `RideStatsScreen`, `BikeRideToDestinationScreen`, `RiderPopupScreen` (fixes `style` is deprecated warning)
- Fixed `initialDistance` → `totalDistanceRef.current` ref bug in `BikeRideToDestinationScreen.handleEndRide`
- Rewired `DriverNavigator.jsx` to a 4-tab layout: Home (DriverModeSelect) | My Trips (`DriverTripHistoryScreen` with `initialParams={{ list: true }}`) | Wallet (new `MarshalWalletScreen`) | Profile; `DriverRouteList` now a stack screen `DriverRouteSearch`
- Created `MarshalWalletScreen.jsx` (driver wallet): zip layout, real data via `fetchWallet` (balance + today/week/month earnings from credit txs + recent 10 txs + delegate to DriverTripHistoryScreen for history)
- Rewired `DriverBikeHomeScreen.jsx`/`DriverAutoHomeScreen.jsx` `handleNext` → `navigate("DriverRouteSearch", { pickup, destination, mode })`
- Rewired `DriverRouteList.jsx` `onSelectRoute` → `navigate("AutoFindPassenger"/"BikeFindPassenger", { route })` (was legacy `DriverFindPassengers`)
- Added role-driven `DriverHomeTab` wrapper in `DriverNavigator.jsx`: renders `DriverAutoHomeScreen` when `role === ROLE.AUTO_DRIVER`, `DriverBikeHomeScreen` when `ROLE.BIKE_DRIVER`, else falls back to `DriverModeSelectScreen` (tab name kept as `DriverModeSelect`)
- Fixed `DriverBikeHomeScreen.jsx` card scroll: added `useWindowDimensions`; inner card ScrollView capped at `maxHeight: windowHeight - 210` so recent searches are reachable/selectable
- Redesigned `DriverRouteList.jsx`: stops hidden by default (collapsed card shows only user-chosen start + end, falling back to first/last stop names); added green "View N stops / Hide stops" toggle (`stopsToggle`/`stopsToggleText`); new `stopNameFlex` truncation style; route selection navigates to registered `"FindPassenger"` (bike radar) / `"AutoFindPassenger"`
- Ported the zip "Pre-Ride Check" verification overlay into prod `BikeFindPassengerScreen.jsx` (bike radar): `VEHICLE_IMAGES` hero cycling `vayyWithoutPassengerBike{1..4}.png`, 6 `CHECKS` (System: network/gps/location; Safety: helmet/stand/device), `scaleIn`/`floatAnim`/`spinAnim`/`sweepAnim` animations, animated progress track + `x/6` + "All Clear" badges, "Go Live" button appears only after all checks pass; zip `LinearGradient`/`MapView` imports skipped (not installed / prod uses `VayyMap`); `showVerify`/`checks`/`handleStart` wiring preserved (calls `setOnline(true)` + `setPhase("scanning")`)

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- OTP gets its own screen (OtpVerificationPage) rather than being inline in RegisterPage
- Dispatch lifecycle gets a dedicated Redux slice (dispatchSlice) with all lifecycle thunks
- `endTrip` was redirected from commented-out `trips/{id}/complete/` to existing `dispatch/{id}/complete/` (PATCH)
- Mock timer simulations are preserved as fallback when route params aren't available
- Ride complete/rating screens get a dedicated Redux slice (rideSlice) rather than sharing dispatchSlice
- WebSocket integration uses a custom hook wrapping the existing socketManager singleton rather than modifying tracking screens that use direct `new WebSocket(url)`

## Next Steps
1. Test and debug any connection issues with the actual backend (auth, dispatch, WS)

## Critical Context
- Backend wraps responses in `{ success, message, data }` — all thunks unwrap with `response.data.data || response.data`
- Backend roles: `passenger`, `bikedriver`, `autodriver`, `admin` (not `driver`)
- Auth flow: Register → OTP sent → Verify OTP → Login (tokens only at login, not register)
- Backend uses `success_response()` / `error_response()` utility wrappers
- `expo-image-picker` was installed as a new dependency
- The `CompleteTripAPIView` is commented out in backend urls.py; `DispatchCompleteAPIView` (PATCH) is the active endpoint for completing trips
- Backend WebSocket endpoints: `ws/dispatch/<uuid:dispatch_id>/` (no auth), `ws/tracking/vehicle/<uuid:vehicle_id>/` (JWT auth), `ws/tracking/trip/<uuid:trip_id>/` (JWT auth), `ws/notifications/<uuid:user_id>/` (no auth)
- Frontend tracking screens use `useWebSocket(/ws/tracking/trip/<tripId>/)` and `useWebSocket(/ws/tracking/vehicle/<vehicleId>/)` via socketManager — zero raw `new WebSocket()` calls remain
- `socketManager.js` is a singleton at `src/shared/lib/socketManager.js` with auto-reconnect, token injection, and event pub/sub

## Relevant Files
- `vayy_app/src/auth/authSlice.jsx`: core auth thunks (login, register, verifyOtp, resendOtp, restoreAuth)
- `vayy_app/src/auth/screens/OtpVerificationPage.jsx`: new OTP verification screen
- `vayy_app/src/auth/screens/LoginPage.jsx`: now dispatches real loginUser
- `vayy_app/src/auth/screens/RegisterPage.jsx`: now navigates to OTP screen
- `vayy_app/src/auth/screens/PasswordResetPage.jsx`: fixed API path
- `vayy_app/src/shared/lib/api.jsx`: axios client, token interceptor, normalizeApiError export
- `vayy_app/src/store/store.jsx`: all slices registered (auth, vehicleMode, trip, wallet, tracking, notifications, profile, dispatch, ride)
- `vayy_app/src/store/slices/dispatchSlice.js`: dispatch lifecycle thunks
- `vayy_app/src/store/slices/rideSlice.js`: ride history, rating, estimate thunks
- `vayy_app/src/store/slices/profileSlice.js`: profile fetch/update thunks
- `vayy_app/src/shared/screens/ProfileScreen.jsx`: wired to live profile API
- `vayy_app/src/driver/screens/DriverKycScreen.jsx`: fixed real image picker + multi-doc upload
- `vayy_app/src/driver/screens/DriverTripHistoryScreen.jsx`: wired to ride history API
- `vayy_app/src/driver/bike-ride/BikeFindPassengerScreen.jsx`: wired accept/reject to dispatchSlice
- `vayy_app/src/driver/bike-ride/BikeRequestScreen.jsx`: bike request stub screen
- `vayy_app/src/driver/bike-ride/BikeSearchingScreen.jsx`: driver passenger-search waiting screen
- `vayy_app/src/driver/bike-ride/BikeTripCompleteScreen.jsx`: already param-driven
- `vayy_app/src/driver/shared-auto/AutoAheadAlertScreen.jsx`: wired accept/reject with auto-reject
- `vayy_app/src/driver/shared-auto/AutoBoardedPopupScreen.jsx`: wired arrivedDispatch
- `vayy_app/src/driver/shared-auto/AutoFindPassengerScreen.jsx`: passes dispatchId through
- `vayy_app/src/driver/shared-auto/AutoLiveTrackingScreen.jsx`: replaced mock data with params
- `vayy_app/src/driver/services/driverService.jsx`: endTrip uses dispatch complete
- `vayy_app/src/passenger/screens/DestinationSearchScreen.jsx`: OSM geocoding destination search
- `vayy_app/src/passenger/screens/JourneyHistoryScreen.jsx`: wired to ride history API
- `vayy_app/src/passenger/bike-ride/BikeSearchingScreen.jsx`: wired to requestDispatch
- `vayy_app/src/passenger/bike-ride/MapPreRideScreen.jsx`: param-driven with proper route destructuring
- `vayy_app/src/passenger/bike-ride/MapPostAcceptScreen.jsx`: param-driven driver data
- `vayy_app/src/passenger/bike-ride/RideCompleteScreen.jsx`: wired to submitRating
- `vayy_app/src/passenger/bike-ride/RideStatsScreen.jsx`: param-driven; passes trip data to RideComplete
- `vayy_app/src/passenger/bike-ride/RiderPopupScreen.jsx`: param-driven; passes data to RideStats
- `vayy_app/src/passenger/shared-auto/AutoSearchingScreen.jsx`: wired to requestDispatch
- `vayy_app/src/passenger/shared-auto/AutoPreRideScreen.jsx`: param-driven; passes routeId to AutoSearching
- `vayy_app/src/passenger/shared-auto/AutoRideCompleteScreen.jsx`: wired to submitRating
- `vayy_app/src/routes/screens/RouteResultsScreen.jsx`: route results stub
- `vayy_app/src/routes/screens/RouteSelectionScreen.jsx`: route selection stub
- `vayy_app/src/routes/screens/RouteDetailsScreen.jsx`: route details stub
- `vayy_app/src/routes/screens/RouteLibraryScreen.jsx`: route library with mock data
- `vayy_app/src/routes/screens/RouteCreationScreen.jsx`: route creation form
- `vayy_app/src/routes/screens/TripEndSummary.jsx`: already param-driven
- `vayy_app/src/shared/hooks/useWebSocket.js`: new WS hook wrapping socketManager
- `vayy_app/src/shared/lib/socketManager.js`: WS singleton with reconnection, token injection
- `vayy_app/src/navigation/PassengerNavigator.jsx`: includes DestinationSearchScreen, BikeSearching, AutoSearching
- `vayy_app/src/navigation/AppNavigator.jsx`: driverRoles includes bikedriver/autodriver
- `vayy_app/src/navigation/AuthNavigator.jsx`: added OTP screen route
- `vayy_app/src/navigation/BikeDriverNavigator.jsx`: references BikeSearchingScreen from driver path
- `backend/vayy/accounts/api/urls.py`: all auth endpoints
- `backend/vayy/operations/api/urls.py`: dispatch lifecycle endpoints
- `backend/vayy/operations/websockets/routing.py`: `ws/dispatch/<uuid:dispatch_id>/` endpoint
- `backend/vayy/tracking/websockets/routing.py`: `ws/tracking/vehicle/<uuid:vehicle_id>/` and `ws/tracking/trip/<uuid:trip_id>/` endpoints
- `vayy_app/src/store/slices/dispatchSlice.js`: includes `setDispatchStatus` reducer for WS-driven updates
- `vayy_app/src/tracking/screens/PassengerLiveTracking.jsx`: migrated to `useWebSocket(/ws/tracking/trip/<tripId>/)`
- `vayy_app/src/driver/screens/DriverLiveTracking.jsx`: migrated to `useWebSocket(/ws/tracking/vehicle/<vehicleId>/)`
- `vayy_app/src/passenger/bike-ride/BikeSearchingScreen.jsx`: wired dispatch WS listener
- `vayy_app/src/passenger/shared-auto/AutoSearchingScreen.jsx`: wired dispatch WS listener
- `vayy_app/src/driver/bike-ride/BikeFindPassengerScreen.jsx`: wired notification WS listener
- `vayy_app/src/driver/shared-auto/AutoAheadAlertScreen.jsx`: wired dispatch WS listener
- `vayy_app/src/passenger/services/passengerService.jsx`: `getRecentSearches` + `saveRecentSearch`
- `backend/vayy/accounts/models.py`: `RecentSearch` model
- `backend/vayy/accounts/api/serializers.py`: `RecentSearchSerializer` + `RecentSearchCreateSerializer`
- `backend/vayy/accounts/api/views.py`: `RecentSearchAPIView` (GET list / POST create)
- `backend/vayy/accounts/api/urls.py`: `recent-searches/` endpoint
- `backend/vayy/accounts/migrations/0003_add_recent_search.py`: migration
- `backend/vayy/vayy/__init__.py`: uncommented Celery wiring
- `backend/vayy/tracking/websockets/consumers.py`: `VehicleTrackingConsumer.receive()` for driver WS → RabbitMQ
- `backend/vayy/tracking/services/location_service.py`: WS broadcast payload format fixed
- `backend/vayy/tracking/management/commands/consume_location.py`: RabbitMQ → Celery consumer
- `backend/vayy/communication/services/rabbitmq_service.py`: added `location.*` wildcard binding
- `backend/vayy/docker-compose.yaml`: Celery service runs worker + consumer
