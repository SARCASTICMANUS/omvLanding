import * as ReactNativeWeb from "react-native-web";

// Extract original components/APIs
const { UIManager: OriginalUIManager, ...OtherAPIs } = ReactNativeWeb;

/**
 * Enhanced UIManager shim for web.
 * Adds missing native methods to prevent library crashes.
 */
export const UIManager = {
  ...OriginalUIManager,
  hasViewManagerConfig: (name) => {
    return false; // No native view managers on web
  },
  getViewManagerConfig: (name) => {
    return null;
  },
};

/**
 * Native component registration shims.
 */
export const requireNativeComponent = (name) => {
  return () => null;
};

export const codegenNativeComponent = () => {
  return () => null;
};

export const codegenNativeCommands = (options) => {
  return options;
};

// Re-export standard APIs
export const {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Appearance,
  AppRegistry,
  AppState,
  BackHandler,
  Button,
  CheckBox,
  Clipboard,
  Dimensions,
  Easing,
  FlatList,
  I18nManager,
  Image,
  ImageBackground,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Linking,
  LogBox,
  Modal,
  NativeEventEmitter,
  NativeModules,
  PanResponder,
  Picker,
  PixelRatio,
  Platform,
  Pressable,
  ProgressBar,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  SectionList,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  Touchable,
  TouchableHighlight,
  TouchableNativeFeedback,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  VirtualizedList,
  YellowBox,
  findNodeHandle,
  processColor,
  render,
  unmountComponentAtNode,
  useColorScheme,
  useLocaleContext,
  useWindowDimensions,
} = OtherAPIs;

// Default export combining all shims and APIs
const ReactNativeShim = {
  ...OtherAPIs,
  UIManager,
  requireNativeComponent,
  codegenNativeComponent,
  codegenNativeCommands,
};

export default ReactNativeShim;
