const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const { resolve } = require("metro-resolver");

const config = getDefaultConfig(__dirname);

// Use a robust resolution strategy for web shims
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web") {
    // Avoid shimming imports coming from our shims to prevent infinite loops
    const shimDir = path.resolve(__dirname, "src/lib");
    const isInternalImport = context.originModulePath.startsWith(shimDir);

    if (!isInternalImport) {
      // Handle main package entry points
      if (
        moduleName === "react-native" ||
        moduleName === "react-native-web" ||
        moduleName === "react-native-web/dist/index" ||
        moduleName === "react-native-web/dist/cjs/index"
      ) {
        return {
          filePath: path.resolve(__dirname, "src/lib/react-native-web-shim.js"),
          type: "sourceFile",
        };
      }

      // Handle internal utility imports
      if (moduleName.includes("codegenNativeComponent")) {
        return {
          filePath: path.resolve(__dirname, "src/lib/codegenNativeComponent-shim.js"),
          type: "sourceFile",
        };
      }
      if (moduleName.includes("codegenNativeCommands")) {
        return {
          filePath: path.resolve(__dirname, "src/lib/codegenNativeCommands-shim.js"),
          type: "sourceFile",
        };
      }
    }
  }

  // Fallback to the default resolver using metro-resolver
  return resolve(context, moduleName, platform);
};

module.exports = config;
