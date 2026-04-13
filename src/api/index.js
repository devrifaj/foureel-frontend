const BASE = '/api';

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Auth
export const login = (email, password) => req('POST', '/auth/login', { email, password });
export const logout = () => req('POST', '/auth/logout');
export const getMe = () => req('GET', '/auth/me');

// Clients
export const getClients = () => req('GET', '/clients');
export const getClient = (id) => req('GET', `/clients/${id}`);
export const createClient = (data) => req('POST', '/clients', data);
export const updateClient = (id, data) => req('PUT', `/clients/${id}`, data);
export const deleteClient = (id) => req('DELETE', `/clients/${id}`);

// Events
export const getEvents = () => req('GET', '/events');
export const createEvent = (data) => req('POST', '/events', data);
export const updateEvent = (id, data) => req('PUT', `/events/${id}`, data);
export const deleteEvent = (id) => req('DELETE', `/events/${id}`);

// Tasks
export const getTasks = () => req('GET', '/tasks');
export const getArchivedTasks = () => req('GET', '/tasks/archived');
export const createTask = (data) => req('POST', '/tasks', data);
export const updateTask = (id, data) => req('PUT', `/tasks/${id}`, data);
export const archiveTask = (id, reason) => req('POST', `/tasks/${id}/archive`, { reason });
export const restoreTask = (id) => req('POST', `/tasks/${id}/restore`);

// Batches / Workspace
export const getBatches = () => req('GET', '/batches');
export const createBatch = (data) => req('POST', '/batches', data);
export const updateBatch = (id, data) => req('PUT', `/batches/${id}`, data);
export const deleteBatch = (id) => req('DELETE', `/batches/${id}`);
export const addVideo = (batchId, data) => req('POST', `/batches/${batchId}/videos`, data);
export const updateVideo = (batchId, videoId, data) => req('PUT', `/batches/${batchId}/videos/${videoId}`, data);
export const deleteVideo = (batchId, videoId) => req('DELETE', `/batches/${batchId}/videos/${videoId}`);

// Portal (team side)
export const getPortalNotes = (clientId) => req('GET', `/portal/${clientId}/notes`);
export const sendPortalNote = (clientId, text, author) => req('POST', `/portal/${clientId}/notes`, { text, author });
export const getPortalVideos = (clientId) => req('GET', `/portal/${clientId}/videos`);
export const markNotesRead = (clientId) => req('POST', `/portal/${clientId}/notes/read`);
export const getPortalUnreadSummary = () => req('GET', '/portal/unread-summary');

// Portal (client side)
export const getPortalMe = () => req('GET', '/portal/me');
export const sendClientNote = (text) => req('POST', '/portal/me/notes', { text });
export const approveVideo = (videoId) => req('POST', `/portal/me/videos/${videoId}/approve`);
export const requestRevision = (videoId, note) => req('POST', `/portal/me/videos/${videoId}/revision`, { note });

// Questionnaire
export const getQuestionnaire = (clientId) => req('GET', `/questionnaire/${clientId}`);
export const saveQuestionnaire = (answers, submitted = false) => req('POST', '/questionnaire/me', { answers, submitted });

// Stats
export const getActivity = () => req('GET', '/activity');
export const getPulse = () => req('GET', '/pulse');
