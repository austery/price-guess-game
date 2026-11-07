// Entry Worker: static pages are served from public/ automatically.
// This only handles the WebSocket endpoint (forwarded to the GameRoom Durable Object)
// and the QR code image for the join link.

import qrcode from "qrcode-generator";

export { GameRoom } from "./room";

const ROOM_NAME = "main";
const TOKEN_RE = /^[A-Za-z0-9-]{8,64}$/;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      const role = url.searchParams.get("role");
      const headers = new Headers(request.headers);
      if (role === "host") {
        if (!env.HOST_KEY) return new Response("HOST_KEY is not configured on the server.", { status: 500 });
        if (!timingSafeEqual(url.searchParams.get("key") ?? "", env.HOST_KEY)) {
          return new Response("Wrong host key", { status: 403 });
        }
        headers.set("X-Role", "host");
      } else if (role === "player") {
        if (!TOKEN_RE.test(url.searchParams.get("token") ?? "")) return new Response("Bad token", { status: 400 });
        headers.set("X-Role", "player");
      } else {
        return new Response("Bad role", { status: 400 });
      }
      // Never forward the host key into the room.
      const forwardUrl = new URL(url);
      forwardUrl.searchParams.delete("key");
      const stub = env.ROOM.get(env.ROOM.idFromName(ROOM_NAME));
      return stub.fetch(forwardUrl.toString(), { headers });
    }

    if (url.pathname === "/api/host-check") {
      const ok = !!env.HOST_KEY && timingSafeEqual(url.searchParams.get("key") ?? "", env.HOST_KEY);
      return new Response(ok ? "ok" : "forbidden", { status: ok ? 200 : 403, headers: { "Cache-Control": "no-store" } });
    }

    if (url.pathname === "/qr.svg") {
      const qr = qrcode(0, "M");
      qr.addData(`${url.origin}/`);
      qr.make();
      return new Response(qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true }), {
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
