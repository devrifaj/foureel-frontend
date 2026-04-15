import { useMemo, useRef, useState } from "react";
import { createWorker } from "tesseract.js";
import { analyzeCheckerText } from "../../api";

const MAX_FRAMES = 12;
const MAX_FILE_SIZE = 500 * 1024 * 1024;

function fmtBytes(bytes) {
  if (!bytes && bytes !== 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function timeLabel(seconds) {
  const sec = Math.max(0, Math.round(seconds));
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function VideoCheckerView() {
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const workerRef = useRef(null);
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [intervalSec, setIntervalSec] = useState("3");
  const [lang, setLang] = useState("nl");
  const [mode, setMode] = useState("spelling");
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("Frames extraheren…");
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState([]);

  const errorCount = useMemo(
    () => results.reduce((sum, row) => sum + (row.errors?.length || 0), 0),
    [results],
  );
  const cleanCount = useMemo(
    () => results.filter((row) => (row.errors?.length || 0) === 0).length,
    [results],
  );

  const scoreInfo = useMemo(() => {
    if (!results.length) return null;
    if (errorCount === 0)
      return { cls: "vc-score-ok", text: "Geen fouten gevonden" };
    if (errorCount <= 5)
      return { cls: "vc-score-warn", text: `${errorCount} aandachtspunten` };
    return { cls: "vc-score-error", text: `${errorCount} fouten gevonden` };
  }, [errorCount, results.length]);

  const pushLog = (text, kind = "info") => {
    setLogs((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, text, kind },
    ]);
  };

  const onPickFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      pushLog("Bestand is geen video.", "err");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      pushLog("Bestand is te groot (max 500MB).", "err");
      return;
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const nextUrl = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(nextUrl);
    setResults([]);
    setLogs([]);
    setProgress(0);
    setProgressText("Klaar om te checken");
    pushLog(`Video geladen: ${file.name}`, "ok");
  };

  const extractFrames = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return [];
    await new Promise((resolve) => {
      if (video.readyState >= 1 && video.duration) return resolve();
      video.onloadedmetadata = () => resolve();
    });

    const duration = video.duration || 0;
    const step = Math.max(1, Number(intervalSec) || 3);
    const timestamps = [];
    for (let t = 0; t <= duration; t += step) {
      timestamps.push(t);
      if (timestamps.length >= MAX_FRAMES) break;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const width = Math.max(480, Math.min(1280, video.videoWidth || 1280));
    const height = Math.round(
      (width / Math.max(1, video.videoWidth || 16)) * (video.videoHeight || 9),
    );
    canvas.width = width;
    canvas.height = height;

    const out = [];
    for (let i = 0; i < timestamps.length; i += 1) {
      const ts = timestamps[i];
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        const onSeek = () => {
          video.removeEventListener("seeked", onSeek);
          resolve();
        };
        video.addEventListener("seeked", onSeek);
        video.currentTime = Math.min(ts, Math.max(0, duration - 0.1));
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      out.push({
        idx: i + 1,
        timestamp: ts,
        thumb: canvas.toDataURL("image/jpeg", 0.72),
      });
    }
    return out;
  };

  const getWorker = async () => {
    if (workerRef.current) return workerRef.current;
    const ocrLang =
      lang === "en" ? "eng" : lang === "nl+en" ? "nld+eng" : "nld";
    const worker = await createWorker(ocrLang);
    workerRef.current = worker;
    return worker;
  };

  const runCheck = async () => {
    if (!videoFile || isRunning) return;
    try {
      setIsRunning(true);
      setResults([]);
      setProgress(0);
      setLogs([]);
      setProgressText("Frames extraheren…");
      pushLog("Start video scan...", "info");

      const frames = await extractFrames();
      if (!frames.length) {
        pushLog("Geen frames gevonden in deze video.", "err");
        setIsRunning(false);
        return;
      }

      pushLog(`${frames.length} frame(s) geselecteerd voor analyse.`, "info");
      const worker = await getWorker();
      const all = [];

      for (let i = 0; i < frames.length; i += 1) {
        const frame = frames[i];
        setProgressText(`Frame ${i + 1}/${frames.length} analyseren…`);

        // eslint-disable-next-line no-await-in-loop
        const ocr = await worker.recognize(frame.thumb);
        const text = (ocr?.data?.text || "").replace(/\s+/g, " ").trim();
        if (!text) {
          all.push({ ...frame, text: "", errors: [] });
          pushLog(
            `Frame ${frame.idx} (${timeLabel(frame.timestamp)}): geen tekst`,
            "ok",
          );
          setProgress(Math.round(((i + 1) / frames.length) * 100));
          continue;
        }

        // eslint-disable-next-line no-await-in-loop
        const analysis = await analyzeCheckerText({
          text,
          language: lang,
          mode,
        });
        const errors = analysis?.errors || [];
        all.push({ ...frame, text, errors });
        pushLog(
          `Frame ${frame.idx} (${timeLabel(frame.timestamp)}): ${errors.length} issue(s)`,
          errors.length ? "err" : "ok",
        );
        setProgress(Math.round(((i + 1) / frames.length) * 100));
      }

      setResults(all);
      setProgressText("Check afgerond");
    } catch (err) {
      pushLog(err?.message || "Check mislukt", "err");
    } finally {
      setIsRunning(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove("dragover");
    const f = e.dataTransfer?.files?.[0];
    if (f) onPickFile(f);
  };

  return (
    <section className="view active">
      <div className="page-header">
        <div>
          <div className="page-title">
            Video Checker <em>— Spelling & Tekst</em>
          </div>
          <div className="page-subtitle">
            Scan on-screen tekst in video's op Nederlandse spelfouten
          </div>
        </div>
      </div>

      <div className="vc-layout">
        <div className="vc-upload-card">
          <div
            className="vc-drop-zone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add("dragover");
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("dragover");
            }}
            onDrop={onDrop}
          >
            <span className="vc-drop-icon">🎬</span>
            <div className="vc-drop-title">Video uploaden</div>
            <div className="vc-drop-sub">
              Sleep een video hierheen
              <br />
              of klik om te bladeren
              <span
                style={{
                  fontSize: "11px",
                  marginTop: "4px",
                  display: "block",
                  color: "var(--text-3)",
                }}
              >
                MP4, MOV, WebM · max 500MB
              </span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="vc-file-input"
            accept="video/*"
            onChange={(e) => onPickFile(e.target.files?.[0])}
          />

          <div className={`vc-video-wrap${videoUrl ? " has-video" : ""}`}>
            <video
              ref={videoRef}
              className="vc-video-el"
              controls
              preload="metadata"
              src={videoUrl || undefined}
            />
          </div>
          <div className={`vc-file-info${videoFile ? " has-video" : ""}`}>
            <div className="vc-file-name">{videoFile?.name || ""}</div>
            <div className="vc-file-meta">
              {videoFile
                ? `${fmtBytes(videoFile.size)}${videoRef.current?.duration ? ` · ${timeLabel(videoRef.current.duration)}` : ""}`
                : ""}
            </div>
          </div>

          <div className="vc-frame-strip">
            {results.map((row) => (
              <img
                key={`thumb-${row.idx}-${row.timestamp}`}
                className={`vc-thumb ${(row.errors?.length || 0) > 0 ? "error" : "clean"}`}
                src={row.thumb}
                alt={`Frame ${row.idx}`}
              />
            ))}
          </div>

          <div className="vc-settings">
            <div className="vc-setting-row">
              <div className="vc-setting-label">
                Frame interval
                <span>Hoe vaak een frame wordt gescand</span>
              </div>
              <select
                className="vc-select"
                value={intervalSec}
                onChange={(e) => setIntervalSec(e.target.value)}
              >
                <option value="2">Elke 2 sec</option>
                <option value="3">Elke 3 sec</option>
                <option value="5">Elke 5 sec</option>
                <option value="10">Elke 10 sec</option>
              </select>
            </div>
            <div className="vc-setting-row">
              <div className="vc-setting-label">
                Taal
                <span>Welke taal wordt gecontroleerd</span>
              </div>
              <select
                className="vc-select"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
              >
                <option value="nl">Nederlands</option>
                <option value="en">Engels</option>
                <option value="nl+en">NL + EN gemengd</option>
              </select>
            </div>
            <div className="vc-setting-row">
              <div className="vc-setting-label">
                Modus
                <span>Wat er gecheckt wordt</span>
              </div>
              <select
                className="vc-select"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="spelling">Spelling</option>
                <option value="spelling+grammar">Spelling + Grammatica</option>
                <option value="all">Alles incl. stijl</option>
              </select>
            </div>
          </div>

          <div
            className={`vc-progress-wrap${isRunning || progress > 0 ? " active" : ""}`}
          >
            <div className="vc-progress-label">
              <span>{progressText}</span>
              <span>{progress}%</span>
            </div>
            <div className="vc-progress-bar">
              <div
                className="vc-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <button
            className="vc-start-btn"
            disabled={!videoFile || isRunning}
            onClick={runCheck}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
              <path d="M3 3l10 5-10 5V3z" />
            </svg>
            {isRunning ? "Bezig met checken…" : "Check starten"}
          </button>

          <div className={`vc-log${logs.length ? " active" : ""}`}>
            {logs.map((line) => (
              <div key={line.id} className={`vc-log-line ${line.kind}`}>
                {line.text}
              </div>
            ))}
          </div>
        </div>

        <div className="vc-results-card">
          <div className="vc-results-header">
            <div className="vc-results-title">Resultaten</div>
            {scoreInfo && (
              <div className={`vc-score-badge ${scoreInfo.cls}`}>
                {scoreInfo.text}
              </div>
            )}
          </div>
          <div>
            {!results.length ? (
              <div className="vc-empty-state">
                <div className="vc-empty-icon">🔍</div>
                <div className="vc-empty-title">Nog geen check uitgevoerd</div>
                <div className="vc-empty-sub">
                  Upload een video links en klik op
                  <br />
                  "Check starten" om te beginnen.
                  <br />
                  <br />
                  OCR scant zichtbare tekst per frame en controleert
                  spelling/grammatica.
                </div>
              </div>
            ) : (
              <div className="vc-error-list">
                <div className="vc-clean-summary">
                  <div className="vc-clean-icon">✅</div>
                  <div>
                    <div className="vc-clean-text">
                      {cleanCount} frame(s) zonder issues
                    </div>
                    <div className="vc-clean-sub">
                      {errorCount} totaal gevonden issue(s)
                    </div>
                  </div>
                </div>
                {results
                  .filter((row) => row.errors?.length)
                  .map((row) => (
                    <div
                      className="vc-error-card"
                      key={`err-${row.idx}-${row.timestamp}`}
                    >
                      <div className="vc-error-thumb-wrap">
                        <img
                          className="vc-error-thumb"
                          src={row.thumb}
                          alt={`Frame ${row.idx}`}
                        />
                        <div className="vc-error-ts">
                          {timeLabel(row.timestamp)}
                        </div>
                      </div>
                      <div className="vc-error-body">
                        <div className="vc-error-context">{row.text}</div>
                        {row.errors.map((err) => (
                          <div
                            className="vc-error-row"
                            key={`${row.idx}-${err.offset}-${err.wrong}`}
                          >
                            <span className="vc-wrong">{err.wrong || "—"}</span>
                            <span className="vc-arrow">→</span>
                            <span className="vc-correct">
                              {err.suggestion || "n.v.t."}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </section>
  );
}
