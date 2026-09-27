// Password + field validation rules mirrored from
// vayy_app/src/auth/utils/validators.js so both clients show the same copy.

export const PASSWORD_RULES = [
  {
    key: "length",
    label: "At least 8 characters",
    test: (value) => value.length >= 8,
  },
  {
    key: "uppercase",
    label: "One uppercase letter",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    key: "lowercase",
    label: "One lowercase letter",
    test: (value) => /[a-z]/.test(value),
  },
  {
    key: "number",
    label: "One number",
    test: (value) => /\d/.test(value),
  },
  {
    key: "special",
    label: "One special character",
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
];

export const VALIDATORS = {
  email: (value) => /^\S+@\S+\.\S+$/.test(value),
  fullName: (value) => /^[A-Za-z\s]{3,50}$/.test(value),
  minLength: (value, length = 8) => value.length >= length,
  mobile: (value) => /^[6-9]\d{9}$/.test(String(value || "").replace(/\s/g, "")),
  vehicleNumber: (value) =>
    /^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,2}\s?\d{1,4}$/.test(
      String(value || "").toUpperCase().trim(),
    ),
};

export const VALIDATION_MESSAGES = {
  fullName: "Enter at least 3 letters",
  mobile: "Enter a valid 10-digit mobile number",
  vehicleNumber: "Enter valid Indian format (e.g., UP32AB1234)",
};

export const isValidEmail = (value) => VALIDATORS.email(value);
