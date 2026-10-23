export interface Env {
  DB: D1Database;
  ADMIN_API_TOKEN: string;
  APP_ORIGIN: string;
}

type SimNetwork = "MTN" | "Vodacom" | "Cell C" | "Telkom";
const NETWORKS: SimNetwork[] = ["MTN", "Vodacom", "Cell C", "Telkom"];
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } });
}
function cors(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin");
  const headers: Record<string, string> = { "vary": "Origin", "access-control-allow-methods": "GET,POST,PATCH,OPTIONS", "access-control-allow-headers": "Authorization,Content-Type", "access-control-max-age": "600" };
  if (origin && origin === env.APP_ORIGIN) headers["access-control-allow-origin"] = origin;
  return headers;
}
async function authorised(request: Request, env: Env): Promise<boolean> {
  const header = request.headers.get("Authorization") || "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!supplied || !env.ADMIN_API_TOKEN) return false;
  const a = new TextEncoder().encode(supplied);
  const b = new TextEncoder().encode(env.ADMIN_API_TOKEN);
  if (a.length !== b.length) return false;
  const digestA = await crypto.subtle.digest("SHA-256", a);
  const digestB = await crypto.subtle.digest("SHA-256", b);
  const x = new Uint8Array(digestA); const y = new Uint8Array(digestB);
  let diff = 0; for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
async function bodyObject(request: Request): Promise<Record<string, unknown> | null> {
  const type = request.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("application/json")) return null;
  try { const value: unknown = await request.json(); return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
  catch { return null; }
}
function str(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length > 0 && v.length <= max ? v : null;
}
function uuid(): string { return crypto.randomUUID(); }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const headers = cors(request, env);
    if (request.method === "OPTIONS") {
      if (!request.headers.get("Origin") || request.headers.get("Origin") !== env.APP_ORIGIN) return json({ error: "origin_not_allowed" }, 403);
      return new Response(null, { status: 204, headers });
    }
    if (url.pathname === "/api/health" && request.method === "GET") return json({ ok: true, service: "eyaelo-sim-manager-api", mode: "draft-only" }, 200, headers);
    if (!url.pathname.startsWith("/api/")) return json({ error: "not_found" }, 404, headers);
    if (!await authorised(request, env)) return json({ error: "unauthorised" }, 401, headers);

    try {
      if (url.pathname === "/api/sims" && request.method === "GET") {
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
        const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
        const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
        const result = q
          ? await env.DB.prepare("SELECT * FROM sim_cards WHERE phone_number LIKE ? OR network LIKE ? OR COALESCE(assigned_agent,'') LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(`%${q}%`, `%${q}%`, `%${q}%`, limit, offset).all()
          : await env.DB.prepare("SELECT * FROM sim_cards ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(limit, offset).all();
        return json({ data: result.results, limit, offset }, 200, headers);
      }

      if (url.pathname === "/api/sims" && request.method === "POST") {
        const body = await bodyObject(request);
        if (!body) return json({ error: "invalid_json" }, 400, headers);
        const phone = str(body.phone_number, 20);
        const network = str(body.network, 20) as SimNetwork | null;
        if (!phone || !/^\+?[0-9]{8,15}$/.test(phone) || !network || !NETWORKS.includes(network)) return json({ error: "invalid_phone_or_network" }, 400, headers);
        const agent = body.assigned_agent == null || body.assigned_agent === "" ? null : str(body.assigned_agent, 120);
        const location = body.assigned_location == null || body.assigned_location === "" ? null : str(body.assigned_location, 120);
        if (body.assigned_agent && !agent || body.assigned_location && !location) return json({ error: "invalid_optional_field" }, 400, headers);
        const id = uuid();
        const actor = "admin-token";
        await env.DB.batch([
          env.DB.prepare("INSERT INTO sim_cards (id, phone_number, network, assigned_agent, assigned_location, registration_date, status, notes) VALUES (?, ?, ?, ?, ?, ?, 'active', ?)").bind(id, phone, network, agent, location, str(body.registration_date, 10), str(body.notes, 500)),
          env.DB.prepare("INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, outcome) VALUES (?, ?, 'sim.create', 'sim_card', ?, 'success')").bind(uuid(), actor.slice(0, 120), id)
        ]);
        return json({ id, phone_number: phone, network, status: "active" }, 201, headers);
      }

      const simMatch = url.pathname.match(/^\/api\/sims\/([a-f0-9-]{36})$/i);
      if (simMatch && request.method === "PATCH") {
        const body = await bodyObject(request);
        if (!body) return json({ error: "invalid_json" }, 400, headers);
        const allowed = ["assigned_agent", "assigned_location", "registration_date", "status", "notes"] as const;
        const values: unknown[] = [];
        const sets: string[] = [];
        for (const field of allowed) {
          if (!(field in body)) continue;
          let value: unknown = body[field];
          if (field === "status") {
            if (!["active", "inactive", "suspended", "lost", "closed"].includes(String(value))) return json({ error: "invalid_status" }, 400, headers);
          } else if (field === "registration_date") {
            if (value !== null && value !== "" && (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))) return json({ error: "invalid_date" }, 400, headers);
            if (value === "") value = null;
          } else if (field === "notes") {
            if (value !== null && value !== "") { value = str(value, 500); if (!value) return json({ error: "invalid_notes" }, 400, headers); } else value = null;
          } else {
            if (value !== null && value !== "") { value = str(value, 120); if (!value) return json({ error: "invalid_field" }, 400, headers); } else value = null;
          }
          sets.push(field + " = ?"); values.push(value);
        }
        if (!sets.length) return json({ error: "no_editable_fields" }, 400, headers);
        sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
        values.push(simMatch[1]);
        const result = await env.DB.prepare(`UPDATE sim_cards SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
        if (!result.meta.changes) return json({ error: "sim_not_found" }, 404, headers);
        await env.DB.prepare("INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, outcome) VALUES (?, 'admin-token', 'sim.update', 'sim_card', ?, 'success')").bind(uuid(), simMatch[1]).run();
        return json({ ok: true }, 200, headers);
      }

      if (url.pathname === "/api/recharges" && request.method === "GET") {
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
        const result = await env.DB.prepare("SELECT * FROM recharge_transactions ORDER BY created_at DESC LIMIT ?").bind(limit).all();
        return json({ data: result.results }, 200, headers);
      }

      if (url.pathname === "/api/recharges" && request.method === "POST") {
        const body = await bodyObject(request);
        if (!body) return json({ error: "invalid_json" }, 400, headers);
        const simId = str(body.sim_card_id, 36);
        const amount = Number(body.amount_cents);
        const idempotencyKey = str(body.idempotency_key, 100);
        if (!simId || !Number.isSafeInteger(amount) || amount < 100 || amount > 10000000 || !idempotencyKey) return json({ error: "invalid_recharge_request" }, 400, headers);
        const sim = await env.DB.prepare("SELECT id, phone_number, network, status FROM sim_cards WHERE id = ?").bind(simId).first<{id:string;phone_number:string;network:SimNetwork;status:string}>();
        if (!sim) return json({ error: "sim_not_found" }, 404, headers);
        if (sim.status !== "active") return json({ error: "sim_not_active" }, 409, headers);
        const id = uuid();
        await env.DB.batch([
          env.DB.prepare("INSERT INTO recharge_transactions (id, sim_card_id, phone_number_snapshot, network_snapshot, amount_cents, status, idempotency_key, requested_by, request_source) VALUES (?, ?, ?, ?, ?, 'draft', ?, 'admin-token', 'admin')").bind(id, sim.id, sim.phone_number, sim.network, amount, idempotencyKey),
          env.DB.prepare("INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, outcome) VALUES (?, 'admin-token', 'recharge.draft_created', 'recharge_transaction', ?, 'success')").bind(uuid(), id)
        ]);
        return json({ id, status: "draft", message: "Draft saved only; no airtime was sent." }, 201, headers);
      }

      if (url.pathname === "/api/reports/summary" && request.method === "GET") {
        const sims = await env.DB.prepare("SELECT network, status, COUNT(*) AS count FROM sim_cards GROUP BY network, status").all();
        const recharges = await env.DB.prepare("SELECT status, COUNT(*) AS count, COALESCE(SUM(amount_cents),0) AS amount_cents FROM recharge_transactions GROUP BY status").all();
        const commissions = await env.DB.prepare("SELECT network, status, COALESCE(SUM(amount_cents),0) AS amount_cents FROM commission_statements GROUP BY network, status").all();
        return json({ sims: sims.results, recharges: recharges.results, commissions: commissions.results }, 200, headers);
      }
      return json({ error: "not_found" }, 404, headers);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      if (message.includes("UNIQUE constraint failed")) return json({ error: "duplicate_record_or_idempotency_key" }, 409, headers);
      console.error(JSON.stringify({ level: "error", route: url.pathname, message }));
      return json({ error: "internal_error" }, 500, headers);
    }
  }
};
