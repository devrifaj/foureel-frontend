import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getBatches,
  getClients,
  getPortalNotes,
  getPortalUnreadSummary,
  getPortalVideos,
  markNotesRead,
  sendPortalNote,
  updateVideo,
} from "../../api";
import { useAuth } from "../../context/AuthContext";
import { DASHBOARD_BASE } from "../../paths";
import LoadingSpinner from "../../components/LoadingSpinner";

function useClientPortalData(clientId) {
  const notesQuery = useQuery({
    queryKey: ["portalNotes", clientId],
    queryFn: () => getPortalNotes(clientId),
    enabled: !!clientId,
  });
  const videosQuery = useQuery({
    queryKey: ["portalVideos", clientId],
    queryFn: () => getPortalVideos(clientId),
    enabled: !!clientId,
  });
  return {
    notes: notesQuery.data || [],
    reviewVideos: videosQuery.data || [],
    loading: notesQuery.isLoading || videosQuery.isLoading,
  };
}

export default function PortalTeamView() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [reply, setReply] = useState("");

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: getClients,
    refetchInterval: 15000,
  });
  const batchesQuery = useQuery({
    queryKey: ["batches"],
    queryFn: getBatches,
    refetchInterval: 15000,
  });
  const unreadQuery = useQuery({
    queryKey: ["portalUnreadSummary"],
    queryFn: getPortalUnreadSummary,
    refetchInterval: 10000,
  });
  const clients = clientsQuery.data || [];
  const batches = batchesQuery.data || [];
  const unreadSummary = unreadQuery.data || { byClient: {}, totalUnread: 0 };
  const hasDataError =
    clientsQuery.isError || batchesQuery.isError || unreadQuery.isError;

  const selectedClient =
    clients.find((c) => c._id === selectedId) || clients[0] || null;
  const clientId = selectedClient?._id;
  const { notes, reviewVideos, loading } = useClientPortalData(clientId);

  const sendMut = useMutation({
    mutationFn: () => sendPortalNote(clientId, reply, `${user?.name} · 4REEL`),
    onSuccess: () => {
      setReply("");
      qc.invalidateQueries({ queryKey: ["portalNotes", clientId] });
    },
  });
  const videoMut = useMutation({
    mutationFn: ({ batchId, videoId, payload }) => updateVideo(batchId, videoId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portalVideos", clientId] });
      qc.invalidateQueries({ queryKey: ["batches"] });
    },
  });

  const readMut = useMutation({
    mutationFn: () => markNotesRead(clientId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portalNotes", clientId] }),
  });

  const unreadByClient = useMemo(() => unreadSummary?.byClient || {}, [unreadSummary]);

  const deliveredCount = useMemo(
    () =>
      batches
        .flatMap((b) => b.videos || [])
        .filter((v) => v.approved || v.editFase === "client_approved").length,
    [batches],
  );

  const pendingReviewCount = useMemo(
    () =>
      batches
        .flatMap((b) => b.videos || [])
        .filter((v) =>
          ["waitreview", "client_review", "client_revision"].includes(v.editFase),
        ).length,
    [batches],
  );

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.portalEmail?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q),
    );
  }, [clients, search]);

  const unreadTotal = unreadSummary?.totalUnread || 0;

  const sendReply = () => {
    if (!reply.trim() || !clientId) return;
    sendMut.mutate();
  };
  const setVideoState = (video, mode) => {
    if (!video?.batchId || !video?._id) return;
    if (mode === "review")
      videoMut.mutate({
        batchId: video.batchId,
        videoId: video._id,
        payload: { editFase: "client_review" },
      });
    if (mode === "approved")
      videoMut.mutate({
        batchId: video.batchId,
        videoId: video._id,
        payload: {
          editFase: "client_approved",
          approved: true,
          approvedAt: new Date().toISOString(),
        },
      });
    if (mode === "revision")
      videoMut.mutate({
        batchId: video.batchId,
        videoId: video._id,
        payload: {
          editFase: "client_revision",
          revision: true,
          revisionNote: video.revisionNote || "Revisie nodig",
        },
      });
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header className="portal-header">
        <div className="portal-header-logo">
          <span>4REEL</span> Portaal Admin
        </div>
        <div className="portal-header-client">
          <span>{user?.name}</span>
          <a href={DASHBOARD_BASE} style={{ color: "var(--accent)", fontWeight: 600 }}>
            Dashboard
          </a>
          <button className="portal-logout" onClick={logout}>
            Uitloggen
          </button>
        </div>
      </header>

      <main style={{ padding: "28px 34px" }}>
        {hasDataError && (
          <div
            style={{
              marginBottom: "12px",
              border: "1px solid #e8c8c8",
              background: "#fef2f2",
              color: "#9f3a3a",
              borderRadius: "10px",
              padding: "10px 12px",
              fontSize: "13px",
            }}
          >
            Data kon niet geladen worden. Controleer of backend draait en je nog
            ingelogd bent.
          </div>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,minmax(140px,1fr))",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          {[
            [clients.length, "Clients", "var(--accent)"],
            [unreadTotal, "Ongelezen", "var(--orange)"],
            [pendingReviewCount, "In review", "var(--blue)"],
            [deliveredCount, "Opgeleverd", "var(--sage)"],
          ].map(([n, l, c]) => (
            <div
              key={l}
              style={{
                background: "white",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  fontFamily: "Montserrat",
                  fontSize: "26px",
                  fontWeight: 700,
                  color: c,
                }}
              >
                {n}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-3)" }}>{l}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "340px 1fr",
            gap: "16px",
            minHeight: "calc(100vh - 210px)",
          }}
        >
          <section
            style={{
              background: "white",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ padding: "12px", borderBottom: "1px solid var(--border)" }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Zoek client..."
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1.5px solid var(--border)",
                  borderRadius: "8px",
                }}
              />
            </div>
            <div style={{ overflowY: "auto" }}>
              {filteredClients.length === 0 && (
                <div style={{ padding: "14px", fontSize: "12px", color: "var(--text-3)" }}>
                  Geen clients gevonden.
                </div>
              )}
              {filteredClients.map((c) => {
                const active = c._id === clientId;
                const unread = unreadByClient[c._id] || 0;
                return (
                  <button
                    key={c._id}
                    onClick={() => {
                      setSelectedId(c._id);
                      setReply("");
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "12px 14px",
                      border: "none",
                      borderBottom: "1px solid var(--border)",
                      background: active ? "var(--accent-pale)" : "white",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "50%",
                        background: c.color || "var(--accent)",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      {(c.name || "?")
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600 }}>{c.name}</div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--text-3)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {c.email || "Geen portal e-mail"}
                      </div>
                    </div>
                    {unread > 0 && (
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          background: "var(--accent)",
                          color: "white",
                          borderRadius: "10px",
                          padding: "2px 6px",
                        }}
                      >
                        {unread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section
            style={{
              background: "white",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "16px",
              overflow: "auto",
            }}
          >
            {!selectedClient ? (
              <div style={{ color: "var(--text-3)" }}>Geen client geselecteerd.</div>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "14px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: "Montserrat",
                        fontSize: "22px",
                        fontWeight: 600,
                      }}
                    >
                      {selectedClient.name}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-3)" }}>
                      Portal login: {selectedClient.portalEmail || "Niet ingesteld"}
                    </div>
                  </div>
                  <button
                    onClick={() => readMut.mutate()}
                    className="btn btn-ghost btn-sm"
                  >
                    Markeer gelezen
                  </button>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-3)",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      marginBottom: "8px",
                    }}
                  >
                    Videos in review ({reviewVideos.length})
                  </div>
                  {loading ? (
                    <div style={{ color: "var(--text-3)" }}>Laden...</div>
                  ) : reviewVideos.length === 0 ? (
                    <div style={{ color: "var(--text-3)" }}>Geen videos in review.</div>
                  ) : (
                    reviewVideos.map((v) => (
                      <div
                        key={v._id}
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          padding: "10px 12px",
                          marginBottom: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 600 }}>{v.name}</div>
                          {v.revisionNote && (
                            <div style={{ fontSize: "11px", color: "var(--amber)" }}>
                              Revisie: {v.revisionNote}
                            </div>
                          )}
                        </div>
                        {v.frameUrl ? (
                          <a
                            href={v.frameUrl}
                            target="_blank"
                            rel="noopener"
                            style={{ fontSize: "12px", color: "var(--blue)" }}
                          >
                            Frame.io
                          </a>
                        ) : null}
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setVideoState(v, "review")}>In review</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setVideoState(v, "revision")}>Revisie</button>
                          <button className="btn btn-primary btn-sm" onClick={() => setVideoState(v, "approved")}>Akkoord</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--text-3)",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    marginBottom: "8px",
                  }}
                >
                  Chat
                </div>
                <div
                  style={{
                    maxHeight: "320px",
                    overflowY: "auto",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "10px",
                    marginBottom: "10px",
                    background: "var(--bg-alt)",
                  }}
                >
                  {notes.map((n) => (
                    <div
                      key={n._id}
                      style={{
                        marginBottom: "8px",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        background: n.from === "client" ? "white" : "#EFF4FF",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div style={{ fontSize: "10px", color: "var(--text-3)" }}>
                        {n.author} · {new Date(n.createdAt).toLocaleDateString("nl-NL")}
                      </div>
                      <div style={{ fontSize: "13px" }}>{n.text}</div>
                    </div>
                  ))}
                  {notes.length === 0 && (
                    <div style={{ fontSize: "12px", color: "var(--text-3)" }}>
                      Nog geen berichten.
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={2}
                    placeholder="Typ een bericht..."
                    style={{
                      flex: 1,
                      border: "1.5px solid var(--border)",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      resize: "none",
                    }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={sendReply}
                    disabled={!reply.trim() || sendMut.isPending}
                    style={sendMut.isPending ? { display: "inline-flex", alignItems: "center", gap: "8px" } : undefined}
                  >
                    {sendMut.isPending ? (
                      <>
                        <LoadingSpinner size={18} />
                        <span>Stuur</span>
                      </>
                    ) : (
                      "Stuur"
                    )}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
