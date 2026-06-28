import Constants from "expo-constants";
import { DEFAULT_API_URL } from "../../constants";

const trimTrailingSlash = (value) => value.replace(/\/+$/, "");

export const getWsUrl = (path) => {
  const getBaseUrl = () => {
    const envUrl = process.env.EXPO_PUBLIC_API_URL;
    if (envUrl && envUrl.trim().length > 0) return envUrl;

    const extraUrl = Constants.expoConfig?.extra?.apiUrl;
    if (extraUrl && extraUrl.trim().length > 0) return extraUrl;

    return DEFAULT_API_URL;
  };

  const baseUrl = trimTrailingSlash(getBaseUrl());
  const wsProtocol = baseUrl.startsWith("https") ? "wss" : "ws";
  const wsHost = baseUrl.replace(/^https?:\/\//, "");

  return `${wsProtocol}://${wsHost}${path}`;
};

export default getWsUrl;
