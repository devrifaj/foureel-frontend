import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import FormInput from "../components/FormInput";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  login as apiLogin,
  requestClientForgotPassword,
  validateClientResetToken,
  submitClientPasswordReset,
} from "../api";
import { DASHBOARD_BASE } from "../paths";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_PASSWORD_MIN = 8;

function normalizeLoginApiError(message, t) {
  if (!message) return t("loginInvalid");
  const lower = String(message).toLowerCase();
  if (lower.includes("invalid credentials")) return t("loginInvalid");
  if (lower.includes("email and password are required")) {
    return t("loginValServerForm");
  }
  return String(message);
}

function normalizeForgotApiError(message, t) {
  if (!message) return t("loginInvalid");
  const lower = String(message).toLowerCase();
  if (lower.includes("valid email")) return t("loginValEmailInvalid");
  return String(message);
}

function normalizeResetApiError(message, t) {
  if (!message) return t("resetInvalidLink");
  const lower = String(message).toLowerCase();
  if (lower.includes("invalid or expired")) return t("resetInvalidLink");
  if (lower.includes("at least") && lower.includes("characters")) return t("teamValPasswordLength");
  if (lower.includes("do not match")) return t("resetValPasswordMismatch");
  return String(message);
}

function FeedbackBanner({ feedback }) {
  return (
    <div
      className={
        feedback.text && feedback.type
          ? `login-feedback login-feedback--${feedback.type} is-visible`
          : "login-feedback"
      }
      role={
        feedback.text ? (feedback.type === "success" ? "status" : "alert") : undefined
      }
      aria-live="polite"
      aria-hidden={!feedback.text}
    >
      {feedback.text}
    </div>
  );
}

export default function LoginPage() {
  const { t } = useLang();
  const { establishSession, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get("reset");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("client");
  const [screen, setScreen] = useState("signin");
  const [forgotEmail, setForgotEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
  const [forgotFieldError, setForgotFieldError] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetFieldErrors, setResetFieldErrors] = useState({
    password: "",
    confirm: "",
  });
  const [resetVerify, setResetVerify] = useState({
    status: resetToken ? "loading" : "idle",
  });
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [submitting, setSubmitting] = useState(false);

  const clearFeedback = () => setFeedback({ type: "", text: "" });

  useEffect(() => {
    if (!resetToken) {
      setResetVerify({ status: "idle" });
      return;
    }
    setResetVerify({ status: "loading" });
    let cancelled = false;
    validateClientResetToken(resetToken).then((ok) => {
      if (!cancelled) setResetVerify({ status: ok ? "valid" : "invalid" });
    });
    return () => {
      cancelled = true;
    };
  }, [resetToken]);

  const validateFields = () => {
    const next = { email: "", password: "" };
    const emailTrim = email.trim();
    if (!emailTrim) next.email = t("loginValEmailRequired");
    else if (!EMAIL_REGEX.test(emailTrim)) next.email = t("loginValEmailInvalid");
    if (!password) next.password = t("loginValPasswordRequired");
    else if (!password.trim()) next.password = t("loginValPasswordSpaces");
    setFieldErrors(next);
    return !next.email && !next.password;
  };

  const validateForgotEmail = () => {
    const trimmed = forgotEmail.trim();
    if (!trimmed) {
      setForgotFieldError(t("loginValEmailRequired"));
      return false;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setForgotFieldError(t("loginValEmailInvalid"));
      return false;
    }
    setForgotFieldError("");
    return true;
  };

  const validateResetPasswords = () => {
    const next = { password: "", confirm: "" };
    if (!resetPassword) next.password = t("loginValPasswordRequired");
    else if (resetPassword.length < RESET_PASSWORD_MIN) {
      next.password = t("teamValPasswordLength");
    }
    if (!resetConfirm) next.confirm = t("resetValConfirmRequired");
    else if (resetConfirm !== resetPassword) next.confirm = t("resetValPasswordMismatch");
    setResetFieldErrors(next);
    return !next.password && !next.confirm;
  };

  const setModeSafe = (nextMode) => {
    setMode(nextMode);
    setScreen("signin");
    setForgotEmail("");
    setForgotFieldError("");
    setFieldErrors({ email: "", password: "" });
    clearFeedback();
  };

  const openForgot = () => {
    setForgotEmail(email.trim());
    setForgotFieldError("");
    clearFeedback();
    setScreen("forgot");
  };

  const backToSignin = () => {
    setScreen("signin");
    setForgotFieldError("");
    clearFeedback();
  };

  const doLogin = async (e) => {
    e?.preventDefault();
    clearFeedback();
    if (!validateFields()) return;

    setSubmitting(true);
    try {
      const result = await apiLogin(email.trim(), password);
      const loggedRole = result?.user?.role;
      const expectedRole = mode === "admin" ? "team" : "client";
      if (loggedRole !== expectedRole) {
        try {
          await logout();
        } catch {
          /* logout clears user in AuthContext even on API failure */
        }
        setFeedback({
          type: "error",
          text:
            mode === "admin" ? t("loginWrongRoleTeam") : t("loginWrongRoleClient"),
        });
        return;
      }

      establishSession(result.user);
      setFeedback({ type: "success", text: t("loginSuccess") });
      await new Promise((r) => setTimeout(r, 650));
      if (loggedRole === "client") navigate("/portaal", { replace: true });
      else navigate(DASHBOARD_BASE, { replace: true });
    } catch (err) {
      const raw = err?.message || "";
      const isNetwork =
        err?.name === "TypeError" || /network|failed to fetch|load failed/i.test(raw);
      setFeedback({
        type: "error",
        text: isNetwork ? t("loginNetworkError") : normalizeLoginApiError(raw, t),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const doForgot = async (e) => {
    e?.preventDefault();
    clearFeedback();
    if (!validateForgotEmail()) return;

    setSubmitting(true);
    try {
      await requestClientForgotPassword(forgotEmail.trim());
      setFeedback({ type: "success", text: t("forgotSuccess") });
    } catch (err) {
      const raw = err?.message || "";
      const isNetwork =
        err?.name === "TypeError" || /network|failed to fetch|load failed/i.test(raw);
      setFeedback({
        type: "error",
        text: isNetwork ? t("loginNetworkError") : normalizeForgotApiError(raw, t),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const doResetPassword = async (e) => {
    e?.preventDefault();
    clearFeedback();
    if (!resetToken || !validateResetPasswords()) return;

    setSubmitting(true);
    try {
      await submitClientPasswordReset({
        token: resetToken,
        password: resetPassword,
        confirmPassword: resetConfirm,
      });
      setFeedback({ type: "success", text: t("resetSuccess") });
      await new Promise((r) => setTimeout(r, 900));
      navigate("/login", { replace: true });
    } catch (err) {
      const raw = err?.message || "";
      const isNetwork =
        err?.name === "TypeError" || /network|failed to fetch|load failed/i.test(raw);
      setFeedback({
        type: "error",
        text: isNetwork ? t("loginNetworkError") : normalizeResetApiError(raw, t),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isResetFlow = Boolean(resetToken);
  const isForgot = screen === "forgot" && mode === "client" && !isResetFlow;

  let title;
  let subtitle;
  if (isResetFlow) {
    if (resetVerify.status === "loading") {
      title = t("resetTitle");
      subtitle = t("resetCheckingLink");
    } else if (resetVerify.status === "invalid") {
      title = t("resetInvalidTitle");
      subtitle = t("resetInvalidLink");
    } else {
      title = t("resetTitle");
      subtitle = t("resetSub");
    }
  } else if (isForgot) {
    title = t("forgotTitle");
    subtitle = t("forgotSub");
  } else {
    title = mode === "client" ? t("portalTitleClient") : t("portalTitleTeam");
    subtitle = mode === "client" ? t("portalSubClient") : t("portalSubTeam");
  }

  return (
    <div className="login-screen" id="login-screen">
      <div className="login-box">
        <div className="login-logo">4R</div>

        {!isResetFlow ? (
          <div className="login-toggle" role="tablist" aria-label={t("portalLoginTypeAria")}>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "client"}
              className={`login-toggle-btn${mode === "client" ? " is-active" : ""}`}
              onClick={() => setModeSafe("client")}
            >
              {t("portalTabClient")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "admin"}
              className={`login-toggle-btn${mode === "admin" ? " is-active" : ""}`}
              onClick={() => setModeSafe("admin")}
            >
              {t("portalTabTeam")}
            </button>
          </div>
        ) : null}

        <div className="login-title">{title}</div>
        <div className="login-sub">{subtitle}</div>

        {isResetFlow && resetVerify.status === "invalid" ? (
          <div>
            <button
              type="button"
              className="login-btn"
              style={{ marginTop: "16px" }}
              onClick={() => navigate("/login", { replace: true })}
            >
              {t("resetBackToLogin")}
            </button>
          </div>
        ) : null}

        {isResetFlow && resetVerify.status === "valid" ? (
          <form onSubmit={doResetPassword} noValidate>
            <FormInput
              className="login-field"
              id="reset-password"
              type="password"
              label={t("resetNewPasswordLabel")}
              placeholder="••••••••"
              value={resetPassword}
              onChange={(e) => {
                setResetPassword(e.target.value);
                if (resetFieldErrors.password) {
                  setResetFieldErrors((f) => ({ ...f, password: "" }));
                }
              }}
              autoComplete="new-password"
              errorMessage={resetFieldErrors.password}
            />
            <FormInput
              className="login-field"
              id="reset-password-confirm"
              type="password"
              label={t("resetConfirmPasswordLabel")}
              placeholder="••••••••"
              value={resetConfirm}
              onChange={(e) => {
                setResetConfirm(e.target.value);
                if (resetFieldErrors.confirm) {
                  setResetFieldErrors((f) => ({ ...f, confirm: "" }));
                }
              }}
              autoComplete="new-password"
              errorMessage={resetFieldErrors.confirm}
            />
            <FeedbackBanner feedback={feedback} />
            <button
              type="submit"
              className="login-btn"
              disabled={submitting}
              style={submitting ? { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" } : undefined}
            >
              {submitting ? (
                <>
                  <LoadingSpinner size={18} />
                  <span>{t("resetSubmitLoading")}</span>
                </>
              ) : (
                t("resetSubmit")
              )}
            </button>
            <button
              type="button"
              className="forgot-link"
              style={{ textAlign: "center", marginTop: "12px" }}
              onClick={() => navigate("/login", { replace: true })}
            >
              {t("resetBackToLogin")}
            </button>
          </form>
        ) : null}

        {!isResetFlow && isForgot ? (
          <form onSubmit={doForgot} noValidate>
            <FormInput
              className="login-field"
              id="forgot-email"
              type="email"
              label={t("portalEmailLabel")}
              placeholder={t("portalEmailPlaceholder")}
              value={forgotEmail}
              onChange={(e) => {
                setForgotEmail(e.target.value);
                if (forgotFieldError) setForgotFieldError("");
              }}
              autoComplete="email"
              errorMessage={forgotFieldError}
            />
            <FeedbackBanner feedback={feedback} />
            <button
              type="submit"
              className="login-btn"
              disabled={submitting}
              style={submitting ? { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" } : undefined}
            >
              {submitting ? (
                <>
                  <LoadingSpinner size={18} />
                  <span>{t("forgotSubmitLoading")}</span>
                </>
              ) : (
                t("forgotSubmit")
              )}
            </button>
            <button
              type="button"
              className="forgot-link"
              style={{ textAlign: "center", marginTop: "12px" }}
              onClick={backToSignin}
            >
              {t("forgotBack")}
            </button>
          </form>
        ) : null}

        {!isResetFlow && !isForgot ? (
          <form onSubmit={doLogin} noValidate>
            <FormInput
              className="login-field"
              id="login-email"
              type="email"
              label={t("portalEmailLabel")}
              placeholder={t("portalEmailPlaceholder")}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: "" }));
              }}
              autoComplete="email"
              errorMessage={fieldErrors.email}
            />
            <FormInput
              className="login-field"
              id="login-password"
              type="password"
              label={t("portalPasswordLabel")}
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: "" }));
              }}
              autoComplete="current-password"
              errorMessage={fieldErrors.password}
            />
            {mode === "client" ? (
              <button type="button" className="forgot-link" onClick={openForgot}>
                {t("forgotPasswordLink")}
              </button>
            ) : null}
            <FeedbackBanner feedback={feedback} />
            <button
              type="submit"
              className="login-btn"
              disabled={submitting}
              style={submitting ? { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" } : undefined}
            >
              {submitting ? (
                <>
                  <LoadingSpinner size={18} />
                  <span>{t("portalLoginSubmitLoading")}</span>
                </>
              ) : (
                t("portalLoginSubmit")
              )}
            </button>
          </form>
        ) : null}

        <div className="login-powered">{t("portalPoweredBy")}</div>
      </div>
    </div>
  );
}
