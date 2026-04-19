import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PortalClientView from "./portal/PortalClientView";
import PortalTeamView from "./portal/PortalTeamView";

export default function Portal() {
  const { user, loading } = useAuth();

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

  if (!user) return <Navigate to="/login" replace />;

  if (user.role === "client") return <PortalClientView />;
  if (user.role === "team") return <PortalTeamView />;

  return <Navigate to="/login" replace />;
}
