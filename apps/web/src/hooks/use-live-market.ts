"use client";
import { useEffect, useState } from "react";
import {
  applyLiveTick,
  parseLiveTick,
  type LiveSnapshot,
  type LiveSymbol,
} from "@/lib/live-market";
import type { Resolution } from "@/lib/market-data";
export function useLiveMarket(symbol: LiveSymbol, resolution: Resolution, enabled: boolean) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [status, setStatus] = useState("Connexion…");
  const [error, setError] = useState("");
  const [receivedAt, setReceivedAt] = useState<number | null>(null);
  useEffect(() => {
    let disposed = false,
      pending = false,
      socket: WebSocket | null = null;
    let initialized = false;
    let lastFrame = 0,
      reconnect: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | null = null;
    setError("");
    if (!enabled) {
      setStatus("En pause");
      return;
    }
    const visible = () => document.visibilityState === "visible";
    const load = async () => {
      if (disposed || pending || !visible()) return;
      pending = true;
      request = new AbortController();
      try {
        const response = await fetch(`/api/market/live?symbol=${symbol}&resolution=${resolution}`, {
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]),
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Prix indisponible");
        if (!disposed && visible()) {
          setSnapshot((current) =>
            current &&
            current.symbol === symbol &&
            current.resolution === resolution &&
            current.marketTime > data.marketTime
              ? current
              : data,
          );
          initialized = true;
          setReceivedAt(Date.now());
          setError("");
          setStatus("Actualisation · 3 s");
        }
      } catch (error) {
        if (!disposed && visible() && !request.signal.aborted) {
          setError(error instanceof Error ? error.message : "Prix indisponible");
          setStatus("Reconnexion…");
        }
      } finally {
        pending = false;
        request = null;
      }
    };
    const connect = () => {
      if (disposed || !visible() || socket) return;
      const pair = symbol.toLowerCase();
      const ws = new WebSocket(
        `wss://data-stream.binance.vision/stream?streams=${pair}@kline_${resolution}/${pair}@miniTicker`,
      );
      socket = ws;
      lastFrame = Date.now();
      ws.onmessage = (event) => {
        if (disposed || socket !== ws || !visible()) return;
        try {
          const tick = parseLiveTick(JSON.parse(event.data));
          if (!tick || tick.symbol !== symbol) return;
          lastFrame = Date.now();
          setSnapshot((current) => (current ? applyLiveTick(current, tick) : current));
          setReceivedAt(lastFrame);
          setError("");
          setStatus("Flux en direct");
        } catch {
          /* Ignore malformed feed frames; polling remains available. */
        }
      };
      ws.onerror = () => {
        lastFrame = 0;
        if (!disposed && visible()) setStatus("Actualisation · 3 s");
      };
      ws.onclose = () => {
        lastFrame = 0;
        if (socket === ws) socket = null;
        if (!disposed && visible()) {
          setStatus("Actualisation · 3 s");
          reconnect = setTimeout(connect, 10_000);
        }
      };
    };
    const resume = () => {
      if (!visible()) {
        clearTimeout(reconnect);
        request?.abort();
        socket?.close();
        socket = null;
        setStatus("En pause · onglet masqué");
      } else {
        lastFrame = 0;
        setStatus("Connexion…");
        void load().finally(connect);
      }
    };
    setStatus(visible() ? "Connexion…" : "En pause · onglet masqué");
    void load().finally(connect);
    const timer = setInterval(() => {
      if (visible() && (!initialized || Date.now() - lastFrame > 10_000)) {
        void load();
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      }
    }, 3_000);
    document.addEventListener("visibilitychange", resume);
    return () => {
      disposed = true;
      clearInterval(timer);
      clearTimeout(reconnect);
      document.removeEventListener("visibilitychange", resume);
      request?.abort();
      socket?.close();
    };
  }, [symbol, resolution, enabled]);
  const current =
    snapshot?.symbol === symbol && snapshot.resolution === resolution ? snapshot : null;
  return { snapshot: current, status, error, receivedAt: current ? receivedAt : null };
}
