type Env = {
  DB: any;
  ADMIN_PASSWORD?: string;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  MEDIA: any;
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

  if (path === "/api/admin/uploads" && request.method === "DELETE") {
    if (!env.MEDIA || typeof env.MEDIA.delete !== "function") return json({ error: "Image storage is not connected." }, 503);
    const key = clean(url.searchParams.get("key"), 300);
    if (!/^uploads\/(?:construction|services|projects|products|designs)\/[a-f0-9-]+\.(?:jpg|png|webp|gif)$/.test(key)) return json({ error: "Only Eyaelo-uploaded image files can be permanently deleted here." }, 400);
    await env.MEDIA.delete(key);
    return json({ ok: true, deleted: key });
  }

  if (path === "/api/admin/uploads" && request.method === "POST") {
    if (!env.MEDIA || typeof env.MEDIA.put !== "function") return json({ error: "Image storage is not connected to this Worker yet." }, 503);
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) return json({ error: "Choose an image file to upload." }, 400);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return json({ error: "Choose an image from your phone first." }, 400);
    if (file.size > 8 * 1024 * 1024) return json({ error: "Images must be 8 MB or smaller." }, 413);
    const allowedTypes: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"
    };
    const ext = allowedTypes[file.type.toLowerCase()];
    if (!ext) return json({ error: "Use a JPG, PNG, WEBP or GIF image." }, 400);
    const category = clean(form.get("category"), 30).toLowerCase();
    if (!["construction", "services", "projects", "products", "designs"].includes(category)) return json({ error: "Choose a valid image category." }, 400);
    const title = clean(form.get("title"), 160);
    const description = clean(form.get("description"), 1000);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isJpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const isPng = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
    const isGif = bytes[0] === 71 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 56;
    const isWebp = bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80;
    if (!(isJpeg || isPng || isGif || isWebp)) return json({ error: "The selected file does not appear to be a valid image." }, 400);
    const key = "uploads/" + category + "/" + crypto.randomUUID() + "." + ext;
    await env.MEDIA.put(key, bytes, {
      httpMetadata: { contentType: file.type.toLowerCase(), cacheControl: "public, max-age=31536000, immutable" },
      customMetadata: { category, title, description, originalName: clean(file.name, 180) }
    });
    return json({ ok: true, key, url: new URL(request.url).origin + "/media/" + key, title, description }, 201);
  }


  if (path === "/api/admin/design-submissions" && request.method === "GET") {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS design_submission_files (id INTEGER PRIMARY KEY AUTOINCREMENT, design_id INTEGER NOT NULL, object_key TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL, content_type TEXT NOT NULL, file_size INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY(design_id) REFERENCES designs(id) ON DELETE CASCADE)").run();
    const rows = await env.DB.prepare("SELECT d.id, d.title, d.description, d.category, d.designer_name, d.designer_email, d.designer_phone, d.portfolio_url, d.rights_confirmed, d.status, f.id AS file_id, f.file_name, f.file_size, f.created_at AS file_created_at FROM designs d LEFT JOIN design_submission_files f ON f.design_id = d.id WHERE d.status IN ('pending','rejected') OR f.id IS NOT NULL ORDER BY d.id DESC").all();
    return json(rows.results || []);
  }
  const privateFileMatch = path.match(/^\\/api\\/admin\\/design-submissions\\/(\\d+)\\/files\\/(\\d+)$/);
  if (privateFileMatch && request.method === "GET") {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS design_submission_files (id INTEGER PRIMARY KEY AUTOINCREMENT, design_id INTEGER NOT NULL, object_key TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL, content_type TEXT NOT NULL, file_size INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY(design_id) REFERENCES designs(id) ON DELETE CASCADE)").run();
    const row = await env.DB.prepare("SELECT object_key, file_name FROM design_submission_files WHERE id = ? AND design_id = ?").bind(Number(privateFileMatch[2]), Number(privateFileMatch[1])).first();
    if (!row || !env.MEDIA || typeof env.MEDIA.get !== "function") return json({ error: "File not found." }, 404);
    const object = await env.MEDIA.get(row.object_key);
    if (!object) return json({ error: "File not found in private storage." }, 404);
    const safeName = String(row.file_name || "design-file").replace(/[\\r\\n"]/g, "_").replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 180);
    return new Response(object.body, { status: 200, headers: { "content-type": "application/octet-stream", "content-disposition": "attachment; filename=\"" + safeName + "\"", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  }
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
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS design_submission_files (id INTEGER PRIMARY KEY AUTOINCREMENT, design_id INTEGER NOT NULL, object_key TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL, content_type TEXT NOT NULL, file_size INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY(design_id) REFERENCES designs(id) ON DELETE CASCADE)").run();
    const files = await env.DB.prepare("SELECT object_key FROM design_submission_files WHERE design_id = ?").bind(Number(designDelete[1])).all();
    for (const file of files.results || []) if (env.MEDIA && typeof env.MEDIA.delete === "function") await env.MEDIA.delete(file.object_key);
    await env.DB.prepare("DELETE FROM design_submission_files WHERE design_id = ?").bind(Number(designDelete[1])).run();
    await env.DB.prepare("DELETE FROM designs WHERE id = ?").bind(Number(designDelete[1])).run();
    return json({ ok: true });
  }

  if (path === "/api/admin/enquiries" && request.method === "GET") {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS career_cvs (enquiry_id INTEGER PRIMARY KEY, file_name TEXT NOT NULL, content_type TEXT NOT NULL, file_data BLOB NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY(enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE)").run();
    const rows = await env.DB.prepare("SELECT e.id, e.type, e.name, e.company, e.phone, e.email, e.subject, e.details, e.status, e.created_at, c.file_name AS cv_file_name FROM enquiries e LEFT JOIN career_cvs c ON c.enquiry_id = e.id ORDER BY e.id DESC LIMIT 200").all();
    return json(rows.results || []);
  }
  const cvMatch = path.match(/^\/api\/admin\/enquiries\/(\d+)\/cv$/);
  if (cvMatch && request.method === "GET") {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS career_cvs (enquiry_id INTEGER PRIMARY KEY, file_name TEXT NOT NULL, content_type TEXT NOT NULL, file_data BLOB NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY(enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE)").run();
    const row = await env.DB.prepare("SELECT c.file_name, c.content_type, c.file_data FROM career_cvs c JOIN enquiries e ON e.id = c.enquiry_id WHERE c.enquiry_id = ? AND e.type = 'career'").bind(Number(cvMatch[1])).first();
    if (!row) return json({ error: "No CV file is attached to this application." }, 404);
    const safeName = String(row.file_name || "cv").replace(/[\r\n"]/g, "_");
    return new Response(row.file_data, { status: 200, headers: { "content-type": row.content_type || "application/octet-stream", "content-disposition": "attachment; filename=\"" + safeName + "\"", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
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
    const imageCategoryNames = [
      "Residential Construction", "Commercial and Retail Buildings", "Healthcare and Institutional Facilities",
      "Roads and Transport Infrastructure", "Industrial and Agro-Processing Facilities", "Property and Mixed-Use Developments",
      "Water and Sanitation Infrastructure", "Bridges and Major Structures", "Warehousing and Logistics Facilities",
      "Structural and Foundation Works", "Civil and Site Works", "Renovation and Refurbishment", "Roofing and Building Finishes",
      "Reinforcement Steel Works", "Water, Drainage and Sanitation", "Construction Materials Sourcing",
      "Site Clearance and Earthworks", "Concrete and Formwork Works", "Waterproofing and Damp Protection",
      "Paving, Kerbs and External Works", "Project and Site Coordination", "Building Maintenance and Repairs"
    ];
    const allowed = ["heroTitle", "heroText", ...imageCategoryNames.flatMap((name) => ["categoryImage:" + name, "categoryImages:" + name])];
    for (const key of allowed) {
      if (typeof body[key] === "string") {
        const value = clean(body[key], key.startsWith("categoryImages:") ? 7000 : key === "heroText" ? 600 : 1000);
        if (key.startsWith("categoryImages:") && value) {
          let images: unknown;
          try { images = JSON.parse(value); } catch { return json({ error: "Category gallery must be a valid image list." }, 400); }
          if (!Array.isArray(images) || images.length > 7 || images.some((image) => typeof image !== "string" || image.length > 1000 || !(/^https:\/\//i.test(image) || /^\/media\/uploads\/(?:construction|services)\/[a-f0-9-]+\.(?:jpg|png|webp|gif)$/i.test(image)))) {
            return json({ error: "Each category can have up to 7 HTTPS image URLs." }, 400);
          }
        }
        if (key.startsWith("categoryImage:") && value && value !== "__none__") {
          try {
            const imageUrl = new URL(value);
            if (imageUrl.protocol !== "https:") return json({ error: "Category image links must use HTTPS." }, 400);
          } catch {
            return json({ error: "Enter a valid direct HTTPS image URL." }, 400);
          }
        }
        await env.DB.prepare("INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')")
          .bind(key, value).run();
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
    if (url.pathname.startsWith("/media/")) {
      if (!env.MEDIA || typeof env.MEDIA.get !== "function") return new Response("Image storage is unavailable.", { status: 503 });
      const key = decodeURIComponent(url.pathname.slice("/media/".length));
      if (!/^uploads\/(?:construction|services|projects|products|designs)\/[a-f0-9-]+\.(?:jpg|png|webp|gif)$/.test(key)) return new Response("Not found.", { status: 404 });
      const object = await env.MEDIA.get(key);
      if (!object) return new Response("Not found.", { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("cache-control", "public, max-age=31536000, immutable");
      headers.set("x-content-type-options", "nosniff");
      return new Response(object.body, { status: 200, headers });
    }
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
          const contentType = request.headers.get("content-type") || "";
          const multipart = contentType.toLowerCase().includes("multipart/form-data");
          let body: Record<string, unknown>;
          let designFile: File | null = null;
          if (multipart) {
            const length = Number(request.headers.get("content-length") || "0");
            if (length > 21_000_000) return json({ error: "The total upload is too large. Design files must be 20 MB or smaller." }, 413, headers);
            const form = await request.formData();
            body = Object.fromEntries(Array.from(form.entries()).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
            const uploaded = form.get("design_file");
            if (uploaded instanceof File && uploaded.size > 0) designFile = uploaded;
          } else {
            body = await readBody(request);
          }
          const title = clean(body.title, 160), category = clean(body.category, 50), name = clean(body.designer_name, 160), email = clean(body.designer_email, 200), phone = clean(body.designer_phone, 80);
          if (!title || !name || !email || !phone) return json({ error: "Please provide the design title, your name, email and phone." }, 400, headers);
          if (!designCategories.includes(category)) return json({ error: "Choose a valid design category." }, 400, headers);
          if (body.rights_confirmed !== true && body.rights_confirmed !== "true" && body.rights_confirmed !== "on") return json({ error: "Please confirm you own or are authorised to submit this work." }, 400, headers);
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400, headers);
          const portfolio = clean(body.portfolio_url, 1000);
          if (portfolio) { try { if (new URL(portfolio).protocol !== "https:") throw new Error(); } catch { return json({ error: "Portfolio link must be a valid HTTPS URL." }, 400, headers); } }
          let bytes: Uint8Array | null = null, ext = "", safeName = "";
          if (designFile) {
            if (designFile.size > 20 * 1024 * 1024) return json({ error: "Design files must be 20 MB or smaller." }, 413, headers);
            safeName = (designFile.name.split(/[\\\\/]/).pop() || "design-file").replace(/[\r\n"]/g, "_").replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 180);
            ext = safeName.toLowerCase().split(".").pop() || "";
            if (!["pdf", "dwg", "dxf", "doc", "docx", "zip"].includes(ext)) return json({ error: "Accepted files: PDF, DWG, DXF, DOC, DOCX or ZIP. Maximum 20 MB." }, 400, headers);
            bytes = new Uint8Array(await designFile.arrayBuffer());
            const begins = (...signature: number[]) => signature.every((value, index) => bytes![index] === value);
            const valid = ext === "pdf" ? begins(37,80,68,70,45)
              : ["docx","zip"].includes(ext) ? begins(80,75,3,4)
              : ext === "doc" ? begins(208,207,17,224,161,177,26,225)
              : ext === "dxf" ? new TextDecoder().decode(bytes.slice(0,4096)).includes("SECTION")
              : new TextDecoder().decode(bytes.slice(0,6)).startsWith("AC10");
            if (!valid) return json({ error: "The file content does not match a supported file format." }, 400, headers);
          }
          await env.DB.prepare("CREATE TABLE IF NOT EXISTS design_submission_files (id INTEGER PRIMARY KEY AUTOINCREMENT, design_id INTEGER NOT NULL, object_key TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL, content_type TEXT NOT NULL, file_size INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY(design_id) REFERENCES designs(id) ON DELETE CASCADE)").run();
          const saved = await env.DB.prepare("INSERT INTO designs (title, description, category, designer_name, designer_email, designer_phone, portfolio_url, rights_confirmed, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'pending', datetime('now'))")
            .bind(title, clean(body.description, 3000), category, name, email, phone, portfolio).run();
          const designId = Number(saved.meta?.last_row_id || 0);
          if (designFile && bytes && designId) {
            if (!env.MEDIA || typeof env.MEDIA.put !== "function") {
              await env.DB.prepare("DELETE FROM designs WHERE id = ?").bind(designId).run();
              return json({ error: "Private file storage is unavailable. Your submission was not saved; try again without a file." }, 503, headers);
            }
            const key = "private-design-submissions/" + designId + "/" + crypto.randomUUID() + "." + ext;
            try {
              await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: "application/octet-stream" }, customMetadata: { designId: String(designId), originalName: safeName } });
              await env.DB.prepare("INSERT INTO design_submission_files (design_id, object_key, file_name, content_type, file_size) VALUES (?, ?, ?, ?, ?)")
                .bind(designId, key, safeName, designFile.type || "application/octet-stream", designFile.size).run();
            } catch (uploadError) {
              await env.MEDIA.delete(key).catch(() => {});
              await env.DB.prepare("DELETE FROM designs WHERE id = ?").bind(designId).run();
              throw uploadError;
            }
          }
          return json({ ok: true, id: designId, file_uploaded: Boolean(designFile), message: "Submission received privately for review." }, 201, headers);
        }

        if (url.pathname === "/api/enquiries" && request.method === "POST") {
          const contentType = request.headers.get("content-type") || "";
          let body: Record<string, unknown>;
          let cvFile: File | null = null;
          if (contentType.toLowerCase().includes("multipart/form-data")) {
            const length = Number(request.headers.get("content-length") || "0");
            if (length > 1_150_000) return json({ error: "The upload is too large. CV files must be 1 MB or smaller." }, 413, headers);
            const form = await request.formData();
            body = Object.fromEntries(Array.from(form.entries()).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
            const uploaded = form.get("cv");
            if (uploaded instanceof File && uploaded.size > 0) cvFile = uploaded;
          } else {
            body = await readBody(request);
          }
          const name = clean(body.name, 160);
          if (!name) return json({ error: "Name is required." }, 400, headers);
          const requestedType = clean(body.type, 30);
          const type = ["material", "career"].includes(requestedType) ? requestedType : "quote";
          if (cvFile && type !== "career") return json({ error: "CV uploads are only accepted with career applications." }, 400, headers);
          let cvType = "";
          let cvName = "";
          let cvBytes: Uint8Array | null = null;
          if (cvFile) {
            if (cvFile.size > 1_048_576) return json({ error: "Your CV must be 1 MB or smaller." }, 413, headers);
            cvName = cvFile.name.split(/[\\/]/).pop()!.replace(/[\\r\\n]/g, "_").slice(0, 180);
            const ext = cvName.toLowerCase().split(".").pop() || "";
            if (!["pdf", "doc", "docx"].includes(ext)) return json({ error: "Upload your CV as a PDF, DOC or DOCX file." }, 400, headers);
            cvBytes = new Uint8Array(await cvFile.arrayBuffer());
            const signature = Array.from(cvBytes.slice(0, 8));
            const validSignature = ext === "pdf"
              ? signature[0] === 37 && signature[1] === 80 && signature[2] === 68 && signature[3] === 70
              : ext === "doc"
                ? signature.slice(0, 8).join(",") === "208,207,17,224,161,177,26,225"
                : signature[0] === 80 && signature[1] === 75 && signature[2] === 3 && signature[3] === 4;
            if (!validSignature) return json({ error: "The file does not appear to be a valid PDF, DOC or DOCX document." }, 400, headers);
            cvType = ext === "pdf" ? "application/pdf" : ext === "doc" ? "application/msword" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          }
          const fields: Array<[string, string]> = [["Name", "name"], ["Email", "email"], ["Phone", "phone"], ["Location", "location"], ["Area of interest", "role"], ["Relevant experience", "experience"], ["Availability", "availability"], ["Message", "message"], ["CV or portfolio link", "cvLink"]];
          let details = clean(body.details, 6000);
          if (type === "career") {
            details = fields.map(([label, key]) => { const value = clean(body[key], key === "message" ? 3000 : 1000); return value ? label + ": " + value : ""; }).filter(Boolean).join("\n");
            if (cvFile) details += (details ? "\n" : "") + "CV attached: " + cvName;
          }
          await env.DB.prepare("CREATE TABLE IF NOT EXISTS career_cvs (enquiry_id INTEGER PRIMARY KEY, file_name TEXT NOT NULL, content_type TEXT NOT NULL, file_data BLOB NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY(enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE)").run();
          const saved = await env.DB.prepare("INSERT INTO enquiries (type, name, company, phone, email, subject, details) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind(type, name, clean(body.company, 160), clean(body.phone, 80), clean(body.email, 200), clean(body.subject || body.role || (type === "career" ? "General career application" : ""), 200), details).run();
          const enquiryId = Number(saved.meta?.last_row_id || 0);
          if (cvFile && cvBytes && enquiryId) {
            try {
              await env.DB.prepare("INSERT INTO career_cvs (enquiry_id, file_name, content_type, file_data) VALUES (?, ?, ?, ?)")
                .bind(enquiryId, cvName, cvType, cvBytes).run();
            } catch (uploadError) {
              await env.DB.prepare("DELETE FROM enquiries WHERE id = ?").bind(enquiryId).run();
              throw uploadError;
            }
          }
          return json({ ok: true, id: enquiryId, cv_uploaded: Boolean(cvFile) }, 201, headers);
        }
        return await adminApi(request, env, url);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Request failed." }, 400, headers);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
