import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { Alert } from "react-native";
import DriverStep1Personal from "./DriverStep1Personal";
import DriverStep6OTP from "./DriverStep6OTP";
import { sendRegistrationOtp, verifyAndRegister, loginUser } from "../../authSlice";
import { setField } from "../../../store/slices/onboardingSlice";
import { notifyAction } from "../../../shared/lib/confirmAction";

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
      const ok = await handleSendOtp(merged);
      if (!ok) return;
      setRegistered(true);
      setStep(2);
      return;
    }

    setStep((s) => s + 1);
  };

  const handleSendOtp = async (formData) => {
    setRegistering(true);
    console.log("[Reg] Sending OTP for:", formData.email, "role: bikedriver");
    const result = await dispatch(
      sendRegistrationOtp({
        email: formData.email,
        password: formData.password,
        role: "bikedriver",
        first_name: formData.fullName || "",
      }),
    );
    setRegistering(false);
    console.log("[Reg] OTP result:", sendRegistrationOtp.rejected.match(result) ? "REJECTED" : "SUCCESS", result.payload);

    if (sendRegistrationOtp.rejected.match(result)) {
      const msg =
        result.payload?.message ||
        result.payload?.error ||
        "Failed to send Safety Code";
      if (msg.toLowerCase().includes("already exists")) {
        notifyAction({
          title: "Account Exists",
          message: "An account with this email already exists. Please login.",
        });
        navigation.navigate("LoginPage");
        return false;
      }
      notifyAction({ title: "Error", message: msg });
      return false;
    }
    return true;
  };

  const handleOtpVerified = async (otpValue) => {
    console.log("[Reg] Verifying OTP for:", data.email);
    const result = await dispatch(
      verifyAndRegister({ email: data.email, otp: otpValue }),
    );
    console.log("[Reg] Verify result:", verifyAndRegister.rejected.match(result) ? "REJECTED" : "SUCCESS", result.payload);

    if (verifyAndRegister.rejected.match(result)) {
      const msg =
        result.payload?.message ||
        result.payload?.error ||
        "Verification failed";
      notifyAction({ title: "Verification Failed", message: msg });
      return;
    }

    console.log("[Reg] Saving onboarding fields:", { fullName: data.fullName, email: data.email, mobile: data.mobile, dob: data.dob, gender: data.gender });
    dispatch(setField({ field: "fullName", value: data.fullName }));
    dispatch(setField({ field: "email", value: data.email }));
    dispatch(setField({ field: "mobile", value: data.mobile }));
    dispatch(setField({ field: "dob", value: data.dob }));
    dispatch(setField({ field: "gender", value: data.gender }));

    console.log("[Reg] Auto-logging in...");
    const loginResult = await dispatch(
      loginUser({ email: data.email, password: data.password }),
    );
    console.log("[Reg] Login result:", loginUser.rejected.match(loginResult) ? "REJECTED" : "SUCCESS");

    if (loginUser.rejected.match(loginResult)) {
      console.error("[Reg] Login failed:", loginResult.payload);
      notifyAction({
        title: "Login Failed",
        message: "Account created but login failed. Please go to Login page and sign in.",
      });
      navigation.navigate("LoginPage");
      return;
    }

    console.log("[Reg] Registration complete — navigating to driver app");
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
