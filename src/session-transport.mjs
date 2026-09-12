/** Coordinates refreshes for all requests in this page; access tokens stay in memory. */
export function createSessionTransport({ getSession, applySession, clearSession, getApiBase, fetchImpl = globalThis.fetch, warn = console.warn }) {
  let epoch = 0;
  let inFlight = null;

  // Login/logout invalidate responses from an earlier session, even for the same user.
  function invalidate() {
    epoch += 1;
  }

  function refreshSession(silent = false) {
    const startedEpoch = epoch;
    const base = getApiBase();
    if (inFlight?.epoch === startedEpoch && inFlight.base === base) return inFlight.promise;

    const attempt = { epoch: startedEpoch, base, promise: null };
    attempt.promise = Promise.resolve().then(async () => {
      try {
        const response = await fetchImpl(`${base}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: "{}",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const session = await response.json();
        if (epoch !== startedEpoch || getApiBase() !== base) return false;
        if (!session?.accessToken) throw new Error("Refresh response has no access token");
        applySession(session);
        return true;
      } catch (error) {
        if (epoch === startedEpoch && getApiBase() === base) {
          if (!silent) warn("API POST auth/refresh failed", error);
          invalidate();
          clearSession();
        }
        return false;
      } finally {
        if (inFlight === attempt) inFlight = null;
      }
    });
    inFlight = attempt;
    return attempt.promise;
  }

  async function apiFetch(resource, options = {}, retry = true) {
    const startedEpoch = epoch;
    const base = getApiBase();
    const session = getSession();
    const token = session?.accessToken;
    const headers = new Headers(options.headers || {});
    if (token) headers.set("Authorization", `${session.tokenType || "Bearer"} ${token}`);
    const response = await fetchImpl(`${base}/${resource.replace(/^\/+/, "")}`, {
      ...options,
      credentials: "include",
      headers,
    });
    if (response.status !== 401 || epoch !== startedEpoch || getApiBase() !== base) return response;

    if (retry) {
      // A delayed 401 can arrive after another request has already renewed the token.
      const renewed = getSession()?.accessToken;
      if (renewed && renewed !== token) return apiFetch(resource, options, false);
      if (await refreshSession() && epoch === startedEpoch && getApiBase() === base) {
        return apiFetch(resource, options, false);
      }
    } else if (getSession()?.accessToken === token) {
      invalidate();
      clearSession();
    }
    return response;
  }

  async function waitForRefresh() {
    if (inFlight) await inFlight.promise;
  }

  return { apiFetch, refreshSession, invalidate, waitForRefresh };
}
