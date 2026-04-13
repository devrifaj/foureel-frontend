import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import PortalClientView from "./portal/PortalClientView";
import PortalTeamView from "./portal/PortalTeamView";

export default function Portal() {
  const { t } = useLang();
  const { user, login, logout, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("client"); // 'client' | 'admin'
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "var(--bg)",
        }}
      >
        <div
          style={{
            fontFamily: "Montserrat",
            fontSize: "24px",
            fontWeight: "600",
            color: "var(--accent)",
          }}
        >
          4REEL
        </div>
      </div>
    );

  if (user?.role === "client") return <PortalClientView />;
  if (user?.role === "team") return <PortalTeamView />;

  const doLogin = async (e) => {
    e?.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await login(email, password);
      const loggedRole = result?.user?.role;
      const expectedRole = mode === "admin" ? "team" : "client";
      if (loggedRole !== expectedRole) {
        // Enforce selected login mode to prevent cross-role access from this screen.
        await logout();
        setError(
          mode === "admin" ? t("loginWrongRoleTeam") : t("loginWrongRoleClient")
        );
      }
    } catch (err) {
      setError(t("loginInvalid"));
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === "client" ? t("portalTitleClient") : t("portalTitleTeam");
  const subtitle =
    mode === "client" ? t("portalSubClient") : t("portalSubTeam");

  return (
    <div className="login-screen" id="login-screen">
      <div className="login-box">
        <div className="login-logo">4R</div>

        <div className="login-toggle" role="tablist" aria-label={t("portalLoginTypeAria")}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "client"}
            className={`login-toggle-btn${mode === "client" ? " is-active" : ""}`}
            onClick={() => setMode("client")}
          >
            {t("portalTabClient")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "admin"}
            className={`login-toggle-btn${mode === "admin" ? " is-active" : ""}`}
            onClick={() => setMode("admin")}
          >
            {t("portalTabTeam")}
          </button>
        </div>

        <div className="login-title">{title}</div>
        <div className="login-sub">{subtitle}</div>

        <form onSubmit={doLogin}>
          <div className="login-field">
            <label htmlFor="login-email">{t("portalEmailLabel")}</label>
            <input
              id="login-email"
              type="email"
              placeholder={t("portalEmailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="login-field">
            <label htmlFor="login-password">{t("portalPasswordLabel")}</label>
            <input
              id="login-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {/* <button
            type="button"
            className="forgot-link"
            onClick={() =>
              window.alert(
                "Neem contact op met 4REEL als je je wachtwoord bent vergeten."
              )
            }
          >
            Wachtwoord vergeten?
          </button> */}
          <button type="submit" className="login-btn" disabled={submitting}>
            {submitting ? t("portalLoginSubmitLoading") : t("portalLoginSubmit")}
          </button>
          <div
            className={`login-error${error ? " is-visible" : ""}`}
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        </form>
        <div className="login-powered">{t("portalPoweredBy")}</div>
      </div>
    </div>
  );
}
