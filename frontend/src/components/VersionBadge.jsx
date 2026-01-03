import React from "react";

// Version should match root package.json
export const APP_VERSION = "0.7.4";

const VersionBadge = () => {
  return (
    <a
      href="https://github.com/IT-BAER/finx"
      target="_blank"
      rel="noopener noreferrer"
      className="text-[9px] tracking-wide font-mono bg-cyan-600/10 text-cyan-700 dark:text-cyan-300 dark:bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-600/30 dark:border-cyan-400/30 hover:bg-cyan-600/20 dark:hover:bg-cyan-500/20 transition-colors"
      title={`FinX version ${APP_VERSION} - View on GitHub`}
    >
      v{APP_VERSION}
    </a>
  );
};

export default VersionBadge;
