import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "../hooks/useTranslation";
import Button from "../components/Button";
import Input from "../components/Input";
import { motion } from "framer-motion";

const Register = () => {
  // Check if registration is disabled
  const isRegistrationDisabled =
    import.meta.env.VITE_DISABLE_REGISTRATION === "true";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!email || !password || !confirmPassword) {
      window.toastWithHaptic.error(t("fillAllFields"));
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      window.toastWithHaptic.error(t("passwordsDoNotMatch"));
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      window.toastWithHaptic.error(t("passwordMinLength"));
      setLoading(false);
      return;
    }

    const result = await register(email, password);
    if (result.success) {
      navigate("/dashboard");
    } else {
      window.toastWithHaptic.error(result.message);
    }

    setLoading(false);
  };

  // If registration is disabled, show a message instead of the form
  if (isRegistrationDisabled) {
    return (
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 flex-1">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="display-2 text-center mb-6">{t("createAccount")}</h2>
          </div>

          <div className="card">
            <div className="card-body text-center">
              <p className="text-gray-600 dark:text-gray-300 py-8">
                {t("registrationDisabled")}
              </p>
              <div className="pt-4 flex justify-center">
                <Button variant="primary" onClick={() => navigate("/login")}>
                  {t("signIn")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 flex-1">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="display-2 text-center mb-6">{t("createAccount")}</h2>
          <p className="text-gray-600 dark:text-gray-300">
            {t("getStartedToday")}
          </p>
        </div>

        <div className="card">
          <div className="card-body">
            {/* Error alerts removed - using toast notifications instead */}

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="form-group">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  label={t("email")}
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  floatingLabel={true}
                />
              </div>

              <div className="form-group">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  label={t("password")}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  floatingLabel={true}
                />
              </div>

              <div className="form-group">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  label={t("confirmPassword")}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  floatingLabel={true}
                />
              </div>

              <div>
                <Button
                  variant="primary"
                  type="submit"
                  className="w-full py-3 rounded-full"
                  disabled={loading}
                  haptic="impact"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <span className="spinner mr-2"></span>
                      {t("creatingAccount")}
                    </span>
                  ) : (
                    t("createAccount")
                  )}
                </Button>
              </div>
            </form>
          </div>
          <div className="card-footer text-center">
            <p className="text-gray-600 dark:text-gray-400">
              {t("alreadyHaveAccount")}{" "}
              <motion.span
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 800, damping: 30 }}
              >
                <Link
                  to="/login"
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  {t("signIn")}
                </Link>
              </motion.span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
