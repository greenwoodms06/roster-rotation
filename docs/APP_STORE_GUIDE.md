# App Store Distribution Guide

## Recommendation Summary

**Google Play: Use Bubblewrap (TWA)** -- zero code changes, free, ships in an afternoon.
**Apple App Store: Skip for now** -- the effort/benefit ratio is poor for a coaching tool with one primary user.

---

## Option Comparison

### 1. Bubblewrap (Google's TWA CLI) -- RECOMMENDED for Play Store

Bubblewrap is Google's official CLI for wrapping PWAs into Trusted Web Activities. A TWA runs your PWA in Chrome's rendering engine with no visible browser UI -- it looks and behaves like a native app, but it IS your PWA. Google explicitly endorses this path.

**Pros:**
- Zero code changes to the existing PWA
- Tiny APK (~2 MB wrapper, no bundled WebView)
- Full access to service worker, offline caching, Web APIs -- everything works as-is
- Automatic updates: the TWA always loads the latest version from GitHub Pages
- Digital Asset Links verification proves you own the domain
- Free tooling, well-documented

**Cons:**
- Requires Chrome on the device (pre-installed on all Pixels, 95%+ of Android)
- No access to native APIs beyond what Chrome exposes (not an issue for this app)
- If Chrome is disabled or missing, falls back to a Custom Tab (still works, shows minimal browser UI)

**Setup effort:** ~2 hours for first build, ~15 minutes for updates.

**Steps:**
1. `npm i -g @aspect/aspect/bubblewrap` (or `npx @aspect/aspect/bubblewrap`)
2. `bubblewrap init --manifest=https://<user>.github.io/roster-rotation/manifest.json`
3. Configure signing key, app name, icons (512x512 + 192x192 already in manifest)
4. `bubblewrap build` -- produces an APK and AAB
5. Upload AAB to Google Play Console
6. Add `.well-known/assetlinks.json` to the GitHub Pages repo (proves domain ownership)

### 2. PWABuilder -- GOOD ALTERNATIVE for Play Store

Microsoft's PWABuilder is a web UI that does what Bubblewrap does but with a point-and-click wizard. Under the hood it generates a TWA using the same approach.

**Pros:**
- No CLI required -- upload manifest URL, click through wizard, download APK/AAB
- Handles icon generation, splash screens, signing
- Also generates Windows (MSIX) and iOS packages if desired
- Good for non-developers

**Cons:**
- Less control than Bubblewrap CLI
- The iOS output is a WKWebView wrapper, not a TWA (see Apple section below)
- Generated projects can be harder to customize if something goes wrong

**Setup effort:** ~1 hour via https://pwabuilder.com

### 3. Capacitor (Ionic) -- OVERKILL for this project

Capacitor wraps your web app in a native WebView and gives access to native device APIs via plugins. It's the right choice when you need camera, push notifications, Bluetooth, etc.

**Pros:**
- Access to native APIs (camera, filesystem, push notifications, haptics)
- Single codebase for Android + iOS
- Active ecosystem, good documentation

**Cons:**
- Adds a build toolchain (Node, Gradle, Xcode for iOS)
- Bundles the app's HTML/JS/CSS inside the APK -- you lose automatic updates from GitHub Pages
- Requires rebuilding and re-publishing for every code change
- Overkill: this app uses zero native APIs
- APK size larger than TWA (~5-15 MB vs ~2 MB)

**When to choose this:** Only if you later need native features like push notifications for game reminders, or haptic feedback on generate.

### 4. React Native / Flutter -- WRONG TOOL

Rewriting in a native framework would mean starting over. Not appropriate for an app that's already working well as a PWA.

---

## Google Play Store: Step-by-Step

### Prerequisites
- Google Play Developer account ($25 one-time fee)
- Java/JDK 11+ installed (for APK signing)
- Node.js installed (for Bubblewrap)

### Manifest.json Readiness

The current `manifest.json` is **almost sufficient**. Required changes:

```json
{
  "name": "Rotations - Lineup Manager",
  "short_name": "Rotations",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#0f1923",
  "theme_color": "#0f1923",
  "orientation": "portrait",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "screenshots": [
    { "src": "screenshots/roster.png", "sizes": "1080x1920", "type": "image/png" },
    { "src": "screenshots/lineup.png", "sizes": "1080x1920", "type": "image/png" }
  ]
}
```

**What needs to change:**
1. Add `icons/` folder with 192x192 and 512x512 PNG icons (currently the manifest references icons but they may not exist as files)
2. Add `screenshots/` for Play Store listing (at least 2, phone-sized)
3. Add `"orientation": "portrait"` (already implied by mobile-first design)
4. Ensure `purpose: "any maskable"` on icons for adaptive icon support

### Service Worker Readiness

The current service worker is **sufficient**. It caches the app shell and allows offline use, which is a Play Store requirement for TWAs. No changes needed.

### Digital Asset Links

After uploading to Play Store, add this file to the repo root:

`.well-known/assetlinks.json`

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.yourname.rotations",
    "sha256_cert_fingerprints": ["<YOUR_SIGNING_KEY_FINGERPRINT>"]
  }
}]
```

This proves to Chrome that your Play Store app owns the GitHub Pages domain, enabling full-screen TWA mode (no browser bar).

**GitHub Pages note:** `.well-known` is a dot-directory. GitHub Pages ignores dot-files by default. Add a `_config.yml` with `include: [".well-known"]` to fix this.

### Store Listing Requirements

- **App title:** 30 characters max
- **Short description:** 80 characters max
- **Full description:** 4000 characters max
- **Screenshots:** 2-8 phone screenshots (1080x1920 or similar)
- **Feature graphic:** 1024x500 PNG
- **Privacy policy URL:** Required. Can be a simple page on GitHub Pages stating "no data is collected; all data stays on your device."
- **Content rating:** Complete the IARC questionnaire (takes 5 minutes, will rate E for Everyone)
- **Target audience:** Not directed at children (coaching tool for adults)

### Signing & Release

- Generate a keystore: `keytool -genkey -v -keystore rotations.keystore -alias rotations -keyalg RSA -keysize 2048 -validity 10000`
- **Keep this keystore safe.** Losing it means you can never update the app.
- Build AAB with Bubblewrap, upload to Play Console
- Use Play App Signing (recommended) -- Google manages the release key, you keep the upload key

### Ongoing Maintenance

- **Updates are automatic.** The TWA loads from GitHub Pages, so pushing to `main` updates the app for all users immediately.
- **No AAB rebuild needed** unless you change the manifest, icons, or TWA configuration.
- Play Store requires you to target the latest Android API level annually (usually just a Bubblewrap version bump + rebuild).
- Respond to any policy compliance emails from Google (rare for simple apps).

---

## Apple App Store: Analysis

### Why It's Not Worth It (Yet)

1. **Apple Developer Program costs $99/year** (vs Google's one-time $25)
2. **No TWA equivalent on iOS.** Safari supports PWAs on the home screen but Apple doesn't allow TWAs in the App Store. You'd need a WKWebView wrapper (Capacitor or PWABuilder's iOS output).
3. **WKWebView limitations on iOS:**
   - No service worker support inside WKWebView (breaks offline capability)
   - No `localStorage` persistence guarantee (iOS may evict after 7 days of non-use)
   - Push notifications require native code
4. **App Review is strict.** Apple frequently rejects "web wrapper" apps with: *"Your app is essentially a web page repackaged as an app. We encourage you to submit your content to Safari as a website."*
5. **Xcode + macOS required** for building (you'd need access to a Mac)

### If You Want To Proceed Anyway

The most viable path would be Capacitor:
1. `npm init @capacitor/app`
2. Copy the web files into `www/`
3. `npx cap add ios`
4. Implement a native offline cache to replace the service worker
5. Build in Xcode, submit to App Store

**Estimated effort:** 1-2 days of setup + debugging iOS quirks, plus $99/year.

**Recommendation:** The PWA already works perfectly when added to the home screen on iOS Safari. Tell parents/coaches to use "Add to Home Screen" and save the $99/year and ongoing maintenance burden.

---

## Action Plan

### Phase 1: Google Play (do this)
1. Create app icons (192 + 512 PNG) -- can use any icon generator or draw in Figma
2. Take 2-4 screenshots from the Pixel
3. Write a privacy policy page (`privacy.html` on GitHub Pages)
4. Install Bubblewrap, init from manifest, build AAB
5. Create Google Play Developer account, upload AAB
6. Add `assetlinks.json` to repo
7. Submit for review (typically approved in hours to 1-2 days)

### Phase 2: Apple (skip unless demand emerges)
- If multiple coaches request iOS App Store presence, revisit with Capacitor
- For now, iOS users can "Add to Home Screen" from Safari

---

## Files That Need Changes

| File | Change | Required For |
|------|--------|-------------|
| `manifest.json` | Add `orientation`, verify icon paths | Play Store |
| `icons/icon-192.png` | Create if missing | Play Store |
| `icons/icon-512.png` | Create if missing | Play Store |
| `.well-known/assetlinks.json` | New file (after signing key generated) | TWA verification |
| `_config.yml` | `include: [".well-known"]` | GitHub Pages dot-file serving |
| `privacy.html` | New file, simple privacy policy | Play Store requirement |

**No changes needed to:** `index.html`, `app.js`, `engine.js`, `storage.js`, `field.js`, `formations.js`, `sw.js`
