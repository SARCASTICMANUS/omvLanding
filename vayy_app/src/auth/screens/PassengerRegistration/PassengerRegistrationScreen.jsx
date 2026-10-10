import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { notifyAction } from "../../../shared/lib/confirmAction";
import { Alert } from "react-native";
import PassengerStep1Basic from "./PassengerStep1Basic";
import PassengerStep2Permissions from "./PassengerStep2Permissions";
import PassengerStep3OTP from "./PassengerStep3OTP";
import ApplicationSubmittedScreen from "../ApplicationSubmittedScreen";
import { useNavigation } from "@react-navigation/native";
import { registerUser } from "../../authSlice";
import { ROLE, AUTH } from "../../../constants";
import api from "../../../shared/lib/api";
import { setField } from "../../../store/slices/onboardingSlice";

export default function PassengerRegistrationScreen({ navigation }) {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const onboarding = useSelector((state) => state.onboarding);
  const nav = useNavigation();

  const [step, setStep] = useState(1);
  const [data, setData] = useState({});
  const [registerError, setRegisterError] = useState(null);
  const [registering, setRegistering] = useState(false);

  const onNext = async (payload) => {
    const merged = { ...data, ...payload };
    setData(merged);

    if (step === 1) {
      setRegistering(true);
      const result = await dispatch(
        registerUser({
          email: merged.email,
          password: merged.password,
          role: ROLE.PASSENGER,
          first_name: merged.fullName || "",
          last_name: "",
        }),
      );
      setRegistering(false);

      if (!registerUser.fulfilled.match(result)) {
        const errorMsg = result.payload?.email?.[0] || result.payload?.error || "";
        if (errorMsg.toLowerCase().includes("already exists")) {
          // Routed through notifyAction: Alert.alert renders nothing on web,
          // so the passenger never learned their email was already taken.
          notifyAction({
            title: "Account Exists",
            message:
              "An account already exists with this email. Please login with your existing password.",
          });
          navigation.navigate("LoginPage");
          return;
        }
        setRegisterError(errorMsg || "Registration failed");
        return;
      }
      setRegisterError(null);
      dispatch(setField({ field: "fullName", value: merged.fullName }));
      dispatch(setField({ field: "email", value: merged.email }));
      dispatch(setField({ field: "password", value: merged.password }));
      setStep(2);
      return;
    }

    if (step === 2) {
      setStep(3);
    }
  };

  const onComplete = async () => {
    if (data.dob || data.gender) {
      try {
        await api.put(AUTH.passengerProfile, {
          dob: data.dob || undefined,
          gender: data.gender || undefined,
        });
      } catch {
        // Profile update is non-blocking
      }
    }
    setStep(4);
  };

  const onBack = () => {
    if (step === 1) navigation.goBack();
    else setStep((s) => s - 1);
  };

  useEffect(() => {
    if (step === 4) {
      const timeoutId = setTimeout(() => {
        nav.navigate("LoginPage");
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [step, nav]);

  if (step === 4) {
    return (
      <ApplicationSubmittedScreen
        title="Welcome to OMV!"
        message="Your account is ready. Sign in to start finding rides."
        cta="Sign In"
        onCta={() => navigation.navigate("LoginPage")}
      />
    );
  }

  return (
    <>
      {step === 1 && (
        <PassengerStep1Basic
          onNext={onNext}
          onBack={onBack}
          loading={registering}
          error={registerError}
        />
      )}
      {step === 2 && <PassengerStep2Permissions onNext={onNext} onBack={onBack} />}
      {step === 3 && (
        <PassengerStep3OTP
          onComplete={onComplete}
          onBack={onBack}
          email={data.email}
        />
      )}
    </>
  );
}
