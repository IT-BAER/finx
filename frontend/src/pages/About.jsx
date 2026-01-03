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
      title: getText("aboutFeatureSelfHosted", "Self-Hosted & Private"),
      description: getText("aboutFeatureSelfHostedDesc", "Host on your own server with full control over your data. No third-party access, complete privacy.")
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
            {getText("aboutTagline", "Modern, self-hosted personal finance tracking")}
          </p>
          <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              {getText("aboutBadgeFree", "Free Forever")}
            </span>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
              {getText("aboutBadgeOpenSource", "Open Source")}
            </span>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
              {getText("aboutBadgeSelfHosted", "Self-Hosted")}
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
              {getText("aboutMissionText", "FinX is built with privacy and ownership in mind. As a self-hosted application, all your financial data stays on your own server. No third-party tracking, no data selling, no subscriptions — just a powerful finance tool that respects your privacy.")}
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
                className="p-5 rounded-xl bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
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

        {/* License & Links */}
        <AnimatedSection delay={0.5}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* License Info */}
            <div className="p-5 rounded-xl bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Icon src="/icons/info.svg" size="sm" className="icon-tint-accent" />
                {getText("aboutLicenseTitle", "License")}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {getText("aboutLicenseText", "FinX is licensed under Apache 2.0 with Commons Clause. Free to use, modify, and self-host. Not for commercial resale.")}
              </p>
              <a
                href="https://github.com/IT-BAER/finx/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline text-sm inline-flex items-center gap-1"
              >
                {getText("aboutViewLicense", "View Full License")}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>

            {/* GitHub & Community */}
            <div className="p-5 rounded-xl bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <img src="/logos/logo-32.png" alt="" className="w-5 h-5" />
                {getText("aboutCommunityTitle", "Community & Source")}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {getText("aboutCommunityText", "Contribute, report issues, or star the project on GitHub. Your feedback helps make FinX better!")}
              </p>
              <a
                href="https://github.com/IT-BAER/finx"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                {getText("aboutViewGitHub", "View on GitHub")}
              </a>
            </div>
          </div>
        </AnimatedSection>

        {/* Version Info */}
        <AnimatedSection delay={0.6}>
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
