# Privacy Policy for FinX

**Last Updated:** April 27, 2026

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

### Automatically Collected Data
- **None** (beyond what is described above). FinX does not use analytics, tracking, or crash reporting services.

## How We Use Your Data

Your data is used solely to provide the app's functionality:
- Recording and categorizing transactions
- Generating reports and insights
- Tracking savings goals
- Syncing between devices (Online Mode only)
- Detecting nearby points of interest via geofencing to trigger local transaction reminders (Location Reminders feature, opt-in, Premium only)

## Data Sharing

**We do not share your financial data with any third parties.**

- No advertising networks
- No analytics providers
- No data brokers

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
