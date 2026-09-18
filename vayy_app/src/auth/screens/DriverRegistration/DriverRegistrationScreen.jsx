import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Alert } from "react-native";
import DriverStep1Personal from "./DriverStep1Personal";
import DriverStep2Vehicle from "./DriverStep2Vehicle";
import DriverStep3VehicleInfo from "./DriverStep3VehicleInfo";
import DriverStep4Documents from "./DriverStep4Documents";
import DriverStep5Bank from "./DriverStep5Bank";
import ApplicationSubmittedScreen from "../ApplicationSubmittedScreen";
import { registerUser, loginUser } from "../../authSlice";
import { ROLE, OPERATIONS, AUTH } from "../../../constants";
import api from "../../../shared/lib/api";
import { uriToBase64 } from "../../../shared/lib/base64";

export default function DriverRegistrationScreen({ navigation }) {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const onboardingRole = useSelector((state) => state.onboarding.fields.role);
  const [step, setStep] = useState(1);
  const [data, setData] = useState({});
  const [registerError, setRegisterError] = useState(null);
  const [registering, setRegistering] = useState(false);

  const onNext = async (payload) => {
    const merged = { ...data, ...payload };
    setData(merged);

    if (step === 1) {
      setRegistering(true);
      const roleValue = merged.vehicleType === "auto" ? ROLE.AUTO_DRIVER : ROLE.BIKE_DRIVER;
      const result = await dispatch(
        registerUser({
          email: merged.email,
          password: merged.password,
          role: roleValue,
          first_name: merged.fullName || "",
          last_name: "",
        }),
      );
      setRegistering(false);

      if (!registerUser.fulfilled.match(result)) {
        setRegisterError(
          result.payload?.email?.[0] ||
            result.payload?.error ||
            "Registration failed",
        );
        return;
      }
      setRegisterError(null);
      setStep(2);
      return;
    }

    if (step === 2) setStep(3);
    if (step === 3) setStep(4);
    if (step === 4) setStep(5);
    if (step === 5) {
      handleSubmit(merged);
    }
  };

  const handleSubmit = async (mergedData) => {
    const errors = [];

    try {
      // 1. Login to get JWT token
      const loginResult = await dispatch(
        loginUser({ email: mergedData.email, password: mergedData.password }),
      );

      if (!loginUser.fulfilled.match(loginResult)) {
        Alert.alert("Registration", "Account created but login failed. Please login manually.");
        setStep(7);
        return;
      }

      // 2. Register vehicle (with base64 photo)
      if (mergedData.vehicleNumber) {
        const vehiclePhotoBase64 = mergedData.photo
          ? await uriToBase64(mergedData.photo)
          : "";

        try {
          await api.post(OPERATIONS.vehicleRegister, {
            vehicle_number: mergedData.vehicleNumber,
            vehicle_type: mergedData.vehicleType,
            vehicle_photo: vehiclePhotoBase64 || "",
          });
        } catch (e) {
          errors.push("Vehicle: " + (e.response?.data?.message || e.message));
        }
      }

      // 3. Update driver profile (name, phone, license, vehicle, dob, gender)
      try {
        const profileData = {
          display_name: mergedData.fullName,
          phone_number: mergedData.mobile,
          license_number: mergedData.rcNumber || "",
          vehicle_number: mergedData.vehicleNumber || "",
          vehicle_type: mergedData.vehicleType || "auto",
        };
        if (mergedData.dob) profileData.dob = mergedData.dob;
        if (mergedData.gender) profileData.gender = mergedData.gender;

        await api.put(AUTH.driverProfile, profileData);
      } catch (e) {
        errors.push("Profile: " + (e.response?.data?.message || e.message));
      }

      // 4. Upload documents as base64
      const docMap = {
        LICENSE: [mergedData.dlFront, mergedData.dlBack],
        RC: [mergedData.rcFront, mergedData.rcBack],
        INSURANCE: [mergedData.insuranceFront, mergedData.insuranceBack],
        IDENTITY: [
          mergedData.selfie,
          mergedData.aadhaarFront,
          mergedData.aadhaarBack,
        ].filter(Boolean),
      };

      for (const [type, files] of Object.entries(docMap)) {
        for (const fileUri of files) {
          if (!fileUri) continue;
          try {
            const base64 = await uriToBase64(fileUri);
            if (!base64) {
              errors.push(`${type}: Failed to encode image`);
              continue;
            }
            const fileName = fileUri.split("/").pop() || `${type.toLowerCase()}.jpg`;
            await api.post(AUTH.driverDocuments, {
              document_type: type,
              file_base64: base64,
              file_name: fileName,
            });
          } catch (e) {
            errors.push(`${type}: ` + (e.response?.data?.message || e.message));
          }
        }
      }

      // 5. Save bank details
      if (mergedData.holderName || mergedData.accountNumber || mergedData.ifsc) {
        try {
          await api.post(AUTH.driverBankDetails, {
            holder_name: mergedData.holderName || "",
            account_number: mergedData.accountNumber || "",
            ifsc: mergedData.ifsc || "",
            upi: mergedData.upi || "",
          });
        } catch (e) {
          errors.push("Bank: " + (e.response?.data?.message || e.message));
        }
      }

      if (errors.length > 0) {
        Alert.alert(
          "Some items failed",
          errors.join("\n") + "\n\nYou can retry from your profile.",
        );
      }

      setStep(7);
    } catch {
      setStep(7);
    }
  };

  const DRIVER_ROLES = [ROLE.AUTO_DRIVER, ROLE.BIKE_DRIVER];

  const onBack = () => {
    if (step === 1) navigation.goBack();
    else setStep((s) => s - 1);
  };

  if (step === 7) {
    return (
      <ApplicationSubmittedScreen
        onCta={() => navigation.navigate("LoginPage")}
      />
    );
  }

  return (
    <>
      {step === 1 && <DriverStep1Personal onNext={onNext} onBack={onBack} />}
      {step === 2 && (
        <DriverStep2Vehicle
          onNext={onNext}
          onBack={onBack}
          loading={registering}
          error={registerError}
        />
      )}
      {step === 3 && (
        <DriverStep3VehicleInfo onNext={onNext} onBack={onBack} vehicleType={data.vehicleType} />
      )}
      {step === 4 && <DriverStep4Documents onNext={onNext} onBack={onBack} />}
      {step === 5 && <DriverStep5Bank onNext={onNext} onBack={onBack} />}
    </>
  );
}
