import { API_URL } from "../../constants";

const trimTrailingSlash = (value) => value.replace(/\/+$/, "");

export const getWsUrl = (path) => {
  const baseUrl = trimTrailingSlash(API_URL);
  const wsProtocol = baseUrl.startsWith("https") ? "wss" : "ws";
  const wsHost = baseUrl.replace(/^https?:\/\//, "");

  return `${wsProtocol}://${wsHost}${path}`;
};

export default getWsUrl;
