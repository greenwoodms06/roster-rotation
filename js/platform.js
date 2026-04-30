/**
 * platform.js — Runtime gate for features that behave differently
 * (or must be hidden) when the app is running inside a Capacitor WebView
 * vs. the PWA. PWA behavior is the default; native flips the flag.
 *
 * Store-sensitive UI (donate links, popup-window print) is hidden on native.
 */
const Platform = {
  isNative() { return !!window.Capacitor?.isNativePlatform?.(); },
  isWeb()    { return !Platform.isNative(); },
};
