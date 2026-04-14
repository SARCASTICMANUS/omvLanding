import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronDown } from "lucide-react";

const GENDER_OPTIONS = ["Female", "Male"];
const PURPOSE_OPTIONS = [
  "Office / commute",
  "College / School",
  "Other",
];
const FREQUENCY_OPTIONS = ["Daily", "3-5 times/week", "Occasionally"];
const TIME_OPTIONS = [
  "Morning (7-11 AM)",
  "Afternoon",
  "Evening (5-9 PM)",
];
const ROUTINE_OPTIONS = ["Yes", "No"];
const FALLBACK_CITIES = [
  { id: "lucknow", name: "Lucknow", state: "Uttar Pradesh" },
  { id: "kanpur", name: "Kanpur", state: "Uttar Pradesh" },
  { id: "ghaziabad", name: "Ghaziabad", state: "Uttar Pradesh" },
  { id: "agra", name: "Agra", state: "Uttar Pradesh" },
  { id: "varanasi", name: "Varanasi", state: "Uttar Pradesh" },
  { id: "meerut", name: "Meerut", state: "Uttar Pradesh" },
  { id: "prayagraj", name: "Prayagraj", state: "Uttar Pradesh" },
  { id: "noida", name: "Noida", state: "Uttar Pradesh" },
  { id: "bareilly", name: "Bareilly", state: "Uttar Pradesh" },
  { id: "aligarh", name: "Aligarh", state: "Uttar Pradesh" },
];
const STATE_OPTIONS = ["Uttar Pradesh"];

function FieldLabel({ children }) {
  return (
    <label className="block text-[11px] font-semibold text-black sm:text-[12px]">
      {children}
    </label>
  );
}

function InputField({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder = "",
  readOnly = false,
  autoComplete,
  maxLength,
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        className="h-11 w-full rounded-[12px] border-0 bg-[#a6a6a6] px-4 text-[14px] font-medium text-black outline-none placeholder:text-black/55 sm:h-[50px] sm:text-[15px]"
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  placeholder = "Select",
  gold = true,
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>

      <div className="relative">
        <select
          name={name}
          value={value}
          onChange={onChange}
          className={`h-11 w-full appearance-none rounded-[12px] border-0 px-4 pr-10 text-[14px] font-medium outline-none sm:h-[50px] sm:text-[15px] ${
            gold ? "bg-[#b89d10] text-black" : "bg-[#a6a6a6] text-black"
          }`}
        >
          <option value="" disabled>
            {placeholder}
          </option>

          {options.map((option) => {
            const isObject = typeof option === "object" && option !== null;
            const optionValue = isObject ? String(option.id) : String(option);
            const optionLabel = isObject
              ? `${option.name}${option.state ? `, ${option.state}` : ""}`
              : String(option);

            return (
              <option
                key={optionValue}
                value={optionValue}
                className="bg-white text-black"
              >
                {optionLabel}
              </option>
            );
          })}
        </select>

        <ChevronDown
          size={18}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black"
        />
      </div>
    </div>
  );
}

export default function PassengerRegisterForm({
  email = "",
  cities = [],
  onBack,
  onSubmit,
  loading = false,
  error = "",
}) {
  const cityOptions = Array.isArray(cities) && cities.length > 0 ? cities : FALLBACK_CITIES;

  const [form, setForm] = useState({
    email,
    first_name: "",
    last_name: "",
    phone_number: "",
    password: "",
    gender: "",
    dob: "",
    primary_travel_purpose: "",
    travel_frequency: "",
    usual_travel_time: "",
    same_route_daily: "",
    city: "",
    state: "Uttar Pradesh",
  });

  const trimmedFirstName = form.first_name.trim();
  const trimmedLastName = form.last_name.trim();
  const trimmedPhone = form.phone_number.trim();
  const trimmedPassword = form.password.trim();

  const canSubmit = useMemo(() => {
    return Boolean(
      form.email &&
        trimmedFirstName &&
        trimmedPassword &&
        trimmedPassword.length >= 6 &&
        form.gender &&
        form.dob &&
        form.primary_travel_purpose &&
        form.travel_frequency &&
        form.usual_travel_time &&
        form.same_route_daily &&
        form.city &&
        form.state
    );
  }, [
    form.email,
    form.gender,
    form.dob,
    form.primary_travel_purpose,
    form.travel_frequency,
    form.usual_travel_time,
    form.same_route_daily,
    form.city,
    form.state,
    trimmedFirstName,
    trimmedPassword,
  ]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;

    await onSubmit?.({
      ...form,
      first_name: trimmedFirstName,
      last_name: trimmedLastName,
      phone_number: trimmedPhone,
      password: trimmedPassword,
    });
  };

  return (
    <div className="min-h-screen bg-[#171717] px-2 py-2 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-[1040px]">
        <div className="overflow-hidden rounded-none border border-black bg-[#efefef] shadow-[0_18px_50px_rgba(0,0,0,0.28)] sm:rounded-[22px]">
          <div className="px-3 pb-5 pt-4 sm:px-8 sm:pb-8 sm:pt-7 lg:px-10">
            <div className="relative mb-4 flex items-center justify-center sm:mb-6">
              <button
                type="button"
                onClick={onBack}
                className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full p-1 text-black"
                aria-label="Go back"
              >
                <ChevronLeft size={22} strokeWidth={2.5} />
              </button>

              <h1 className="text-[16px] font-semibold text-black sm:text-[24px]">
                Register
              </h1>
            </div>

            <p className="mb-4 text-[14px] font-semibold text-black sm:text-[18px]">
              Me @Username
            </p>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-5">
              <div className="lg:col-span-2">
                <InputField
                  label="E mail ID"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  readOnly={Boolean(email)}
                  autoComplete="email"
                />
              </div>

              <div>
                <SelectField
                  label="Gender"
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  options={GENDER_OPTIONS}
                  placeholder="Select"
                />
              </div>

              <div>
                <InputField
                  label="DOB"
                  name="dob"
                  type="date"
                  value={form.dob}
                  onChange={handleChange}
                />
              </div>

              <div className="lg:col-span-2">
                <SelectField
                  label="Primary travel purpose"
                  name="primary_travel_purpose"
                  value={form.primary_travel_purpose}
                  onChange={handleChange}
                  options={PURPOSE_OPTIONS}
                  placeholder="Select"
                />
              </div>

              <div>
                <SelectField
                  label="How often do you travel?"
                  name="travel_frequency"
                  value={form.travel_frequency}
                  onChange={handleChange}
                  options={FREQUENCY_OPTIONS}
                  placeholder="Select"
                />
              </div>

              <div>
                <SelectField
                  label="When do you usually travel?"
                  name="usual_travel_time"
                  value={form.usual_travel_time}
                  onChange={handleChange}
                  options={TIME_OPTIONS}
                  placeholder="Select"
                />
              </div>

              <div className="lg:col-span-2">
                <SelectField
                  label="Do you travel on the same route daily?"
                  name="same_route_daily"
                  value={form.same_route_daily}
                  onChange={handleChange}
                  options={ROUTINE_OPTIONS}
                  placeholder="Select"
                />
              </div>

              <div>
                <SelectField
                  label="City"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  options={cityOptions}
                  placeholder="Select"
                />
              </div>

              <div>
                <SelectField
                  label="State"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  options={STATE_OPTIONS}
                  placeholder="Select"
                />
              </div>

              <div>
                <InputField
                  label="First Name"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  autoComplete="given-name"
                />
              </div>

              <div>
                <InputField
                  label="Last Name"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  autoComplete="family-name"
                />
              </div>

              <div>
                <InputField
                  label="Phone Number"
                  name="phone_number"
                  value={form.phone_number}
                  onChange={handleChange}
                  type="tel"
                  autoComplete="tel"
                  maxLength={15}
                />
              </div>

              <div>
                <InputField
                  label="Password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {trimmedPassword && trimmedPassword.length < 6 && (
              <p className="mt-4 text-center text-sm font-medium text-amber-600">
                Password must be at least 6 characters.
              </p>
            )}

            {error && (
              <p className="mt-3 text-center text-sm font-medium text-red-500">
                {error}
              </p>
            )}
          </div>

          <div className="bg-[#d5d5d5] px-3 py-4 sm:px-8 sm:py-5 lg:px-10">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || loading}
              className="mx-auto flex h-[42px] w-[110px] items-center justify-center rounded-[10px] bg-[#9f9f9f] text-[14px] font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70 sm:h-[48px] sm:w-[130px] sm:rounded-[12px] sm:text-[15px]"
            >
              {loading ? "Saving..." : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}