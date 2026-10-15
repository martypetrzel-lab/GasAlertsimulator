"use client";
import { io, Socket } from "socket.io-client";
import { useCallback, useEffect, useRef, useState } from "react";
export async function api<T = unknown>(
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Požadavek selhal.");
  return data;
}
export function useRealtime<T>(
  role: "instructor" | "detector",
  id?: string,
  token?: string,
) {
  const socket = useRef<Socket | null>(null),
    [state, setState] = useState<T | null>(null),
    [connected, setConnected] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if ((role === "instructor" && !id) || (role === "detector" && !token))
      return;
    let last = 0;
    const s = io({
      auth: { role, token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });
    socket.current = s;
    s.on("connect", () => {
      setError("");
      if (role === "instructor")
        s.emit("instructor:watch", id, (r: { error?: string }) => {
          if (r?.error) setError(r.error);
        });
      else
        s.emit("detector:action", {
          action: "foreground",
          visible: !document.hidden,
        });
    });
    s.on(`${role}:state`, (value: T) => {
      last = Date.now();
      setState(value);
      setConnected(true);
    });
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", (e) => {
      setError(e.message);
      setConnected(false);
    });
    const timer = setInterval(() => {
      if (Date.now() - last > 4000) setConnected(false);
    }, 500);
    return () => {
      clearInterval(timer);
      s.disconnect();
      socket.current = null;
      setConnected(false);
      setState(null);
    };
  }, [role, id, token]);
  const send = useCallback(
    (event: string, payload: unknown) =>
      new Promise<void>((resolve, reject) => {
        const s = socket.current;
        if (!s?.connected) {
          reject(new Error("Spojení není dostupné."));
          return;
        }
        s.timeout(7000).emit(
          event,
          payload,
          (err: Error | null, r: { error?: string }) => {
            if (err || r?.error) {
              const message = r?.error || "Server nepotvrdil příkaz.";
              setError(message);
              reject(new Error(message));
            } else {
              setError("");
              resolve();
            }
          },
        );
      }),
    [],
  );
  return { state, connected, error, send, socket };
}
export const timeLabel = (s: number) =>
  `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(Math.floor(s) % 60).padStart(2, "0")}`;
export const statusLabel = {
  ready: "Připraveno",
  running: "Cvičení probíhá",
  paused: "Pozastaveno",
  ended: "Ukončeno",
};
