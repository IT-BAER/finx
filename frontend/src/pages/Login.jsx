import { useEffect, useRef, useState } from "react";
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
  const formRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const hpUserRef = useRef(null); // hidden fallback
  const hpPassRef = useRef(null); // hidden fallback

  // Try to pick up autofilled values on mount (Android PWA often doesn't fire change/input)
  useEffect(() => {
    let tries = 0;
    const maxTries = 8; // ~1.6s total
    const tick = () => {
      tries += 1;
      const ev = emailRef.current?.value || hpUserRef.current?.value;
      const pv = passwordRef.current?.value || hpPassRef.current?.value;
      if (ev && !email) setEmail(ev);
      if (pv && !password) setPassword(pv);
      if (tries < maxTries && (!ev || !pv)) {
        setTimeout(tick, 200);
      }
    };
    setTimeout(tick, 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // As a safety net, read from DOM refs in case state didn't get updated from autofill
    const domEmail = emailRef.current?.value || hpUserRef.current?.value || email;
    const domPassword = passwordRef.current?.value || hpPassRef.current?.value || password;
    if (!email && domEmail) setEmail(domEmail);
    if (!password && domPassword) setPassword(domPassword);

    if (!domEmail || !domPassword) {
      window.toastWithHaptic.error(t("fillAllFields"));
      setLoading(false);
      return;
    }

    const result = await login(domEmail, domPassword, rememberMe);
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

            <form
              ref={formRef}
              className="space-y-6"
              onSubmit={handleSubmit}
              autoComplete="on"
              name="login"
              id="login-form"
            >
              {/* Hidden hints to help mobile managers in PWAs; copied into visible fields on submit */}
              <input
                ref={hpUserRef}
                type="text"
                name="username"
                autoComplete="username"
                tabIndex={-1}
                aria-hidden="true"
                style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none", left: "-9999px" }}
              />
              <input
                ref={hpPassRef}
                type="password"
                name="password"
                autoComplete="current-password"
                tabIndex={-1}
                aria-hidden="true"
                style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none", left: "-9999px" }}
              />
              <div className="form-group">
                <Input
                  ref={emailRef}
                  id="email"
                  name="username"
                  type="email"
                  label={t("email")}
                  autoComplete="username"
                  inputMode="email"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onInput={(e) => !email && setEmail(e.target.value)}
                  floatingLabel={true}
                />
              </div>

              <div className="form-group">
                <Input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type="password"
                  label={t("password")}
                  autoComplete="current-password"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onInput={(e) => !password && setPassword(e.target.value)}
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
