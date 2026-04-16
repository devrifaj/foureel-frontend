import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import {
  getBatches,
  updateVideo,
  deleteVideo,
  addVideo,
  createBatch,
  deleteBatch,
  getClients,
  updateBatch,
} from "../../api";

const FASE_MAP = {
  tentative: { label: "Tentative", cls: "ws-ef-tentative", group: "intern" },
  spotting: {
    label: "Spotting Footage",
    cls: "ws-ef-spotting",
    group: "intern",
  },
  inprogress: {
    label: "In Progress",
    cls: "ws-ef-inprogress",
    group: "intern",
  },
  ready: { label: "Ready to Edit", cls: "ws-ef-ready", group: "intern" },
  intern_review: {
    label: "Intern Review",
    cls: "ws-ef-waitreview",
    group: "intern",
  },
  intern_approved: {
    label: "Intern Goedgekeurd ✓",
    cls: "ws-ef-uploaddrive",
    group: "intern",
  },
  waitreview: {
    label: "Stuur naar klant →",
    cls: "ws-ef-waitreview",
    group: "client",
  },
  client_review: {
    label: "In review bij klant",
    cls: "ws-ef-feedbackrdy",
    group: "client",
  },
  client_revision: {
    label: "Revisie aangevraagd",
    cls: "ws-ef-spotting",
    group: "client",
  },
  client_approved: {
    label: "Goedgekeurd door klant ✓",
    cls: "ws-ef-finished",
    group: "client",
  },
  uploaddrive: {
    label: "Upload to Drive",
    cls: "ws-ef-uploaddrive",
    group: "done",
  },
  finished: { label: "Finished ✓", cls: "ws-ef-finished", group: "done" },
};

const GROUPS = [
  { key: "intern", label: "── Intern ──" },
  { key: "client", label: "── Klant ──" },
  { key: "done", label: "── Afronden ──" },
];
const WS_TABS = [
  { key: "inbox", label: "Project Inbox", icon: "📥" },
  { key: "stage", label: "Project Stage", icon: "🎯" },
  { key: "deadlines", label: "Posting Deadlines", icon: "📅" },
  { key: "shoots", label: "Scheduled Shoots", icon: "🎬" },
  { key: "month", label: "Month View", icon: "🗓" },
];
const SHOOT_STATUS_MAP = {
  wrapped: { label: "Wrapped", cls: "ws-ss-wrapped" },
  tentative: { label: "Tentative", cls: "ws-ss-tentative" },
  waiting: { label: "Waiting on Client", cls: "ws-ss-waiting" },
  planned: { label: "Planned", cls: "ws-ss-planned" },
};
const PROJECT_STAGE_MAP = {
  development: { label: "Development", cls: "ws-ps-development" },
  preproduction: { label: "Pre-Production", cls: "ws-ps-preproduction" },
  shooting: { label: "Shooting", cls: "ws-ps-shooting" },
  "post-production": { label: "Post-Production", cls: "ws-ps-postproduction" },
  completed: { label: "Completed", cls: "ws-ps-completed" },
};
const AV_COLORS = {
  Paolo: "var(--accent)",
  Lex: "var(--sage)",
  Rick: "var(--blue)",
  Ray: "var(--amber)",
  Boy: "var(--text-3)",
};
const AV_INIT = {
  Paolo: "P",
  Lex: "L",
  Rick: "R",
  Ray: "Ra",
  Boy: "B",
};
const WS_RES_TABS = [
  { key: "scripts", label: "Scripts & Docs", icon: "📄" },
  { key: "props", label: "Props", icon: "🎭" },
  { key: "cast", label: "Cast", icon: "👤" },
  { key: "shotlist", label: "Shotlist", icon: "🎬" },
  { key: "moodboard", label: "Moodboard & Refs", icon: "🖼️" },
  { key: "interview", label: "Interview vragen", icon: "💬" },
];

function FaseSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        fontSize: "10px",
        fontWeight: "700",
        width: "100%",
        border: "1.5px solid var(--border)",
        borderRadius: "6px",
        padding: "3px 8px",
        cursor: "pointer",
        fontFamily: "DM Sans,sans-serif",
        background: "var(--bg-alt)",
      }}
    >
      {GROUPS.map((g) => (
        <optgroup key={g.key} label={g.label}>
          {Object.entries(FASE_MAP)
            .filter(([, m]) => m.group === g.key)
            .map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

export default function WorkspaceView() {
  const { user } = useAuth();
  const [wsTab, setWsTab] = useState("inbox");
  const [batchId, setBatchId] = useState(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [newBatch, setNewBatch] = useState({
    name: "",
    client: "",
    editor: "Lex",
    projectStage: "preproduction",
    shootDate: "",
    deadline: "",
  });
  const [scriptVideo, setScriptVideo] = useState(null);
  const [scriptDraft, setScriptDraft] = useState("");
  const [shotVideo, setShotVideo] = useState(null);
  const [shotDraft, setShotDraft] = useState("");
  const [shootMode, setShootMode] = useState(false);
  const [sopVideo, setSopVideo] = useState(null);
  const [sopDraft, setSopDraft] = useState(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [newVideoName, setNewVideoName] = useState("");
  const [newLink, setNewLink] = useState({ label: "", url: "" });
  const [resTab, setResTab] = useState("scripts");
  const [resDraftName, setResDraftName] = useState("");
  const [resDraftNote, setResDraftNote] = useState("");
  const shotOverlayRef = useRef(null);
  const qc = useQueryClient();

  const { data: batches = [] } = useQuery({
    queryKey: ["batches"],
    queryFn: getBatches,
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: getClients,
  });
  const updateMut = useMutation({
    mutationFn: ({ bId, vId, ...d }) => updateVideo(bId, vId, d),
    onSuccess: () => qc.invalidateQueries(["batches"]),
  });
  const createBatchMut = useMutation({
    mutationFn: createBatch,
    onSuccess: (created) => {
      qc.invalidateQueries(["batches"]);
      if (created?._id) setBatchId(created._id);
    },
  });
  const deleteBatchMut = useMutation({
    mutationFn: deleteBatch,
    onSuccess: () => {
      qc.invalidateQueries(["batches"]);
      if (batchId) setBatchId(null);
    },
  });
  const updateBatchMut = useMutation({
    mutationFn: ({ id, data }) => updateBatch(id, data),
    onSuccess: () => qc.invalidateQueries(["batches"]),
  });

  const batch = batches.find((b) => b._id === batchId);
  const formatShortDate = (isoDate) => {
    if (!isoDate) return "—";
    const dt = new Date(isoDate);
    if (Number.isNaN(dt.getTime())) return "—";
    return new Intl.DateTimeFormat("nl-NL", {
      month: "short",
      day: "numeric",
    }).format(dt);
  };

  const filteredBatches = useMemo(() => {
    const list = [...batches];
    if (wsTab === "stage") {
      const order = [
        "development",
        "preproduction",
        "shooting",
        "post-production",
        "completed",
      ];
      list.sort(
        (a, b) => order.indexOf(a.projectStage) - order.indexOf(b.projectStage),
      );
      return list;
    }
    if (wsTab === "deadlines") {
      return list
        .filter((b) => !!b.deadline)
        .sort(
          (a, b) =>
            new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
        );
    }
    if (wsTab === "shoots") {
      return list
        .filter((b) => !!b.shootDate)
        .sort(
          (a, b) =>
            new Date(b.shootDate).getTime() - new Date(a.shootDate).getTime(),
        );
    }
    if (wsTab === "month") {
      const now = new Date();
      return list.filter((b) => {
        if (!b.deadline) return false;
        const dt = new Date(b.deadline);
        return (
          !Number.isNaN(dt.getTime()) &&
          dt.getMonth() === now.getMonth() &&
          dt.getFullYear() === now.getFullYear()
        );
      });
    }
    return list.sort((a, b) => {
      const ad = a.shootDate ? new Date(a.shootDate).getTime() : -Infinity;
      const bd = b.shootDate ? new Date(b.shootDate).getTime() : -Infinity;
      return bd - ad;
    });
  }, [batches, wsTab]);

  const scriptWords = useMemo(
    () => (scriptDraft.trim() ? scriptDraft.trim().split(/\s+/).length : 0),
    [scriptDraft],
  );

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setShootMode(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const openScript = (video) => {
    setScriptVideo(video);
    setScriptDraft(video.script || "");
  };
  const saveScript = () => {
    if (!batch || !scriptVideo) return;
    updateMut.mutate({
      bId: batch._id,
      vId: scriptVideo._id,
      script: scriptDraft,
    });
    setScriptVideo(null);
  };

  const openShotlist = (video) => {
    setShotVideo(video);
    setShotDraft("");
    setShootMode(false);
  };
  const saveShotlist = (nextShotlist) => {
    if (!batch || !shotVideo) return;
    updateMut.mutate({
      bId: batch._id,
      vId: shotVideo._id,
      shotlist: nextShotlist,
    });
  };
  const toggleShot = (idx) => {
    if (!shotVideo) return;
    const list = (shotVideo.shotlist || []).map((s, i) =>
      i === idx ? { ...s, done: !s.done } : s,
    );
    setShotVideo({ ...shotVideo, shotlist: list });
    saveShotlist(list);
  };
  const addShot = () => {
    if (!shotVideo || !shotDraft.trim()) return;
    const list = [
      ...(shotVideo.shotlist || []),
      { text: shotDraft.trim(), done: false },
    ];
    setShotVideo({ ...shotVideo, shotlist: list });
    saveShotlist(list);
    setShotDraft("");
  };
  const removeShot = (idx) => {
    if (!shotVideo) return;
    const list = (shotVideo.shotlist || []).filter((_, i) => i !== idx);
    setShotVideo({ ...shotVideo, shotlist: list });
    saveShotlist(list);
  };
  const resetShots = () => {
    if (!shotVideo) return;
    const list = (shotVideo.shotlist || []).map((s) => ({ ...s, done: false }));
    setShotVideo({ ...shotVideo, shotlist: list });
    saveShotlist(list);
  };
  const toggleShootMode = async () => {
    if (!shotOverlayRef.current) return;
    if (!shootMode) {
      try {
        if (!document.fullscreenElement)
          await shotOverlayRef.current.requestFullscreen();
      } catch (_) {}
      setShootMode(true);
    } else {
      if (document.fullscreenElement) await document.exitFullscreen();
      setShootMode(false);
    }
  };

  const openSop = (video) => {
    setSopVideo(video);
    setSopDraft({
      format: video.sop?.format || "",
      muziek: video.sop?.muziek || "",
      kleurprofiel: video.sop?.kleurprofiel || "",
      extraNotes: video.sop?.extraNotes || "",
      ratioTags: video.sop?.ratioTags || [],
      stijlTags: video.sop?.stijlTags || [],
    });
  };
  const saveSop = () => {
    if (!batch || !sopVideo || !sopDraft) return;
    updateMut.mutate({ bId: batch._id, vId: sopVideo._id, sop: sopDraft });
    setSopVideo(null);
  };

  const ratioOptions = ["9:16", "16:9", "1:1", "4:5"];
  const styleOptions = ["Cinematic", "Fast Cuts", "Minimal", "Bold", "Story"];
  const toggleTag = (key, value) => {
    if (!sopDraft) return;
    const arr = sopDraft[key] || [];
    const next = arr.includes(value)
      ? arr.filter((x) => x !== value)
      : [...arr, value];
    setSopDraft({ ...sopDraft, [key]: next });
  };

  const createNewBatch = () => {
    if (!newBatch.name.trim()) return;
    if (!newBatch.client || !newBatch.editor || !newBatch.projectStage) return;
    createBatchMut.mutate(
      {
        name: newBatch.name.trim(),
        client: newBatch.client,
        editor: newBatch.editor,
        projectStage: newBatch.projectStage,
        shootStatus: "planned",
        deadline: newBatch.deadline,
        shootDate: newBatch.shootDate,
        videos: [],
      },
      {
        onSuccess: () => {
          setShowBatchModal(false);
          setNewBatch({
            name: "",
            client: "",
            editor: "Lex",
            projectStage: "preproduction",
            shootDate: "",
            deadline: "",
          });
        },
      },
    );
  };

  const createNewVideo = async () => {
    if (!batch || !newVideoName.trim()) return;
    await addVideo(batch._id, {
      name: newVideoName.trim(),
      editFase: "tentative",
    });
    setNewVideoName("");
    setShowVideoModal(false);
    qc.invalidateQueries(["batches"]);
  };

  if (user?.role !== "team") {
    return <Navigate to="/portaal" replace />;
  }

  if (batch) {
    const done = batch.videos.filter((v) => v.editFase === "finished").length;
    const total = batch.videos.length;
    const links = batch.links || [];
    const resources = batch.resources || {};
    const activeResources = resources[resTab] || [];
    const workflowSteps = [
      {
        n: 1,
        icon: "⬇️",
        title: "Assets downloaden",
        desc: "Download de footage via de Drive-link hierboven. Sla elke batch op in een aparte map op je lokale schijf. Hernoem de bestanden NIET.",
      },
      {
        n: 2,
        icon: "✂️",
        title: "Project aanmaken in Premiere",
        desc: "Gebruik de Premiere Pro template via de link hierboven. Laad de LUTs-map in voor het correcte kleurprofiel per project.",
      },
      {
        n: 3,
        icon: "🎬",
        title: 'Edit uitvoeren → status op "In Progress"',
        desc: "Monteer de video op basis van de shotlist en interviewvragen. Zet de Edit Fase van jouw filmpje op In Progress zodra je begint.",
      },
      {
        n: 4,
        icon: "📤",
        title: "Exporteren met exacte bestandsnaam",
        desc: "Exporteer met de exacte naam zoals in de tabel hieronder, inclusief versienummer.",
      },
      {
        n: 5,
        icon: "🔗",
        title: "Upload naar Frame.io → link in Export kolom",
        desc: "Upload het geëxporteerde filmpje naar Frame.io en plak de link in Export Frame.io.",
      },
      {
        n: 6,
        icon: "✅",
        title: 'Edit Fase → "Waiting for Review"',
        desc: "Zet de Edit Fase op Waiting for Review. Na goedkeuring → Finished.",
      },
    ];

    const setBatchField = (field, value) => {
      updateBatchMut.mutate({ id: batch._id, data: { [field]: value } });
    };

    const addProjectLink = () => {
      const label = newLink.label.trim();
      const url = newLink.url.trim();
      if (!url) return;
      const next = [...links, { label: label || url, url }];
      updateBatchMut.mutate({ id: batch._id, data: { links: next } });
      setNewLink({ label: "", url: "" });
    };

    const deleteProjectLink = (index) => {
      const next = links.filter((_, i) => i !== index);
      updateBatchMut.mutate({ id: batch._id, data: { links: next } });
    };

    const addResourceItem = () => {
      const name = resDraftName.trim();
      const note = resDraftNote.trim();
      if (!name) return;
      const nextResources = {
        ...resources,
        [resTab]: [...activeResources, { name, note, status: "" }],
      };
      updateBatchMut.mutate({
        id: batch._id,
        data: { resources: nextResources },
      });
      setResDraftName("");
      setResDraftNote("");
    };

    const deleteResourceItem = (idx) => {
      const nextResources = {
        ...resources,
        [resTab]: activeResources.filter((_, i) => i !== idx),
      };
      updateBatchMut.mutate({
        id: batch._id,
        data: { resources: nextResources },
      });
    };

    return (
      <>
        <section className="view active ws-detail-surface">
          <div className="ws-detail-topbar">
            <div className="ws-detail-breadcrumbs">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setBatchId(null)}
              >
                ← Alle batches
              </button>
              <span
                style={{ fontSize: "13px", color: "var(--text-3)" }}
                id="ws-crumb"
              ></span>
              <span className="ws-detail-chip">👤 {batch.client || "—"}</span>
              <span className="ws-detail-chip ws-detail-chip-current">
                📁 {batch.name}
              </span>
            </div>
            <div className="ws-detail-actions">
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: "#c04040", borderColor: "#e8c8c8" }}
                onClick={() => {
                  if (window.confirm(`"${batch.name}" verwijderen?`)) {
                    deleteBatchMut.mutate(batch._id, {
                      onSuccess: () => setBatchId(null),
                    });
                  }
                }}
              >
                Batch verwijderen
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowVideoModal(true)}
              >
                + Filmpje
              </button>
            </div>
          </div>

          <div
            className="ws-detail-card"
            style={{
              background: "var(--card)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow)",
              padding: "16px 16px 18px",
              marginBottom: "14px",
            }}
          >
            <div
              className="ws-detail-hero"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "14px",
              }}
            >
              <div style={{ fontSize: "26px" }}>{batch.emoji || "🎬"}</div>
              <div>
                <div
                  className="ws-detail-hero-title"
                  style={{
                    fontFamily: "Montserrat",
                    fontSize: "34px",
                    fontWeight: "500",
                    lineHeight: 1.05,
                  }}
                >
                  {batch.name}
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-3)" }}>
                  {batch.client} · Shoot: {batch.shootDate || "—"}
                </div>
              </div>
            </div>
            <div
              className="ws-prop-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6,minmax(0,1fr))",
                gap: "10px",
                marginBottom: "10px",
              }}
            >
              <div className="ws-prop-tile">
                <div className="ws-prop-tile-label">Shoot Status</div>
                <select
                  className="form-select"
                  value={batch.shootStatus || "planned"}
                  onChange={(e) => setBatchField("shootStatus", e.target.value)}
                >
                  <option value="wrapped">Wrapped</option>
                  <option value="tentative">Tentative</option>
                  <option value="waiting">Waiting on Client</option>
                  <option value="planned">Planned</option>
                </select>
              </div>
              <div className="ws-prop-tile">
                <div className="ws-prop-tile-label">Shoot Datum</div>
                <input
                  className="form-input"
                  type="date"
                  value={batch.shootDate || ""}
                  onChange={(e) => setBatchField("shootDate", e.target.value)}
                />
              </div>
              <div className="ws-prop-tile">
                <div className="ws-prop-tile-label">Deadline</div>
                <input
                  className="form-input"
                  type="date"
                  value={batch.deadline || ""}
                  onChange={(e) => setBatchField("deadline", e.target.value)}
                />
              </div>
              <div className="ws-prop-tile">
                <div className="ws-prop-tile-label">Editor</div>
                <select
                  className="form-select"
                  value={batch.editor || "Lex"}
                  onChange={(e) => setBatchField("editor", e.target.value)}
                >
                  {["Paolo", "Lex", "Rick", "Ray", "Boy"].map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ws-prop-tile">
                <div className="ws-prop-tile-label">Project Stage</div>
                <select
                  className="form-select"
                  value={batch.projectStage || "preproduction"}
                  onChange={(e) =>
                    setBatchField("projectStage", e.target.value)
                  }
                >
                  <option value="development">Development</option>
                  <option value="preproduction">Pre-Production</option>
                  <option value="shooting">Shooting</option>
                  <option value="post-production">Post-Production</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="ws-prop-tile">
                <div className="ws-prop-tile-label">Klant</div>
                <input
                  className="form-input"
                  value={batch.client || ""}
                  onChange={(e) => setBatchField("client", e.target.value)}
                />
              </div>
            </div>
            <div className="ws-prop-tile ws-prop-tile-wide">
              <div className="ws-prop-tile-label">Batch notities</div>
              <textarea
                className="ws-prop-area"
                value={batch.notes || ""}
                onChange={(e) => setBatchField("notes", e.target.value)}
              />
            </div>
          </div>

          <div
            className="ws-detail-card"
            style={{
              background: "var(--card)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow)",
              padding: "14px",
              marginBottom: "14px",
            }}
          >
            <div className="ws-sop-title">
              🔗 Project links (Drive · LUTs · B-Roll · Premiere)
            </div>
            {links.map((lk, idx) => (
              <div key={`${lk.url}-${idx}`} className="ws-link-row-item">
                <span style={{ display: "inline-flex", width: "20px" }}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 87.3 78"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
                      fill="#0066da"
                    ></path>
                    <path
                      d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
                      fill="#00ac47"
                    ></path>
                    <path
                      d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
                      fill="#ea4335"
                    ></path>
                    <path
                      d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
                      fill="#00832d"
                    ></path>
                    <path
                      d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
                      fill="#2684fc"
                    ></path>
                    <path
                      d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
                      fill="#ffba00"
                    ></path>
                  </svg>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "12px", fontWeight: 600 }}>
                    {lk.label}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-3)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {lk.url}
                  </div>
                </div>
                <a
                  href={
                    lk.url?.startsWith("http") ? lk.url : `https://${lk.url}`
                  }
                  target="_blank"
                  rel="noopener"
                  style={{ fontSize: "11px", color: "var(--text-2)" }}
                >
                  Openen ↗
                </a>
                <button
                  className="link-row-remove"
                  onClick={() => deleteProjectLink(idx)}
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="ws-link-add-row" style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <input
                className="form-input"
                style={{ maxWidth: "220px" }}
                placeholder="Label (bijv. LUTs folder)"
                value={newLink.label}
                onChange={(e) =>
                  setNewLink((p) => ({ ...p, label: e.target.value }))
                }
              />
              <input
                className="form-input"
                placeholder="https://drive.google.com/..."
                value={newLink.url}
                onChange={(e) =>
                  setNewLink((p) => ({ ...p, url: e.target.value }))
                }
              />
              <button
                className="btn btn-primary btn-sm ws-link-add-btn"
                onClick={addProjectLink}
              >
                + Link toevoegen
              </button>
            </div>
          </div>

          <div
            className="ws-detail-card"
            style={{
              background: "var(--card)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow)",
              padding: "14px",
              marginBottom: "14px",
            }}
          >
            <div className="ws-sop-title">
              📋 Workflow — hoe werken we met deze bestanden?
            </div>
            <div>
              {workflowSteps.map((s, i) => (
                <div
                  className="ws-workflow-step"
                  key={s.n}
                  style={{
                    display: "flex",
                    gap: "12px",
                    padding: "11px 0",
                    borderBottom:
                      i === workflowSteps.length - 1
                        ? "none"
                        : "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "50%",
                      background: "var(--sidebar)",
                      color: "#FAF7F2",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      fontWeight: "700",
                      flexShrink: 0,
                      marginTop: "1px",
                    }}
                  >
                    {s.n}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "var(--text)",
                        marginBottom: "3px",
                      }}
                    >
                      {s.icon} {s.title}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--text-2)",
                        lineHeight: 1.6,
                      }}
                    >
                      {s.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="ws-detail-card"
            style={{
              background: "var(--card)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow)",
              overflow: "hidden",
            }}
          >
            <div
              className="ws-videos-head"
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  fontFamily: "Montserrat",
                  fontSize: "12px",
                  fontWeight: "700",
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: "var(--text-3)",
                }}
              >
                Filmpjes in batch ({total})
              </div>
              <div
                className="ws-videos-head-right"
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <div style={{ fontSize: "12px", color: "var(--text-3)" }}>
                  {done}/{total} klaar ·{" "}
                  {Math.round((done / Math.max(total, 1)) * 100)}%
                </div>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="ws-table">
                <thead>
                  <tr>
                    {[
                      "#",
                      "Bestandsnaam",
                      "Edit Fase",
                      "Assets Drive",
                      "Export Frame.io",
                      "📝 Script",
                      "📁 Brand Assets",
                      "🎬 Shotlist",
                      "📋 SOP",
                      "Notities",
                      "",
                    ].map((h) => (
                      <th key={h} className="ws-th">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batch.videos.map((v, i) => {
                    const shots = v.shotlist || [];
                    const done = shots.filter((s) => s.done).length;
                    const ef = FASE_MAP[v.editFase];
                    return (
                      <tr key={v._id} className="ws-tr ws-vid-row">
                        <td className="ws-td">
                          <div
                            className="ws-td-inner"
                            style={{
                              color: "var(--text-3)",
                              fontSize: "11px",
                              fontWeight: "600",
                            }}
                          >
                            {i + 1}
                          </div>
                        </td>
                        <EditCell
                          value={v.name}
                          placeholder="Bestandsnaam…"
                          onSave={(val) =>
                            updateMut.mutate({
                              bId: batch._id,
                              vId: v._id,
                              name: val,
                            })
                          }
                          icon="📄"
                          textWeight={500}
                        />
                        <td className="ws-td" style={{ padding: 0 }}>
                          <div style={{ padding: "4px 8px" }}>
                            {ef && (
                              <span className={`ws-pill ${ef.cls}`}>
                                {ef.label}
                              </span>
                            )}
                            <FaseSelect
                              value={v.editFase}
                              onChange={(val) =>
                                updateMut.mutate({
                                  bId: batch._id,
                                  vId: v._id,
                                  editFase: val,
                                })
                              }
                            />
                          </div>
                        </td>
                        <EditCell
                          value={v.assets}
                          placeholder="+ Drive link"
                          onSave={(val) =>
                            updateMut.mutate({
                              bId: batch._id,
                              vId: v._id,
                              assets: val,
                            })
                          }
                          isLink
                        />
                        <EditCell
                          value={v.export}
                          placeholder="+ Frame.io link"
                          onSave={(val) =>
                            updateMut.mutate({
                              bId: batch._id,
                              vId: v._id,
                              export: val,
                            })
                          }
                          isLink
                        />
                        <td className="ws-td" onClick={() => openScript(v)}>
                          <div className="ws-td-inner">
                            {v.script ? (
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "var(--text-2)",
                                }}
                              >
                                Open script
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--text-3)",
                                  fontStyle: "italic",
                                }}
                              >
                                Script toevoegen…
                              </span>
                            )}
                          </div>
                        </td>
                        <EditCell
                          value={v.driveLink}
                          placeholder="Drive link…"
                          onSave={(val) =>
                            updateMut.mutate({
                              bId: batch._id,
                              vId: v._id,
                              driveLink: val,
                            })
                          }
                          isLink
                        />
                        <td className="ws-td" onClick={() => openShotlist(v)}>
                          <div
                            className="ws-td-inner"
                            style={{ flexDirection: "column", gap: "3px" }}
                          >
                            {shots.length > 0 ? (
                              <>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                  }}
                                >
                                  <div
                                    style={{
                                      flex: 1,
                                      height: "5px",
                                      background: "var(--border)",
                                      borderRadius: "3px",
                                      overflow: "hidden",
                                    }}
                                  >
                                    <div
                                      style={{
                                        height: "100%",
                                        background: "var(--sage)",
                                        width: `${Math.round((done / shots.length) * 100)}%`,
                                      }}
                                    />
                                  </div>
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      fontWeight: "700",
                                      color: "var(--sage)",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {done}/{shots.length}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--text-3)",
                                  fontStyle: "italic",
                                }}
                              >
                                Shotlist aanmaken…
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="ws-td" onClick={() => openSop(v)}>
                          <div className="ws-td-inner">
                            {(v.sop?.ratioTags || []).slice(0, 1).map((t) => (
                              <span
                                key={t}
                                style={{
                                  fontSize: "9px",
                                  fontWeight: "700",
                                  padding: "2px 6px",
                                  borderRadius: "10px",
                                  background: "var(--accent-pale)",
                                  color: "var(--accent)",
                                }}
                              >
                                {t}
                              </span>
                            ))}
                            {!v.sop?.ratioTags?.length && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--text-3)",
                                  fontStyle: "italic",
                                }}
                              >
                                SOP invullen…
                              </span>
                            )}
                          </div>
                        </td>
                        <EditCell
                          value={v.notes}
                          placeholder="Notitie…"
                          onSave={(val) =>
                            updateMut.mutate({
                              bId: batch._id,
                              vId: v._id,
                              notes: val,
                            })
                          }
                        />
                        <td className="ws-td">
                          <div className="ws-tr-actions">
                            {v.editFase === "client_approved" ? (
                              <span className="ws-action-muted ws-action-ok">
                                ✓ Klant akkoord
                              </span>
                            ) : v.editFase === "waitreview" ||
                              v.editFase === "client_review" ||
                              v.editFase === "client_revision" ? (
                              <span className="ws-action-muted ws-action-client">
                                👁 Bij klant
                              </span>
                            ) : (
                              <button
                                type="button"
                                className={`ws-portal-btn ${
                                  v.editFase === "intern_approved"
                                    ? "ws-portal-btn-ready"
                                    : "ws-portal-btn-muted"
                                }`}
                                title={
                                  v.editFase === "intern_approved"
                                    ? "Intern goedgekeurd — stuur naar klant"
                                    : "Eerst intern goedkeuren"
                                }
                                onClick={() => {
                                  if (v.editFase !== "intern_approved") {
                                    window.alert("Eerst intern goedkeuren");
                                    return;
                                  }
                                  updateMut.mutate({
                                    bId: batch._id,
                                    vId: v._id,
                                    editFase: "waitreview",
                                  });
                                }}
                              >
                                {v.editFase === "intern_approved"
                                  ? "→ Stuur naar klant"
                                  : "→ Portaal"}
                              </button>
                            )}
                            <button
                              type="button"
                              className="ws-video-delete-btn"
                              aria-label="Video verwijderen"
                              onClick={async () => {
                                if (window.confirm("Video verwijderen?")) {
                                  await deleteVideo(batch._id, v._id);
                                  qc.invalidateQueries(["batches"]);
                                }
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div
            className="ws-detail-card"
            style={{
              background: "var(--card)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow)",
              marginTop: "14px",
              overflow: "hidden",
            }}
          >
            <div className="ws-res-tabs">
              {WS_RES_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`ws-res-tab${resTab === tab.key ? " active" : ""}`}
                  onClick={() => {
                    setResTab(tab.key);
                    setResDraftName("");
                    setResDraftNote("");
                  }}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="ws-res-body">
              {activeResources.map((item, idx) => (
                <div key={`${item.name}-${idx}`} className="ws-res-item">
                  <span className="ws-res-item-icon">📄</span>
                  <div className="ws-res-item-name">{item.name}</div>
                  <div className="ws-res-item-meta">
                    {item.note || item.status || "—"}
                  </div>
                  <button
                    type="button"
                    className="ws-res-item-del"
                    onClick={() => deleteResourceItem(idx)}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <div
                className="ws-res-add-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 1fr auto",
                  gap: "8px",
                  marginTop: "8px",
                }}
              >
                <input
                  className="form-input"
                  placeholder="Naam"
                  value={resDraftName}
                  onChange={(e) => setResDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addResourceItem();
                  }}
                />
                <input
                  className="form-input"
                  placeholder="Notitie (optioneel)"
                  value={resDraftNote}
                  onChange={(e) => setResDraftNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addResourceItem();
                  }}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={addResourceItem}
                  disabled={!resDraftName.trim()}
                >
                  + Toevoegen
                </button>
              </div>
            </div>
          </div>
        </section>

        {showVideoModal && (
          <div
            className="modal-overlay open"
            onMouseDown={() => setShowVideoModal(false)}
          >
            <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">Nieuw filmpje</div>
                <button
                  className="modal-close"
                  onClick={() => setShowVideoModal(false)}
                >
                  ✕
                </button>
              </div>
              <div className="form-group">
                <label className="form-label">Bestandsnaam</label>
                <input
                  className="form-input"
                  value={newVideoName}
                  onChange={(e) => setNewVideoName(e.target.value)}
                  placeholder="Bijv. Kalea_Intro_Reel_v1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createNewVideo();
                  }}
                />
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowVideoModal(false)}
                >
                  Annuleren
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!newVideoName.trim()}
                  onClick={createNewVideo}
                >
                  Toevoegen
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <section className="view active">
        <div className="page-header ws-page-header">
          <div>
            <div className="page-title">
              Workspace <em>— Editors</em>
            </div>
            <div className="page-subtitle">
              Project batches filmpjes statussen resources
            </div>
          </div>
          <button
            className="ws-new-btn"
            onClick={() => setShowBatchModal(true)}
          >
            + Nieuwe batch
          </button>
        </div>
        <div
          style={{
            background: "var(--card)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow)",
            overflow: "hidden",
          }}
        >
          <div className="ws-tabs">
            {WS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`ws-tab${wsTab === tab.key ? " active" : ""}`}
                data-wstab={tab.key}
                onClick={() => setWsTab(tab.key)}
              >
                <span className="ws-tab-icon">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="ws-table-wrap">
            <table className="ws-table">
              <thead>
                <tr>
                  <th className="ws-th">Shoot date</th>
                  <th className="ws-th">Shoot status</th>
                  <th className="ws-th" style={{ minWidth: 220 }}>
                    Batch / Project
                  </th>
                  <th className="ws-th">Videos</th>
                  <th className="ws-th" style={{ minWidth: 130 }}>
                    Progress
                  </th>
                  <th className="ws-th">Deadline</th>
                  <th className="ws-th">Stage</th>
                  <th className="ws-th">Editor</th>
                  <th className="ws-th">Client</th>
                  <th className="ws-th" style={{ width: 36 }} />
                </tr>
              </thead>
              <tbody>
                {filteredBatches.map((b) => {
                  const videos = b.videos || [];
                  const total = videos.length;
                  const done = videos.filter(
                    (v) => v.editFase === "finished",
                  ).length;
                  const pct = total ? Math.round((done / total) * 100) : 0;
                  const anyProgress = videos.some((v) =>
                    [
                      "inprogress",
                      "waitreview",
                      "client_review",
                      "client_revision",
                      "uploaddrive",
                    ].includes(v.editFase),
                  );
                  const allDone = total > 0 && done === total;
                  const barColor = allDone
                    ? "var(--sage)"
                    : anyProgress
                      ? "var(--amber)"
                      : "var(--blue)";
                  const shootStatus =
                    SHOOT_STATUS_MAP[b.shootStatus || "planned"];
                  const stage = PROJECT_STAGE_MAP[b.projectStage];
                  const editor = b.editor || "";
                  const editorColor = AV_COLORS[editor] || "var(--text-3)";
                  const editorInit =
                    AV_INIT[editor] || (editor ? editor.slice(0, 2) : "?");
                  return (
                    <tr
                      key={b._id}
                      className="ws-tr"
                      onClick={() => setBatchId(b._id)}
                    >
                      <td className="ws-td">
                        <div className="ws-td-inner">
                          <span
                            className={
                              b.shootDate ? "ws-date-cell" : "ws-date-empty"
                            }
                          >
                            {formatShortDate(b.shootDate)}
                          </span>
                        </div>
                      </td>
                      <td className="ws-td">
                        <div className="ws-td-inner">
                          {shootStatus ? (
                            <span className={`ws-pill ${shootStatus.cls}`}>
                              {shootStatus.label}
                            </span>
                          ) : (
                            <span className="ws-date-empty">—</span>
                          )}
                        </div>
                      </td>
                      <td className="ws-td">
                        <div className="ws-project-link">
                          <span
                            style={{ fontWeight: 500, color: "var(--text)" }}
                          >
                            {b.name}
                          </span>
                        </div>
                      </td>
                      <td className="ws-td">
                        <div className="ws-td-inner">
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "var(--text-2)",
                            }}
                          >
                            {total}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--text-3)",
                              marginLeft: 4,
                            }}
                          >
                            film{total === 1 ? "" : "s"}
                          </span>
                        </div>
                      </td>
                      <td className="ws-td">
                        <div
                          className="ws-td-inner"
                          style={{
                            flexDirection: "column",
                            alignItems: "flex-start",
                            padding: "8px 10px",
                            gap: 3,
                          }}
                        >
                          <div
                            style={{
                              width: "100%",
                              height: 5,
                              background: "var(--border)",
                              borderRadius: 4,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${pct}%`,
                                background: barColor,
                                borderRadius: 4,
                              }}
                            />
                          </div>
                          <span
                            style={{ fontSize: 10, color: "var(--text-3)" }}
                          >
                            {done}/{total} klaar
                          </span>
                        </div>
                      </td>
                      <td className="ws-td">
                        <div className="ws-td-inner">
                          {b.deadline ? (
                            <span
                              style={{ fontSize: 13, color: "var(--orange)" }}
                            >
                              {formatShortDate(b.deadline)}
                            </span>
                          ) : (
                            <span className="ws-date-empty">—</span>
                          )}
                        </div>
                      </td>
                      <td className="ws-td">
                        <div className="ws-td-inner">
                          {stage ? (
                            <span className={`ws-pill ${stage.cls}`}>
                              {stage.label}
                            </span>
                          ) : (
                            <span className="ws-date-empty">—</span>
                          )}
                        </div>
                      </td>
                      <td className="ws-td">
                        <div className="ws-td-inner">
                          {editor ? (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                              }}
                            >
                              <div
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: "50%",
                                  background: editorColor,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 8,
                                  fontWeight: 700,
                                  color: "white",
                                }}
                              >
                                {editorInit}
                              </div>
                              <span
                                style={{ fontSize: 12, color: "var(--text-2)" }}
                              >
                                {editor}
                              </span>
                            </div>
                          ) : (
                            <span className="ws-date-empty">—</span>
                          )}
                        </div>
                      </td>
                      <td className="ws-td">
                        <div className="ws-td-inner">
                          <span
                            style={{ fontSize: 12, color: "var(--text-2)" }}
                          >
                            {b.client || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="ws-td">
                        <div
                          className="ws-tr-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--text-3)",
                              fontSize: 13,
                              padding: 3,
                            }}
                            onClick={() => {
                              if (window.confirm(`"${b.name}" verwijderen?`))
                                deleteBatchMut.mutate(b._id);
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="ws-add-row" onClick={() => setShowBatchModal(true)}>
              + Nieuwe batch aanmaken
            </div>
          </div>
        </div>
      </section>

      {scriptVideo && (
        <div
          id="script-overlay"
          className="open"
          onMouseDown={() => setScriptVideo(null)}
        >
          <div id="script-box" onMouseDown={(e) => e.stopPropagation()}>
            <div id="script-head">
              <div id="script-head-title">Script — {scriptVideo.name}</div>
              <button
                className="modal-close"
                onClick={() => setScriptVideo(null)}
              >
                ✕
              </button>
            </div>
            <textarea
              id="script-textarea"
              value={scriptDraft}
              onChange={(e) => setScriptDraft(e.target.value)}
            />
            <div id="script-foot">
              <div id="script-char-count">
                {scriptWords} woorden · {scriptDraft.length} tekens
              </div>
              <button className="btn btn-primary btn-sm" onClick={saveScript}>
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}

      {shotVideo && (
        <div
          id="sl-overlay"
          ref={shotOverlayRef}
          className={`open${shootMode ? " shootmode" : ""}`}
          onMouseDown={() => setShotVideo(null)}
        >
          <div id="sl-box" onMouseDown={(e) => e.stopPropagation()}>
            <div id="sl-head">
              <div id="sl-head-title">Shotlist — {shotVideo.name}</div>
              <button
                className="modal-close"
                onClick={() => setShotVideo(null)}
              >
                ✕
              </button>
            </div>
            <div id="sl-progress-wrap">
              <div id="sl-progress-bar">
                <div
                  id="sl-progress-fill"
                  style={{
                    width: `${Math.round(((shotVideo.shotlist || []).filter((s) => s.done).length / Math.max((shotVideo.shotlist || []).length, 1)) * 100)}%`,
                  }}
                />
              </div>
              <div id="sl-progress-txt">
                {(shotVideo.shotlist || []).filter((s) => s.done).length}/
                {(shotVideo.shotlist || []).length} voltooid
              </div>
            </div>
            <div id="sl-content">
              <div id="sl-list-side">
                <div id="sl-list-wrap">
                  {(shotVideo.shotlist || []).map((s, i) => (
                    <div
                      key={`${s.text}-${i}`}
                      className={`sl-item${s.done ? " done" : ""}`}
                      onClick={() => toggleShot(i)}
                    >
                      <div className="sl-cb">{s.done ? "✓" : ""}</div>
                      <div className="sl-num">
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <div className="sl-text">{s.text}</div>
                      <button
                        className="sl-del"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeShot(i);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div id="sl-add-row">
                  <input
                    id="sl-add-inp"
                    value={shotDraft}
                    onChange={(e) => setShotDraft(e.target.value)}
                    placeholder="Nieuwe shot toevoegen..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addShot();
                      }
                    }}
                  />
                  <button id="sl-add-btn" onClick={addShot}>
                    Toevoegen
                  </button>
                </div>
              </div>
              <div id="sl-script-side">
                <div
                  style={{
                    padding: "14px 18px",
                    borderBottom: "1px solid var(--border)",
                    fontWeight: 700,
                    fontSize: "12px",
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    color: "var(--text-3)",
                  }}
                >
                  Script
                </div>
                <div id="sl-script-panel">
                  {shotVideo.script ||
                    "Geen script toegevoegd voor deze video."}
                </div>
              </div>
            </div>
            <div id="sl-foot">
              <button
                className={`sl-shootbtn${shootMode ? " on" : ""}`}
                onClick={toggleShootMode}
              >
                🎬 Shoot Mode
              </button>
              <button className="sl-reset-btn" onClick={resetShots}>
                Reset checks
              </button>
            </div>
          </div>
        </div>
      )}

      {sopVideo && sopDraft && (
        <div
          id="sop-overlay"
          className="open"
          onMouseDown={() => setSopVideo(null)}
        >
          <div id="sop-box" onMouseDown={(e) => e.stopPropagation()}>
            <div id="sop-head">
              <div id="sop-head-title">SOP — {sopVideo.name}</div>
              <button className="modal-close" onClick={() => setSopVideo(null)}>
                ✕
              </button>
            </div>
            <div id="sop-body">
              <div className="sop-card">
                <div className="sop-card-title">Format & Stijl</div>
                <label className="sop-lbl">Ratio tags</label>
                <div className="sop-tags">
                  {ratioOptions.map((tag) => (
                    <button
                      key={tag}
                      className={`sop-tag${(sopDraft.ratioTags || []).includes(tag) ? " on" : ""}`}
                      onClick={() => toggleTag("ratioTags", tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <label className="sop-lbl">Stijl tags</label>
                <div className="sop-tags">
                  {styleOptions.map((tag) => (
                    <button
                      key={tag}
                      className={`sop-tag${(sopDraft.stijlTags || []).includes(tag) ? " on" : ""}`}
                      onClick={() => toggleTag("stijlTags", tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <label className="sop-lbl">Kleurprofiel</label>
                <input
                  className="sop-inp"
                  value={sopDraft.kleurprofiel}
                  onChange={(e) =>
                    setSopDraft({ ...sopDraft, kleurprofiel: e.target.value })
                  }
                />
              </div>
              <div className="sop-card">
                <div className="sop-card-title">Instructies</div>
                <label className="sop-lbl">Muziek</label>
                <input
                  className="sop-inp"
                  value={sopDraft.muziek}
                  onChange={(e) =>
                    setSopDraft({ ...sopDraft, muziek: e.target.value })
                  }
                />
                <label className="sop-lbl">Extra editor notes</label>
                <textarea
                  className="sop-ta"
                  value={sopDraft.extraNotes}
                  onChange={(e) =>
                    setSopDraft({ ...sopDraft, extraNotes: e.target.value })
                  }
                />
                <label className="sop-lbl">Format notitie</label>
                <textarea
                  className="sop-ta"
                  value={sopDraft.format}
                  onChange={(e) =>
                    setSopDraft({ ...sopDraft, format: e.target.value })
                  }
                />
              </div>
            </div>
            <div id="sop-foot">
              <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                SOP wordt opgeslagen per video.
              </span>
              <button className="btn btn-primary btn-sm" onClick={saveSop}>
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchModal && (
        <div
          className="modal-overlay open"
          onMouseDown={() => setShowBatchModal(false)}
        >
          <div
            className="modal ws-create-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-header ws-create-modal-head">
              <div className="modal-title" style={{ fontSize: "24px" }}>
                Nieuw workspace project
              </div>
              <button
                className="modal-close"
                onClick={() => setShowBatchModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">Project naam</label>
              <input
                className="form-input"
                value={newBatch.name}
                onChange={(e) =>
                  setNewBatch({ ...newBatch, name: e.target.value })
                }
                placeholder="bijv. Vermado Automotive S2"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Klant</label>
              <select
                className="form-select"
                value={newBatch.client}
                onChange={(e) =>
                  setNewBatch({ ...newBatch, client: e.target.value })
                }
              >
                <option value="">— Kies klant —</option>
                {clients.map((c) => (
                  <option key={c._id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Fase</label>
              <select
                className="form-select"
                value={newBatch.projectStage}
                onChange={(e) =>
                  setNewBatch({ ...newBatch, projectStage: e.target.value })
                }
              >
                <option value="development">Development</option>
                <option value="preproduction">Pre-productie</option>
                <option value="shooting">Shooting</option>
                <option value="post-production">Post-Production</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Shoot datum</label>
              <input
                type="date"
                className="form-input"
                value={newBatch.shootDate}
                onChange={(e) =>
                  setNewBatch({ ...newBatch, shootDate: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Deadline</label>
              <input
                type="date"
                className="form-input"
                value={newBatch.deadline}
                onChange={(e) =>
                  setNewBatch({ ...newBatch, deadline: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Lead editor</label>
              <select
                className="form-select"
                value={newBatch.editor}
                onChange={(e) =>
                  setNewBatch({ ...newBatch, editor: e.target.value })
                }
              >
                {["Paolo", "Lex", "Rick", "Ray", "Boy"].map((name) => (
                  <option key={name} value={name}>
                    {name} — {name === "Lex" ? "Editor" : "Team"}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-footer ws-create-modal-foot">
              <button
                className="btn btn-ghost ws-create-modal-btn ws-create-modal-btn-ghost"
                onClick={() => setShowBatchModal(false)}
              >
                Annuleer
              </button>
              <button
                className="btn btn-primary ws-create-modal-btn"
                disabled={
                  !newBatch.name.trim() ||
                  !newBatch.client ||
                  !newBatch.editor ||
                  !newBatch.projectStage ||
                  createBatchMut.isPending
                }
                onClick={createNewBatch}
              >
                Project aanmaken
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function EditCell({
  value,
  placeholder,
  onSave,
  isLink,
  multiline,
  preview,
  icon = null,
  textWeight = 400,
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");

  useEffect(() => {
    if (!editing) setVal(value || "");
  }, [value, editing]);

  const commit = () => {
    const current = value || "";
    if (val !== current) onSave(val);
    setEditing(false);
  };

  if (editing) {
    return (
      <td className="ws-td">
        {multiline ? (
          <textarea
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={commit}
            style={{
              width: "100%",
              minHeight: "60px",
              border: "1.5px solid var(--accent)",
              borderRadius: "5px",
              padding: "5px 8px",
              fontSize: "12px",
              fontFamily: "inherit",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        ) : (
          <input
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commit();
              }
              if (e.key === "Escape") {
                setVal(value || "");
                setEditing(false);
              }
            }}
            style={{
              width: "100%",
              border: "1.5px solid var(--accent)",
              borderRadius: "5px",
              padding: "5px 8px",
              fontSize: "12px",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        )}
      </td>
    );
  }
  const display = value
    ? preview
      ? value.slice(0, preview) + (value.length > preview ? "…" : "")
      : value
    : null;
  const toHref = (raw) => {
    if (!raw) return "";
    const trimmed = String(raw).trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  return (
    <td className="ws-td" onClick={() => setEditing(true)}>
      <div className="ws-td-inner" style={{ cursor: "pointer" }}>
        {display ? (
          isLink ? (
            <a
              href={toHref(value)}
              target="_blank"
              rel="noopener"
              style={{
                fontSize: "11px",
                color: "var(--blue)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "block",
                maxWidth: "130px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              🔗 {display}
            </a>
          ) : (
            <>
              {icon && <span style={{ fontSize: "12px" }}>{icon}</span>}
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--text-2)",
                  fontWeight: textWeight,
                }}
              >
                {display}
              </span>
            </>
          )
        ) : (
          <span
            style={{
              fontSize: "11px",
              color: "var(--text-3)",
              fontStyle: "italic",
            }}
          >
            {placeholder}
          </span>
        )}
      </div>
    </td>
  );
}
