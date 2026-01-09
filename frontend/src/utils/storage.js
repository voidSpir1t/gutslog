const STORAGE_KEYS = {
  TEMPLATES: 'workout_templates',
  SESSIONS: 'workout_sessions',
};

export const getTemplates = () => {
  const data = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
  return data ? JSON.parse(data) : [];
};

export const saveTemplates = (templates) => {
  localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
};

export const getSessions = () => {
  const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
  return data ? JSON.parse(data) : [];
};

export const saveSessions = (sessions) => {
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
};

export const addSession = (session) => {
  const sessions = getSessions();
  sessions.unshift(session);
  saveSessions(sessions);
};
