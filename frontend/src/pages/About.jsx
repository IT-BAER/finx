import { useTranslation } from "../hooks/useTranslation";
import { motion } from "framer-motion";
import { AnimatedPage, AnimatedSection } from "../components/AnimatedPage";
import Icon from "../components/Icon.jsx";
import { APP_VERSION } from "../components/VersionBadge.jsx";

const About = () => {
  const { t } = useTranslation();

  // Helper function to get translation or fallback
  const getText = (key, fallback) => {
    const translation = t(key);
    // If translation returns the key itself, use fallback
    return translation === key ? fallback : translation;
  };

  const features = [
    {
      icon: "/icons/transactions.svg",
      title: getText("aboutFeatureTransactions", "Transaction Tracking"),
      description: getText("aboutFeatureTransactionsDesc", "Track income and expenses with categories, sources, and targets. Import data with duplicate detection.")
    },
    {
      icon: "/icons/recurring.svg",
      title: getText("aboutFeatureRecurring", "Recurring Transactions"),
      description: getText("aboutFeatureRecurringDesc", "Set up recurring rules for automated transaction processing with flexible scheduling.")
    },
    {
      icon: "/icons/share.svg",
      title: getText("aboutFeatureSharing", "Data Sharing"),
      description: getText("aboutFeatureSharingDesc", "Share financial data with fine-grained access control and real-time sync across devices.")
    },
    {
      icon: "/icons/reports.svg",
      title: getText("aboutFeatureReports", "Reports & Analytics"),
      description: getText("aboutFeatureReportsDesc", "Visualize spending patterns with interactive charts and customizable date ranges.")
    },
    {
      icon: "/icons/goals.svg",
      title: getText("aboutFeatureGoals", "Financial Goals"),
      description: getText("aboutFeatureGoalsDesc", "Set savings targets and track progress with visual goal tracking.")
    },
    {
      icon: "/icons/settings.svg",
      title: getText("aboutFeatureSelfHosted", "Secure & Private"),
      description: getText("aboutFeatureSelfHostedDesc", "Your financial data is securely hosted and encrypted. No third-party access, no ads, complete privacy.")
    },
  ];

  const techStack = [
    { name: "React 19", description: getText("aboutTechReact", "Modern UI framework") },
    { name: "Vite 6", description: getText("aboutTechVite", "Fast build tool") },
    { name: "Express.js", description: getText("aboutTechExpress", "Backend API") },
    { name: "PostgreSQL", description: getText("aboutTechPostgres", "Database") },
    { name: "Tailwind CSS", description: getText("aboutTechTailwind", "Styling") },
    { name: "Framer Motion", description: getText("aboutTechFramer", "Animations") },
  ];

  return (
    <AnimatedPage>
      <div className="container mx-auto px-4 pt-4 md:pt-0 pb-8">
        {/* Header */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="flex items-center justify-center gap-4 mb-4">
            <img
              src="/logos/logo_full_256.png"
              alt="FinX"
              className="h-16 w-auto"
            />
            <h1 className="display-1 leading-none">FinX</h1>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            {getText("aboutTagline", "Modern, cloud-hosted personal finance tracking")}
          </p>
          <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              {getText("aboutBadgeFree", "FinX Pro")}
            </span>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
              {getText("aboutBadgeOpenSource", "Privacy-First")}
            </span>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
              {getText("aboutBadgeSelfHosted", "Cloud-Hosted")}
            </span>
          </div>
        </motion.div>

        {/* Mission Statement */}
        <AnimatedSection delay={0.2}>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 md:p-8 mb-8 border border-blue-100 dark:border-blue-800/30">
            <h2 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
              {getText("aboutMissionTitle", "Your Data, Your Control")}
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {getText("aboutMissionText", "FinX is built with privacy in mind. Your financial data is securely hosted in the EU with encryption at rest and in transit. No third-party tracking, no data selling — just a powerful finance tool that respects your privacy.")}
            </p>
          </div>
        </AnimatedSection>

        {/* Features Grid */}
        <AnimatedSection delay={0.3}>
          <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
            {getText("aboutFeaturesTitle", "Key Features")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="card p-5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 * index }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
                    <Icon
                      src={feature.icon}
                      size="md"
                      className="icon-tint-accent"
                    />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatedSection>

        {/* Tech Stack */}
        <AnimatedSection delay={0.4}>
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            {getText("aboutTechTitle", "Built With")}
          </h2>
          <div className="flex flex-wrap gap-3 mb-8">
            {techStack.map((tech) => (
              <div
                key={tech.name}
                className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
              >
                <span className="font-medium text-gray-900 dark:text-white">{tech.name}</span>
                <span className="text-gray-500 dark:text-gray-400 ml-2">•</span>
                <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">{tech.description}</span>
              </div>
            ))}
          </div>
        </AnimatedSection>

        {/* FAQ Section */}
        <AnimatedSection delay={0.5}>
          <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
            {getText("faqTitle", "Frequently Asked Questions")}
          </h2>
          <div className="space-y-4 mb-8">
            {[
              { q: getText("faqQ1", "Is my financial data secure?"), a: getText("faqA1", "Yes. Your data is stored on servers in the European Union with encryption at rest and in transit. We are fully GDPR/DSGVO compliant. No third parties have access to your financial information.") },
              { q: getText("faqQ2", "Can I access FinX from multiple devices?"), a: getText("faqA2", "Yes. All your devices stay in sync in real-time. Changes made on one device appear instantly on all others.") },
              { q: getText("faqQ3", "How do I back up my data?"), a: getText("faqA3", "Go to Settings > Import/Export. You can export your data as a JSON file for safekeeping at any time.") },
              { q: getText("faqQ4", "Can I share my financial data with others?"), a: getText("faqA4", "Yes. Use the Data Sharing feature in Settings to grant read or write access to other FinX users with fine-grained permissions.") },
              { q: getText("faqQ5", "What happens if I cancel my subscription?"), a: getText("faqA5", "You can export all your data before cancellation. After your subscription ends, your account data is retained for 30 days before deletion.") },
              { q: getText("faqQ6", "How does Bank Sync work?"), a: getText("faqA6", "Bank Sync uses SimpleFIN, a third-party service, to automatically import transactions from your bank. You can configure it in Settings > Bank Sync.") },
              { q: getText("faqQ7", "Who has access to my data?"), a: getText("faqA7", "Only you and anyone you explicitly share with. We do not use analytics, tracking, or advertising. Your financial data is never shared with third parties.") },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="p-5 rounded-xl bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 * i }}
              >
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">{item.q}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{item.a}</p>
              </motion.div>
            ))}
          </div>
        </AnimatedSection>

        {/* License & Links */}
        <AnimatedSection delay={0.6}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* License Info */}
            <div className="p-5 rounded-xl bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Icon src="/icons/info.svg" size="sm" className="icon-tint-accent" />
                {getText("aboutLicenseTitle", "License")}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {getText("aboutLicenseText", "FinX Pro is a managed service provided by IT-BAER. Your subscription includes secure cloud hosting, automatic updates, and priority support.")}
              </p>
            </div>

            {/* GitHub & Community */}
            <div className="p-5 rounded-xl bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <img src="/logos/logo-32.png" alt="" className="w-5 h-5" />
                {getText("aboutCommunityTitle", "Support & Contact")}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {getText("aboutCommunityText", "Need help or have feedback? Reach out to our support team. We're here to make your FinX experience great!")}
              </p>
              <a
                href="mailto:admin@it-baer.net"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {getText("aboutViewGitHub", "Contact Support")}
              </a>
            </div>
          </div>

          {/* Legal Links */}
          <div className="flex items-center justify-center gap-6 mt-6">
            <a
              href="/legal/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {t("privacyPolicy") || "Privacy Policy"}
            </a>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <a
              href="/legal/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {t("termsOfUse") || "Terms of Use"}
            </a>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <a
              href="/legal/imprint"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {t("imprint") || "Imprint"}
            </a>
          </div>
        </AnimatedSection>

        {/* Version Info */}
        <AnimatedSection delay={0.7}>
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {getText("aboutVersion", "Version")} <span className="font-mono font-medium">{APP_VERSION}</span>
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {getText("aboutCreatedBy", "Created by IT-BAER")}
            </p>
          </div>
        </AnimatedSection>
      </div>
    </AnimatedPage>
  );
};

export default About;
