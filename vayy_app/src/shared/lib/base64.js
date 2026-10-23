import * as FileSystem from "expo-file-system/legacy";

/**
 * Convert a file URI (from expo-image-picker) to a base64 data string.
 * Returns null if conversion fails.
 */
export async function uriToBase64(uri) {
  if (!uri) return null;
  try {
    return await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
  } catch (err) {
    console.warn("[uriToBase64] FAILED:", uri?.substring(0, 80), err?.message);
    return null;
  }
}

/**
 * Convert a file URI to a base64 string with MIME prefix.
 * Returns "data:image/jpeg;base64,..." ready for API upload.
 */
export async function uriToBase64Data(uri, mime = "image/jpeg") {
  const base64 = await uriToBase64(uri);
  if (!base64) return null;
  return `data:${mime};base64,${base64}`;
}
