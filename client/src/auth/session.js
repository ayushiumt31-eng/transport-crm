// One signed-in session per browser tab: { role, accessToken, user }.
// sessionStorage keeps tabs independent, so different roles can be signed in side by side.
const SESSION_KEY = 'transport_crm_session';
export const SESSION_EXPIRED_EVENT = 'transport-crm:session-expired';

export function getSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    return session?.role && session?.accessToken ? session : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function getAccessToken() {
  return getSession()?.accessToken || '';
}

function expireSession(message) {
  const role = getSession()?.role;
  clearSession();
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { role, message } }));
}

async function toError(response) {
  const result = await response.json().catch(() => ({}));
  const detail = result.errors?.[0]?.message;
  const error = new Error(
    detail && result.message === 'Validation failed' ? detail : result.message || `Request failed (${response.status}).`
  );
  error.status = response.status;
  error.details = result.errors;
  return error;
}

/**
 * Calls the API as the signed-in user. Returns the parsed JSON body (or the Response when raw).
 * A 401 on an authenticated call ends the session and sends the user back to the login page.
 */
export async function apiFetch(path, options = {}) {
  const { method = 'GET', body, headers = {}, raw = false, auth = true } = options;
  const session = auth ? getSession() : null;
  const isFormData = body instanceof FormData;

  const response = await fetch(`/api/v1${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...headers
    },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined
  });

  if (response.status === 401 && session) {
    expireSession('Your session has ended. Please sign in again.');
  }

  if (!response.ok) throw await toError(response);
  if (raw) return response;
  return response.json().catch(() => ({}));
}
