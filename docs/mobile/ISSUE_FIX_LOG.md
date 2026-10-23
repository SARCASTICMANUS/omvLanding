# OMV Mobile Issue & Fix Log

Scope: `vayy_app/` only. Web frontend and standalone admin are out of scope.

## Changes made

| ID | Area | Issue | Fix | Status |
|---|---|---|---|---|
| MOB-001 | KYC screen | `KycScreen.jsx` used `useState` without importing it and called `fetchVerification()` without importing the thunk. Upload thunk was imported from the wrong slice. Image picker used the old `mediaTypesLibrary` property and the old result URI shape. | Imported `useState`; imported `uploadDocument` from `profileSlice` and `fetchVerification` from `verificationSlice`; use supported `mediaTypes: ["images"]`, request library permission, read `result.assets[0]`, check thunk success and reset loading in `finally`. | Fixed; targeted ESLint pass; device test pending |
| MOB-002 | File/base64 helper | `expo-file-system` v19 no longer exposes the old `EncodingType` namespace and legacy `readAsStringAsync` from the root entry point. | Switched to `expo-file-system/legacy` and the documented `"base64"` encoding value. | Fixed; targeted ESLint pass |
| MOB-003 | Driver route list | `DriverRouteList.jsx` directly read `item.pickup_stop.name` and `item.dropoff_stop.name`; routes without those objects could crash the card render. | Added optional chaining and fallbacks to pickup/destination labels and route stop names. | Fixed in source; targeted lint produced no errors before timeout (one existing hook-dependency warning) |
| MOB-004 | Login/session | Login persists tokens only when both access and refresh tokens are present, although Redux can still mark a response with access token as authenticated. Need confirm backend response contract before finalizing the persistence behavior. | Identified; no auth source change recorded as applied. | Open |
| MOB-005 | Passenger route preview | PassengerTripPlanner previously searched live corridor vehicles before displaying results, which skipped the planned route-first flow. PassengerRouteList also replaced the incoming route list with active-vehicle matches. | PassengerTripPlanner now calls the existing `dynamicPreview()` route-generation service first; PassengerRouteList preserves those generated route candidates and passes the selected route to BikeMapPreRide for the hand-raise stage. Driver route search already uses the same dynamic preview service. | Source updated; backend/device route geometry and hand-raise behavior still require runtime verification |
| MOB-006 | API host | Mobile defaults to `http://localhost:8000`; Android emulator rewrites localhost to `10.0.2.2:8000`. Host Docker may expose only the Nginx front door on port 80. | No host URL hard-coded because emulator, physical device, and deployment differ. Set `EXPO_PUBLIC_API_URL` for the target environment and test reachability. | Needs environment verification |
| MOB-007 | Mobile lint baseline | Previous full mobile lint scan reported 18 errors / 97 warnings, including KYC and FileSystem issues. | Two affected files now pass targeted ESLint. Full lint still needs a successful run; unrelated remaining diagnostics are not marked fixed. | In progress |

## Verification record

- Targeted command: `npx eslint src/KycScreen.jsx src/shared/lib/base64.js` — **pass, no diagnostics**.
- Targeted route-flow lint: `npx eslint src/passenger/screens/PassengerTripPlanner.jsx src/routes/screens/PassengerRouteList.jsx src/driver/screens/DriverRouteList.jsx` — **0 errors, 5 warnings** (pre-existing hook-dependency/unused-variable warnings).
- Full mobile lint from the earlier repository scan: **18 errors / 97 warnings**; a repeat full run did not finish within the tool execution window.
- No runtime login, dynamic route generation, map rendering, hand-raise, driver start-ride, request popup/acceptance, or document upload test has been run against a live backend/device. Passenger search now requests generated route candidates first; live driver matching must occur after hand raise.
- Existing untracked user files have been preserved. No web or admin source files were intentionally changed.

## Runtime test checklist

- [ ] Valid login and role-based navigation.
- [ ] Cold-start session restoration.
- [ ] Expired access token / refresh-token rotation.
- [ ] Logout clears persisted and in-memory credentials.
- [ ] Search dynamic routes using known coordinates and verify candidate response.
- [ ] Verify pickup/drop-off labels, distance, ETA, fare, stops and geometry on route cards.
- [ ] Confirm route polyline renders correctly on Android and iOS.
- [ ] Upload a KYC image and verify server status refreshes.
- [ ] Test API host from the actual emulator/device/build environment.