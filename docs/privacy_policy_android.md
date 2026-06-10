# Privacy Policy for FinX

**Last Updated:** June 10, 2026

Your privacy is our priority. How we handle your data depends on how you use the app.

---

## Local Mode Privacy

When using Local Mode, your financial data never leaves your device. We do not collect, transmit, or store any of your transaction data. You have complete control and ownership.

## Online Mode Privacy

When using Online Mode, your data is stored on your own self-hosted server. FinX does not have access to your data. Your privacy and data security depend on how you configure and secure your server.

## Managed Hosting Privacy

When using the FinX managed hosting service, your data is stored on servers located in the European Union (EU) and is fully DSGVO/GDPR compliant. Your financial data remains on EU servers and is never shared with third parties.

---

## Data We Collect

### Personal Information
- **Account Data (Online Mode only):** Email address, name, and password (stored on your self-hosted server)
- **Financial Data:** Transaction records, categories, budgets, and savings goals (stored locally or on your server depending on mode)

### Location Data (Optional – Premium Feature)

FinX includes an opt-in **Location Reminders** feature (available to Premium subscribers) that reminds you to log transactions after visiting stores, restaurants, gas stations, and similar locations.

**What is accessed:**
- **Precise location** (`ACCESS_FINE_LOCATION`) — used to detect when you enter or exit a geofenced area around a nearby point of interest (store, restaurant, etc.)
- **Approximate location** (`ACCESS_COARSE_LOCATION`) — used as a fallback for the same purpose
- **Background location** (`ACCESS_BACKGROUND_LOCATION`) — required so that geofence events can be detected even when the app is not in the foreground or the screen is off

**How it is used:**
- Your device's GPS/network position is compared against geofences around nearby points of interest (e.g. supermarkets, pharmacies, gas stations)
- When you enter or leave such a location, the app may send you a local notification reminding you to record a transaction
- Points of interest are fetched from the **OpenStreetMap Overpass API** (openstreetmap.org) based on your approximate area — only a bounding box around your current position is sent to this service, not your exact coordinates
- Location data is **processed entirely on your device** and is **never stored on FinX servers** or shared with third parties beyond the Overpass API lookup described above

**This feature is:**
- **Disabled by default** — you must explicitly enable it in Settings → Location Reminders
- **Opt-in and revocable** — you can disable it at any time in Settings; revoking location permission in your device settings also stops all location access immediately
- **Premium-only** — available to Premium subscribers only

### AI Features (Optional – Receipt Scanning & Notification Parsing)

FinX includes optional AI features that require your **explicit in-app consent** before any data is sent. Nothing is sent until you accept the disclosure shown in the app, and declining keeps the feature off.

- **Receipt Scanning:** When you scan a receipt or invoice, the photo is sent to an AI service that extracts the transaction details (amount, date, merchant). The image is **transient** — it is downscaled, sent for a single extraction, then discarded. It is not stored by FinX, not attached to the transaction, and not retained on FinX servers.
- **Notification Parsing:** When enabled, the text of incoming transaction notifications (e.g. bank payment alerts) is sent to an AI service that extracts the transaction details. The text is used for that single extraction only.

**How it is handled:**
- Both features are **opt-in** and gated behind an explicit consent dialog; if you decline, no data is sent.
- Requests are routed to third-party AI providers for processing. FinX requests that your data **not be used for model training** (sent with a no-data-collection flag where supported), but cannot fully guarantee the retention practices of every provider.
- Advanced users may supply their own API key (BYOK), in which case requests go directly to the provider they choose.

### Automatically Collected Data
- **None.** FinX does not use analytics, tracking, or crash reporting services. (The opt-in AI features above only run when you trigger them and after you consent.)

## How We Use Your Data

Your data is used solely to provide the app's functionality:
- Recording and categorizing transactions
- Generating reports and insights
- Tracking savings goals
- Syncing between devices (Online Mode only)
- Detecting nearby points of interest via geofencing to trigger local transaction reminders (Location Reminders feature, opt-in, Premium only)
- Extracting transaction details from receipt photos or notification text via AI (AI Features, opt-in, consent-gated)

## Data Sharing

**We do not sell your data, and we do not share it with advertising networks, analytics providers, or data brokers.**

- No advertising networks
- No analytics providers
- No data brokers

The only third parties that ever receive your data are the limited, purpose-specific service providers described below (location POI lookup, subscription management, and — only if you opt in — AI processing).

### OpenStreetMap Overpass API (Location Reminders only)

When Location Reminders are enabled, FinX queries the **OpenStreetMap Overpass API** to find points of interest (stores, restaurants, etc.) near your current area. A bounding box around your approximate position is sent as a query parameter. No account information, device identifiers, or precise GPS coordinates are transmitted. OpenStreetMap data is made available under the [Open Database License (ODbL)](https://www.openstreetmap.org/copyright).

### Subscription Management (RevenueCat)

FinX uses RevenueCat to manage optional Premium subscriptions. RevenueCat processes only billing-related metadata:
- Subscription status (active, expired, canceled)
- Purchase and renewal events
- Anonymous app user ID

**RevenueCat does NOT have access to:**
- Your transaction data, balances, or categories
- Your personal financial information
- Any data stored in Local Mode or on your server

For more information, see [RevenueCat's Privacy Policy](https://www.revenuecat.com/privacy).

### AI Processing (Receipt Scanning & Notification Parsing — opt-in)

If — and only if — you opt in to the AI features, receipt images or notification text are sent to third-party AI providers solely to extract transaction details for you. This happens only after you grant explicit in-app consent, and only for the specific scan or notification involved. FinX requests that this data not be used for model training. Receipt images are transient and are not retained by FinX. See **AI Features** under "Data We Collect" above for details.

## Data Security

- All network communication uses HTTPS/TLS encryption
- Passwords are hashed using bcrypt
- Biometric authentication data (Face ID/fingerprint) is processed locally by your device OS and never accessed by FinX

## Data Retention & Deletion

- **Local Mode:** Data exists only on your device. Delete the app to remove all data.
- **Online Mode:** You can delete your account and all associated data from Settings > Delete Account, or directly from your self-hosted server.

## Your Rights

You have the right to:
- Access your personal data
- Export your data (Settings > Backup & Restore)
- Delete your account and all associated data
- Withdraw consent at any time

## Children's Privacy

FinX is suitable for users of all ages, including children learning to manage money. In Local Mode, no data is collected or transmitted. For Online Mode, we recommend parental supervision when setting up server connections.

## Changes to This Policy

We may update this policy occasionally. Changes will be posted here with an updated date.

## Contact

If you have questions about this privacy policy, contact us at:
- **Email:** admin@it-baer.net
- **GitHub:** https://github.com/IT-BAER/finx
