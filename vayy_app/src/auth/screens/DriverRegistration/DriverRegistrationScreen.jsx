import React, { useState } from "react";
import { useDispatch } from "react-redux";
import DriverStep1Personal from "./DriverStep1Personal";
import DriverStep2Vehicle from "./DriverStep2Vehicle";
import DriverStep3VehicleInfo from "./DriverStep3VehicleInfo";
import DriverStep4Documents from "./DriverStep4Documents";
import DriverStep5Bank from "./DriverStep5Bank";
import DriverStep6OTP from "./DriverStep6OTP";
import ApplicationSubmittedScreen from "../ApplicationSubmittedScreen";
import { registerUser } from "../../authSlice";
import { ROLE } from "../../../constants";

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
          onComplete={() => setStep(7)}
          onBack={onBack}
          email={data.email}
        />
      )}
    </>
  );
}
