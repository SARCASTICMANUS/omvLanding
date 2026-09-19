import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { Alert } from "react-native";
import DriverStep1Personal from "./DriverStep1Personal";
import DriverStep6OTP from "./DriverStep6OTP";
import { registerUser, loginUser } from "../../authSlice";
import { setField } from "../../../store/slices/onboardingSlice";

export default function DriverRegistrationScreen({ navigation }) {
  const dispatch = useDispatch();
  const [step, setStep] = useState(1);
  const [data, setData] = useState({});
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);

  const onNext = async (payload) => {
    const merged = { ...data, ...payload };
    setData(merged);

    if (step === 1) {
      const ok = await handleRegister(merged);
      if (!ok) return;
      setRegistered(true);
      setStep(2);
      return;
    }

    setStep((s) => s + 1);
  };

  const handleRegister = async (formData) => {
    setRegistering(true);
    const result = await dispatch(
      registerUser({
        email: formData.email,
        password: formData.password,
        role: "bikedriver",
        first_name: formData.fullName || "",
      }),
    );
    setRegistering(false);

    if (registerUser.rejected.match(result)) {
      const msg =
        result.payload?.email?.[0] ||
        result.payload?.error ||
        result.payload?.message ||
        "Registration failed";
      if (msg.toLowerCase().includes("already exists")) {
        Alert.alert("Account Exists", "An account with this email already exists. Please login.", [
          { text: "Go to Login", onPress: () => navigation.navigate("LoginPage") },
        ]);
        return false;
      }
      Alert.alert("Registration Failed", msg);
      return false;
    }
    return true;
  };

  const handleOtpVerified = async () => {
    dispatch(setField({ field: "fullName", value: data.fullName }));
    dispatch(setField({ field: "email", value: data.email }));
    dispatch(setField({ field: "mobile", value: data.mobile }));
    dispatch(setField({ field: "dob", value: data.dob }));
    dispatch(setField({ field: "gender", value: data.gender }));

    const result = await dispatch(
      loginUser({ email: data.email, password: data.password }),
    );

    if (loginUser.rejected.match(result)) {
      Alert.alert(
        "Login Failed",
        "OTP verified but login failed. Please go to Login page and sign in.",
        [{ text: "Go to Login", onPress: () => navigation.navigate("LoginPage") }],
      );
      return;
    }

    // AppNavigator will auto-switch to DriverNavigator since isAuthenticated is now true
  };

  const onBack = () => {
    if (step === 1 && !registered) navigation.goBack();
    else if (step === 2) { setStep(1); setRegistered(false); }
  };

  return (
    <>
      {step === 1 && <DriverStep1Personal onNext={onNext} onBack={onBack} loading={registering} />}
      {step === 2 && (
        <DriverStep6OTP
          onComplete={handleOtpVerified}
          onBack={onBack}
          email={data.email}
        />
      )}
    </>
  );
}
