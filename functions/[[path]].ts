/**
 * Proxy the dashboard and public-media API to the Eyaelo Worker.
 *
 * The Pages site and Worker are separate deployments. Without this proxy,
 * same-origin calls such as /api/admin/uploads stop at Pages and never reach
 * the Worker that owns the D1 and R2 bindings.
 */
export const onRequest = async (context: any) => {
  const request = context.request as Request;
  const pathname = new URL(request.url).pathname;

  if (!pathname.startsWith("/api/") && !pathname.startsWith("/media/")) {
    return context.next();
  }

  const upstream = new URL(request.url);
  upstream.protocol = "https:";
  upstream.hostname = "eyaelo-construction.martinelolu30.workers.dev";
  upstream.port = "";

  try {
    // Forward method, headers, body and the admin session cookie unchanged.
    // The Worker response (including Set-Cookie) is returned to the Pages
    // origin, so the dashboard remains same-origin on pages.dev.
    const proxiedRequest = new Request(upstream.toString(), request);
    return await fetch(proxiedRequest);
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "The Eyaelo API could not be reached. Please try again.",
        detail: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 502,
        headers: { "content-type": "application/json; charset=utf-8" }
      }
    );
  }
};
