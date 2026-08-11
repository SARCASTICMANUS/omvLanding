export default ({ config }) => ({
  ...config,
  plugins: [
    ...config.plugins,
    ["expo-build-properties", { android: { usesCleartextTraffic: true } }],
  ],
  extra: {
    ...config.extra,
    apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000",
  },
});
