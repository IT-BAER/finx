import { useTranslation } from "../hooks/useTranslation";
import { useAuth } from "../contexts/AuthContext";
import VersionBadge from "./VersionBadge.jsx";

const Footer = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <footer
      className={`border-t border-gray-200 dark:border-gray-700 ${user ? "pb-16" : ""} md:pb-0`}
      style={{ backgroundColor: "var(--surface)" }}
    >
      <div className="container mx-auto px-4 py-2 flex justify-between items-center">
        <div className="flex items-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            <span className="font-bold">FinX</span> -{" "}
            {t("footerText").split(" - ")[1]}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <VersionBadge />
          <a
            href="https://github.com/IT-BAER"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src="/logos/logo-32.png"
              alt="FinX Logo"
              className="h-6 w-auto"
              width="24"
              height="24"
            />
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
