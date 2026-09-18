import * as FileSystem from "expo-file-system";

/**
 * Convert a file URI (from expo-image-picker) to a base64 data string.
 * Returns null if conversion fails.
 */
export async function uriToBase64(uri) {
  if (!uri) return null;
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch {
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
