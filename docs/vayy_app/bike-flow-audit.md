# VAYY Passenger Bike Flow — Audit and Proposed Improvements

> **Status: proposal/audit snapshot, not an implementation checklist of confirmed missing features.** Some items may have changed since this audit. Compare every item with current passenger navigation, screens, API services and backend endpoints before implementing it. Do not treat suggested WebSocket events or APIs below as existing contracts.


---

## 1. FINAL VAYY PASSENGER BIKE FLOW

```
Login
→ Home (IntroPage)
  → Search Route (PassengerTripPlanner)
    → Route Selection (PassengerRouteList)
      → Bike Pickup / Raise Hand (BikeMapPreRideScreen)  ← EXISTING
        → Finding Rider (BikeSearchingScreen)             ← EXISTING (upgraded)
          → Rider Found (BikeSearchingScreen)
            → RIDER ARRIVING (NEW)                        ← Screen 1 (with OTP display + arrived modal)
              → OTP SUCCESS ANIMATION (NEW)                ← Screen 2 (shown after driver verifies OTP)
                → LIVE RIDE TRACKING (RideStatsScreen)     ← EXISTING (upgraded)
                  → END RIDE VALIDATION                    ← EXISTING (upgraded)
                    → TRIP COMPLETE (RideCompleteScreen)   ← EXISTING (upgraded)
```

---

## 2. CURRENT FLOW GAPS vs REQUIRED FLOW

| Step | Current | Required | Gap |
|------|---------|----------|-----|
| Rider Arriving | RiderPopupScreen shows distance but no live map, no communication | Dedicated RiderArriving screen with live map markers, distance progress | Missing |
| Contact Rider | Call button only | Dedicated Contact screen with quick messages, call, proximity trigger | Missing |
| Rider Arrived | None | Modal showing "Rider has arrived" with Call/Verify OTP | Missing |
| OTP Display | OTP shown as display-only (correct) | OTP display + "Share with rider" + arrived modal with large OTP | ✓ Correct, needs polish |
| OTP Success Animation | Instant transition, no verification animation | 3-step verification animation with green checkmark | Missing |
| Live Ride Tracking | Basic stats, no Share/Emergency actions | Full tracking with Share Trip, Emergency, proper End Ride validation | Partial |
| End Ride Validation | Single modal, no destination proximity check | Two cases: reached vs not reached destination | Missing |
| Trip Complete | Basic fare, no payment badge, weak rating | Fare breakdown, payment chip, per-star rating labels | Partial |

---

## 3. MISSING SCREENS (2 new files)

### Screen 1: RiderArrivingScreen.jsx
**File:** `src/passenger/bike-ride/RiderArrivingScreen.jsx`
**Purpose:** Show rider approaching the pickup stop with live distance updates. Contains OTP display (passenger reads to driver) and arrived modal in one screen.

**States:**
- `arriving` — rider en route, distance countdown (400m → 250m → 100m → 50m → 0m)
- `arrived` — rider at stop (shows arrived modal with OTP display)

**Layout:**
- Fullscreen MapView with rider + passenger markers
- Glass-effect BlurView header: "Rider Arriving"
- Bottom sheet: rider photo, name, vehicle, rating, ETA, distance bar, OTP display (read-only)
- Arrived modal: rider info + large OTP digits (passenger reads to driver) + Call button
- Auto-transition to OTPVerificationAnimation after driver verifies OTP

### Screen 2: OTPVerificationAnimationScreen.jsx
**File:** `src/passenger/bike-ride/OTPVerificationAnimationScreen.jsx`
**Purpose:** Build trust with animated verification process shown after driver confirms OTP.

**States:**
- `checking_otp` — "Checking OTP..." (spinner, 1s)
- `verifying_rider` — "Verifying Rider..." (progress, 1s)
- `confirmed` — "Ride Confirmed" (green checkmark, 1.5s)
- `transitioning` — auto-navigating to RideStats

**Layout:**
- Fullscreen VAYY green background (#009849)
- Circular verification animation (checkmark drawing itself)
- Three sequential labels with checkmarks
- Final state: "Verified Successfully" + "Your ride has started."
- Auto-transition to RideStats after 2-3s

---

## 4. MISSING STATES (per existing screen)

### BikeSearchingScreen.jsx (Finding Rider)
| Current | Missing |
|---------|---------|
| `searching`, `found`, `failed` | `connecting` (matching engine working), `expired` (no riders after extended timeout), `extending` (auto-retry with wider radius) |

### RiderPopupScreen.jsx (Ride Accepted → now split into 3 stages)
| Current | Missing |
|---------|---------|
| Single screen with distance steps | Needs to split into: `accepted` (ride confirmed), `rider_arriving` (live tracking), `rider_arrived` (proximity modal) |

### RideStatsScreen.jsx (Live Ride Tracking)
| Current | Missing |
|---------|---------|
| Basic stats, End Ride only | `share_modal` (Share Trip), `emergency_modal` (Emergency contacts), `end_ride_validation` (proximity check) |

### RideCompleteScreen.jsx (Trip Complete)
| Current | Missing |
|---------|---------|
| Basic rating (1-5 stars) | `payment_badge` (Paid via Cash/UPI), `fare_breakdown` (detailed), `rating_labels` (per-star text) |

---

## 5. MISSING MODALS (3 new modals)

### Modal 1: EndRieValidationModal (replaces ConfirmPopup in RideStats)
**Trigger:** Passenger taps "End Ride"
**Logic:**
- If distance to destination ≤ 100m: "Looks like you've reached your destination. End Ride?" with buttons "End Ride" | "Continue Ride"
- If distance > 100m: "You are still 1.2 km away. Are you sure?" with buttons "End Ride Anyway" (red) | "Continue Ride"

### Modal 2: ShareTripModal
**Trigger:** Passenger taps share icon
**Content:** Share live trip link via SMS, WhatsApp, or copy link

### Modal 3: EmergencyModal
**Trigger:** Passenger taps emergency/sos button
**Content:** Emergency contact list, "Call 112" button, "Share location with emergency contact"

---

## 6. MISSING BACKEND EVENTS

### WebSocket Events (Passenger → Server)

| Event | Payload | When |
|-------|---------|------|
| `passenger.raise_hand` | `{ trip_id, stop_id, passenger_id }` | Passenger raises hand at stop |
| `passenger.hand_confirmed` | `{ trip_id, passenger_id, rider_id }` | Rider accepts hand raise |
| `passenger.otp.submit` | `{ trip_id, otp_code }` | Passenger submits OTP |
| `passenger.otp.resend` | `{ trip_id }` | Passenger requests OTP resend |
| `passenger.ride.start` | `{ trip_id, otp_verified: true }` | Ride officially starts after OTP match |
| `passenger.ride.end` | `{ trip_id, reason: "arrived" \| "early" }` | Passenger ends ride |
| `passenger.location.update` | `{ trip_id, lat, lng }` | Periodic location share |
| `passenger.emergency.trigger` | `{ trip_id, passenger_id }` | Emergency button pressed |
| `passenger.trip.share` | `{ trip_id, contact }` | Share trip with contact |

### WebSocket Events (Server → Passenger)

| Event | Payload | When |
|-------|---------|------|
| `rider.found` | `{ rider_id, name, photo, vehicle, eta }` | Rider accepts hand raise |
| `rider.location.update` | `{ rider_id, lat, lng, distance_to_stop }` | Real-time rider position |
| `rider.arriving` | `{ distance, eta }` | Rider is approaching |
| `rider.proximity_100m` | `{ rider_id }` | Rider within 100m (trigger Contact) |
| `rider.arrived` | `{ rider_id, stop_id }` | Rider reached stop |
| `otp.verified` | `{ success: true, trip_id }` | OTP matched |
| `otp.failed` | `{ success: false, attempt, max_attempts }` | OTP mismatch |
| `ride.started` | `{ trip_id, started_at }` | Ride is active |
| `ride.ended` | `{ trip_id, summary }` | Ride completed |

---

## 7. MISSING APIS

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/bike/raise-hand` | POST | Submit hand raise at stop |
| `POST /api/bike/cancel-request` | POST | Cancel active hand raise |
| `GET /api/bike/nearby-riders` | GET | Get count of nearby riders (searching screen) |
| `POST /api/bike/verify-otp` | POST | Verify OTP between passenger and rider |
| `POST /api/bike/resend-otp` | POST | Resend OTP code |
| `POST /api/bike/start-ride` | POST | Start ride after OTP confirmation |
| `POST /api/bike/end-ride` | POST | End ride with reason + location |
| `GET /api/bike/trip/:id` | GET | Get trip details with live status |
| `POST /api/bike/rate-rider` | POST | Rate rider after trip |
| `POST /api/bike/share-trip` | POST | Share trip link with contact |
| `POST /api/bike/emergency` | POST | Trigger emergency protocol |

---

## 8. STATE MANAGEMENT CHANGES

### New Redux Slice: `bikeRideSlice.jsx`

```javascript
// src/store/slices/bikeRideSlice.jsx
const initialState = {
  // Hand Raise
  raiseHandStatus: "idle" | "raising" | "raised" | "confirmed" | "expired",
  
  // Matching
  matchStatus: "searching" | "found" | "connecting" | "failed" | "expired",
  matchedRider: null, // { id, name, photo, vehicle, rating, phone, eta }
  
  // Arrival
  arrivalStatus: "en_route" | "proximity" | "arrived",
  distanceToStop: 0, // meters
  riderLocation: null, // { lat, lng }
  
  // OTP
  otpStatus: "pending" | "entering" | "validating" | "verified" | "failed",
  otpAttempts: 0,
  maxOtpAttempts: 3,
  otpVerified: false,
  
  // Ride
  rideStatus: "not_started" | "active" | "ended",
  rideStartedAt: null,
  rideEndedAt: null,
  
  // Tracking
  currentLocation: null,
  routePolyline: null,
  remainingDistance: 0,
  remainingEta: 0,
  speed: 0,
  
  // End validation
  endValidation: null, // { show: bool, reachedDestination: bool, distanceAway: number }
  
  // Trip data
  trip: null,
  pickup: null,
  destination: null,
};
```

### Redux Actions to Add

| Action | Payload | Purpose |
|--------|---------|---------|
| `setRaiseHandStatus` | status | Track hand raise lifecycle |
| `setMatchedRider` | rider | Store matched rider details |
| `setArrivalStatus` | status + distance | Track rider arrival progress |
| `setRiderLocation` | location | Real-time rider position |
| `setOtpStatus` | status | Track OTP verification state |
| `setRideStatus` | status + timestamps | Track active ride state |
| `setTrackingData` | { distance, eta, speed } | Live tracking metrics |
| `setEndValidation` | validation | End ride proximity check |
| `resetBikeRide` | — | Reset entire slice |
| `updateRiderProximity` | distance | Called by WS on rider location |

### Files to Update

| File | Change |
|------|--------|
| `src/store/store.jsx` | Add `bikeRide: bikeRideReducer` |
| `src/store/slices/bikeRideSlice.jsx` | Create new slice (or extend rideFlowSlice) |

---

## 9. NAVIGATION CHANGES

### File: `src/navigation/PassengerNavigator.jsx`

**New screens to register:**

```javascript
import { RiderArrivingScreen } from "../passenger/bike-ride/RiderArrivingScreen";
import { ContactRiderScreen } from "../passenger/bike-ride/ContactRiderScreen";
import { OTPVerificationScreen } from "../passenger/bike-ride/OTPVerificationScreen";
import { OTPVerificationAnimationScreen } from "../passenger/bike-ride/OTPVerificationAnimationScreen";

// In stack:
<Stack.Screen name="RiderArriving" component={RiderArrivingScreen} />
<Stack.Screen name="ContactRider" component={ContactRiderScreen} />
<Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
<Stack.Screen name="OTPVerificationAnimation" component={OTPVerificationAnimationScreen} />
```

**Updated flow in existing files:**

| File | Line | Change |
|------|------|--------|
| `BikeSearchingScreen.jsx` | ~59 | `navigation.navigate('RiderPopup')` → `navigation.replace('RiderArriving')` |
| `RiderArrivingScreen.jsx` | NEW | Auto-navigate to ContactRider at 100m proximity |
| `ContactRiderScreen.jsx` | NEW | On "Verify OTP" tap → navigate to OTPVerification |
| `OTPVerificationScreen.jsx` | NEW | On verify → navigate.replace('OTPVerificationAnimation') |
| `OTPVerificationAnimationScreen.jsx` | NEW | After 2-3s → navigation.replace('RideStats') |
| `RideStatsScreen.jsx` | ~200 | On End Ride validation → navigate to RideComplete or stay |
| `ConfirmPopup.jsx` | No change | Reuse for both Raise Hand and End Ride |

---

## 10. TRUST & SAFETY IMPROVEMENTS

| # | Improvement | Where | Impact |
|---|------------|-------|--------|
| 1 | Rider photo + name + vehicle shown before ride starts | RiderArrivingScreen | Passenger can visually identify rider |
| 2 | OTP displayed for passenger to read to driver | RiderArrivingScreen (bottom sheet + arrived modal) | Prevents wrong bike boarding, driver-side verification |
| 3 | OTP verification animation builds confidence | OTPVerificationAnimationScreen | Psychological trust signal |
| 4 | Call rider button | RiderArrivingScreen (bottom sheet + arrived modal) | Reduces missed pickups |
| 5 | OTP display in arrived modal for easy reading | RiderArrivingScreen (arrived modal) | Passenger reads code to driver |
| 6 | "Rider Has Arrived" attention-modal | RiderArrivingScreen (arrived modal) | Passenger knows to look up |
| 7 | End Ride proximity validation | RideStatsScreen | Prevents accidental early ending |
| 8 | Share Trip with contacts | RideStatsScreen | Safety via visibility |
| 9 | Emergency button with contacts | RideStatsScreen | Critical safety net |
| 10 | Live rider marker on map throughout | RiderArrivingScreen → RideStatsScreen | Transparency |
| 11 | Max OTP attempts (3) with lockout | OTPVerificationScreen | Prevents brute force |
| 12 | Driver rating visible before ride | RiderArrivingScreen | Informed consent |

---

## 11. UX IMPROVEMENTS

| # | Improvement | Problem Solved |
|---|-------------|----------------|
| 1 | Distance-to-stop ring (circular progress) | Passenger sees exact gap closing |
| 2 | Live distance text (400m → 250m → 100m → 50m) | Real-time progress feedback |
| 3 | Contact Rider card slides up at 100m | Just-in-time coordination |
| 4 | Quick message chips (tap to send) | Reduces typing friction |
| 5 | OTP auto-advance input boxes | Fast entry, familiar pattern |
| 6 | Green success animation after OTP | Dopamine hit = confidence |
| 7 | Per-star rating labels (Poor → Excellent) | Better feedback quality |
| 8 | Payment badge (Paid via Cash/UPI) | Receipt clarity |
| 9 | End Ride "arrived" vs "early" distinction | Reduces accidental ends |
| 10 | Share Trip action | Social safety net |
| 11 | Glass-effect BlurView headers (consistent) | Premium feel across all screens |
| 12 | Zoom controls on all map screens | Power user expectation |

---

## 12. ACCEPTANCE CRITERIA

### Rider Arriving Screen
- [ ] Shows rider photo, name, vehicle number on bottom card
- [ ] Live distance countdown updates every 2s (mock: 400→250→100→50→0m)
- [ ] Map shows both passenger marker and rider marker
- [ ] Contact Rider card appears when distance ≤ 100m
- [ ] "Rider Arrived" modal appears when distance = 0m
- [ ] Call button opens device dialer with rider number

### Contact Rider Screen
- [ ] Call Rider button opens phone dialer
- [ ] Message Rider button opens SMS with pre-filled template
- [ ] 4 quick message chips visible and tappable
- [ ] "Verify OTP" button navigates to OTPVerificationScreen
- [ ] Dismissible bottom sheet on swipe down

### RiderArrivingScreen (OTP Display)
- [ ] OTP shown as 4 read-only boxes in bottom sheet
- [ ] Hint text: "Share this code with your rider to start the ride"
- [ ] Arrived modal shows OTP in larger format for easy reading
- [ ] Arrived modal shows "Waiting for rider to verify OTP..." state
- [ ] Auto-transitions to OTPVerificationAnimation when driver verifies OTP

### OTP Verification Animation
- [ ] 3 sequential steps: Checking OTP → Verifying Rider → Ride Confirmed
- [ ] Each step shows animated checkmark
- [ ] Green success state persists for 2s
- [ ] Auto-navigates to RideStats after 2-3s total

### End Ride Validation
- [ ] If destination distance ≤ 100m: "Reached destination" modal
- [ ] If destination distance > 100m: "Still 1.2 km away" warning modal
- [ ] "Continue Ride" returns to tracking
- [ ] "End Ride Anyway" navigates to RideComplete
- [ ] Distance shown in warning is accurate to 100m

### Trip Complete
- [ ] Fare breakdown shows base fare, distance, time
- [ ] Payment badge shows payment method
- [ ] Star rating with per-star text labels
- [ ] "Book Another Ride" loops back to BikeMapPreRide
- [ ] "Return Home" pops to tab navigator

---

## 13. EDGE CASE ANALYSIS

| # | Edge Case | Handling |
|---|-----------|----------|
| 1 | Passenger not at stop when rider arrives | Contact Rider card + SMS quick message "I am at the stop" + Call button |
| 2 | Rider not at stop when passenger arrives | RiderArriving screen shows live ETA; Contact Rider for communication |
| 3 | Passenger arrives late | Rider waits; Contact Rider allows "Please wait 2 minutes" message |
| 4 | Rider arrives early | Distance countdown shows exact approach; no surprise arrival |
| 5 | Passenger cannot find rider | Contact Rider screen with Call + "I am wearing blue" message |
| 6 | OTP mismatch (driver side) | Driver notified on their app; passenger sees "Waiting for OTP verification" with option to re-share code |
| 7 | OTP mismatch (3 attempts, driver side) | Driver locked out; passenger notified "Please contact support" + Call Rider |
| 8 | Rider cancels after match | Show cancellation modal → Return to BikeSearching or BikeMapPreRide |
| 9 | Passenger cancels after match | Cancel modal → ConfirmPopup → Return to BikeMapPreRide |
| 10 | Rider waiting too long (>5 min) | Notification: "Your rider is waiting. Please reach the stop." |
| 11 | No network during OTP | Show "No internet connection" banner; retry button; cached local OTP fallback |
| 12 | GPS mismatch (off by 50m+) | Contact Rider quick messages handle "I am near Gate 2" scenarios |
| 13 | Wrong pickup gate | Quick messages: "I am near Gate 2" + Call button for verbal coordination |
| 14 | Multiple nearby riders | OTP verification ensures boarding correct bike |
| 15 | Passenger boards wrong bike | OTP mismatch → error message → rider mismatch prevention |

---

## 14. EXISTING FILES DEPRECATION / REPURPOSE

| File | Action |
|------|--------|
| `MapPostAcceptScreen.jsx` | Remove import + screen registration (unused, replaced by RiderArriving) |
| `RiderPopupScreen.jsx` | Repurpose: split into RiderArriving + OTPVerification + OTPVerificationAnimation - OR keep as redirection hub that forwards to new screens |

**Recommendation:** Rather than deleting RiderPopupScreen, use it as a thin bridge:
- On mount, immediately navigate to the first new screen based on state
- This preserves backward compatibility with dev screens

---

## 15. MVP vs FUTURE VERSION

| Feature | MVP | Future v2 |
|---------|-----|-----------|
| Rider Arriving screen | ✅ Mock distance simulation | Real WebSocket location |
| Contact Rider (Call + Message) | ✅ Opens device apps | In-app calling/messaging |
| Quick Messages | ✅ 4 preset chips | Custom message + language localization |
| OTP Entry | ✅ Passenger enters OTP | Biometric + OTP |
| OTP Success Animation | ✅ 3-step Lottie-style | Haptic feedback + sound |
| Live Ride Tracking | ✅ Enhanced stats | Real OSRM polyline + traffic |
| Share Trip | ✅ Share link | Live share with map |
| Emergency | ✅ Call 112 + contacts | Auto-detect crash + share location |
| End Ride Validation | ✅ Proximity check | Geofence-based auto-detect |
| Fare Integration | ✅ Mock data | Real fare from backend |
| Payment Badge | ✅ Display only | Real payment status |
| Rating Labels | ✅ Static per-star | Free-text review + photo |
| Rider Cancellation Notice | ✅ Simple modal | Auto-rebook + compensation |
| No Network Mode | ❌ | Offline OTP + queue ride data |
| Multi-language | ❌ | Hindi, English, Hinglish |
| Voice Navigation | ❌ | Turn-by-turn voice |
| Ride Receipt PDF | ❌ | Email receipt |
| Scheduled Rides | ❌ | Pre-book bike |
| Loyalty Points | ❌ | Points per ride |
