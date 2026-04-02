# Roster Rotation Manager — Distribution & Architecture Strategy

> **Reference document.** Captures decisions made during architecture planning for app store distribution, cloud backup, and monetization. Intended as a stable reference for future development phases.

---

## Core Philosophy

The PWA on GitHub Pages **is** the product. Everything else (store wrappers, backup, monetization) is layered on top without touching the core app logic. The web version remains fully functional as a free, open fallback for all platforms.

---

## Platform Strategy

### Why Not PWA-Only

US smartphone distribution is roughly **55% iOS / 45% Android**. Youth sports coaching skews further toward iPhone users. "Add to Home Screen" from Safari is:

- Hidden in the share sheet, non-obvious to non-technical users
- Unavailable from Chrome on iOS (Apple restricts to Safari only)
- Not discoverable via any app store

A PWA-only approach creates a significant drop-off for the majority of likely users. Coaches at a game sideline will not figure out a share-sheet gesture.

### Chosen Approach: Capacitor

**Capacitor** wraps the existing PWA HTML/CSS/JS in a thin native shell, producing real native apps for both stores with no changes to web code.

| | Detail |
|---|---|
| Your PWA/web code | **Unchanged** — Capacitor hosts it in a WebView |
| iOS | Real App Store app, proper install, discoverable |
| Android | Real Play Store app, replaces a TWA-only approach |
| Build tooling | Node + Capacitor CLI — one build pipeline for both platforms |
| Auto-updates | **Lost vs. TWA** — code changes require a new build + store submission |
| Apple Developer account | $99/year |
| Google Play | $25 one-time |

**Why not TWA (Trusted Web Activity) for Android?**
TWA was the original plan for Android-only because it preserves the "push to GitHub → users updated automatically" workflow. Once iOS became a first-class target requiring Capacitor, TWA adds complexity with no benefit — Capacitor handles Android equally well and keeps a single build pipeline for both platforms.

**The auto-update tradeoff:** The biggest cost of Capacitor vs. TWA is losing instant GitHub-push updates. For a coaching sideline tool that doesn't update constantly, submitting a new build a few times per season is acceptable. The iOS App Store presence justifies the tradeoff.

---

## Cloud Backup

### Architecture: No Backend

Cloud backup is implemented entirely client-side using the user's **own cloud storage account**. There is no server, no database, and no infrastructure costs to the developer.

The app writes a single backup file (e.g., `roster-rotation-backup.json`) to a sandboxed app folder in the user's chosen cloud storage — invisible in their regular file browser but accessible by the app via OAuth.

**Why this is the right approach:**
- Zero ongoing cost to the developer
- User owns their data entirely
- Works from both the PWA (github.io) and the native app
- No surprise infrastructure bills possible

### Supported Providers

"Google Drive" was used as a planning example but the intent is to support the most common providers:

| Provider | Mechanism | Notes |
|---|---|---|
| **Google Drive** | Drive REST API, `appDataFolder` scope | Best fit for Android users; OAuth via Google Sign-In |
| **iCloud Drive** | CloudKit JS API | Best fit for iOS users; requires Apple Developer account |
| **OneDrive** | Microsoft Graph API | Broad enterprise/Windows user coverage |
| **Dropbox** | Dropbox API v2 | Widely used across platforms |

**Implementation note:** Each provider uses a different OAuth and API surface, but the app-side logic is identical — serialize the JSON blob, PUT to the provider, GET it back on restore. The backup module should abstract the provider behind a common interface (`backup(json)` / `restore()`) so providers are interchangeable.

**Priority order for implementation:** Google Drive first (Android primary users), iCloud second (iOS majority), others as time permits.

### Security & Abuse Protection

Since there is no backend, the attack surface is limited to the OAuth flows themselves, which are handled entirely by the provider (Google, Apple, Microsoft, etc.). No Firestore rules, no rate limiting, no App Check needed.

The only risk is a runaway loop in the app itself accidentally hammering a provider API. Mitigate with:
- A minimum interval between backup writes (e.g., no more than one write per minute)
- Explicit user-initiated backup only (no background sync unless explicitly added later)

---

## Monetization

### Model: Pay-Once App Purchase

| Channel | Model |
|---|---|
| **Play Store (Android)** | One-time purchase price ($0.99–$2.99) |
| **App Store (iOS)** | One-time purchase price ($0.99–$2.99) |
| **github.io web version** | Free, always |
| **In-app purchases** | None |
| **Subscriptions** | None |

The app purchase itself is the support mechanism. There is no separate "unlock" or "tip" button inside the app. Buying it from the store is the transaction.

### Donation / Tip Path (Optional)

For users who find the app via github.io or want to give additional support:

- The app includes a neutral "Website / GitHub" link (not payment language)
- The GitHub Pages site hosts payment links (Ko-fi, GitHub Sponsors, PayPal.me, etc.)
- No payment flow exists inside the app itself

**Why this is safe under Play/App Store policy:** Store payment policies govern in-app purchases of digital goods. A link to an external website is explicitly permitted. Payment messaging lives on the website, not in the app. This is standard practice for open-source and indie hobby apps.

### If Cloud Backup Ever Needs to Be Gated

If backend costs ever become real (unlikely given the no-backend architecture), the backup feature could be gated behind the app purchase. Since backup already requires the store-purchased app to work seamlessly, this is a natural pairing — web version gets manual export/import, app purchase gets cloud backup convenience.

No in-app subscription infrastructure would be needed for this model.

---

## What Stays Free Forever

- Full rotation engine
- All app features
- Manual backup/restore (JSON files)
- github.io web version

---

## Infrastructure Cost Summary

| Item | Cost |
|---|---|
| GitHub Pages hosting | Free |
| Cloud backup storage | $0 to developer (user's own quota) |
| Backend / database | None |
| Apple Developer Program | $99/year |
| Google Play Console | $25 one-time |
| **Total ongoing** | **$99/year** |

---

## Next Development Phases

### Phase 0 — Complete
- ~~Multi-team / multi-season storage refactor~~
- ~~Clean localStorage schema~~
- ~~Import/export pipeline~~ → v3 backup/restore/share format implemented

### Phase 1 — Play Store (Android)
1. Set up Capacitor project wrapping github.io PWA
2. Configure signing, Play Console account, store listing
3. Set purchase price; mention free web version in description
4. Add "Website / GitHub" link in app About section

### Phase 2 — App Store (iOS)
1. iOS Capacitor build from same project
2. Apple Developer account, App Store Connect listing
3. Match price point to Android

### Phase 3 — Cloud Backup
1. Implement backup module with common `backup()` / `restore()` interface
2. Google Drive provider first (OAuth + `appDataFolder` scope)
3. iCloud / OneDrive / Dropbox providers as follow-on
4. "Sign in to back up" UI in app settings; works on web version too

### Phase 4 — Additional Providers / Polish
- Additional cloud storage providers based on user feedback
- Backup history / versioning if warranted
- Any native-feel improvements via Capacitor plugins

---

## Key Decisions Log

| Decision | Chosen | Rejected | Reason |
|---|---|---|---|
| Android wrapper | Capacitor | TWA | iOS is majority platform; single pipeline justified |
| Backup storage | User's own cloud | Firebase / Supabase | Zero backend cost; user owns data |
| Monetization | App purchase | Subscription / in-app tips | Hobby app; minimal management overhead |
| Backend | None | Firebase, S3 | No need given client-side backup architecture |
| iOS support | Full App Store via Capacitor | PWA-only | US distribution is ~55% iOS; install friction too high |

---

*Last updated: March 2026*
