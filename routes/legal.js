const express = require("express");
const router = express.Router();

const LAST_UPDATED = "June 25, 2025";
const CONTACT_EMAIL = "admin@it-baer.net";

function htmlPage(title, bodyContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — FinX</title>
  <style>
    :root { --primary: #3b82f6; --bg: #f8fafc; --surface: #fff; --text: #0f172a; --muted: #64748b; --border: #e2e8f0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); line-height: 1.7; }
    .container { max-width: 680px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
    h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
    .updated { color: var(--muted); font-size: 0.875rem; margin-bottom: 2rem; }
    h2 { font-size: 1.25rem; margin: 2rem 0 0.75rem; padding-bottom: 0.25rem; border-bottom: 1px solid var(--border); }
    h3 { font-size: 1.05rem; margin: 1.25rem 0 0.5rem; }
    p, li { margin-bottom: 0.75rem; color: var(--text); }
    ul { padding-left: 1.25rem; }
    a { color: var(--primary); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .logo { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem; }
    .logo span { font-size: 1.25rem; font-weight: 700; color: var(--primary); }
    hr { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }
    @media (prefers-color-scheme: dark) {
      :root { --bg: #0b1220; --surface: #111827; --text: #e5e7eb; --muted: #9ca3af; --border: #374151; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo"><span>FinX</span></div>
    ${bodyContent}
  </div>
</body>
</html>`;
}

router.get("/privacy", (req, res) => {
  const body = `
    <h1>Privacy Policy</h1>
    <p class="updated">Last Updated: ${LAST_UPDATED}</p>
    <p>Your privacy is our priority. How we handle your data depends on how you use the app.</p>

    <h2>Local Mode Privacy</h2>
    <p>When using Local Mode, your financial data never leaves your device. We do not collect, transmit, or store any of your transaction data. You have complete control and ownership.</p>

    <h2>Online Mode Privacy</h2>
    <p>When using Online Mode, your data is stored on your own self-hosted server. FinX does not have access to your data. Your privacy and data security depend on how you configure and secure your server.</p>

    <h2>Managed Hosting Privacy</h2>
    <p>When using the FinX managed hosting service, your data is stored on servers located in the European Union (EU) and is fully DSGVO/GDPR compliant. Your financial data remains on EU servers and is never shared with third parties.</p>

    <hr>

    <h2>Data We Collect</h2>
    <h3>Personal Information</h3>
    <ul>
      <li><strong>Account Data (Online Mode only):</strong> Email address, name, and password (stored on your self-hosted server)</li>
      <li><strong>Financial Data:</strong> Transaction records, categories, budgets, and savings goals (stored locally or on your server depending on mode)</li>
    </ul>
    <h3>Automatically Collected Data</h3>
    <p><strong>None.</strong> FinX does not use analytics, tracking, or crash reporting services.</p>

    <h2>How We Use Your Data</h2>
    <p>Your data is used solely to provide the app&rsquo;s functionality:</p>
    <ul>
      <li>Recording and categorizing transactions</li>
      <li>Generating reports and insights</li>
      <li>Tracking savings goals</li>
      <li>Syncing between devices (Online Mode only)</li>
    </ul>

    <h2>Data Sharing</h2>
    <p><strong>We do not share your financial data with any third parties.</strong></p>
    <ul>
      <li>No advertising networks</li>
      <li>No analytics providers</li>
      <li>No data brokers</li>
    </ul>

    <h3>Subscription Management (RevenueCat)</h3>
    <p>FinX uses RevenueCat to manage optional Premium subscriptions. RevenueCat processes only billing-related metadata:</p>
    <ul>
      <li>Subscription status (active, expired, canceled)</li>
      <li>Purchase and renewal events</li>
      <li>Anonymous app user ID</li>
    </ul>
    <p><strong>RevenueCat does NOT have access to:</strong></p>
    <ul>
      <li>Your transaction data, balances, or categories</li>
      <li>Your personal financial information</li>
      <li>Any data stored in Local Mode or on your server</li>
    </ul>
    <p>For more information, see <a href="https://www.revenuecat.com/privacy" rel="noopener noreferrer">RevenueCat&rsquo;s Privacy Policy</a>.</p>

    <h2>Data Security</h2>
    <ul>
      <li>All network communication uses HTTPS/TLS encryption</li>
      <li>Passwords are hashed using bcrypt</li>
      <li>Biometric authentication data (Face ID/fingerprint) is processed locally by your device OS and never accessed by FinX</li>
    </ul>

    <h2>Data Retention &amp; Deletion</h2>
    <ul>
      <li><strong>Local Mode:</strong> Data exists only on your device. Delete the app to remove all data.</li>
      <li><strong>Online Mode:</strong> You can delete your account and all associated data from Settings &gt; Delete Account, or directly from your self-hosted server.</li>
    </ul>

    <h2>Your Rights</h2>
    <p>You have the right to:</p>
    <ul>
      <li>Access your personal data</li>
      <li>Export your data (Settings &gt; Backup &amp; Restore)</li>
      <li>Delete your account and all associated data</li>
      <li>Withdraw consent at any time</li>
    </ul>

    <h2>Children&rsquo;s Privacy</h2>
    <p>FinX is suitable for users of all ages, including children learning to manage money. In Local Mode, no data is collected or transmitted. For Online Mode, we recommend parental supervision when setting up server connections.</p>

    <h2>Changes to This Policy</h2>
    <p>We may update this policy occasionally. Changes will be posted here with an updated date.</p>

    <h2>Contact</h2>
    <p>If you have questions about this privacy policy, contact us at:</p>
    <ul>
      <li><strong>Email:</strong> <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></li>
    </ul>
  `;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(htmlPage("Privacy Policy", body));
});

router.get("/terms", (req, res) => {
  const body = `
    <h1>Terms of Use</h1>
    <p class="updated">Last Updated: ${LAST_UPDATED}</p>

    <h2>1. Service Modes</h2>
    <p>FinX offers two modes of operation. &ldquo;Local Mode&rdquo; stores data exclusively on your device. &ldquo;Online Mode&rdquo; enables cloud synchronization with your self-hosted FinX server.</p>

    <h2>2. Data Responsibility</h2>
    <p>For Local Mode, you are solely responsible for backing up your data. FinX cannot recover data lost from a device in Local Mode. For Online Mode, data security depends on your server configuration.</p>

    <h2>3. Self-Hosting</h2>
    <p>Online Mode requires connecting to your own FinX server. You are responsible for hosting, maintaining, and securing your server. FinX does not provide hosted servers for users.</p>

    <h2>4. Managed Hosting</h2>
    <p>FinX may offer an optional managed hosting service. When using managed hosting, your data is stored on servers in the European Union and handled in compliance with GDPR/DSGVO. Managed hosting requires an active FinX Pro subscription.</p>

    <h2>5. Subscriptions</h2>
    <p>FinX Pro subscriptions are processed through Google Play. Subscriptions auto-renew unless canceled at least 24 hours before the end of the current billing period. You can manage or cancel subscriptions through Google Play Store settings.</p>

    <h2>6. Intellectual Property</h2>
    <p>FinX is licensed under the Apache License 2.0 with Commons Clause. You may use, modify, and self-host FinX for personal use. Commercial resale of hosted FinX services is not permitted without written consent.</p>

    <h2>7. Limitation of Liability</h2>
    <p>FinX is provided &ldquo;as is&rdquo; without warranty. We are not liable for data loss, financial decisions made based on app data, or issues arising from self-hosted server configurations.</p>

    <h2>8. Changes to Terms</h2>
    <p>We may update these terms occasionally. Continued use of the app after changes constitutes acceptance of the modified terms.</p>

    <h2>Contact</h2>
    <p>If you have questions about these terms, contact us at:</p>
    <ul>
      <li><strong>Email:</strong> <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></li>
    </ul>
  `;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(htmlPage("Terms of Use", body));
});

module.exports = router;
