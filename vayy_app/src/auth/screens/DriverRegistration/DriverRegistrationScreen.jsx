import React, { useState } from "react";
import { useDispatch } from "react-redux";
import DriverStep1Personal from "./DriverStep1Personal";
import DriverStep2Vehicle from "./DriverStep2Vehicle";
import DriverStep3VehicleInfo from "./DriverStep3VehicleInfo";
import DriverStep4Documents from "./DriverStep4Documents";
import DriverStep5Bank from "./DriverStep5Bank";
import DriverStep6OTP from "./DriverStep6OTP";
import ApplicationSubmittedScreen from "../ApplicationSubmittedScreen";
import { registerUser, loginUser } from "../../authSlice";
import { ROLE, OPERATIONS, AUTH } from "../../../constants";
import api from "../../../shared/lib/api";

export default function DriverRegistrationScreen({ navigation }) {
  const dispatch = useDispatch();
  const [step, setStep] = useState(1);
  const [data, setData] = useState({});
  const [registerError, setRegisterError] = useState(null);
  const [registering, setRegistering] = useState(false);

  const onNext = async (payload) => {
    const merged = { ...data, ...payload };
    setData(merged);

    if (step === 2) {
      const role = merged.vehicleType === "auto" ? ROLE.AUTO_DRIVER : ROLE.BIKE_DRIVER;
      setRegistering(true);
      const result = await dispatch(
        registerUser({
          email: merged.email,
          password: merged.password,
          role,
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
    }

    setStep((s) => s + 1);
  };

  const onOtpComplete = async () => {
    try {
      // 0. Auto-login to get auth token (required for subsequent API calls)
      const loginResult = await dispatch(
        loginUser({ email: data.email, password: data.password }),
      );
      if (!loginUser.fulfilled.match(loginResult)) {
        // Login failed but OTP was verified — driver can login manually later
        setStep(7);
        return;
      }

      // 1. Register vehicle
      if (data.vehicleNumber) {
        await api.post(OPERATIONS.vehicleRegister, {
          vehicle_number: data.vehicleNumber,
          vehicle_type: data.vehicleType,
        });
      }

      // 2. Update driver profile
      await api.put(AUTH.driverProfile, {
        display_name: data.fullName,
        phone_number: data.mobile,
        license_number: data.rcNumber || "",
        vehicle_number: data.vehicleNumber || "",
        vehicle_type: data.vehicleType || "auto",
      });

      // 3. Upload documents (fire-and-forget, files upload async)
      const docMap = {
        LICENSE: [data.dlFront, data.dlBack],
        IDENTITY: [data.selfie],
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
    } catch {
      // Registration succeeded even if profile/doc upload fails
      // Driver can complete profile later
    }

    setStep(7);
  };

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
      {step === 6 && (
        <DriverStep6OTP
          onComplete={onOtpComplete}
          onBack={onBack}
          email={data.email}
        />
      )}
    </>
  );
}
