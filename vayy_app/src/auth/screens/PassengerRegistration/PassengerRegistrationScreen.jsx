import React, { useState } from "react";
import { useDispatch } from "react-redux";
import PassengerStep1Basic from "./PassengerStep1Basic";
import PassengerStep2Permissions from "./PassengerStep2Permissions";
import PassengerStep3OTP from "./PassengerStep3OTP";
import SuccessScreen from "../SuccessScreen";
import { registerUser } from "../../authSlice";
import { ROLE } from "../../../constants";

export default function PassengerRegistrationScreen({ navigation }) {
  const dispatch = useDispatch();
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

  if (step === 5) {
    return (
      <SuccessScreen
        title="Welcome to VAYY!"
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
          onComplete={() => setStep(5)}
          onBack={onBack}
          email={data.email}
        />
      )}
    </>
  );
}
