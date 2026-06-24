# VAYY Repository Guidelines

## Project Overview

VAYY is a route-based mobility platform for passengers, auto drivers, and bike riders. The platform focuses on route discovery, live tracking, stop-based boarding, and transit intelligence.

## Tech Stack

* React Native + Expo
* TypeScript
<!-- * NativeWind -->
* Redux Toolkit
* React Navigation
* Django Backend
* WebSockets
* MapLibre
* OSM
* OSRM

## Project Structure

* app/ → Expo Router screens
* src/components → Reusable UI
* src/features → Business modules
* src/hooks → Custom hooks
* src/store → Redux
* src/services → API layer
* src/constants → Shared constants

## Design System

* Primary: #009849
* Live Tracking: #00E676
* Radius: 18px
* Mobile-first
* Clean transit UI
* No unnecessary redesigns

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

## Maps

* Use MapLibre + OSM
* Use OSRM routing
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

## Conversation Summary (2026-06-20)

### Fixes & Enhancements Made:

1. **AutoFindPassengerScreen - `scale` animation error fix**
   - Changed `<View>` to `<Animated.View>` on the radar pulse and glow views to fix `scale` animation prop error.

2. **Removed OTP from auto driver flow**
   - Removed `handleStartTripOtp`, `otpTimer`, `otpCode`, `showOtpModal`, and all OTP-related UI from `AutoFindPassengerScreen`.

3. **Removed accept/decline from auto find passenger**
   - Replaced accept/decline UI with a simple popup showing passenger distance.

4. **Radar as live continuous screen with 3-dot menu**
   - Added 3-dot menu in header with Online/Offline toggle.
   - Radar runs continuously without requiring manual re-trigger.

5. **Used bike's dark radar UI design for auto**
   - Ported the dark theme, glow effects, and radar styling from BikeLiveTracking to AutoFindPassengerScreen.

6. **Map-based radar with live moving vehicle**
   - Added MapLibre map with animated vehicle marker following a simulated path.
   - Non-disruptive notifications (toast-style snackbar).

7. **Bottom card with live stats**
   - Added bottom card showing speed, ETA, next stop, and progress bar.

8. **Namaste greeting with typewriter animation**
   - **BikeHomeScreen** (driver bike): Added typewriter "Namaste," → "Ramu" → "Aaj aap kahan jaana chahte hain?"
   - **AutoDriverHomeScreen** (driver auto): Added same typewriter greeting.
   - **IntroPage.jsx** (passenger home): Replaced static "Good afternoon 👋 / Where are you going today?" with Namaste typewriter greeting for "Arjun".
   - **PassengerTripPlanner.jsx** (passenger trip planner): Replaced "Choose Your Route" hero with Namaste typewriter greeting for "Arjun".
   - Made greeting sizes consistent (30px) between auto and bike driver home screens.
   
9. **Road scene with 3 characters for bike passenger trip planner**
   - **PassengerTripPlanner.jsx** (bike mode): Replaced the generic `ImageBackground` hero with a custom road scene featuring:
     - Green grass background
     - Grey road with white center line
     - 3 character images (`vayyBoy.png`, `vayyGirl.png`, `VayyOfficeUncle.png`) positioned on the road
   - Auto mode still uses the original `trip.png` background.
   - Added `position: relative` to the bike hero container for correct absolute positioning of characters.

### 10. Major Passenger Auto Flow Redesign (2026-06-23)

**Goal**: Redesign Passenger Auto flow from route discovery → trip completion with Hand Raise → live discovery → in-ride tracking, preserving VAYY's route-based model.

**Navigation & Structure:**
- Removed Live Map tab from `PassengerNavigator` bottom tabs
- Changed `initialRouteName` from `PassengerMain` to `PassengerHome`
- Removed `PassengerTripPlanner` from tab list (kept as stack screen reachable from Home → search)
- Registered `AutoDiscovery` and `AutoRideActive` screens in navigator stack
- Flow: Home → search → route list (1.2s auto-match) → Hand Raise → AutoDiscovery → Boarding confirm → AutoRideActive → AutoRideComplete

**Hand Raise Screen** (`AutoPreRideScreen.jsx`):
- Proximity-gated Raise Hand button (500m threshold, grey disabled >500m, green enabled ≤500m)
- Distance-to-stop proximity ring showing meter gap
- Instruction card (3 steps: walk to stop → raise hand → board auto)
- "Raise Hand?" confirmation modal with cancel/confirm
- "Move Closer To Stop" out-of-range modal with exact distance delta
- Auto-navigates to `AutoDiscovery` on confirm via `navigation.replace('AutoDiscovery')`

**Auto Discovery Screen** (`AutoDiscoveryScreen.jsx`):
- Fullscreen map with glass-effect BlurView header (VAYY green `rgba(0,152,73,0.6)`)
- Mock 3 approaching autos list with real-time icons and ETA
- Nearest auto card at bottom showing "approaching in 2 min"
- Auto-assigned Found state after 6s mock timer with green header banner
- "Tap To Board" CTA with boarding confirmation modal
- Navigates to `AutoRideActive` on confirm

**Auto Ride Active Screen** (`AutoRideActiveScreen.jsx`):
- Fullscreen map with live vehicle marker and route polyline
- Glass-effect header showing "Ride Active"
- Progress bar with 4 stops timeline
- Live stats card: speed (28 km/h), distance remaining (2.4 km), ETA (6 min)
- Next stop card: "Gomti Nagar Crossing (Hazratganj Stop)"
- End Ride button (red) in bottom card
- End Ride validation: "Arrived at destination" modal vs "Early End" warning modal
- Navigates to `AutoRideComplete` on valid end

**Auto Ride Complete Screen** (`AutoRideCompleteScreen.jsx`):
- Enhanced trip summary with fare breakdown (estimated fare, distance, rate applied)
- Payment badge ("Paid via Cash") with green chip styling
- Rating with per-star text labels (Poor, Below Average, Average, Good, Excellent)
- "Book Another Auto" and "Return Home" action buttons

**Redux Slices Created:**
- `rideFlowSlice.jsx`: match status, distance-to-stop, raise hand status, ride status
- `autoMatchingSlice.jsx`: approaching autos list, assigned auto, matching status
- `autoRideSlice.jsx`: current position, route polyline, remaining distance/ETA, end validation
- All registered in `store.jsx`

**Design System Applied:**
- 7 screens use `BlurView` glass-effect headers (`intensity={80}`, `tint="dark"`) with `rgba(0,152,73,0.6)` background + white text
- All maps use `react-native-maps` `MapView` with `absoluteFill` layout
- Zoom controls (+/-) on all map screens
- `StatusBar` set to `light-content` across all screens
- Bottom sheets positioned absolutely at bottom (`position: "absolute", bottom: 0`)
- Radius 18px buttons, VAYY green `#009849` primary color, shadow elevation 6