import React, { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronDown,
  Sun,
  Globe,
  Upload,
  Calendar,
  User,
} from "lucide-react";

/* ── Constants (unchanged from original) ── */
const GENDER_OPTIONS = ["Female", "Male"];
const DRIVING_EXP_OPTIONS = [
  "0-3 years",
  "3-5 years",
  "5-8 years",
  "Master Driver 10+",
];
const VEHICLE_TYPE_OPTIONS = [
  { value: "bike",   label: "Bike" },
  { value: "auto",   label: "Auto-Rickshaw" },
];

/* ── Design tokens ── */
const green      = "#16a34a";
const borderCol  = "#e2e8f0";
const inputBg    = "#ffffff";
const labelColor = "#0f172a";
const placeholderColor = "#94a3b8";
const fieldBorder = "1.5px solid #e2e8f0";
const fieldRadius = 10;
const fieldHeight = 50;

/* ─────────────────────────────────────────
   SVG DECORATIONS (matching reference)
───────────────────────────────────────── */
function DecoLeft() {
  return (
    <svg width="160" height="260" viewBox="0 0 160 260" fill="none" style={{ display: "block" }}>
      {/* Large quarter-circle */}
      <circle cx="0" cy="200" r="155" fill="#dcfce7" opacity=".55" />
      {/* Small circle overlap */}
      <circle cx="30" cy="260" r="60" fill="#bbf7d0" opacity=".4" />
    </svg>
  );
}

function DecoRight() {
  return (
    <svg width="180" height="320" viewBox="0 0 180 320" fill="none" style={{ display: "block" }}>
      {/* Large quarter-circle */}
      <circle cx="180" cy="50" r="155" fill="#dcfce7" opacity=".5" />
      {/* Building silhouettes */}
      <rect x="100" y="120" width="28" height="200" rx="3" fill="#bbf7d0" opacity=".55" />
      <rect x="130" y="90"  width="22" height="230" rx="3" fill="#a7f3d0" opacity=".45" />
      <rect x="154" y="140" width="26" height="180" rx="3" fill="#bbf7d0" opacity=".5" />
      {/* Windows */}
      <rect x="106" y="130" width="6" height="7" rx="1" fill="#f0fdf4" opacity=".8" />
      <rect x="116" y="130" width="6" height="7" rx="1" fill="#f0fdf4" opacity=".8" />
      <rect x="106" y="148" width="6" height="7" rx="1" fill="#f0fdf4" opacity=".8" />
      <rect x="116" y="148" width="6" height="7" rx="1" fill="#f0fdf4" opacity=".8" />
      <rect x="136" y="100" width="5" height="6" rx="1" fill="#f0fdf4" opacity=".8" />
      <rect x="143" y="100" width="5" height="6" rx="1" fill="#f0fdf4" opacity=".8" />
      <rect x="136" y="114" width="5" height="6" rx="1" fill="#f0fdf4" opacity=".8" />
      <rect x="143" y="114" width="5" height="6" rx="1" fill="#f0fdf4" opacity=".8" />
    </svg>
  );
}

/* OMV mark */
function OmvLogo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="8" fill="#16A34A" />
      <text x="18" y="25" textAnchor="middle" fill="white" fontSize="21" fontWeight="900">O</text>
    </svg>
  );
}

/* ─────────────────────────────────────────
   FIELD COMPONENTS
───────────────────────────────────────── */
function FieldLabel({ children, required }) {
  return (
    <label
      className="block text-[13px] font-semibold mb-2"
      style={{ color: labelColor }}
    >
      {children}
      {required && (
        <span style={{ color: green, marginLeft: 3 }}>*</span>
      )}
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
  required = false,
}) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        style={{
          height: fieldHeight,
          width: "100%",
          border: fieldBorder,
          borderRadius: fieldRadius,
          background: inputBg,
          padding: "0 16px",
          fontSize: 14,
          color: labelColor,
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.15s",
        }}
        onFocus={e => (e.target.style.borderColor = green)}
        onBlur={e  => (e.target.style.borderColor = "#e2e8f0")}
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
  required = false,
}) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <div style={{ position: "relative" }}>
        <select
          name={name}
          value={value}
          onChange={onChange}
          style={{
            height: fieldHeight,
            width: "100%",
            appearance: "none",
            border: fieldBorder,
            borderRadius: fieldRadius,
            background: inputBg,
            padding: "0 40px 0 16px",
            fontSize: 14,
            color: value ? labelColor : placeholderColor,
            outline: "none",
            cursor: "pointer",
            boxSizing: "border-box",
            transition: "border-color 0.15s",
          }}
          onFocus={e => (e.target.style.borderColor = green)}
          onBlur={e  => (e.target.style.borderColor = "#e2e8f0")}
        >
          <option value="" disabled style={{ color: placeholderColor }}>
            {placeholder}
          </option>
          {options.map((option) => {
            const optionValue = typeof option === "string" ? option : option.value;
            const optionLabel = typeof option === "string" ? option : option.label;
            return (
              <option key={optionValue} value={optionValue} style={{ color: labelColor }}>
                {optionLabel}
              </option>
            );
          })}
        </select>
        <ChevronDown
          size={18}
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            color: "#64748b",
          }}
        />
      </div>
    </div>
  );
}

function DateField({ label, name, value, onChange, required = false }) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <div style={{ position: "relative" }}>
        <input
          type="date"
          name={name}
          value={value}
          onChange={onChange}
          placeholder="Select date of birth"
          style={{
            height: fieldHeight,
            width: "100%",
            border: fieldBorder,
            borderRadius: fieldRadius,
            background: inputBg,
            padding: "0 40px 0 16px",
            fontSize: 14,
            color: value ? labelColor : placeholderColor,
            outline: "none",
            boxSizing: "border-box",
            cursor: "pointer",
            transition: "border-color 0.15s",
          }}
          onFocus={e => (e.target.style.borderColor = green)}
          onBlur={e  => (e.target.style.borderColor = "#e2e8f0")}
        />
        <Calendar
          size={17}
          style={{
            position: "absolute",
            right: 13,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            color: "#64748b",
          }}
        />
      </div>
    </div>
  );
}

function UploadField({ label, fileName, onChange, required = false }) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <label
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          minHeight: 120,
          border: `1.5px dashed ${green}`,
          borderRadius: 12,
          background: "#f0fdf4",
          cursor: "pointer",
          transition: "background 0.15s",
          boxSizing: "border-box",
          padding: "20px 16px",
        }}
      >
        <input type="file" style={{ display: "none" }} onChange={onChange} />
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "#dcfce7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Upload size={20} color={green} strokeWidth={2} />
        </div>
        {fileName ? (
          <span style={{ fontSize: 13, color: green, fontWeight: 600 }}>
            {fileName}
          </span>
        ) : (
          <>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
              Click to upload your Driving License
            </span>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              PNG, JPG or PDF (Max. 5MB)
            </span>
          </>
        )}
      </label>
    </div>
  );
}

/* ─────────────────────────────────────────
   MAIN COMPONENT — all props/state/logic
   100% identical to original
───────────────────────────────────────── */
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
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setForm((prev) => ({ ...prev, dl_file: file }));
  };

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    await onSubmit?.(form);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "inherit",
      }}
    >

      {/* ══════════ NAVBAR ══════════ */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          height: 64,
          background: "white",
          borderBottom: `1px solid ${borderCol}`,
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <OmvLogo size={30} />
          <span
            style={{
              fontWeight: 900,
              fontSize: 17,
              letterSpacing: "0.18em",
              color: "#0f172a",
            }}
          >
            OMV
          </span>
        </div>

        {/* Right controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            style={{
              padding: 8,
              border: "none",
              background: "none",
              cursor: "pointer",
              color: "#64748b",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
            }}
          >
            <Sun size={18} strokeWidth={2} />
          </button>
          <div style={{ width: 1, height: 20, background: borderCol }} />
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              border: `1px solid ${borderCol}`,
              borderRadius: 8,
              background: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              color: "#64748b",
            }}
          >
            <Globe size={14} />
            <span>English</span>
            <ChevronDown size={13} />
          </button>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: `1.5px solid ${borderCol}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#94a3b8",
            }}
          >
            <User size={18} />
          </div>
        </div>
      </nav>

      {/* ══════════ PAGE BODY ══════════ */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "28px 16px 48px",
        }}
      >
        {/* Card with relative positioning for decorations */}
        <div
          style={{
            position: "relative",
            background: "white",
            borderRadius: 20,
            boxShadow: "0 4px 32px rgba(0,0,0,0.07)",
            overflow: "hidden",
          }}
        >
          {/* ── Left decoration ── */}
          <div
            style={{
              position: "absolute",
              left: 0,
              bottom: 0,
              zIndex: 0,
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            <DecoLeft />
          </div>

          {/* ── Right decoration ── */}
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              zIndex: 0,
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            <DecoRight />
          </div>

          {/* ── Form area ── */}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              padding: "36px 40px 32px",
            }}
            className="sm:px-10 px-5"
          >
            {/* Header row */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 20,
                marginBottom: 32,
              }}
            >
              {/* Back button */}
              <button
                type="button"
                onClick={onBack}
                aria-label="Go back"
                style={{
                  flexShrink: 0,
                  width: 44,
                  height: 44,
                  border: `1.5px solid ${borderCol}`,
                  borderRadius: 10,
                  background: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#0f172a",
                  marginTop: 2,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                }}
              >
                <ChevronLeft size={20} strokeWidth={2.5} />
              </button>

              {/* Title block */}
              <div>
                <h1
                  style={{
                    fontSize: "clamp(20px, 2.5vw, 28px)",
                    fontWeight: 800,
                    color: "#0f172a",
                    letterSpacing: "-0.02em",
                    marginBottom: 4,
                  }}
                >
                  Driver Onboarding
                </h1>
                <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                  Fill in your details to get started
                </p>
              </div>
            </div>

            {/* ── FORM FIELDS ── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "20px 24px",
                maxWidth: 860,
              }}
            >
              {/* Row 1: First Name | Last Name */}
              <InputField
                label="First Name"
                name="first_name"
                value={form.first_name}
                onChange={handleChange}
                placeholder="Enter first name"
                required
              />
              <InputField
                label="Last Name"
                name="last_name"
                value={form.last_name}
                onChange={handleChange}
                placeholder="Enter last name"
                required
              />

              {/* Row 2: Vehicle No (full width) */}
              <div style={{ gridColumn: "1 / -1" }}>
                <InputField
                  label="Enter Vehicle No"
                  name="vehicle_no"
                  value={form.vehicle_no}
                  onChange={handleChange}
                  placeholder="Enter vehicle number (e.g. UP32DC0003)"
                  required
                />
              </div>

              {/* Row 3: Vehicle Type (full width) */}
              <div style={{ gridColumn: "1 / -1" }}>
                <SelectField
                  label="Choose Vehicle Type"
                  name="vehicle_type"
                  value={form.vehicle_type}
                  onChange={handleChange}
                  options={VEHICLE_TYPE_OPTIONS}
                  placeholder="Select vehicle type"
                  required
                />
              </div>

              {/* Row 4: Gender | DOB | Driving Exp (3-col on large) */}
              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "0 24px",
                }}
                className="three-col-grid"
              >
                <SelectField
                  label="Gender"
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  options={GENDER_OPTIONS}
                  placeholder="Select gender"
                  required
                />
                <DateField
                  label="DOB"
                  name="dob"
                  value={form.dob}
                  onChange={handleChange}
                  required
                />
                <SelectField
                  label="Driving Exp"
                  name="driving_experience"
                  value={form.driving_experience}
                  onChange={handleChange}
                  options={DRIVING_EXP_OPTIONS}
                  placeholder="Select driving experience"
                  required
                />
              </div>

              {/* Row 5: Upload DL (full width) */}
              <div style={{ gridColumn: "1 / -1" }}>
                <UploadField
                  label="Upload Your Driving License"
                  fileName={form.dl_file?.name}
                  onChange={handleFileChange}
                  required
                />
              </div>

              {/* Row 6: License No | Email */}
              <InputField
                label="License No"
                name="license_number"
                value={form.license_number}
                onChange={handleChange}
                placeholder="Enter license number"
                required
              />
              <InputField
                label="E-mail ID"
                name="email"
                value={form.email}
                onChange={handleChange}
                readOnly={!!email}
                placeholder="Enter email address"
              />

              {/* Row 7: Phone | Password */}
              <InputField
                label="Phone Number"
                name="phone_number"
                value={form.phone_number}
                onChange={handleChange}
                placeholder="Enter phone number"
              />
              <InputField
                label="Password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Create a password"
              />
            </div>

            {/* Error message */}
            {error && (
              <p
                style={{
                  marginTop: 16,
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#ef4444",
                }}
              >
                {error}
              </p>
            )}

            {/* ── SUBMIT BUTTON ── */}
            <div style={{ maxWidth: 860, marginTop: 28 }}>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || loading}
                style={{
                  width: "100%",
                  height: 52,
                  borderRadius: 12,
                  border: "none",
                  background:
                    canSubmit && !loading
                      ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
                      : "#e2e8f0",
                  color: canSubmit && !loading ? "white" : "#94a3b8",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: canSubmit && !loading ? "pointer" : "not-allowed",
                  boxShadow:
                    canSubmit && !loading
                      ? "0 4px 18px rgba(22,163,74,0.28)"
                      : "none",
                  transition: "all 0.2s",
                  letterSpacing: "0.01em",
                }}
              >
                {loading ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive 3-col → 1-col on mobile */}
      <style>{`
        @media (max-width: 700px) {
          .three-col-grid {
            grid-template-columns: 1fr !important;
            gap: 20px 0 !important;
          }
        }
        @media (max-width: 600px) {
          div[style*="grid-template-columns: repeat(2, 1fr)"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
