type Env = {
  DB: any;
  ADMIN_PASSWORD?: string;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
};

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

const corsHeaders = { "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin" };
const clean = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);
const sha256 = async (value: string) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
};
const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
};
const getCookie = (request: Request, name: string) => {
  const cookie = request.headers.get("Cookie") || "";
  const part = cookie.split(";").map((x) => x.trim()).find((x) => x.startsWith(name + "="));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : "";
};
const cookieHeader = (token: string, maxAge: number) =>
  "eyaelo_admin=" + token + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" + maxAge;

async function requireAdmin(request: Request, env: Env) {
  const token = getCookie(request, "eyaelo_admin");
  if (!token) return false;
  const hash = await sha256(token);
  const row = await env.DB.prepare("SELECT token_hash FROM admin_sessions WHERE token_hash = ? AND expires_at > datetime('now')").bind(hash).first();
  return Boolean(row);
}
async function readBody(request: Request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > 200000) throw new Error("Request too large");
  return await request.json() as Record<string, unknown>;
}

const designCategories = ["Residential", "Commercial", "Education", "Healthcare", "Infrastructure", "Other projects"];

async function content(env: Env) {
  const [services, products, videos, projects, settingRows] = await Promise.all([
    env.DB.prepare("SELECT id, name, description, sort_order FROM services WHERE published = 1 ORDER BY sort_order, id").all(),
    env.DB.prepare("SELECT id, name, description, category, price, unit, image_url FROM products WHERE published = 1 ORDER BY name").all(),
    env.DB.prepare("SELECT id, title, description, video_url, placement FROM videos WHERE published = 1 ORDER BY id DESC").all(),
    env.DB.prepare("SELECT id, title, description, location, image_url FROM projects WHERE published = 1 ORDER BY id DESC").all(),
    env.DB.prepare("SELECT key, value FROM site_settings").all(),
  ]);
  const settings: Record<string, string> = {};
  for (const row of settingRows.results || []) settings[row.key] = row.value;
  return { services: services.results || [], products: products.results || [], projects: projects.results || [], videos: videos.results || [], settings };
}
async function adminApi(request: Request, env: Env, url: URL) {
  const path = url.pathname;
  if (path === "/api/admin/login" && request.method === "POST") {
    if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 12) return json({ error: "Admin password has not been configured. Add a strong ADMIN_PASSWORD secret in Cloudflare." }, 503);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const ipKey = await sha256(ip);
    await env.DB.prepare("DELETE FROM login_attempts WHERE attempted_at < datetime('now', '-30 minutes')").run();
    const attempts = await env.DB.prepare("SELECT COUNT(*) AS count FROM login_attempts WHERE ip_key = ? AND attempted_at > datetime('now', '-15 minutes')").bind(ipKey).first();
    if (Number(attempts?.count || 0) >= 8) return json({ error: "Too many login attempts. Please wait 15 minutes." }, 429);
    const body = await readBody(request);
    if (clean(body.password, 200) !== env.ADMIN_PASSWORD) {
      await env.DB.prepare("INSERT INTO login_attempts (ip_key) VALUES (?)").bind(ipKey).run();
      return json({ error: "Incorrect password." }, 401);
    }
    await env.DB.prepare("DELETE FROM login_attempts WHERE ip_key = ?").bind(ipKey).run();
    const token = randomToken();
    const hash = await sha256(token);
    await env.DB.prepare("DELETE FROM admin_sessions WHERE expires_at <= datetime('now')").run();
    await env.DB.prepare("INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, datetime('now', '+12 hours'))").bind(hash).run();
    return json({ ok: true }, 200, { "set-cookie": cookieHeader(token, 43200) });
  }
  if (path === "/api/admin/logout" && request.method === "POST") {
    const token = getCookie(request, "eyaelo_admin");
    if (token) await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
    return json({ ok: true }, 200, { "set-cookie": cookieHeader("", 0) });
  }
  if (path === "/api/admin/me" && request.method === "GET") {
    return (await requireAdmin(request, env)) ? json({ authenticated: true }) : json({ authenticated: false }, 401);
  }
  if (!(await requireAdmin(request, env))) return json({ error: "Please log in to the admin dashboard." }, 401);


  if (path === "/api/admin/designs" && request.method === "GET") {
    const rows = await env.DB.prepare("SELECT * FROM designs ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'published' THEN 1 ELSE 2 END, id DESC").all();
    return json(rows.results || []);
  }
  if (path === "/api/admin/designs" && request.method === "POST") {
    const body = await readBody(request);
    const title = clean(body.title, 160), category = clean(body.category, 50);
    if (!title) return json({ error: "Design title is required." }, 400);
    if (!designCategories.includes(category)) return json({ error: "Choose a valid design category." }, 400);
    const status = ["pending", "published", "rejected"].includes(clean(body.status, 20)) ? clean(body.status, 20) : "pending";
    const result = await env.DB.prepare("INSERT INTO designs (title, description, category, designer_name, designer_email, designer_phone, portfolio_url, image_url, price_label, rights_confirmed, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))")
      .bind(title, clean(body.description, 3000), category, clean(body.designer_name, 160), clean(body.designer_email, 200), clean(body.designer_phone, 80), clean(body.portfolio_url, 1000), clean(body.image_url, 1000), clean(body.price_label, 100) || "Enquire for price", body.rights_confirmed ? 1 : 0, status).run();
    return json({ id: result.meta?.last_row_id }, 201);
  }
  const designMatch = path.match(/^\/api\/admin\/designs\/(\d+)$/);
  if (designMatch && request.method === "PUT") {
    const body = await readBody(request), id = Number(designMatch[1]);
    const title = clean(body.title, 160), category = clean(body.category, 50), status = clean(body.status, 20);
    if (!title) return json({ error: "Design title is required." }, 400);
    if (!designCategories.includes(category)) return json({ error: "Choose a valid design category." }, 400);
    if (!["pending", "published", "rejected"].includes(status)) return json({ error: "Choose pending, published or rejected status." }, 400);
    await env.DB.prepare("UPDATE designs SET title=?, description=?, category=?, designer_name=?, designer_email=?, designer_phone=?, portfolio_url=?, image_url=?, price_label=?, rights_confirmed=?, status=?, updated_at=datetime('now') WHERE id=?")
      .bind(title, clean(body.description, 3000), category, clean(body.designer_name, 160), clean(body.designer_email, 200), clean(body.designer_phone, 80), clean(body.portfolio_url, 1000), clean(body.image_url, 1000), clean(body.price_label, 100) || "Enquire for price", body.rights_confirmed ? 1 : 0, status, id).run();
    return json({ ok: true });
  }
  const designDelete = path.match(/^\/api\/admin\/designs\/(\d+)$/);
  if (designDelete && request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM designs WHERE id = ?").bind(Number(designDelete[1])).run();
    return json({ ok: true });
  }

  if (path === "/api/admin/enquiries" && request.method === "GET") {
    const rows = await env.DB.prepare("SELECT id, type, name, company, phone, email, subject, details, status, created_at FROM enquiries ORDER BY id DESC LIMIT 200").all();
    return json(rows.results || []);
  }
  const statusMatch = path.match(/^\/api\/admin\/enquiries\/(\d+)$/);
  if (statusMatch && request.method === "PATCH") {
    const body = await readBody(request);
    const status = clean(body.status, 20);
    if (!["new", "in_progress", "completed", "archived"].includes(status)) return json({ error: "Invalid status." }, 400);
    await env.DB.prepare("UPDATE enquiries SET status = ? WHERE id = ?").bind(status, Number(statusMatch[1])).run();
    return json({ ok: true });
  }
  if (path === "/api/admin/settings" && request.method === "GET") {
    const rows = await env.DB.prepare("SELECT key, value FROM site_settings").all();
    return json(Object.fromEntries((rows.results || []).map((r: any) => [r.key, r.value])));
  }
  if (path === "/api/admin/settings" && request.method === "PUT") {
    const body = await readBody(request);
    const allowed = ["heroTitle", "heroText"];
    for (const key of allowed) {
      if (typeof body[key] === "string") {
        await env.DB.prepare("INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')")
          .bind(key, clean(body[key], key === "heroText" ? 600 : 160)).run();
      }
    }
    return json({ ok: true });
  }
  const resourceMatch = path.match(/^\/api\/admin\/(products|services|projects|videos)$/);
  if (resourceMatch && request.method === "GET") {
    const table = resourceMatch[1];
    const order = table === "services" ? "sort_order, id" : "id DESC";
    const rows = await env.DB.prepare("SELECT * FROM " + table + " ORDER BY " + order).all();
    return json(rows.results || []);
  }
  if (resourceMatch && request.method === "POST") {
    const table = resourceMatch[1];
    const body = await readBody(request);
    const published = body.published ? 1 : 0;
    if (table === "videos") {
      const title = clean(body.title, 160), videoUrl = clean(body.video_url, 1000), placement = clean(body.placement, 20) || "website";
      let parsed: URL;
      try { parsed = new URL(videoUrl); } catch { return json({ error: "Enter a valid YouTube or Vimeo video link." }, 400); }
      if (parsed.protocol !== "https:" || !["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be", "vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(parsed.hostname)) return json({ error: "Use a public YouTube or Vimeo video link." }, 400);
      if (!title || !videoUrl) return json({ error: "Video title and link are required." }, 400);
      if (!["website", "shop", "both"].includes(placement)) return json({ error: "Choose where the video should appear." }, 400);
      const result = await env.DB.prepare("INSERT INTO videos (title, description, video_url, placement, published, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))").bind(title, clean(body.description, 3000), videoUrl, placement, published).run();
      return json({ id: result.meta?.last_row_id }, 201);
    }
    if (table === "products") {
      const name = clean(body.name, 160);
      if (!name) return json({ error: "Product name is required." }, 400);
      const price = body.price === "" || body.price === null || body.price === undefined ? null : Number(body.price);
      if (price !== null && (!Number.isFinite(price) || price < 0)) return json({ error: "Enter a valid price." }, 400);
      const result = await env.DB.prepare("INSERT INTO products (name, description, category, price, unit, image_url, published, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))")
        .bind(name, clean(body.description, 3000), clean(body.category, 100) || "Other Building Materials", price, clean(body.unit, 40), clean(body.image_url, 1000), published).run();
      return json({ id: result.meta?.last_row_id }, 201);
    }
    if (table === "services") {
      const name = clean(body.name, 160);
      if (!name) return json({ error: "Service name is required." }, 400);
      const result = await env.DB.prepare("INSERT INTO services (name, description, sort_order, published, updated_at) VALUES (?, ?, ?, ?, datetime('now'))")
        .bind(name, clean(body.description, 3000), Number(body.sort_order) || 0, published).run();
      return json({ id: result.meta?.last_row_id }, 201);
    }
    const title = clean(body.title, 160);
    if (!title) return json({ error: "Project title is required." }, 400);
    const result = await env.DB.prepare("INSERT INTO projects (title, description, location, image_url, published, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))")
      .bind(title, clean(body.description, 3000), clean(body.location, 160), clean(body.image_url, 1000), published).run();
    return json({ id: result.meta?.last_row_id }, 201);
  }
  const itemMatch = path.match(/^\/api\/admin\/(products|services|projects|videos)\/(\d+)$/);
  if (itemMatch && request.method === "PUT") {
    const table = itemMatch[1], id = Number(itemMatch[2]), body = await readBody(request), published = body.published ? 1 : 0;
    if (table === "videos") {
      const title = clean(body.title, 160), videoUrl = clean(body.video_url, 1000), placement = clean(body.placement, 20) || "website";
      let parsed: URL;
      try { parsed = new URL(videoUrl); } catch { return json({ error: "Enter a valid YouTube or Vimeo video link." }, 400); }
      if (!title || parsed.protocol !== "https:" || !["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be", "vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(parsed.hostname)) return json({ error: "Enter a title and a valid YouTube or Vimeo link." }, 400);
      if (!["website", "shop", "both"].includes(placement)) return json({ error: "Choose where the video should appear." }, 400);
      await env.DB.prepare("UPDATE videos SET title=?, description=?, video_url=?, placement=?, published=?, updated_at=datetime('now') WHERE id=?").bind(title, clean(body.description, 3000), videoUrl, placement, published, id).run();
    } else if (table === "products") {
      const price = body.price === "" || body.price === null || body.price === undefined ? null : Number(body.price);
      if (price !== null && (!Number.isFinite(price) || price < 0)) return json({ error: "Enter a valid price." }, 400);
      await env.DB.prepare("UPDATE products SET name=?, description=?, category=?, price=?, unit=?, image_url=?, published=?, updated_at=datetime('now') WHERE id=?")
        .bind(clean(body.name, 160), clean(body.description, 3000), clean(body.category, 100), price, clean(body.unit, 40), clean(body.image_url, 1000), published, id).run();
    } else if (table === "services") {
      await env.DB.prepare("UPDATE services SET name=?, description=?, sort_order=?, published=?, updated_at=datetime('now') WHERE id=?")
        .bind(clean(body.name, 160), clean(body.description, 3000), Number(body.sort_order) || 0, published, id).run();
    } else {
      await env.DB.prepare("UPDATE projects SET title=?, description=?, location=?, image_url=?, published=?, updated_at=datetime('now') WHERE id=?")
        .bind(clean(body.title, 160), clean(body.description, 3000), clean(body.location, 160), clean(body.image_url, 1000), published, id).run();
    }
    return json({ ok: true });
  }
  if (itemMatch && request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM " + itemMatch[1] + " WHERE id = ?").bind(Number(itemMatch[2])).run();
    return json({ ok: true });
  }
  return json({ error: "Not found." }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const headers = corsHeaders;
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...headers, "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "access-control-allow-headers": "Content-Type" } });
      try {
        if (url.pathname === "/api/content" && request.method === "GET") return json(await content(env), 200, headers);

        if (url.pathname === "/api/designs" && request.method === "GET") {
          const category = clean(url.searchParams.get("category"), 50);
          const rows = category && designCategories.includes(category)
            ? await env.DB.prepare("SELECT id, title, description, category, designer_name, image_url, price_label FROM designs WHERE status='published' AND category=? ORDER BY id DESC").bind(category).all()
            : await env.DB.prepare("SELECT id, title, description, category, designer_name, image_url, price_label FROM designs WHERE status='published' ORDER BY id DESC").all();
          return json(rows.results || [], 200, headers);
        }
        if (url.pathname === "/api/design-submissions" && request.method === "POST") {
          const body = await readBody(request);
          const title = clean(body.title, 160), category = clean(body.category, 50), name = clean(body.designer_name, 160), email = clean(body.designer_email, 200), phone = clean(body.designer_phone, 80);
          if (!title || !name || !email || !phone) return json({ error: "Please provide the design title, your name, email and phone." }, 400, headers);
          if (!designCategories.includes(category)) return json({ error: "Choose a valid design category." }, 400, headers);
          if (body.rights_confirmed !== true) return json({ error: "Please confirm you own or are authorised to submit this work." }, 400, headers);
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400, headers);
          const portfolio = clean(body.portfolio_url, 1000);
          if (portfolio) { try { if (new URL(portfolio).protocol !== "https:") throw new Error(); } catch { return json({ error: "Portfolio link must be a valid HTTPS URL." }, 400, headers); } }
          await env.DB.prepare("INSERT INTO designs (title, description, category, designer_name, designer_email, designer_phone, portfolio_url, rights_confirmed, status) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'pending')")
            .bind(title, clean(body.description, 3000), category, name, email, phone, portfolio).run();
          return json({ ok: true, message: "Submission received for review. Artwork uploads will be connected later." }, 201, headers);
        }

        if (url.pathname === "/api/enquiries" && request.method === "POST") {
          const body = await readBody(request);
          const name = clean(body.name, 160);
          if (!name) return json({ error: "Name is required." }, 400, headers);
          const type = clean(body.type, 30) === "material" ? "material" : "quote";
          const details = clean(body.details, 6000);
          await env.DB.prepare("INSERT INTO enquiries (type, name, company, phone, email, subject, details) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind(type, name, clean(body.company, 160), clean(body.phone, 80), clean(body.email, 200), clean(body.subject, 200), details).run();
          return json({ ok: true }, 201, headers);
        }
        return await adminApi(request, env, url);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Request failed." }, 400, headers);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
