export const VALIDATORS = {
  fullName: (v) => /^[A-Za-z\s]{3,50}$/.test(v?.trim()),
  mobile: (v) => /^[6-9]\d{9}$/.test(v?.replace(/\s/g, "")),
  email: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v?.trim()),
  password: (v) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(v),
  vehicleNumber: (v) => /^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,2}\s?\d{1,4}$/.test(v?.toUpperCase().trim()),
  dl: (v) => /^[A-Z]{2}\d{2}\s?\d{4}\s?\d{7}$/.test(v?.toUpperCase().trim()),
  aadhaar: (v) => /^\d{12}$/.test(v?.replace(/\s/g, "")),
  ifsc: (v) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v?.toUpperCase().trim()),
  upi: (v) => !v || /^[\w.-]+@[\w]+$/.test(v?.trim()),
  accountNumber: (v) => /^\d{9,18}$/.test(v?.replace(/\s/g, "")),
};

export const PASSWORD_RULES = [
  { key: "length", label: "8 characters minimum", test: (v) => v.length >= 8 },
  { key: "upper", label: "One uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { key: "lower", label: "One lowercase letter", test: (v) => /[a-z]/.test(v) },
  { key: "number", label: "One number", test: (v) => /\d/.test(v) },
  { key: "special", label: "One special character", test: (v) => /[@$!%*?&]/.test(v) },
];

export const PASSWORD_STRENGTH = (v) => {
  let score = 0;
  if (v.length >= 8) score++;
  if (v.length >= 12) score++;
  if (/[A-Z]/.test(v)) score++;
  if (/[a-z]/.test(v)) score++;
  if (/\d/.test(v)) score++;
  if (/[@$!%*?&]/.test(v)) score++;
  if (/[^A-Za-z0-9@$!%*?&]/.test(v)) score++;
  if (score <= 2) return { label: "Weak", color: "#ef4444", width: "25%" };
  if (score <= 4) return { label: "Fair", color: "#f59e0b", width: "50%" };
  if (score <= 6) return { label: "Strong", color: "#009849", width: "75%" };
  return { label: "Very Strong", color: "#00E676", width: "100%" };
};

export const VALIDATION_MESSAGES = {
  fullName: "Enter at least 3 letters",
  mobile: "Enter a valid 10-digit mobile number",
  email: "Enter a valid email address",
  password: "Password doesn't meet requirements",
  confirmPassword: "Passwords do not match",
  vehicleNumber: "Enter valid Indian format (e.g., UP32AB1234)",
  dl: "Enter valid DL format (e.g., UP1420240001234)",
  aadhaar: "Enter valid 12-digit Aadhaar number",
  ifsc: "Enter valid IFSC code (e.g., SBIN0001234)",
  accountNumber: "Enter valid account number (9-18 digits)",
};
