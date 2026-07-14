# VAYY — Route-Based Mobility Platform

Passenger & driver platform for bike and auto ride-sharing with route discovery, buddy matching, live tracking, and OTP handshake verification.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo |
| Language | TypeScript |
| Navigation | React Navigation (Stack + Bottom Tabs) |
| State | Redux Toolkit |
| Maps | MapLibre + OSM |
| Routing | OSRM |
| Geocoding | Nominatim (OSM) |
| Backend | Django |
| Real-time | WebSockets |
| Icons | `@expo/vector-icons` (Ionicons, MaterialIcons) |
| UI Primitives | Custom `VayyCard`, `VayyButton`, `AppFrame` |

---

## Design System

| Token | Value |
|---|---|
| **Primary** | `#009849` (green) |
| **Live Tracking** | `#00E676` |
| **Background** | `#F8FAF9` |
| **Card** | `#FFFFFF`, `borderRadius: 20` |
| **Bottom Sheet** | `borderTopLeftRadius: 32`, `borderTopRightRadius: 32` |
| **Primary Button** | `height: 56`, `borderRadius: 18`, green shadow |
| **Handle Bar** | `40×4`, `#E5E7EB`, `borderRadius: 2`, centered |
| **Map Placeholder** | `#F9FAFB` with 3×3 grid lines at 25%/50%/75% |
| **Typography** | Headings: `"800"`–`"900"`, Body: `"500"`–`"700"` |
| **Green Tint** | `#ECFAF1` for badges, info rows |

---

## Folder Structure

```
src/
├── navigation/
│   ├── AppNavigator.jsx          # Root — routes to Auth, Driver, or Passenger
│   ├── AuthNavigator.jsx
│   ├── DriverNavigator.jsx       # Driver tabs + stack screens (bike + auto)
│   ├── PassengerNavigator.jsx    # Passenger tabs + stack screens (bike + auto)
│   ├── BikeDriverNavigator.jsx   # Legacy bike driver nav
│   └── AutoDriverNavigator.jsx   # Legacy auto driver nav
│
├── driver/
│   ├── bike-ride/                # Bike driver screens
│   ├── shared-auto/              # Auto driver screens (shared with future auto flow)
│   ├── screens/                  # Generic driver screens (route list, review, etc.)
│   └── utils/
│
├── passenger/
│   ├── bike-ride/                # Passenger bike screens
│   ├── shared-auto/              # Passenger auto screens
│   └── screens/                  # Generic passenger screens (trip planner, etc.)
│
├── shared/
│   ├── constants/                # colors, radius, spacing, shadow
│   ├── components/common/        # VayyButton, VayyCard, VehicleIconBadge
│   └── screens/                  # ProfileScreen (shared by both roles)
│
├── auth/                         # Redux slice, login/register
├── routes/                       # Route list, timeline, utils
├── tracking/                     # Live tracking screens
├── handshake/                    # Alert screens
├── components/                   # Legacy shared components
├── theme/                        # Legacy theme (colors, spacing, typography)
├── store/                        # Redux store
├── services/                     # API layer
└── hooks/                        # Custom hooks
```

---

## User Flows

### Passenger — Bike Ride

```
[PassengerTripPlanner]
  → Enter pickup & destination
  → "Find Best Route"
  → [PassengerRouteList] — select a route
  → [BikeMapPreRide]
      • Map view with start/end markers
      • Distance/safety info bar
      • "Open Radar" button
      → [ConfirmPopup] — confirm intent
      → [BikeSearchingScreen]
          • Pulsing radar animation
          • 5-second scan
          • Rider card appears (name, rating, ETA, fare)
          → Accept → [RiderPopup]
              • Rider assigned overlay
              → [BikeMapPostAccept]
                  • Live tracking to pickup
                  • Driver location dot
                  • "I'm Here" button
                  → [RideStatsScreen]
                      • Live ride stats (distance, time, speed)
                      → [RideCompleteScreen]
                          • Trip details card
                          • Fare breakdown
                          • Rate driver (1–5 stars)
                          • "Book Another Ride" / "Back to Home"
          → Ignore → searches for next rider
```

### Passenger — Auto / Shared Auto

```
[PassengerTripPlanner]
  → Enter pickup & destination
  → "Find Best Route"
  → [PassengerRouteList] — select a route
  → [AutoPreRideScreen]
      • Map view with pickup zone (200m radius)
      • "Open Radar" → [ConfirmPopup]
      • Out-of-range overlay if >500m
      → [AutoSearchingScreen]
          • Pulsing radar
          • 5-second scan
          • Driver card appears
          → Accept → [ConfirmPopup] (board confirmation)
              → [AutoRideCompleteScreen]
                  • Trip details
                  • Fare breakdown
                  • Rate driver
          → Ignore → next driver
```

### Driver — Bike Ride

```
[DriverHome] (Tab: Home)
  • Hero image + LocationSearch (Nominatim)
  • Swap pickup/destination
  • "Find Best Route" button
  • Go Online toggle
  → [DriverRoutes] (Tab: Routes — or stack push)
      • List of admin-created routes (or 3 dummy routes)
      • "Select Route" on any card
      → [FindPassenger] (BikeFindPassengerScreen)
          • PRE-FLIGHT CHECK overlay (slides up)
              ├── ✅ Network Connection   (animated sequential checks)
              ├── ✅ GPS Signal
              ├── ✅ Location Permission
              └── ✅ Device Readiness
              → "Start Finding Buddy" button
          • Radar scanning animation
          • 5-second scan
          • Buddy card slides up (avatar, rating, trips, fare, pickup/drop, distance, ETA)
          → Accept → [BikeRideToPickup]
              • Map with driver + buddy dots
              • Route path to pickup
              • Live distance counter (1.2 km → 0 km, 1.5s intervals)
              • Progress bar drains from full to empty (color: red → amber → green → primary)
              • Loading dots animation
              • "I've Arrived at Pickup" button
                  → Disabled (dimmed, 0.5 opacity) until ≤30m
                  → Active (pulsing green) when in range
                  → Tap → [Modal] "Confirm Arrival"
                      → "Not Yet" / "Yes, I'm Here"
                      → [BikeOTPEntry]
                          • Buddy badge (avatar, name, pickup)
                          • "Enter 4-digit code from your buddy"
                          • 4 OTP input boxes (auto-advance, backspace support)
                          • "Verify & Start Ride" button
                              → Shake animation if incomplete
                              → Success checkmark overlay
                              → Auto-navigate to [BikeRideToDestination] (1.2s)
          → Ignore → next buddy (3-second cooldown)

      → [BikeRideToDestination]
          • Map with driver dot + destination pin
          • Stats row: distance remaining · elapsed time · avg speed
          • Progress bar with animated thumb
          • ETA badge
          • "End Ride" button (red)
          → [BikeTripComplete]
              • Success checkmark "Trip Complete"
              • Buddy card (avatar, name, route, 4.9★)
              • Trip Details (pickup → drop, km, time, timestamp)
              • Earnings (base ₹25 + distance ₹19 + time ₹28 = ₹72)
              • Buddy Feedback (5 stars + quote)
              • "Next Ride" / "Back to Home"
```

### Driver — Auto (placeholder / future)

```
[DriverHome] (Tab: Home)
  → [DriverRoutes]
      • Select a route
      → [AutoFindPassengerScreen]
          • Radar scanning
          • Passenger card
          → [AutoAheadAlertScreen]
              • Passenger ahead alert
              → [AutoBoardedPopupScreen]
                  • Boarding confirmation
                  → [AutoLiveTrackingScreen]
                      • Live ride tracking
```

---

## Screen Reference

### Passenger Screens

| Screen | File | Description |
|---|---|---|
| IntroPage | `passenger/screens/IntroPage.jsx` | Tab: Home — landing / hero |
| PassengerTripPlanner | `passenger/screens/PassengerTripPlanner.jsx` | Tab: Live Map — pickup/dest search + route matching |
| PassengerRouteList | `routes/screens/PassengerRouteList.jsx` | Route selection list |
| AllRoutesPage | `routes/screens/AllRoutesPage.jsx` | Tab: Routes — all routes |
| PassengerStopsTimeline | `routes/screens/PassengerStopsTimeline.jsx` | Stop-by-stop route details |
| PassengerLiveTracking | `tracking/screens/PassengerLiveTracking.jsx` | Live vehicle tracking |
| PassengerAlertsScreen | `handshake/screens/PassengerAlertsScreen.jsx` | Tab: Alerts |
| PassengerActionsScreen | `passenger/screens/PassengerActionsScreen.jsx` | Tab: Actions |
| DestinationSearchScreen | `passenger/screens/DestinationSearchScreen.jsx` | Search destination |
| JourneyHistoryScreen | `passenger/screens/JourneyHistoryScreen.jsx` | Past trips |
| ProfileScreen | `shared/screens/ProfileScreen.jsx` | Tab: Profile — user details, earnings (driver) |

**Passenger Bike Flow**

| Screen | File | Description |
|---|---|---|
| BikeMapPreRideScreen | `passenger/bike-ride/MapPreRideScreen.jsx` | Pre-ride map, radar trigger, distance card |
| BikeSearchingScreen | `passenger/bike-ride/BikeSearchingScreen.jsx` | Radar scanning, rider card, accept/ignore |
| RiderPopupScreen | `passenger/bike-ride/RiderPopupScreen.jsx` | Rider assigned confirmation overlay |
| BikeMapPostAcceptScreen | `passenger/bike-ride/MapPostAcceptScreen.jsx` | Post-accept live map, driver location |
| RideStatsScreen | `passenger/bike-ride/RideStatsScreen.jsx` | Live ride stats during trip |
| RideCompleteScreen | `passenger/bike-ride/RideCompleteScreen.jsx` | Trip complete — details, fare, rate |
| ConfirmPopup | `passenger/bike-ride/ConfirmPopup.jsx` | Reusable confirmation modal |
| NoRideFoundPopup | `passenger/bike-ride/NoRideFoundPopup.jsx` | No ride available modal |

**Passenger Auto Flow**

| Screen | File | Description |
|---|---|---|
| AutoPreRideScreen | `passenger/shared-auto/AutoPreRideScreen.jsx` | Pre-ride map with 200m pickup zone |
| AutoSearchingScreen | `passenger/shared-auto/AutoSearchingScreen.jsx` | Radar scanning, driver card, board confirm |
| AutoRideCompleteScreen | `passenger/shared-auto/AutoRideCompleteScreen.jsx` | Trip complete — details, fare, rate driver |

### Driver Screens

| Screen | File | Description |
|---|---|---|
| DriverBikeHomeScreen | `driver/bike-ride/DriverBikeHomeScreen.jsx` | Tab: Home — hero, LocationSearch, Go Online |
| DriverRouteList | `driver/screens/DriverRouteList.jsx` | Tab: Routes — route selection (3 dummy routes) |
| DriverTripReview | `driver/screens/DriverTripReview.jsx` | Route review (legacy, no longer reached in bike flow) |
| DriverLiveTracking | `driver/screens/DriverLiveTracking.jsx` | Live tracking (generic) |
| DriverTrackingScreen | `driver/screens/DriverTrackingScreen.jsx` | Alternate tracking screen |
| DriverActionsScreen | `driver/bike-ride/DriverActionsScreen.jsx` | Tab: Actions |
| DriverTripHistoryScreen | `driver/screens/DriverTripHistoryScreen.jsx` | Past trips history |
| VehicleSelectionScreen | `driver/screens/VehicleSelectionScreen.jsx` | Choose vehicle type |
| DriverLoginScreen | `driver/screens/DriverLoginScreen.jsx` | Driver auth screen |
| ProfileScreen | `shared/screens/ProfileScreen.jsx` | Tab: Profile — user info + earnings section (driver-only) |

**Driver Bike Flow**

| Screen | File | Description |
|---|---|---|
| BikeFindPassengerScreen | `driver/bike-ride/BikeFindPassengerScreen.jsx` | Pre-flight check overlay → radar → buddy card |
| BikeRideToPickupScreen | `driver/bike-ride/BikeRideToPickupScreen.jsx` | Live distance to pickup (1.2→0 km), 30m arrival gate, progress bar |
| BikeOTPEntryScreen | `driver/bike-ride/BikeOTPEntryScreen.jsx` | 4-digit OTP input, shake animation, verify → success |
| BikeRideToDestinationScreen | `driver/bike-ride/BikeRideToDestinationScreen.jsx` | Ride tracking to drop, stats row, progress bar, End Ride |
| BikeTripCompleteScreen | `driver/bike-ride/BikeTripCompleteScreen.jsx` | Trip summary — buddy card, details, earnings, feedback |
| BikeTrackingScreen | `driver/bike-ride/BikeTrackingScreen.jsx` | Live bike tracking |
| BikeBookingScreen | `driver/bike-ride/BikeBookingScreen.jsx` | Booking screen (exports BuddyRequestPopupScreen) |
| BikeRequestScreen | `driver/bike-ride/BikeRequestScreen.jsx` | Incoming request screen |
| BikeOTPHandshakeScreen | `driver/bike-ride/BikeOTPHandshakeScreen.jsx` | Legacy OTP display (replaced by BikeOTPEntry) |

**Driver Auto Flow**

| Screen | File | Description |
|---|---|---|
| AutoFindPassengerScreen | `driver/shared-auto/AutoFindPassengerScreen.jsx` | Radar scanning for auto passengers |
| AutoAheadAlertScreen | `driver/shared-auto/AutoAheadAlertScreen.jsx` | Passenger ahead alert |
| AutoBoardedPopupScreen | `driver/shared-auto/AutoBoardedPopupScreen.jsx` | Boarding confirmation popup |
| AutoLiveTrackingScreen | `driver/shared-auto/AutoLiveTrackingScreen.jsx` | Live ride tracking for auto |
| AutoBestMatchRouteScreen | `driver/shared-auto/AutoBestMatchRouteScreen.jsx` | Best route match display |

---

## Navigation Architecture

```
AppNavigator
├── AuthNavigator (when not authenticated)
├── DriverNavigator (when role = "driver")
│   ├── Tab: Home        → DriverBikeHomeScreen
│   ├── Tab: Routes      → DriverRouteList
│   ├── Tab: Actions     → DriverActionsScreen
│   ├── Tab: Profile     → ProfileScreen
│   └── Stack Screens:
│       ├── FindPassenger → BikeFindPassengerScreen
│       ├── BikeRideToPickup → BikeRideToPickupScreen
│       ├── BikeOTPEntry → BikeOTPEntryScreen
│       ├── BikeRideToDestination → BikeRideToDestinationScreen
│       ├── BikeTripComplete → BikeTripCompleteScreen
│       ├── BikeTracking → BikeTrackingScreen
│       ├── AheadAlert → AutoAheadAlertScreen
│       ├── BoardedPopup → AutoBoardedPopupScreen
│       ├── AutoRideActive → AutoLiveTrackingScreen
│       └── ... (legacy screens)
│
└── PassengerNavigator (when role = "passenger" | "student")
    ├── Tab: Home        → IntroPage
    ├── Tab: Routes      → AllRoutesPage
    ├── Tab: Live Map    → PassengerTripPlanner
    ├── Tab: Alerts      → PassengerAlertsScreen
    ├── Tab: Actions     → PassengerActionsScreen
    ├── Tab: Profile     → ProfileScreen
    └── Stack Screens:
        ├── BikeMapPreRide → BikeMapPreRideScreen
        ├── BikeSearching → BikeSearchingScreen
        ├── RiderPopup → RiderPopupScreen
        ├── BikeMapPostAccept → BikeMapPostAcceptScreen
        ├── RideStats → RideStatsScreen
        ├── RideComplete → RideCompleteScreen
        ├── AutoPreRide → AutoPreRideScreen
        ├── AutoSearching → AutoSearchingScreen
        └── AutoRideComplete → AutoRideCompleteScreen
```

---

## Key Design Decisions

### Driver Bike Flow — Complete Ride Lifecycle

```
Home (search) → Routes → Pre-Flight Check → Radar (Find Buddy)
  → Accept → Ride to Pickup (live distance, 30m gate)
  → OTP Entry (4-digit verify) → Ride to Destination (tracking)
  → Trip Complete (summary, earnings, feedback)
```

- **Pre-Flight Check**: 4 sequential animated checks (network, GPS, location permission, device readiness) before radar starts — prevents location/network failures mid-flow.
- **30m Arrival Gate**: "I've Arrived" button stays disabled until driver is ≤30m from pickup. Progress bar drains from full to empty with color shifts (red → amber → green → primary).
- **OTP Handshake**: Driver enters the 4-digit code shown on the passenger's device. Shake animation on incomplete input, success overlay on verify.
- **Trip Complete**: Shows earnings breakdown (base + distance + time), buddy feedback with star rating and quote.

### Shared ProfileScreen

Both roles share `ProfileScreen`. Drivers see an additional **Earnings** section between Profile Details and Settings showing Today's earnings, trip count, and online hours.

### Map Placeholder Convention

All map areas use `#F9FAFB` with grid lines at 25%, 50%, 75% (horizontal + vertical) — a clean placeholder until MapLibre tiles load.

---

## Route Data

- Routes are **admin-created** (backend/Django)
- Driver selects pickup/destination → matched to best route
- **Dummy routes** are defined inline in `DriverRouteList.jsx` for offline development:
  - Gomti Nagar → IT City
  - Alambagh → SGPGI
  - Charbagh → Indira Nagar
- Dummy buddy data is defined in `BikeFindPassengerScreen.jsx`:
  - Ravi Kumar (4.8★, ₹35, 400m)
  - Priya Singh (4.9★, ₹25, 280m)
  - Amit Verma (4.7★, ₹40, 550m)

---

## Development

```bash
# Install
npm install

# Start Expo
npx expo start

# TypeScript check
npx tsc --noEmit

# Lint
npx eslint src/
```

### Conventions

- Reuse existing components (`VayyCard`, `VayyButton`, `ConfirmPopup`)
- Edit existing files before creating new ones
- Match passenger UI patterns for new driver screens
- Use shared constants for colors, radius, spacing, shadow
- `"800"`–`"900"` font weights for headings and primary text
- Bottom sheets: `borderTopLeftRadius: 32`, handle bar (`40×4`, `#E5E7EB`)
