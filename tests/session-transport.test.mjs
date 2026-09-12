import { test } from "node:test";
import assert from "node:assert/strict";
import { createSessionTransport } from "../src/session-transport.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const denied = () => json({ code: "TOKEN_EXPIRED" }, 401);
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function fixture(fetchImpl, initialSession = { accessToken: "expired" }) {
  let session = initialSession;
  let clears = 0;
  let applied = 0;
  let base = "/api";
  const transport = createSessionTransport({
    getSession: () => session,
    applySession: value => { applied += 1; session = value; },
    clearSession: () => { clears += 1; session = null; },
    getApiBase: () => base,
    fetchImpl,
    warn: () => {},
  });
  return {
    ...transport,
    session: () => session,
    clears: () => clears,
    applied: () => applied,
    changeSession(value) { transport.invalidate(); session = value; },
    changeBase(value) { base = value; },
  };
}

test("concurrent 401s share one refresh and all requests resume", async () => {
  let refreshes = 0;
  let reads = 0;
  const client = fixture(async (url, options) => {
    if (url.endsWith("/auth/refresh")) {
      refreshes += 1;
      assert.equal(options.credentials, "include");
      return json({ accessToken: "renewed" });
    }
    reads += 1;
    return options.headers.get("Authorization") === "Bearer renewed" ? json({ ok: true }) : denied();
  });
  const responses = await Promise.all(["term1", "term2", "term3"].map(term => client.apiFetch(term)));
  assert.deepEqual(responses.map(r => r.status), [200, 200, 200]);
  assert.equal(refreshes, 1);
  assert.equal(reads, 6);
  assert.equal(client.applied(), 1);
  assert.equal(client.clears(), 0);
  assert.equal(client.session().accessToken, "renewed");
});

test("a late 401 reuses the already renewed token", async () => {
  const slow = deferred();
  let refreshes = 0;
  const client = fixture(async (url, options) => {
    if (url.endsWith("/auth/refresh")) { refreshes += 1; return json({ accessToken: "renewed" }); }
    if (options.headers.get("Authorization") === "Bearer renewed") return json({ ok: true });
    if (url.endsWith("/slow")) return slow.promise;
    return denied();
  });
  const pending = client.apiFetch("slow");
  assert.equal((await client.apiFetch("fast")).status, 200);
  slow.resolve(denied());
  assert.equal((await pending).status, 200);
  assert.equal(refreshes, 1);
  assert.equal(client.clears(), 0);
});

test("failed refresh clears once and does not start a retry loop", async () => {
  let refreshes = 0;
  const client = fixture(async url => {
    if (url.endsWith("/auth/refresh")) refreshes += 1;
    return denied();
  });
  const responses = await Promise.all([client.apiFetch("a"), client.apiFetch("b"), client.apiFetch("c")]);
  assert.deepEqual(responses.map(r => r.status), [401, 401, 401]);
  assert.equal(refreshes, 1);
  assert.equal(client.clears(), 1);
  assert.equal(client.session(), null);
});

test("a rejected renewed token is retried at most once", async () => {
  let calls = 0;
  const client = fixture(async url => {
    calls += 1;
    return url.endsWith("/auth/refresh") ? json({ accessToken: "renewed" }) : denied();
  });
  assert.equal((await client.apiFetch("a")).status, 401);
  assert.equal(calls, 3);
  assert.equal(client.clears(), 1);
});

test("mutation retry preserves the method body and idempotency key", async () => {
  const writes = [];
  const client = fixture(async (url, options) => {
    if (url.endsWith("/auth/refresh")) return json({ accessToken: "renewed" });
    writes.push(options);
    return options.headers.get("Authorization") === "Bearer renewed" ? json({ ok: true }) : denied();
  });
  const options = { method: "PUT", headers: { "Content-Type": "application/json", "Idempotency-Key": "same-operation" }, body: '{"week":10}' };
  assert.equal((await client.apiFetch("attendance", options)).status, 200);
  assert.equal(writes.length, 2);
  for (const sent of writes) {
    assert.equal(sent.method, "PUT");
    assert.equal(sent.body, options.body);
    assert.equal(sent.headers.get("Idempotency-Key"), "same-operation");
  }
  assert.equal(options.headers.Authorization, undefined);
});

test("logout or a new login prevents an old refresh response from restoring its session", async () => {
  for (const replacement of [null, { accessToken: "new-login" }]) {
    const pending = deferred();
    const started = deferred();
    const client = fixture(() => { started.resolve(); return pending.promise; });
    const result = client.refreshSession();
    await started.promise;
    client.changeSession(replacement);
    pending.resolve(json({ accessToken: "obsolete" }));
    assert.equal(await result, false);
    assert.deepEqual(client.session(), replacement);
    assert.equal(client.applied(), 0);
    assert.equal(client.clears(), 0);
  }
});

test("a late failed refresh cannot clear a new login", async () => {
  const pending = deferred();
  const started = deferred();
  const client = fixture(() => { started.resolve(); return pending.promise; });
  const result = client.refreshSession();
  await started.promise;
  client.changeSession({ accessToken: "new-login" });
  pending.resolve(denied());
  assert.equal(await result, false);
  assert.equal(client.session().accessToken, "new-login");
  assert.equal(client.clears(), 0);
});

test("a late 401 from another session cannot retry a mutation as the new user", async () => {
  const pending = deferred();
  let requests = 0;
  const client = fixture(() => { requests += 1; return pending.promise; });
  const result = client.apiFetch("attendance", { method: "PUT", body: "{}" });
  client.changeSession({ accessToken: "new-user" });
  pending.resolve(denied());
  assert.equal((await result).status, 401);
  assert.equal(requests, 1);
  assert.equal(client.clears(), 0);
  assert.equal(client.session().accessToken, "new-user");
});

test("startup restoration shares the pending refresh", async () => {
  let requests = 0;
  const client = fixture(async () => { requests += 1; return json({ accessToken: "restored" }); }, null);
  assert.deepEqual(await Promise.all([client.refreshSession(true), client.refreshSession()]), [true, true]);
  assert.equal(requests, 1);
});

test("network failure releases the refresh so a later attempt can succeed", async () => {
  let requests = 0;
  const client = fixture(async () => {
    if (++requests === 1) throw new Error("network unavailable");
    return json({ accessToken: "restored" });
  });
  assert.equal(await client.refreshSession(), false);
  assert.equal(await client.refreshSession(), true);
  assert.equal(requests, 2);
  assert.equal(client.session().accessToken, "restored");
});

test("changing API origin discards a pending refresh", async () => {
  const pending = deferred();
  const client = fixture(() => pending.promise);
  const result = client.refreshSession();
  client.changeBase("/other-api");
  pending.resolve(json({ accessToken: "obsolete" }));
  assert.equal(await result, false);
  assert.equal(client.applied(), 0);
  assert.equal(client.clears(), 0);
});

test("logout can wait for rotation before revoking the new cookie", async () => {
  const pending = deferred();
  const client = fixture(() => pending.promise);
  const refresh = client.refreshSession();
  const wait = client.waitForRefresh();
  pending.resolve(json({ accessToken: "renewed" }));
  await wait;
  assert.equal(await refresh, true);
  assert.equal(client.session().accessToken, "renewed");
});
