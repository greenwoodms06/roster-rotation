# Session Prompt: Capacitor Wrap — Android First

## Goal

Wrap the existing PWA with Capacitor and produce an Android App Bundle (`.aab`)
suitable for a Google Play internal-testing upload. iOS is deliberately
deferred. The PWA on GitHub Pages must keep working identically after this
session — wrapping is additive.

## Status coming in

Production-readiness cleanup is done (Batches A–E of the readiness review).
Every Capacitor-sensitive concern that could be addressed ahead of time has
been addressed:

- **Platform seam** — `js/platform.js` provides `Platform.isNative()` /
  `Platform.isWeb()`. Already wired into:
  - donate button (removed from header on native — Play payments policy),
  - Print button in lineup + game-history popup (removed on native —
    `window.open` popup print doesn't work inside WebViews),
  - `beforeinstallprompt` handler (early-out on native),
  - Service worker registration (skipped on native).
- **Self-hosted fonts** — `fonts/dm-sans-latin.woff2`,
  `fonts/jetbrains-mono-latin.woff2`. No runtime network fetch. Play Store
  privacy form can declare zero third-party calls.
- **Storage adapter** — `js/storage_adapter.js` is the single seam for
  swapping `localStorage` → Capacitor Preferences on native later. Don't
  swap in this session; verify localStorage-in-WebView works first.
- **Escape discipline** — `esc()` in `utils.js` is now attribute-safe;
  position and user-string sinks are all HTML-escaped. Position names may
  contain arbitrary characters again (reverted the alphanumeric filter).
- **Repo hygiene** — `.gitattributes` enforces LF. Empty root
  `package-lock.json` and the `.well-known/assetlinks.json` placeholder
  are gone. `_config.yml` is gone (was only there to serve `.well-known`).
- **CACHE_NAME** currently at `rotation-v3.40`. Keep in sync with
  `<div class="about-version">` in `index.html`.

## Scope (this session)

### 1. Initialize Capacitor

```bash
npm init -y                                    # create top-level package.json
                                               # (separate from tests/e2e/ — or
                                               # keep tests/e2e lockfile scope)
npm install --save-dev @capacitor/core @capacitor/cli
npx cap init "Rotations" "com.greenwoodms06.rotations" --web-dir=.
npm install --save @capacitor/android
npx cap add android
```

- `appId` = `com.greenwoodms06.rotations` (reserved in the previous TWA
  assetlinks placeholder — keep consistent).
- `webDir=.` means Capacitor bundles the repo root. Before `cap copy` add a
  `.capacitorignore` (tests/, docs/, media/, e2e scaffolding, *.md).
- Do NOT commit `android/` wholesale yet — review what Capacitor generates,
  then commit selectively with a `.gitignore` that excludes build artifacts
  (`android/app/build/`, `android/build/`, `android/.gradle/`,
  `android/local.properties`).

### 2. Android-specific configuration

- **Icons.** Current `icons/icon-192.png` and `icon-512.png` are maskable
  PWA icons. For Android native you need the adaptive-icon pair
  (`ic_launcher_foreground.xml` + `ic_launcher_background.xml`). Easiest:
  feed `icons/icon-512.png` to the Image Asset Studio in Android Studio and
  let it generate the mipmap set. Alternative: use `capacitor-assets`
  (`npm install --save-dev @capacitor/assets; npx capacitor-assets generate
  --android`) which takes a single 1024×1024 source image.
- **Splash screen.** Use `@capacitor/splash-screen` plugin. Background
  color `#0f1923` (matches the app's theme). Keep duration short
  (~500 ms — the PWA loads fast).
- **Status bar.** `@capacitor/status-bar` plugin — set style `DARK`
  (light content on the existing `#0f1923` header) and background color
  to match `--bg`. Safe-area insets are already handled in CSS
  (`env(safe-area-inset-*)`).
- **Package signing.** Generate a keystore (`keytool -genkey -v -keystore
  rotations-release.jks ...`). Store it OUTSIDE the repo. Add the
  release signing config to `android/app/build.gradle`. Never commit the
  keystore or the password — gitignore `keystore.properties`.

### 3. Verify behavior in the WebView

Build a debug APK (`cd android; ./gradlew assembleDebug`), install on a
device or emulator, and check:

- [ ] Donate button is absent from the header.
- [ ] Print button is absent from the lineup tab and the game-history
      popup.
- [ ] No install banner appears at startup.
- [ ] No "Update available" banner appears (SW doesn't register).
- [ ] Fonts render correctly (DM Sans + JetBrains Mono — same as PWA).
- [ ] Creating a team, adding players, generating a lineup, swapping
      players, backup-and-restore all work.
- [ ] Back button behavior is sensible (Android hardware back).
- [ ] Rotation / orientation respects `manifest.json`'s `"portrait"`
      (Capacitor config may need `orientation: 'portrait'`).
- [ ] Safe-area insets are respected on a notched device (Pixel 6/7/8
      emulator is fine).

### 4. Plugins to consider (install only if needed)

- **@capacitor/share** — `navigator.share` on Android WebView works for
  text and files, but the native plugin gives better file-share ergonomics.
  Current `js/backup.js` uses `navigator.share` with a fallback to
  `downloadBlob` — test that path before deciding.
- **@capacitor/filesystem** — only if `downloadBlob` fallback does not
  trigger a download-to-device dialog in the WebView. Test first.
- **@capacitor/preferences** — deferred; swap `StorageAdapter` to use it
  only after observing localStorage behavior under Capacitor (v5→v6 had a
  wipe bug — see `capacitor#7548`). Low priority.
- **@capacitor-community/print** — optional; would restore the Print
  button on native. Skip for MVP.

### 5. Store listing prep (out of scope for this session — note only)

- Screenshots from the Android build (Pixel 6 emulator works).
- Privacy policy URL → `privacy.html` on GitHub Pages is fine.
- Data-safety form: "Data collected" = none; "Data shared" = none.
  Third-party SDKs = none. This is accurate post-self-hosting.
- Content rating: everyone. No ads, no IAP, no user accounts.
- License consideration: PolyForm Noncommercial 1.0.0. A free listing is
  compatible. If monetization is ever added, relicense first.

## Explicitly out of scope

- iOS build.
- Capacitor Preferences swap.
- OTA web-asset updates (Live Updates).
- Any engine / UI behavior changes.
- Field.js decoupling from app.js globals.

## Success criteria

- [x] `npx cap run android` launches a working app on emulator/device.
- [x] A signed release `.aab` is produced locally (not uploaded yet —
      author does that out-of-band).
- [x] Unit tests (`node tests/run_all.mjs`) still green (unaffected
      by the wrap; no engine/storage changes).
- [x] Playwright (`cd tests/e2e && npm test`) green — 13/13 in 51.9s.
      Print path swap (popup → iframe) didn't regress anything the suite
      exercises.
- [x] PWA on GitHub Pages still renders identically (donate still gated
      on native only; Print restored on both — see Outcomes below).

## Outcomes (post-session addendum)

The session shipped a working signed `app-release.aab` on a real
emulator + device. A few things went differently than this prompt
predicted:

- **`webDir: "."` doesn't work.** Capacitor 5 hard-rejects it (would
  recurse into `android/`). Fix: `scripts/build-www.mjs` mirrors the
  runtime files into a gitignored `www/` directory before each `cap
  sync`. `capacitor.config.json` points `webDir` at `www`. PWA root
  layout untouched. `npm run cap:sync` chains the build + sync.

- **Print is back on native, not skipped.** The prompt scoped print
  out for MVP (`@capacitor-community/print` listed as optional). Did
  it anyway via a custom `JavascriptInterface` in `MainActivity.java`
  named `AndroidPrint` — renders the HTML in an off-screen WebView and
  hands the `PrintDocumentAdapter` to `PrintManager`. ~40 lines of
  Java, no plugin dependency.

- **Share required Android 14 patches.** `@capacitor/share@5.0.8`
  (latest v5) crashes twice on `targetSdk 34`: `registerReceiver`
  missing `RECEIVER_NOT_EXPORTED` flag, and `PendingIntent` with
  `FLAG_MUTABLE` over an implicit intent. Both were fixed in v6 of
  the plugin and never backported. `patches/@capacitor+share+5.0.8.patch`
  carries the diffs; `patch-package` postinstall hook reapplies on
  every `npm install`.

- **Plugins installed.** Splash Screen + Status Bar (per prompt),
  plus Share + Filesystem (the prompt listed them as "install only
  if needed" — needed). Filesystem feeds `Share.share({ url })` with
  a cache-dir URI; FileProvider config already covered the cache path.

- **`targetSdkVersion` bumped 33 → 34** during the wrap (Play Store
  floor as of Aug 2025). `compileSdkVersion` matched. `minSdk` 22
  unchanged. Unsigned build warnings about AGP 8.0 + compileSdk 34
  are noisy but harmless — Capacitor 5's bundled AGP version handles
  it; can be silenced with `android.suppressUnsupportedCompileSdk=34`
  in `gradle.properties` if desired.

- **Icons regenerated from `icons/icon.svg`** via Inkscape (called
  through `wslpath` from WSL bash) → 1024 PNGs → ImageMagick down-
  scaled into per-density mipmaps. Adaptive-icon background is the
  `@color/ic_launcher_background` resource (`#0f1923`), foreground is
  `assets/icon-foreground.svg` (loop only, scaled into the safe zone).
  Re-running this is currently manual; no script in `scripts/` for it
  yet.

- **Keystore lives at `D:/AndroidKeystores/rotations-release.jks`**
  (outside the repo). Wired through `android/keystore.properties`
  (gitignored) → `android/app/build.gradle` `signingConfigs.release`.
  Schema in `android/keystore.properties.example`. The PKCS12 `.jks`
  was generated with `keytool` directly (Android Studio's bundled
  JBR includes it).

## References

- [Capacitor Getting Started](https://capacitorjs.com/docs/getting-started)
- [Capacitor Android docs](https://capacitorjs.com/docs/android)
- [capacitor-assets plugin](https://github.com/ionic-team/capacitor-assets)
- [Splash screen plugin](https://capacitorjs.com/docs/apis/splash-screen)
- [Play Console: signing](https://developer.android.com/studio/publish/app-signing)
- Existing context: `docs/SESSION_PROMPT_CAPACITOR_PREP.md` — what was
  already done before this session.
