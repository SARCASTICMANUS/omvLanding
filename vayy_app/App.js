import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { AppState } from "react-native";
import { Provider, useDispatch, useSelector } from "react-redux";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { store } from "./src/store/store";
import {
  clearVerification,
  fetchVerification,
} from "./src/store/slices/verificationSlice";
import AppNavigator from "./src/navigation/AppNavigator";
import { LanguageProvider } from "./src/shared/lib/i18n/LanguageContext";
import WebSocketProvider from "./src/shared/lib/WebSocketProvider";
import VerificationGate from "./src/VerificationGate";

// While the gate is showing, re-ask the server this often so an admin approval
// (or a completed upload) unlocks the app without a relaunch.
const BLOCKED_POLL_MS = 15000;

function Root() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(
    (state) => state.auth?.isAuthenticated === true
  );
  const isBlocked = useSelector((state) => {
    const v = state.verification?.state;
    return !!v && v.can_use_app !== true && v.stage !== "fully_verified";
  });

  // Verification is server-controlled and platform-independent (the backend
  // derives it from the DB on every request). Re-read it on login/boot and wipe
  // it on logout so a stale answer can never leak between accounts.
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchVerification());
    } else {
      dispatch(clearVerification());
    }
  }, [dispatch, isAuthenticated]);

  // Revalidate whenever the app returns to the foreground (web: tab focus).
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") dispatch(fetchVerification());
    });
    return () => sub.remove();
  }, [dispatch, isAuthenticated]);

  // Poll only while blocked; stops the moment the server says can_use_app.
  useEffect(() => {
    if (!isAuthenticated || !isBlocked) return undefined;
    const id = setInterval(() => dispatch(fetchVerification()), BLOCKED_POLL_MS);
    return () => clearInterval(id);
  }, [dispatch, isAuthenticated, isBlocked]);

  return (
    <SafeAreaProvider>
      <WebSocketProvider>
        <LanguageProvider>
          <StatusBar style="dark" backgroundColor="#FFFFFF" />
          {isAuthenticated && <VerificationGate />}
          <AppNavigator />
        </LanguageProvider>
      </WebSocketProvider>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <Root />
    </Provider>
  );
}
