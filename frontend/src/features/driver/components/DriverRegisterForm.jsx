import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronDown } from "lucide-react";

const GENDER_OPTIONS = ["Female", "Male"];
const DRIVING_EXP_OPTIONS = [
  "0-3 years",
  "3-5 years",
  "5-8 years",
  "Master Driver 10+",
];
const VEHICLE_TYPE_OPTIONS = [
  { value: "bus", label: "Transit Bus" },
  { value: "minibus", label: "Minibus" },
  { value: "van", label: "Shuttle Van" },
  { value: "auto", label: "Auto-Rickshaw" },
  { value: "tempo", label: "Tempo Traveller" },
  { value: "car", label: "Car" },
];

function FieldLabel({ children }) {
  return (
    <label className="block text-[11px] sm:text-[12px] font-semibold text-black">
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
        className="h-11 sm:h-[50px] w-full rounded-[12px] border-0 bg-[#a6a6a6] px-4 text-[14px] sm:text-[15px] font-medium text-black outline-none placeholder:text-black/55"
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
  gold = false,
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>

      <div className="relative">
        <select
          name={name}
          value={value}
          onChange={onChange}
          className={`h-11 sm:h-[50px] w-full appearance-none rounded-[12px] border-0 px-4 pr-10 text-[14px] sm:text-[15px] font-medium outline-none ${
            gold ? "bg-[#b89d10] text-black" : "bg-[#a6a6a6] text-black"
          }`}
        >
          <option value="" disabled>
            {placeholder}
          </option>

          {options.map((option) => {
            const optionValue =
              typeof option === "string" ? option : option.value;
            const optionLabel =
              typeof option === "string" ? option : option.label;

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

function UploadField({ label, fileName, onChange }) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>

      <label className="flex h-[62px] sm:h-[76px] w-full cursor-pointer items-center rounded-[12px] bg-[#a6a6a6] px-4">
        <input type="file" className="hidden" onChange={onChange} />
        <span className="truncate text-[14px] sm:text-[15px] font-medium text-black/60">
          {fileName || "Choose file"}
        </span>
      </label>
    </div>
  );
}

export default function DriverRegister({
  email = "",
  onBack,
  onSubmit,
  loading = false,
  error = "",
}) {
  const [form, setForm] = useState({
    email,
    first_name: "",
    last_name: "",
    phone_number: "",
    password: "",
    vehicle_no: "",
    vehicle_type: "",
    gender: "",
    driving_experience: "",
    dob: "",
    license_number: "",
    dl_file: null,
  });

  const canSubmit = useMemo(() => {
    return (
      form.vehicle_no &&
      form.vehicle_type &&
      form.gender &&
      form.driving_experience &&
      form.dob &&
      form.license_number
    );
  }, [form]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setForm((prev) => ({
      ...prev,
      dl_file: file,
    }));
  };

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    await onSubmit?.(form);
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

              <h1 className="text-[16px] sm:text-[24px] font-semibold text-black">
                Register
              </h1>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-5">
              <div className="lg:col-span-2">
                <InputField
                  label="Enter Vehicle NO"
                  name="vehicle_no"
                  value={form.vehicle_no}
                  onChange={handleChange}
                />
              </div>

              <div className="lg:col-span-2">
                <SelectField
                  label="Choose Vehicle Type"
                  name="vehicle_type"
                  value={form.vehicle_type}
                  onChange={handleChange}
                  options={VEHICLE_TYPE_OPTIONS}
                  placeholder="Select"
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
                  gold
                />
              </div>

              <div>
                <SelectField
                  label="Driving Exp"
                  name="driving_experience"
                  value={form.driving_experience}
                  onChange={handleChange}
                  options={DRIVING_EXP_OPTIONS}
                  placeholder="Select"
                  gold
                />
              </div>

              <div className="lg:col-span-2">
                <InputField
                  label="DOB"
                  name="dob"
                  type="date"
                  value={form.dob}
                  onChange={handleChange}
                />
              </div>

              <div className="lg:col-span-2">
                <UploadField
                  label="Upload your DL"
                  fileName={form.dl_file?.name}
                  onChange={handleFileChange}
                />
              </div>

              <div>
                <InputField
                  label="License No"
                  name="license_number"
                  value={form.license_number}
                  onChange={handleChange}
                />
              </div>

              <div>
                <InputField
                  label="E mail ID"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  readOnly={!!email}
                />
              </div>

              <div>
                <InputField
                  label="First Name"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                />
              </div>

              <div>
                <InputField
                  label="Last Name"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                />
              </div>

              <div>
                <InputField
                  label="Phone Number"
                  name="phone_number"
                  value={form.phone_number}
                  onChange={handleChange}
                />
              </div>

              <div>
                <InputField
                  label="Password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                />
              </div>
            </div>

            {error && (
              <p className="mt-4 text-center text-sm font-medium text-red-500">
                {error}
              </p>
            )}
          </div>

          <div className="bg-[#d5d5d5] px-3 py-4 sm:px-8 sm:py-5 lg:px-10">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || loading}
              className="mx-auto flex h-[42px] w-[92px] items-center justify-center rounded-[10px] bg-[#9f9f9f] text-[14px] font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70 sm:h-[48px] sm:w-[120px] sm:rounded-[12px] sm:text-[15px]"
            >
              {loading ? "..." : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}