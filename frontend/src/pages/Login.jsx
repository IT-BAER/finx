import { useState } from "react";
import "../utils/haptics.js";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "../hooks/useTranslation";
import Button from "../components/Button";
import Input from "../components/Input";
import { motion } from "framer-motion";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  // Removed error state - using toast notifications instead
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!email || !password) {
      window.toastWithHaptic.error(t("fillAllFields"));
      setLoading(false);
      return;
    }

    const result = await login(email, password, rememberMe);
    if (result.success) {
      navigate("/dashboard");
    } else {
      window.toastWithHaptic.error(result.message);
    }

    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 flex-1">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="display-2 text-center mb-6">{t("login")}</h2>
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
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  floatingLabel={true}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <motion.input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 800, damping: 30 }}
                  />
                  <label
                    htmlFor="remember-me"
                    className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                  >
                    {t("rememberMe")}
                  </label>
                </div>

                <div className="text-sm">
                  <motion.a
                    href="#"
                    className="font-medium text-blue-600 hover:text-blue-500"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 800, damping: 30 }}
                  >
                    {t("forgotPassword")}
                  </motion.a>
                </div>
              </div>

              <div className="flex justify-center">
                <Button
                  variant="primary"
                  type="submit"
                  disabled={loading}
                  haptic="impact"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <span className="spinner mr-2"></span>
                      {t("signingIn")}
                    </span>
                  ) : (
                    t("signIn")
                  )}
                </Button>
              </div>
            </form>
          </div>
          <div className="card-footer text-center">
            <p className="text-gray-600 dark:text-gray-400">
              {t("dontHaveAccount")}{" "}
              <motion.span
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 800, damping: 30 }}
              >
                <Link
                  to="/register"
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  {t("signUp")}
                </Link>
              </motion.span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
