import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Alert } from "react-native";
import DriverStep2Vehicle from "./DriverStep2Vehicle";
import DriverStep3VehicleInfo from "./DriverStep3VehicleInfo";
import DriverStep4Documents from "./DriverStep4Documents";
import DriverStep5Bank from "./DriverStep5Bank";
import DriverStep7Submit from "./DriverStep7Submit";
import ApplicationSubmittedScreen from "../ApplicationSubmittedScreen";
import { completeRegistration } from "../../authSlice";
import { clearFields } from "../../../store/slices/onboardingSlice";

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

export default function DriverProfileCompletionScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const fields = useSelector((state) => state.onboarding.fields);
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    fullName: fields.fullName || user?.name || user?.full_name || "",
    email: fields.email || user?.email || "",
    mobile: fields.mobile || "",
    dob: fields.dob || "",
    gender: fields.gender || "",
  });
  const [submitting, setSubmitting] = useState(false);

  const onNext = (payload) => {
    setData((prev) => ({ ...prev, ...payload }));
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const bankDetails = {};
      if (data.holderName || data.accountNumber || data.ifsc) {
        bankDetails.holder_name = data.holderName || "";
        bankDetails.account_number = data.accountNumber || "";
        bankDetails.ifsc = data.ifsc || "";
        bankDetails.upi = data.upi || "";
      }

      const dobFormatted = parseDobToISO(data.dob);
      const role = data.vehicleType === "auto" ? "autodriver" : "bikedriver";

      const docMap = {
        LICENSE: [data.dlFront, data.dlBack],
        RC: [data.rcFront, data.rcBack],
        INSURANCE: [data.insuranceFront, data.insuranceBack],
        IDENTITY: [data.selfie, data.aadhaarFront, data.aadhaarBack].filter(Boolean),
      };

      const documents = [];
      for (const [type, files] of Object.entries(docMap)) {
        for (const fileBase64 of files) {
          if (!fileBase64) continue;
          const fileName = `${type.toLowerCase()}.jpg`;
          documents.push({ document_type: type, file_base64: fileBase64, file_name: fileName });
        }
      }

      const result = await dispatch(
        completeRegistration({
          display_name: data.fullName || "",
          phone_number: data.mobile || "",
          dob: dobFormatted,
          gender: data.gender || "",
          vehicle_type: data.vehicleType || "bike",
          vehicle_number: data.vehicleNumber || "",
          vehicle_photo: data.photo || "",
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

      dispatch(clearFields());
      setStep(99);
    } catch {
      setSubmitting(false);
      Alert.alert("Registration Failed", "Something went wrong. Please try again.");
    }
  };

  const onBack = () => {
    if (step > 1) setStep((s) => s - 1);
    else navigation.goBack();
  };

  if (step === 99) {
    return (
      <ApplicationSubmittedScreen onCta={() => navigation.navigate("DriverTabs")} />
    );
  }

  return (
    <>
      {step === 1 && <DriverStep2Vehicle onNext={onNext} onBack={onBack} />}
      {step === 2 && (
        <DriverStep3VehicleInfo
          onNext={onNext}
          onBack={onBack}
          vehicleType={data.vehicleType}
        />
      )}
      {step === 3 && <DriverStep4Documents onNext={onNext} onBack={onBack} />}
      {step === 4 && <DriverStep5Bank onNext={onNext} onBack={onBack} />}
      {step === 5 && (
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
