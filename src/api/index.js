const BASE = "/api";

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 240) || res.statusText || "Request failed" };
    }
  }
  if (!res.ok) {
    const msg =
      typeof data.error === "string"
        ? data.error
        : typeof data.message === "string"
          ? data.message
          : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

// Auth
export const login = (email, password) =>
  req("POST", "/auth/login", { email, password });
export const requestClientForgotPassword = (email) =>
  req("POST", "/auth/forgot-password", { email });

export async function validateClientResetToken(token) {
  const res = await fetch(
    `${BASE}/auth/reset-password/validate?token=${encodeURIComponent(token)}`,
    { credentials: "include" },
  );
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      return false;
    }
  }
  return Boolean(data?.valid);
}

export const submitClientPasswordReset = (payload) =>
  req("POST", "/auth/reset-password", payload);

export const logout = () => req("POST", "/auth/logout");
export const getMe = () => req("GET", "/auth/me");

// Clients
export const getClients = () => req("GET", "/clients");
export const getClient = (id) => req("GET", `/clients/${id}`);
export const createClient = (data) => req("POST", "/clients", data);
export const updateClient = (id, data) => req("PUT", `/clients/${id}`, data);
export const deleteClient = (id) => req("DELETE", `/clients/${id}`);

// Team
export const getTeamMembers = () => req("GET", "/team");
export const createTeamMember = (data) => req("POST", "/team", data);

// Events
export const getEvents = () => req("GET", "/events");
export const createEvent = (data) => req("POST", "/events", data);
export const updateEvent = (id, data) => req("PUT", `/events/${id}`, data);
export const deleteEvent = (id) => req("DELETE", `/events/${id}`);

// Tasks
export const getTasks = () => req("GET", "/tasks");
export const getArchivedTasks = (clientId) =>
  req(
    "GET",
    clientId
      ? `/tasks/archived?clientId=${encodeURIComponent(clientId)}`
      : "/tasks/archived",
  );
export const createTask = (data) => req("POST", "/tasks", data);
export const updateTask = (id, data) => req("PUT", `/tasks/${id}`, data);
export const archiveTask = (id, archivedReason = "manual") =>
  req("POST", `/tasks/${id}/archive`, { archivedReason });
export const restoreTask = (id) => req("POST", `/tasks/${id}/restore`);

// Batches / Workspace
export const getBatches = () => req("GET", "/batches");
export const createBatch = (data) => req("POST", "/batches", data);
export const updateBatch = (id, data) => req("PUT", `/batches/${id}`, data);
export const deleteBatch = (id) => req("DELETE", `/batches/${id}`);
export const addVideo = (batchId, data) =>
  req("POST", `/batches/${batchId}/videos`, data);
export const updateVideo = (batchId, videoId, data) =>
  req("PUT", `/batches/${batchId}/videos/${videoId}`, data);
export const deleteVideo = (batchId, videoId) =>
  req("DELETE", `/batches/${batchId}/videos/${videoId}`);

// Portal (team side)
export const getPortalNotes = (clientId) =>
  req("GET", `/portal/${clientId}/notes`);
export const sendPortalNote = (clientId, text, author) =>
  req("POST", `/portal/${clientId}/notes`, { text, author });
export const getPortalVideos = (clientId) =>
  req("GET", `/portal/${clientId}/videos`);
export const markNotesRead = (clientId) =>
  req("POST", `/portal/${clientId}/notes/read`);
export const getPortalUnreadSummary = () =>
  req("GET", "/portal/unread-summary");

// Portal (client side)
export const getPortalMe = () => req("GET", "/portal/me");
export const sendClientNote = (text) =>
  req("POST", "/portal/me/notes", { text });
export const approveVideo = (videoId) =>
  req("POST", `/portal/me/videos/${videoId}/approve`);
export const requestRevision = (videoId, note) =>
  req("POST", `/portal/me/videos/${videoId}/revision`, { note });

// Questionnaire
export const getQuestionnaire = (clientId) =>
  req("GET", `/questionnaire/${clientId}`);
export const saveQuestionnaire = (answers, submitted = false) =>
  req("POST", "/questionnaire/me", { answers, submitted });

// Stats
export const getActivity = () => req("GET", "/activity");
export const getPulse = () => req("GET", "/pulse");

// Video checker
export const analyzeCheckerText = (payload) =>
  req("POST", "/checker/analyze", payload);

export const presignVideoCheckerUpload = (payload) =>
  req("POST", "/checker/upload/presign", payload);

export const saveVideoCheckerRun = (payload) =>
  req("POST", "/checker/runs", payload);
