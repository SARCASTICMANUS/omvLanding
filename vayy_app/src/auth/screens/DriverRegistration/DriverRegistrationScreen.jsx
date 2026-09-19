import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { Alert } from "react-native";
import DriverStep1Personal from "./DriverStep1Personal";
import DriverStep2Vehicle from "./DriverStep2Vehicle";
import DriverStep3VehicleInfo from "./DriverStep3VehicleInfo";
import DriverStep4Documents from "./DriverStep4Documents";
import DriverStep5Bank from "./DriverStep5Bank";
import DriverStep6OTP from "./DriverStep6OTP";
import DriverStep7Submit from "./DriverStep7Submit";
import ApplicationSubmittedScreen from "../ApplicationSubmittedScreen";
import { registerUser, loginUser, completeRegistration } from "../../authSlice";
import { uriToBase64 } from "../../../shared/lib/base64";

const parseDobToISO = (dob) => {
  if (!dob) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) return dob;
  const parts = dob.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
};

export default function DriverRegistrationScreen({ navigation }) {
  const dispatch = useDispatch();
  const [step, setStep] = useState(1);
  const [data, setData] = useState({});
  const [submitting, setSubmitting] = useState(false);
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
    const loginResult = await dispatch(
      loginUser({ email: data.email, password: data.password }),
    );
    if (loginUser.rejected.match(loginResult)) {
      Alert.alert("Login Failed", "Could not log in automatically. Please login manually.");
      navigation.navigate("LoginPage");
      return;
    }
    setStep(3);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const vehiclePhotoBase64 = data.photo ? await uriToBase64(data.photo) : "";

      const docMap = {
        LICENSE: [data.dlFront, data.dlBack],
        RC: [data.rcFront, data.rcBack],
        INSURANCE: [data.insuranceFront, data.insuranceBack],
        IDENTITY: [data.selfie, data.aadhaarFront, data.aadhaarBack].filter(Boolean),
      };

      const documents = [];
      for (const [type, files] of Object.entries(docMap)) {
        for (const fileUri of files) {
          if (!fileUri) continue;
          const base64 = await uriToBase64(fileUri);
          if (!base64) continue;
          const fileName = fileUri.split("/").pop() || `${type.toLowerCase()}.jpg`;
          documents.push({ document_type: type, file_base64: base64, file_name: fileName });
        }
      }

      const bankDetails = {};
      if (data.holderName || data.accountNumber || data.ifsc) {
        bankDetails.holder_name = data.holderName || "";
        bankDetails.account_number = data.accountNumber || "";
        bankDetails.ifsc = data.ifsc || "";
        bankDetails.upi = data.upi || "";
      }

      const dobFormatted = parseDobToISO(data.dob);
      const role = data.vehicleType === "auto" ? "autodriver" : "bikedriver";

      const result = await dispatch(
        completeRegistration({
          display_name: data.fullName || "",
          phone_number: data.mobile || "",
          dob: dobFormatted,
          gender: data.gender || "",
          vehicle_type: data.vehicleType || "bike",
          vehicle_number: data.vehicleNumber || "",
          vehicle_photo: vehiclePhotoBase64,
          rc_number: data.rcNumber || "",
          documents,
          bank_details: bankDetails,
          role,
        }),
      );

      setSubmitting(false);

      if (completeRegistration.rejected.match(result)) {
        const errorMsg =
          result.payload?.vehicle_number?.[0] ||
          result.payload?.error ||
          result.payload?.message ||
          "Submission failed";
        Alert.alert("Registration Failed", errorMsg);
        return;
      }

      setStep(8);
    } catch {
      setSubmitting(false);
      Alert.alert("Registration Failed", "Something went wrong. Please try again.");
    }
  };

  const onBack = () => {
    if (step === 1 && !registered) navigation.goBack();
    else if (step === 2) { setStep(1); setRegistered(false); }
    else if (step > 2) setStep((s) => s - 1);
  };

  if (step === 8) {
    return (
      <ApplicationSubmittedScreen onCta={() => navigation.navigate("LoginPage")} />
    );
  }

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
      {step === 3 && <DriverStep2Vehicle onNext={onNext} onBack={onBack} />}
      {step === 4 && (
        <DriverStep3VehicleInfo
          onNext={onNext}
          onBack={onBack}
          vehicleType={data.vehicleType}
        />
      )}
      {step === 5 && <DriverStep4Documents onNext={onNext} onBack={onBack} />}
      {step === 6 && <DriverStep5Bank onNext={onNext} onBack={onBack} />}
      {step === 7 && (
        <DriverStep7Submit
          data={data}
          onSubmit={handleSubmit}
          onBack={onBack}
          loading={submitting}
        />
      )}
    </>
  );
}
