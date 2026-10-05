// Data Engineer relay: one room per team, WebSocket, end-to-end encrypted payloads.
// The relay never sees the data (AES-256-GCM with the key inside the team code):
// it only forwards bytes between the team's bridges and viewers and keeps the last
// copy of each "retained" topic for whoever connects later.
//
// Frame (binary) = one or more records:
//   u8 type · u8 flags · u16 topic length · u32 payload length · topic · payload
//   type 1 PUB  client→relay (flags bit0 = retain)
//   type 2 MSG  relay→client (flags bit0 = replayed retained copy)
//   type 3 WILL client→relay: published (retained) if the connection drops
// Text frame "ping" is answered "pong" by the platform without waking the room.
import { DurableObject } from "cloudflare:workers";

const MAX_FRAME = 1 << 20;
const ROOM_RE = /^[A-Za-z0-9_-]{6,40}$/;

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (u.pathname === "/" || u.pathname === "/health") return new Response("Data Engineer relay: ok\n", { headers: { "content-type": "text/plain" } });
    if (u.pathname !== "/ws") return new Response("not found", { status: 404 });
    if ((req.headers.get("Upgrade") || "").toLowerCase() !== "websocket") return new Response("websocket only", { status: 426 });
    const room = u.searchParams.get("room") || "";
    if (!ROOM_RE.test(room)) return new Response("bad room", { status: 400 });
    return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(req);
  },
};

function parse(buf) {
  const b = new Uint8Array(buf), dv = new DataView(b.buffer, b.byteOffset, b.byteLength), out = [];
  let o = 0;
  while (o + 8 <= b.length) {
    const type = b[o], flags = b[o + 1], tl = dv.getUint16(o + 2), pl = dv.getUint32(o + 4);
    o += 8;
    if (o + tl + pl > b.length) break;
    const topic = new TextDecoder().decode(b.subarray(o, o + tl));
    const payload = b.slice(o + tl, o + tl + pl);
    o += tl + pl;
    out.push({ type, flags, topic, payload });
  }
  return out;
}
function build(recs) {
  const te = new TextEncoder();
  const parts = recs.map((r) => [r, te.encode(r.topic)]);
  const size = parts.reduce((a, [r, t]) => a + 8 + t.length + r.payload.length, 0);
  const b = new Uint8Array(size), dv = new DataView(b.buffer);
  let o = 0;
  for (const [r, t] of parts) {
    b[o] = r.type; b[o + 1] = r.flags; dv.setUint16(o + 2, t.length); dv.setUint32(o + 4, r.payload.length);
    b.set(t, o + 8); b.set(r.payload, o + 8 + t.length); o += 8 + t.length + r.payload.length;
  }
  return b;
}
// split into frames below the platform's message size limit
function frames(recs) {
  const out = []; let cur = [], size = 0;
  for (const r of recs) {
    const n = 8 + r.topic.length * 3 + r.payload.length;
    if (n > MAX_FRAME - 1024) continue;
    if (size + n > MAX_FRAME - 1024 && cur.length) { out.push(build(cur)); cur = []; size = 0; }
    cur.push(r); size += n;
  }
  if (cur.length) out.push(build(cur));
  return out;
}
const kindOf = (t) => t.slice(t.lastIndexOf("/") + 1);
const wants = (sub, topic) => sub === "all" || (sub === "regia" && topic.endsWith("/regia/ovc"));
// high-rate topics are kept in memory only; the others are also saved (throttled) so a
// viewer who connects after a quiet period still gets the last state
const HOT = new Set(["sc", "car", "rst"]);

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ret = new Map();
    this.saved = new Map();
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    this.ctx.blockConcurrencyWhile(async () => {
      const all = await this.ctx.storage.list({ prefix: "r:" });
      for (const [k, v] of all) this.ret.set(k.slice(2), new Uint8Array(v));
    });
  }
  async fetch(req) {
    const u = new URL(req.url);
    const room = u.searchParams.get("room");
    const sub = u.searchParams.get("sub") === "regia" ? "regia" : "all";
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ room, sub, will: null });
    const recs = [];
    for (const [topic, payload] of this.ret) if (wants(sub, topic)) recs.push({ type: 2, flags: 1, topic, payload });
    for (const f of frames(recs)) server.send(f);
    return new Response(null, { status: 101, webSocket: client });
  }
  remember(topic, payload) {
    this.ret.set(topic, payload);
    const now = Date.now(), last = this.saved.get(topic) || 0;
    const gap = HOT.has(kindOf(topic)) ? 300e3 : 60e3;
    if (now - last > gap && payload.length < 120e3) {
      this.saved.set(topic, now);
      this.ctx.storage.put("r:" + topic, payload).catch(() => {});
    }
  }
  broadcast(from, recs) {
    if (!recs.length) return;
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === from) continue;
      let att; try { att = ws.deserializeAttachment() || {}; } catch (e) { att = {}; }
      const mine = recs.filter((r) => wants(att.sub || "all", r.topic));
      if (!mine.length) continue;
      try { for (const f of frames(mine)) ws.send(f); } catch (e) {}
    }
  }
  async webSocketMessage(ws, msg) {
    if (typeof msg === "string") return;
    const att = ws.deserializeAttachment() || {};
    const prefix = "de/" + att.room + "/";
    const out = [];
    for (const r of parse(msg)) {
      if (!r.topic.startsWith(prefix) || r.topic.length > 200) continue;
      if (r.type === 1) {
        if (r.flags & 1) this.remember(r.topic, r.payload);
        out.push({ type: 2, flags: 0, topic: r.topic, payload: r.payload });
      } else if (r.type === 3) {
        att.will = { topic: r.topic, payload: Array.from(r.payload) };
        ws.serializeAttachment(att);
      }
    }
    this.broadcast(ws, out);
  }
  async webSocketClose(ws, code, reason, clean) { this.gone(ws); try { ws.close(code, "bye"); } catch (e) {} }
  async webSocketError(ws) { this.gone(ws); }
  gone(ws) {
    let att; try { att = ws.deserializeAttachment() || {}; } catch (e) { return; }
    if (!att.will || att.done) return;
    att.done = true; try { ws.serializeAttachment(att); } catch (e) {}
    const p = new Uint8Array(att.will.payload);
    this.remember(att.will.topic, p);
    this.broadcast(ws, [{ type: 2, flags: 0, topic: att.will.topic, payload: p }]);
  }
}
