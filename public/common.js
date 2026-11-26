// Shared client code: WebSocket with auto-reconnect, server clock sync, formatting.

export function formatCents(cents) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100).toLocaleString("en-US")}.${String(abs % 100).padStart(2, "0")}`;
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/**
 * connect({ params, onState, onError, onAck, onStatus })
 * Returns { send(obj), serverNow() }.
 */
export function connect({ params, onState, onError, onAck, onStatus }) {
  let ws = null;
  let offset = 0; // serverTime - localTime
  let retry = 0;
  let pingTimer = null;
  let reconnectTimer = null;
  const queue = [];

  function open() {
    clearTimeout(reconnectTimer);
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${proto}//${location.host}/ws?${new URLSearchParams(params)}`);
    onStatus?.("connecting");
    ws.onopen = () => {
      retry = 0;
      onStatus?.("online");
      while (queue.length) ws.send(queue.shift());
      clearInterval(pingTimer);
      pingTimer = setInterval(() => ws?.readyState === 1 && ws.send("ping"), 20000);
    };
    ws.onmessage = (ev) => {
      if (ev.data === "pong") return;
      const msg = JSON.parse(ev.data);
      if (msg.t === "state") {
        offset = msg.view.serverNow - Date.now();
        onState?.(msg.view);
      } else if (msg.t === "error") onError?.(msg);
      else if (msg.t === "ack") onAck?.(msg);
    };
    ws.onclose = () => {
      clearInterval(pingTimer);
      onStatus?.("offline");
      const delay = Math.min(5000, 500 * 2 ** retry++);
      reconnectTimer = setTimeout(open, delay);
    };
  }

  // Reconnect immediately when the phone wakes up / comes back to the tab.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !ws) return;
    if (ws.readyState === WebSocket.CLOSED) open();
    else if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "sync" }));
  });

  open();
  return {
    send(obj) {
      const data = JSON.stringify(obj);
      if (ws?.readyState === 1) ws.send(data);
      else queue.push(data);
    },
    serverNow: () => Date.now() + offset,
  };
}

/** Seconds left (ceil) until deadline, never negative. */
export function secondsLeft(deadline, serverNow) {
  if (!deadline) return 0;
  return Math.max(0, Math.ceil((deadline - serverNow) / 1000));
}
