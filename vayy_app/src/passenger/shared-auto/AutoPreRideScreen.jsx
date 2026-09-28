// import React, { useState, useRef, useEffect, useCallback } from "react";
// import {
//   View,
//   Text,
//   TouchableOpacity,
//   StyleSheet,
//   Dimensions,
//   StatusBar,
//   Platform,
//   ActivityIndicator,
//   useWindowDimensions,
// } from "react-native";
// import * as Location from "expo-location";
// import VayyMap, { ViewAnnotation } from "../../shared/components/VayyMap";
// import { BlurView } from "expo-blur";
// import { useSafeAreaInsets } from "react-native-safe-area-context";
// import {
//   Ionicons,
//   MaterialIcons,
//   Feather,
// } from "@expo/vector-icons";
// import { createBoardingRequest } from "../services/passengerService";
// import { TRACKING } from "../../constants";
// import api from "../../shared/lib/api";

// // const { width } = Dimensions.get("window");

// export function AutoPreRideScreen({ navigation, route }) {
//   const insets = useSafeAreaInsets();
//   const { height: screenHeight } = useWindowDimensions();
//   const [sheetHeight, setSheetHeight] = useState(320);
//   const [showConfirm, setShowConfirm] = useState(false);
//   const [isRaising, setIsRaising] = useState(false);
//   const [handRaised, setHandRaised] = useState(false);
//   const mapRef = useRef(null);
//   const cameraRef = useRef(null);
//   const didFitRef = useRef(false);

//   const trip = route?.params?.trip || {};
//   const pickup = route?.params?.pickup;
//   const destination = route?.params?.destination;

//   const pickupStop = trip?.pickup_stop || {};
//   const dropoffStop = trip?.dropoff_stop || {};

//   const pickupLat = typeof pickupStop?.lat === "number" ? pickupStop.lat : typeof pickupStop?.latitude === "number" ? pickupStop.latitude : null;
//   const pickupLon = typeof pickupStop?.lon === "number" ? pickupStop.lon : typeof pickupStop?.longitude === "number" ? pickupStop.longitude : null;

//   const dropoffLat = typeof dropoffStop?.lat === "number" ? dropoffStop.lat : typeof dropoffStop?.latitude === "number" ? dropoffStop.latitude : null;
//   const dropoffLon = typeof dropoffStop?.lon === "number" ? dropoffStop.lon : typeof dropoffStop?.longitude === "number" ? dropoffStop.longitude : null;

//   const pickupName = pickupStop?.name || pickup?.name || pickup?.display_name || "Pickup Location";
//   const destinationName = dropoffStop?.name || destination?.name || destination?.display_name || "Destination";

//   const fare = trip?.fare ?? "—";
//   const etaSeconds = trip?.eta_seconds ?? 0;
//   const walkMinutes = trip?.walk_minutes ?? 0;
//   const vehicleType = trip?.vehicle_type || trip?.fuel_type || "auto";

//   const zoomIn = () => mapRef.current?.zoomIn();
//   const zoomOut = () => mapRef.current?.zoomOut();

//   useEffect(() => {
//     if (didFitRef.current) return;

//     const tryFit = (attempt) => {
//       if (didFitRef.current) return;
//       if (!cameraRef.current) {
//         if (attempt < 10) setTimeout(() => tryFit(attempt + 1), 200);
//         return;
//       }
//       didFitRef.current = true;

//       if (pickupLat != null && pickupLon != null) {
//         const pad = 0.003;
//         const coords = [[pickupLon, pickupLat]];
//         if (dropoffLon != null && dropoffLat != null) coords.push([dropoffLon, dropoffLat]);

//         if (coords.length === 1) {
//           cameraRef.current.setStop({ center: [pickupLon, pickupLat], zoom: 15, duration: 500 });
//         } else {
//           const west = Math.min(...coords.map(c => c[0])) - pad;
//           const south = Math.min(...coords.map(c => c[1])) - pad;
//           const east = Math.max(...coords.map(c => c[0])) + pad;
//           const north = Math.max(...coords.map(c => c[1])) + pad;

//           cameraRef.current.fitBounds(
//             [west, south, east, north],
//             {
//               top: insets.top + 100,
//               right: 50,
//               bottom: 250,
//               left: 50,
//             },
//             500,
//           );
//         }
//       } else {
//         cameraRef.current.setStop({ center: [80.9462, 26.8467], zoom: 13, duration: 500 });
//       }
//     };

//     tryFit(0);
//   }, [pickupLat, pickupLon, dropoffLat, dropoffLon, sheetHeight]); 

//   const handleRaiseHand = useCallback(() => {
//     setShowConfirm(true);
//   }, []);

//   const handleConfirmRaise = useCallback(async () => {
//     setShowConfirm(false);
//     setIsRaising(true);

//     const tripId = trip?.id || trip?.trip_id;
//     const stopId = pickupStop?.id;

//     // 1. Create boarding request first (fast ~150ms)
//     let requestId = null;
//     if (tripId && stopId) {
//       try {
//         const result = await createBoardingRequest(tripId, stopId);
//         const reqData = result?.data || result;
//         requestId = reqData?.id || reqData?.request_id;
//       } catch (e) {
//         console.warn("Boarding request failed:", e?.message || e);
//       }
//     }

//     // 2. Navigate immediately — don't block on GPS
//     setHandRaised(true);
//     navigation.navigate("AutoSearching", {
//       route_id: trip?.route_id,
//       pickup_stop_id: stopId,
//       trip, pickup, destination,
//       boardingRequestId: requestId,
//     });

//     // 3. Push location in background (don't block navigation)
//     (async () => {
//       try {
//         const { status } = await Location.requestForegroundPermissionsAsync();
//         if (status === "granted") {
//           const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
//           api.post(TRACKING.passengerLocation, {
//             lat: loc.coords.latitude,
//             lng: loc.coords.longitude,
//           }).catch(() => {});
//         }
//       } catch {}
//     })();

//     setIsRaising(false);
//   }, [trip, pickupStop, pickup, destination, navigation]);

//   const locationSubRef = useRef(null);

//   useEffect(() => {
//     if (!handRaised) return;

//     let stopped = false;

//     const startTracking = async () => {
//       const { status } = await Location.requestForegroundPermissionsAsync();
//       if (status !== "granted" || stopped) return;

//       locationSubRef.current = await Location.watchPositionAsync(
//         { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
//         (loc) => {
//           if (stopped) return;
//           api.post(TRACKING.passengerLocation, {
//             lat: loc.coords.latitude,
//             lng: loc.coords.longitude,
//           }).catch(() => {});
//         }
//       );
//     };

//     startTracking();

//     return () => {
//       stopped = true;
//       if (locationSubRef.current) {
//         locationSubRef.current.remove();
//         locationSubRef.current = null;
//       }
//     };
//   }, [handRaised]);

//   return (
//     <View style={styles.container}>
//       <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

//       <View style={styles.mapArea}>
//         <VayyMap
//           style={styles.mapBg}
//           ref={mapRef}
//           cameraRef={cameraRef}
//           scrollEnabled={true}
//           zoomEnabled={true}
//           initialViewState={
//             pickupLat != null && pickupLon != null
//               ? { center: [pickupLon, pickupLat], zoom: 25 }
//               : { center: [80.9462, 26.8467], zoom: 25 }
//           }
//         >
//           {pickupLat != null && pickupLon != null && (
//             <ViewAnnotation key={`pickup`} lngLat={[pickupLon, pickupLat]} anchor="center">
//               <View style={styles.mapAnnotationPickup}>
//                 <Text style={{ fontSize: 20 }}>📍</Text>
//               </View>
//             </ViewAnnotation>
//           )}
//           {dropoffLat != null && dropoffLon != null && (
//             <ViewAnnotation key={`dropoff`} lngLat={[dropoffLon, dropoffLat]} anchor="center">
//               <View style={styles.mapAnnotationDropoff}>
//                 <Ionicons name="flag" size={28} color="#F97316" />
//               </View>
//             </ViewAnnotation>
//           )}
//         </VayyMap>

//         <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
//           <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
//           <View style={styles.headerLeft}>
//             {Platform.OS === 'ios' && (
//               <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
//                 <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
//               </TouchableOpacity>
//             )}
//             <Text style={styles.headerTitle}>Pre-Ride</Text>
//           </View>
//         </View>

//         <View style={styles.distanceCard}>
//           <View style={styles.flagWrapper}>
//             <Ionicons name="location" size={24} color="#009849" />
//           </View>
//           <View style={{ flex: 1 }}>
//             <Text style={styles.cardLabel}>Pickup stop</Text>
//             <Text style={styles.cardStopName}>{pickupName}</Text>
//             <View style={styles.walkRow}>
//               <Ionicons name="walk" size={14} color="#6B7280" />
//               <Text style={styles.walkText}>{walkMinutes ? `~${walkMinutes} min walk` : "Walk to pickup"}</Text>
//             </View>
//           </View>
//           <View style={styles.proximityRingActive}>
//             <Text style={styles.proximityTextActive}>✓</Text>
//           </View>
//         </View>

//         <View style={styles.autoLabel}>
//           <Text style={styles.autoLabelText}>{pickupName}</Text>
//           <View style={styles.labelArrow} />
//         </View>

//         <View style={styles.floatingContainer}>
//           <TouchableOpacity style={styles.floatBtn} onPress={zoomIn}>
//             <Text style={styles.zoomText}>+</Text>
//           </TouchableOpacity>
//           <TouchableOpacity style={styles.floatBtn} onPress={zoomOut}>
//             <Text style={styles.zoomText}>−</Text>
//           </TouchableOpacity>
//           <TouchableOpacity style={styles.floatBtn}>
//             <MaterialIcons name="my-location" size={24} color="#111827" />
//           </TouchableOpacity>
//         </View>
//       </View>
//       <View 
//         style={[styles.bottomSheet, { paddingBottom: insets.bottom + 24 }]}
//         onLayout={(event) => {
//           const { height } = event.nativeEvent.layout;
//           if (height > 0 && Math.abs(height - sheetHeight) > 10) {
//             setSheetHeight(height);
//           }
//         }}
//       ></View>

//       <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 24 }]}>
//         <View style={styles.handle} />

//         <View style={styles.instructionCard}>
//           <Text style={styles.instructionTitle}>Before you raise your hand</Text>
//           <View style={styles.instructionStep}>
//             <View style={styles.stepDot}><Text style={styles.stepNum}>1</Text></View>
//             <Text style={styles.stepText}>Walk to <Text style={styles.stepBold}>{pickupName}</Text></Text>
//           </View>
//           <View style={styles.instructionStep}>
//             <View style={styles.stepDot}><Text style={styles.stepNum}>2</Text></View>
//             <Text style={styles.stepText}>Raise your hand to signal approaching {vehicleType}s</Text>
//           </View>
//         </View>

//         <View style={styles.availabilityRow}>
//           <View style={styles.availItem}>
//             <Ionicons name="bicycle" size={16} color="#009849" />
//             <Text style={styles.availText}><Text style={styles.availBold}>{vehicleType}</Text></Text>
//           </View>
//           <View style={styles.availDot} />
//           <View style={styles.availItem}>
//             <Ionicons name="time-outline" size={16} color="#009849" />
//             <Text style={styles.availText}><Text style={styles.availBold}>~{Math.max(1, Math.ceil(etaSeconds / 60))} min</Text></Text>
//           </View>
//           <View style={styles.availDot} />
//           <View style={styles.availItem}>
//             <Ionicons name="cash-outline" size={16} color="#009849" />
//             <Text style={styles.availText}><Text style={styles.availBold}>₹{fare}</Text> fare</Text>
//           </View>
//         </View>

//         <View style={styles.routeInfoRow}>
//           <View style={styles.routeInfoItem}>
//             <Feather name="map-pin" size={14} color="#6B7280" />
//             <Text style={styles.routeInfoText}>{pickupName}</Text>
//           </View>
//           <Ionicons name="arrow-forward" size={14} color="#D1D5DB" />
//           <View style={styles.routeInfoItem}>
//             <Feather name="map-pin" size={14} color="#F97316" />
//             <Text style={styles.routeInfoText}>{destinationName}</Text>
//           </View>
//         </View>

//         <TouchableOpacity
//           activeOpacity={0.9}
//           style={[styles.raiseBtn, isRaising && styles.raiseBtnDisabled]}
//           onPress={handleRaiseHand}
//           disabled={isRaising}
//         >
//           {isRaising ? (
//             <ActivityIndicator color="#FFFFFF" />
//           ) : (
//             <Text style={styles.raiseText}>✋  Raise Hand</Text>
//           )}
//         </TouchableOpacity>
//       </View>

//       {/* Raise Hand Confirmation Modal */}
//       {showConfirm && (
//         <View style={styles.modalOverlay}>
//           <View style={styles.modalContent}>
//             <View style={styles.modalIconWrap}>
//               <Ionicons name="hand-left-outline" size={40} color="#009849" />
//             </View>
//             <Text style={styles.modalTitle}>Raise Hand?</Text>
//             <Text style={styles.modalMessage}>
//               Nearby {vehicleType} drivers will be notified that you are waiting at {pickupName}.
//             </Text>
//             <View style={styles.modalActions}>
//               <TouchableOpacity
//                 style={styles.modalBtnSecondary}
//                 onPress={() => setShowConfirm(false)}
//               >
//                 <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
//               </TouchableOpacity>
//               <TouchableOpacity
//                 style={styles.modalBtnPrimary}
//                 onPress={handleConfirmRaise}
//                 disabled={isRaising}
//               >
//                 {isRaising ? (
//                   <ActivityIndicator color="#FFFFFF" />
//                 ) : (
//                   <Text style={styles.modalBtnPrimaryText}>Raise Hand</Text>
//                 )}
//               </TouchableOpacity>
//             </View>
//           </View>
//         </View>
//       )}
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     position: "relative",
//     backgroundColor: "#F8FAF9",
//   },
//   header: {
//     position: "absolute",
//     top: 0,
//     left: 0,
//     right: 0,
//     zIndex: 10,
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//     paddingHorizontal: 24,
//     paddingBottom: 12,
//     backgroundColor: "rgba(0,152,73,0.6)",
//     overflow: "hidden",
//   },
//   iconBtn: {
//     width: 44,
//     height: 44,
//     borderRadius: 22,
//     backgroundColor: "transparent",
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   headerLeft: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 16,
//   },
//   headerTitle: {
//     fontSize: 24,
//     fontWeight: "800",
//     color: "#FFFFFF",
//     letterSpacing: -0.5,
//   },
//   distanceCard: {
//     position: "absolute",
//     top: 140,
//     left: 20,
//     right: 20,
//     zIndex: 10,
//     backgroundColor: "#FFFFFF",
//     borderRadius: 24,
//     padding: 16,
//     flexDirection: "row",
//     alignItems: "center",
//     shadowColor: "#000",
//     shadowOpacity: 0.04,
//     shadowRadius: 15,
//     elevation: 4,
//   },
//   flagWrapper: {
//     width: 52,
//     height: 52,
//     borderRadius: 16,
//     backgroundColor: "#ECFAF1",
//     justifyContent: "center",
//     alignItems: "center",
//     marginRight: 16,
//   },
//   cardLabel: {
//     fontSize: 14,
//     color: "#888888",
//     fontWeight: "500",
//     marginBottom: 2,
//   },
//   cardStopName: {
//     fontSize: 17,
//     fontWeight: "800",
//     color: "#111827",
//   },
//   walkRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 4,
//     marginTop: 4,
//   },
//   walkText: {
//     fontSize: 12,
//     color: "#6B7280",
//     fontWeight: "600",
//   },
//   mapArea: {
//     ...StyleSheet.absoluteFillObject,
//     backgroundColor: "#F9FAFB",
//   },
//   mapBg: {
//     ...StyleSheet.absoluteFillObject,
//   },
//   mapAnnotationPickup: {
//     width: 44,
//     height: 44,
//     borderRadius: 22,
//     backgroundColor: "#009849",
//     justifyContent: "center",
//     alignItems: "center",
//     borderWidth: 3,
//     borderColor: "#FFFFFF",
//     shadowColor: "#000",
//     shadowOpacity: 0.2,
//     shadowRadius: 8,
//     elevation: 4,
//   },
//   mapAnnotationDropoff: {
//     width: 36,
//     height: 36,
//     borderRadius: 18,
//     backgroundColor: "#FFF7ED",
//     justifyContent: "center",
//     alignItems: "center",
//     borderWidth: 2,
//     borderColor: "#F97316",
//   },
//   autoLabel: {
//     position: "absolute",
//     top: 135,
//     right: 20,
//     backgroundColor: "#FFFFFF",
//     borderRadius: 12,
//     paddingHorizontal: 14,
//     paddingVertical: 10,
//     shadowColor: "#000",
//     shadowOpacity: 0.1,
//     shadowRadius: 8,
//     elevation: 4,
//     zIndex: 10,
//   },
//   autoLabelText: {
//     fontSize: 14,
//     fontWeight: "700",
//     color: "#111827",
//     textAlign: "center",
//     lineHeight: 18,
//   },
//   labelArrow: {
//     position: "absolute",
//     bottom: -6,
//     right: 12,
//     width: 12,
//     height: 12,
//     backgroundColor: "#FFFFFF",
//     transform: [{ rotate: "45deg" }],
//   },
//   floatingContainer: {
//     position: "absolute",
//     right: 20,
//     bottom: 200,
//     gap: 12,
//   },
//   floatBtn: {
//     width: 56,
//     height: 56,
//     borderRadius: 28,
//     backgroundColor: "#FFFFFF",
//     justifyContent: "center",
//     alignItems: "center",
//     shadowColor: "#000",
//     shadowOpacity: 0.1,
//     shadowRadius: 10,
//     elevation: 4,
//   },
//   bottomSheet: {
//     position: "absolute",
//     bottom: 0,
//     left: 0,
//     right: 0,
//     backgroundColor: "#FFFFFF",
//     borderTopLeftRadius: 32,
//     borderTopRightRadius: 32,
//     paddingHorizontal: 20,
//     paddingTop: 12,
//     paddingBottom: 24,
//     shadowColor: "#000",
//     shadowOpacity: 0.1,
//     shadowRadius: 20,
//     elevation: 15,
//   },
//   zoomText: {
//     fontSize: 22,
//     fontWeight: "600",
//     color: "#111827",
//     lineHeight: 24,
//   },
//   handle: {
//     width: 40,
//     height: 4,
//     borderRadius: 2,
//     backgroundColor: "#E5E7EB",
//     alignSelf: "center",
//     marginBottom: 20,
//   },
//   availabilityRow: {
//     flexDirection: "row",
//     backgroundColor: "#ECFAF1",
//     borderRadius: 16,
//     paddingVertical: 10,
//     paddingHorizontal: 12,
//     marginBottom: 12,
//     justifyContent: "center",
//     alignItems: "center",
//     gap: 10,
//     flexWrap: "wrap",
//   },
//   availItem: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 4,
//   },
//   availText: {
//     fontSize: 12,
//     color: "#374151",
//     fontWeight: "500",
//   },
//   availBold: {
//     fontWeight: "800",
//     color: "#009849",
//   },
//   availDot: {
//     width: 4,
//     height: 4,
//     borderRadius: 2,
//     backgroundColor: "#009849",
//     opacity: 0.5,
//   },
//   routeInfoRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 8,
//     backgroundColor: "#F9FAFB",
//     borderRadius: 12,
//     paddingHorizontal: 14,
//     paddingVertical: 10,
//     marginBottom: 16,
//     borderWidth: 1,
//     borderColor: "#F3F4F6",
//   },
//   routeInfoItem: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 6,
//     flex: 1,
//   },
//   routeInfoText: {
//     fontSize: 12,
//     color: "#374151",
//     fontWeight: "600",
//     flex: 1,
//   },
//   raiseBtn: {
//     height: 60,
//     borderRadius: 20,
//     backgroundColor: "#009849",
//     flexDirection: "row",
//     justifyContent: "center",
//     alignItems: "center",
//     shadowColor: "#009849",
//     shadowOpacity: 0.3,
//     shadowRadius: 12,
//     elevation: 6,
//   },
//   raiseBtnDisabled: {
//     backgroundColor: "rgba(0,152,73,0.5)",
//     shadowOpacity: 0,
//     elevation: 0,
//   },
//   raiseText: {
//     color: "#FFFFFF",
//     fontSize: 17,
//     fontWeight: "800",
//   },
//   proximityRingActive: {
//     width: 52,
//     height: 52,
//     borderRadius: 26,
//     backgroundColor: "#ECFAF1",
//     justifyContent: "center",
//     alignItems: "center",
//     borderWidth: 2,
//     borderColor: "#009849",
//   },
//   proximityTextActive: {
//     fontSize: 14,
//     fontWeight: "800",
//     color: "#009849",
//   },
//   instructionCard: {
//     backgroundColor: "#F9FAFB",
//     borderRadius: 16,
//     padding: 16,
//     marginBottom: 16,
//   },
//   instructionTitle: {
//     fontSize: 15,
//     fontWeight: "800",
//     color: "#111827",
//     marginBottom: 12,
//   },
//   instructionStep: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 10,
//     marginBottom: 10,
//   },
//   stepDot: {
//     width: 24,
//     height: 24,
//     borderRadius: 12,
//     backgroundColor: "#009849",
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   stepNum: {
//     fontSize: 12,
//     fontWeight: "800",
//     color: "#FFFFFF",
//   },
//   stepText: {
//     fontSize: 13,
//     color: "#374151",
//     fontWeight: "500",
//     flex: 1,
//   },
//   stepBold: {
//     fontWeight: "800",
//     color: "#111827",
//   },
//   modalOverlay: {
//     position: "absolute",
//     top: 0, left: 0, right: 0, bottom: 0,
//     backgroundColor: "rgba(0,0,0,0.5)",
//     justifyContent: "center",
//     alignItems: "center",
//     zIndex: 100,
//     paddingHorizontal: 24,
//   },
//   modalContent: {
//     backgroundColor: "#FFFFFF",
//     borderRadius: 24,
//     padding: 24,
//     width: "100%",
//     maxWidth: 340,
//     alignItems: "center",
//   },
//   modalIconWrap: {
//     width: 72,
//     height: 72,
//     borderRadius: 36,
//     backgroundColor: "#ECFAF1",
//     justifyContent: "center",
//     alignItems: "center",
//     marginBottom: 16,
//   },
//   modalTitle: {
//     fontSize: 22,
//     fontWeight: "900",
//     color: "#111827",
//     marginBottom: 8,
//   },
//   modalMessage: {
//     fontSize: 14,
//     color: "#6B7280",
//     fontWeight: "500",
//     textAlign: "center",
//     lineHeight: 20,
//     marginBottom: 24,
//   },
//   modalActions: {
//     flexDirection: "row",
//     gap: 12,
//     width: "100%",
//   },
//   modalBtnSecondary: {
//     flex: 1,
//     height: 52,
//     borderRadius: 16,
//     borderWidth: 1.5,
//     borderColor: "#E5E7EB",
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   modalBtnSecondaryText: {
//     fontSize: 15,
//     fontWeight: "700",
//     color: "#374151",
//   },
//   modalBtnPrimary: {
//     flex: 1,
//     height: 52,
//     borderRadius: 16,
//     backgroundColor: "#009849",
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   modalBtnPrimaryText: {
//     fontSize: 15,
//     fontWeight: "800",
//     color: "#FFFFFF",
//   },
// });
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
  StatusBar
} from "react-native";
import * as Location from "expo-location";
import VayyMap, { ViewAnnotation, GeoJSONSource, Layer } from "../../shared/components/VayyMap";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Ionicons,
  MaterialIcons,
  Feather,
} from "@expo/vector-icons";
import { fetchRouteGeometry } from "../../routes/services/routeService";
import { walkingDistanceText } from "../../shared/utils/walkingDistance";
import { TRACKING } from "../../constants";
import api from "../../shared/lib/api";

export function AutoPreRideScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [sheetHeight, setSheetHeight] = useState(320);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isRaising, setIsRaising] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [routePath, setRoutePath] = useState(null);
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const didFitRef = useRef(false);

  const trip = route?.params?.trip || {};
  const pickup = route?.params?.pickup;
  const destination = route?.params?.destination;

  const pickupStop = trip?.pickup_stop || {};
  const dropoffStop = trip?.dropoff_stop || {};

  const pickupLat = typeof pickupStop?.lat === "number" ? pickupStop.lat : typeof pickupStop?.latitude === "number" ? pickupStop.latitude : null;
  const pickupLon = typeof pickupStop?.lon === "number" ? pickupStop.lon : typeof pickupStop?.longitude === "number" ? pickupStop.longitude : null;

  const dropoffLat = typeof dropoffStop?.lat === "number" ? dropoffStop.lat : typeof dropoffStop?.latitude === "number" ? dropoffStop.latitude : null;
  const dropoffLon = typeof dropoffStop?.lon === "number" ? dropoffStop.lon : typeof dropoffStop?.longitude === "number" ? dropoffStop.longitude : null;

  const pickupName = pickupStop?.name || pickup?.name || pickup?.display_name || "Pickup Location";
  const destinationName = dropoffStop?.name || destination?.name || destination?.display_name || "Destination";

  const fare = trip?.fare ?? "—";
  const etaSeconds = trip?.eta_seconds ?? 0;
  const walkMinutes = trip?.walk_minutes ?? 0;
  const walkDistanceMeters = trip?.walk_distance_meters ?? 0;
  const vehicleType = trip?.vehicle_type || trip?.fuel_type || "auto";

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  useEffect(() => {
    const loadRoute = async () => {
      const routeId = trip?.route_id;
      if (!routeId) return;
      try {
        const data = await fetchRouteGeometry(routeId);
        if (data?.path) {
          setRoutePath(data.path);
        }
      } catch (e) {
        console.warn("Failed to load route geometry", e);
      }
    };
    loadRoute();
  }, [trip?.route_id]);

  useEffect(() => {
    if (didFitRef.current) return;

    const tryFit = (attempt) => {
      if (didFitRef.current) return;
      if (!cameraRef.current) {
        if (attempt < 10) setTimeout(() => tryFit(attempt + 1), 200);
        return;
      }
      didFitRef.current = true;

      if (pickupLat != null && pickupLon != null) {
        const pad = 0.003;
        const coords = [[pickupLon, pickupLat]];
        if (dropoffLon != null && dropoffLat != null) coords.push([dropoffLon, dropoffLat]);

        if (coords.length === 1) {
          cameraRef.current.setStop({ center: [pickupLon, pickupLat], zoom: 15, duration: 500 });
        } else {
          const west = Math.min(...coords.map(c => c[0])) - pad;
          const south = Math.min(...coords.map(c => c[1])) - pad;
          const east = Math.max(...coords.map(c => c[0])) + pad;
          const north = Math.max(...coords.map(c => c[1])) + pad;

          cameraRef.current.fitBounds(
            [west, south, east, north],
            {
              top: insets.top + 100,
              right: 50,
              bottom: sheetHeight + 40, // Dynamically handle sheet clearance padding
              left: 50,
            },
            500,
          );
        }
      } else if (pickupLat != null && pickupLon != null) {
        cameraRef.current.setStop({ center: [pickupLon, pickupLat], zoom: 15, duration: 500 });
      }
    };

    tryFit(0);
  }, [pickupLat, pickupLon, dropoffLat, dropoffLon, sheetHeight, insets.top]); 

  const handleRaiseHand = useCallback(() => {
    setShowConfirm(true);
  }, []);

  const handleConfirmRaise = useCallback(async () => {
    setShowConfirm(false);
    setIsRaising(true);

    const stopId = pickupStop?.id;

    setHandRaised(true);
    navigation.navigate("AutoSearching", {
      route_id: trip?.route_id,
      pickup_stop_id: stopId,
      drop_stop_id: trip?.dropoff_stop?.id || null,
      trip, pickup, destination,
    });

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          api.post(TRACKING.passengerLocation, {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          }).catch(() => {});
        }
      } catch {}
    })();

    setIsRaising(false);
  }, [trip, pickupStop, pickup, destination, navigation]);

  const locationSubRef = useRef(null);

  const handleGetCurrentLocation = async () => {
  try {
    // 1. Request permissions if not already granted
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      console.warn("Location permission denied");
      return;
    }

    // 2. Fetch the quick/current coordinate
    const loc = await Location.getCurrentPositionAsync({ 
      accuracy: Location.Accuracy.Balanced 
    });

    // 3. Command the v11 camera to transition smoothly
    if (cameraRef.current && loc?.coords) {
      cameraRef.current.setStop({
        center: [loc.coords.longitude, loc.coords.latitude],
        zoom: 15,          // Sweet-spot zoom level for user location
        duration: 1000,    // 1 second smooth animation
      });
    }
  } catch (error) {
    console.warn("Error getting current location:", error);
  }
};

  useEffect(() => {
    if (!handRaised) return;

    let stopped = false;

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || stopped) return;

      locationSubRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
        (loc) => {
          if (stopped) return;
          api.post(TRACKING.passengerLocation, {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          }).catch(() => {});
        }
      );
    };

    startTracking();

    return () => {
      stopped = true;
      if (locationSubRef.current) {
        locationSubRef.current.remove();
        locationSubRef.current = null;
      }
    };
  }, [handRaised]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* FIXED LAYER 1: Fullscreen isolated underlying map container */}
      <View style={styles.mapArea}>
        <VayyMap
          style={styles.mapBg}
          ref={mapRef}
          cameraRef={cameraRef}
          scrollEnabled={true}
          zoomEnabled={true}
          initialViewState={
            pickupLat != null && pickupLon != null
              ? { center: [pickupLon, pickupLat], zoom: 15 }
              : { center: [80.8, 26.8], zoom: 12 }
          }
        >
          {routePath && (
            <>
              <GeoJSONSource id="routeSource" data={routePath} />
              <Layer
                id="routeLayer"
                type="line"
                source="routeSource"
                layout={{
                  "line-join": "round",
                  "line-cap": "round",
                }}
                paint={{
                  "line-color": "#009849",
                  "line-width": 5,
                }}
              />
            </>
          )}
          {pickupLat != null && pickupLon != null && (
            <ViewAnnotation key={`pickup`} lngLat={[pickupLon, pickupLat]} anchor="center">
              <View style={styles.mapAnnotationPickup}>
                <Text style={{ fontSize: 20 }}>📍</Text>
              </View>
            </ViewAnnotation>
          )}
          {dropoffLat != null && dropoffLon != null && (
            <ViewAnnotation key={`dropoff`} lngLat={[dropoffLon, dropoffLat]} anchor="center">
              <View style={styles.mapAnnotationDropoff}>
                <Ionicons name="flag" size={28} color="#F97316" />
              </View>
            </ViewAnnotation>
          )}
        </VayyMap>
      </View>

      {/* FIXED LAYER 2: Overlay Controls & Context Elements */}
      <View style={[styles.header, { paddingTop: insets.top + 10, overflow: "hidden" }]}>
        <View style={styles.headerGradient}>
          <View style={styles.gradBase} />
          <View style={styles.gradRay1} />
          <View style={styles.gradRay2} />
        </View>
        <View style={styles.headerLeft}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Pre-Ride</Text>
        </View>
      </View>

      <View style={[styles.distanceCard, { top: insets.top + 70 }]}>
        <View style={styles.flagWrapper}>
          <Ionicons name="location" size={24} color="#009849" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardLabel}>Pickup stop</Text>
          <Text style={styles.cardStopName}>{pickupName}</Text>
          <View style={styles.walkRow}>
            <Ionicons name="walk" size={14} color="#6B7280" />
            <Text style={styles.walkText}>{walkDistanceMeters ? `~${walkingDistanceText(walkDistanceMeters)}` : walkMinutes ? `~${walkMinutes} min walk` : "Walk to pickup"}</Text>
          </View>
        </View>
        <View style={styles.proximityRingActive}>
          <Text style={styles.proximityTextActive}>✓</Text>
        </View>
      </View>

      {/* Floating map action configurations */}
      <View style={[styles.floatingContainer, { bottom: sheetHeight + 20 }]}>
        <TouchableOpacity style={styles.floatBtn} onPress={zoomIn}>
          <Ionicons name="add" size={22} color="#111827" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.floatBtn} onPress={zoomOut}>
          <Ionicons name="remove" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.floatDivider} />
        <TouchableOpacity style={styles.floatBtn} onPress={handleGetCurrentLocation}>
          <MaterialIcons name="my-location" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* FIXED LAYER 3: Single Managed Bottom Sheet Layout */}
      <View 
        style={[styles.bottomSheet, { paddingBottom: insets.bottom + 24 }]}
        onLayout={(event) => {
          const { height } = event.nativeEvent.layout;
          if (height > 0 && Math.abs(height - sheetHeight) > 5) {
            setSheetHeight(height);
          }
        }}
      >
        <View style={styles.handle} />

        <View style={styles.instructionCard}>
          <Text style={styles.instructionTitle}>Before you raise your hand</Text>
          <View style={styles.instructionStep}>
            <View style={styles.stepDot}><Text style={styles.stepNum}>1</Text></View>
            <Text style={styles.stepText}>Walk to <Text style={styles.stepBold}>{pickupName}</Text></Text>
          </View>
          <View style={styles.instructionStep}>
            <View style={styles.stepDot}><Text style={styles.stepNum}>2</Text></View>
            <Text style={styles.stepText}>Raise your hand to signal approaching {vehicleType}s</Text>
          </View>
        </View>

        <View style={styles.availabilityRow}>
          <View style={styles.availItem}>
            <Ionicons name="bicycle" size={16} color="#009849" />
            <Text style={styles.availText}><Text style={styles.availBold}>{vehicleType}</Text></Text>
          </View>
          <View style={styles.availDot} />
          <View style={styles.availItem}>
            <Ionicons name="time-outline" size={16} color="#009849" />
            <Text style={styles.availText}><Text style={styles.availBold}>~{Math.max(1, Math.ceil(etaSeconds / 60))} min</Text></Text>
          </View>
          <View style={styles.availDot} />
          <View style={styles.availItem}>
            <Ionicons name="cash-outline" size={16} color="#009849" />
            <Text style={styles.availText}><Text style={styles.availBold}>₹{fare}</Text> fuel share</Text>
          </View>
        </View>

        <View style={styles.routeInfoRow}>
          <View style={styles.routeInfoItem}>
            <Feather name="map-pin" size={14} color="#6B7280" />
            <Text style={styles.routeInfoText}>{pickupName}</Text>
          </View>
          <Ionicons name="arrow-forward" size={14} color="#D1D5DB" />
          <View style={styles.routeInfoItem}>
            <Feather name="map-pin" size={14} color="#F97316" />
            <Text style={styles.routeInfoText}>{destinationName}</Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.raiseBtn, isRaising && styles.raiseBtnDisabled]}
          onPress={handleRaiseHand}
          disabled={isRaising}
        >
          {isRaising ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.raiseText}>✋  Raise Hand</Text>
          )}
        </TouchableOpacity>
      </View>

      

      {/* Confirmation Overlay Elements */}
      {showConfirm && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="hand-left-outline" size={40} color="#009849" />
            </View>
            <Text style={styles.modalTitle}>Raise Hand?</Text>
            <Text style={styles.modalMessage}>
              Nearby {vehicleType} drivers will be notified that you are waiting at {pickupName}.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnSecondary}
                onPress={() => setShowConfirm(false)}
              >
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnPrimary}
                onPress={handleConfirmRaise}
                disabled={isRaising}
              >
                {isRaising ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Raise Hand</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAF9",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  gradBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#009849",
  },
  gradRay1: {
    position: "absolute",
    top: -60,
    right: -20,
    width: 260,
    height: 200,
    backgroundColor: "#00B857",
    opacity: 0.25,
    transform: [{ rotate: "25deg" }],
  },
  gradRay2: {
    position: "absolute",
    bottom: -90,
    right: 40,
    width: 240,
    height: 180,
    backgroundColor: "#FFFFFF",
    opacity: 0.1,
    transform: [{ rotate: "35deg" }],
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  distanceCard: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 15,
    elevation: 4,
  },
  flagWrapper: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#ECFAF1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  cardLabel: {
    fontSize: 14,
    color: "#888888",
    fontWeight: "500",
    marginBottom: 2,
  },
  cardStopName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },
  walkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  walkText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  mapArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1, // Explicitly drops map layer below absolute interaction overlays
  },
  mapBg: {
    ...StyleSheet.absoluteFillObject,
  },
  mapAnnotationPickup: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  mapAnnotationDropoff: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF7ED",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#F97316",
  },
  floatingContainer: {
    position: "absolute",
    right: 20,
    alignItems: "center",
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    paddingVertical: 8,
    zIndex: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  floatBtn: {
    width: 56,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  floatDivider: {
    width: 28,
    height: 1,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 15,
    zIndex: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 20,
  },
  availabilityRow: {
    flexDirection: "row",
    backgroundColor: "#ECFAF1",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  availItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  availText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
  },
  availBold: {
    fontWeight: "800",
    color: "#009849",
  },
  availDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#009849",
    opacity: 0.5,
  },
  routeInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  routeInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  routeInfoText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "600",
    flex: 1,
  },
  raiseBtn: {
    height: 60,
    borderRadius: 20,
    backgroundColor: "#009849",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#009849",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  raiseBtnDisabled: {
    backgroundColor: "rgba(0,152,73,0.5)",
    shadowOpacity: 0,
    elevation: 0,
  },
  raiseText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  proximityRingActive: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#ECFAF1",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#009849",
  },
  proximityTextActive: {
    fontSize: 14,
    fontWeight: "800",
    color: "#009849",
  },
  instructionCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  instructionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
  },
  instructionStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
  },
  stepNum: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  stepText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
    flex: 1,
  },
  stepBold: {
    fontWeight: "800",
    color: "#111827",
  },
  modalOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  modalIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#ECFAF1",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalBtnSecondary: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnSecondaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
  },
  modalBtnPrimary: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#009849",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnPrimaryText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});