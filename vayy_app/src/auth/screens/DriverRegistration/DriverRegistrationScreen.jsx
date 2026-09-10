import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import DriverStep1Personal from "./DriverStep1Personal";
import DriverStep2Vehicle from "./DriverStep2Vehicle";
import DriverStep3VehicleInfo from "./DriverStep3VehicleInfo";
import DriverStep4Documents from "./DriverStep4Documents";
import DriverStep5Bank from "./DriverStep5Bank";
import ApplicationSubmittedScreen from "../ApplicationSubmittedScreen";
import { registerUser, loginUser } from "../../authSlice";
import { ROLE, OPERATIONS, AUTH } from "../../../constants";
import api from "../../../shared/lib/api";

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
    try {
      const loginResult = await dispatch(
        loginUser({ email: mergedData.email, password: mergedData.password }),
      );

      if (data.vehicleNumber) {
        await api.post(OPERATIONS.vehicleRegister, {
          vehicle_number: data.vehicleNumber,
          vehicle_type: data.vehicleType,
        }).catch(() => {});
      }

      await api.put(AUTH.driverProfile, {
        display_name: mergedData.fullName,
        phone_number: mergedData.mobile,
        license_number: mergedData.rcNumber || "",
        vehicle_number: mergedData.vehicleNumber || "",
        vehicle_type: mergedData.vehicleType || "auto",
      }).catch(() => {});

      const docMap = {
        LICENSE: [mergedData.dlFront, mergedData.dlBack],
        IDENTITY: [mergedData.selfie],
      };
      const fileEntries = Object.entries(docMap).flatMap(([type, files]) =>
        files.filter(Boolean).map((file) => ({ type, file }))
      );
      for (const { type, file } of fileEntries) {
        const formData = new FormData();
        formData.append("document_type", type);
        formData.append("file", {
          uri: file,
          name: file.split("/").pop(),
          type: "image/jpeg",
        });
        api.post(AUTH.driverDocuments, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        }).catch(() => {});
      }

      if (DRIVER_ROLES.includes(onboardingRole || "")) {
        await api.post(AUTH.submitForReview, {
          role: onboardingRole || "",
        }).catch(() => {});
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
