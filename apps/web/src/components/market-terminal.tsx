"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickChart,
  ChartLine,
  ChartNoAxesCombined,
  BellPlus,
  Rewind,
  Play,
  Pause,
  StepBack,
  StepForward,
  Undo2,
  Redo2,
  Maximize,
  Minimize,
  Crosshair,
  Minus,
  Spline,
  PencilRuler,
  ArrowUpRight,
  MoveVertical,
  Square,
  Ruler,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Download,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { useLiveMarket } from "@/hooks/use-live-market";
import { LIVE_SYMBOLS, type LiveSymbol, type LiveSnapshot } from "@/lib/live-market";
import { RESOLUTIONS, type Resolution } from "@/lib/market-data";
import { number, priceNumber } from "@/lib/journal-format";
import {
  INDICATOR_CATALOG,
  NO_INDICATORS,
  type IndicatorSelection,
  type Drawing,
  type DrawingTool,
} from "@/lib/terminal-indicators";
import type { TerminalTrade } from "@/lib/terminal-types";
import type { TerminalChart } from "./terminal-canvas";
import { isDrawing, percentAlertPrice, replayStart } from "@/lib/terminal-tools";
import { MarketTradeHistory } from "./market-trade-history";
import s from "./market-terminal.module.css";
const Canvas = dynamic(() => import("./terminal-canvas").then((m) => m.TerminalCanvas), {
  ssr: false,
  loading: () => <p className="p-8">Préparation du graphique…</p>,
});
type Alert = {
  id: string;
  symbol: LiveSymbol;
  price: number;
  direction: "above" | "below";
  triggered: boolean;
};
export function MarketTerminal({
  initialSymbol,
  initialResolution,
  trades,
  timeZone,
}: {
  initialSymbol: LiveSymbol;
  initialResolution: Resolution;
  trades: TerminalTrade[];
  timeZone: string;
}) {
  const [symbol, setSymbol] = useState(initialSymbol),
    [resolution, setResolution] = useState(initialResolution);
  const [enabled, setEnabled] = useState(true),
    [line, setLine] = useState(false),
    [log, setLog] = useState(false);
  const [indicators, setIndicators] = useState<IndicatorSelection>({ ...NO_INDICATORS });
  const [indicatorDialog, setIndicatorDialog] = useState(false);
  const [indicatorSearch, setIndicatorSearch] = useState("");
  const [exportDialog, setExportDialog] = useState(false);
  const [period, setPeriod] = useState(9),
    [tool, setTool] = useState<DrawingTool>("cursor");
  const [drawings, setDrawings] = useState<Record<string, Drawing[]>>({}),
    [redo, setRedo] = useState<Drawing[]>([]);
  const [loaded, setLoaded] = useState(false),
    [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState("");
  const [drawingMenu, setDrawingMenu] = useState(false);
  const historyRequest = useRef<AbortController | null>(null);
  const [alertDialog, setAlertDialog] = useState(false),
    [alertPrice, setAlertPrice] = useState(""),
    [alertMode, setAlertMode] = useState<"price" | "percent">("percent"),
    [alertPercent, setAlertPercent] = useState("2"),
    [alertReference, setAlertReference] = useState<number | null>(null),
    [direction, setDirection] = useState<"above" | "below">("above"),
    [alerts, setAlerts] = useState<Alert[]>([]);
  const [replay, setReplay] = useState<LiveSnapshot | null>(null),
    [replayIndex, setReplayIndex] = useState(0),
    [playing, setPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [tradeHistory, setTradeHistory] = useState<LiveSnapshot | null>(null);
  const [tradeLoading, setTradeLoading] = useState(false);
  const showTrade = async (trade: TerminalTrade) => {
    historyRequest.current?.abort();
    const controller = new AbortController();
    historyRequest.current = controller;
    setSymbol(trade.symbol as LiveSymbol);
    setPositionOverview(false);
    setPlaying(false);
    setReplay(null);
    setTradeHistory(null);
    setTradeLoading(true);
    try {
      const response = await fetch(`/api/trades/${encodeURIComponent(trade.key)}/chart`, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      });
      const data = await response.json();
      if (!response.ok || !data.bars?.length)
        throw new Error(data.error ?? "Aucune bougie disponible");
      if (controller.signal.aborted) return;
      setResolution(data.resolution);
      setTradeHistory({
        ...data,
        price: data.bars.at(-1).close,
        changePct: 0,
        marketTime: Date.now(),
      });
      setNotice("Période du trade affichée. Les rectangles partent de sa bougie d’entrée.");
    } catch (error) {
      if (!controller.signal.aborted)
        setNotice(error instanceof Error ? error.message : "Historique indisponible");
    } finally {
      if (historyRequest.current === controller) {
        historyRequest.current = null;
        setTradeLoading(false);
      }
    }
  };
  const chart = useRef<TerminalChart | null>(null),
    host = useRef<HTMLDivElement>(null);
  const { snapshot, status, error, receivedAt } = useLiveMarket(symbol, resolution, enabled);
  const symbolTrades = trades.filter((t) => t.symbol === symbol);
  const [positionOverview, setPositionOverview] = useState(false);
  useEffect(() => {
    if (!positionOverview || !symbolTrades[0]) return;
    const controller = new AbortController();
    setTradeLoading(true);
    void fetch(`/api/trades/${encodeURIComponent(symbolTrades[0].key)}/chart?scope=symbol`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.bars?.length)
          throw new Error(data.error ?? "Historique indisponible");
        if (!controller.signal.aborted) {
          setResolution(data.resolution);
          setTradeHistory({
            ...data,
            price: data.bars.at(-1).close,
            changePct: 0,
            marketTime: Date.now(),
          });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setNotice(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setTradeLoading(false);
      });
    return () => controller.abort();
  }, [symbol, positionOverview, trades]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("market-terminal-v1") ?? "null");
      if (saved) {
        if (saved.drawings && typeof saved.drawings === "object") {
          const valid: Record<string, Drawing[]> = {};
          for (const pair of LIVE_SYMBOLS)
            valid[pair] = Array.isArray(saved.drawings[pair])
              ? saved.drawings[pair].filter(isDrawing).slice(-100)
              : [];
          setDrawings(valid);
        }
        if (Number.isInteger(saved.period) && saved.period >= 3 && saved.period <= 100)
          setPeriod(saved.period);
        if (saved.indicators)
          setIndicators({
            ...NO_INDICATORS,
            rsi: !!saved.indicators.rsi,
            ema: !!saved.indicators.ema,
            sma: !!saved.indicators.sma,
            macd: !!saved.indicators.macd,
            bollinger: !!saved.indicators.bollinger,
            wma: !!saved.indicators.wma,
            mfi: !!saved.indicators.mfi,
            aroon: !!saved.indicators.aroon,
            volume: !!saved.indicators.volume,
          });
      }
    } catch {
      /* Use defaults if device preferences are unavailable. */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) {
      try {
        localStorage.setItem(
          "market-terminal-v1",
          JSON.stringify({ drawings, period, indicators }),
        );
      } catch {}
    }
  }, [drawings, period, indicators, loaded]);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("resolution", resolution);
    window.history.replaceState(window.history.state, "", url);
    setRedo([]);
    setTool("cursor");
  }, [symbol, resolution]);
  useEffect(() => {
    const changed = () =>
      setFullscreen(document.fullscreenElement === host.current?.closest("main"));
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!document.fullscreenElement) setFullscreen(false);
        setTool("cursor");
        setDrawingMenu(false);
        setNotice("");
      }
    };
    document.addEventListener("fullscreenchange", changed);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("fullscreenchange", changed);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  useEffect(() => {
    if (!playing || !replay) return;
    const timer = setInterval(
      () =>
        setReplayIndex((i) => {
          if (i >= replay.bars.length) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        }),
      700 / replaySpeed,
    );
    return () => clearInterval(timer);
  }, [playing, replay, replaySpeed]);
  useEffect(() => {
    if (!snapshot || !enabled || snapshot.symbol !== symbol) return;
    setAlerts((previous) =>
      previous.map((a) =>
        a.symbol === symbol &&
        !a.triggered &&
        (a.direction === "above" ? snapshot.price >= a.price : snapshot.price <= a.price)
          ? { ...a, triggered: true }
          : a,
      ),
    );
  }, [snapshot, symbol, enabled]);
  const history = useMemo(
    () =>
      replay && replay.symbol === symbol && replay.resolution === resolution
        ? {
            ...replay,
            bars: replay.bars.slice(0, replayIndex),
            price: replay.bars[Math.max(0, replayIndex - 1)]?.close ?? replay.price,
          }
        : tradeHistory && tradeHistory.symbol === symbol && tradeHistory.resolution === resolution
          ? tradeHistory
          : snapshot,
    [snapshot, replay, replayIndex, symbol, resolution, tradeHistory],
  );
  const triggered = alerts.filter((a) => a.triggered);
  const toggleFullscreen = async () => {
    if (fullscreen) {
      setFullscreen(false);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    } else {
      setFullscreen(true);
      const frame = host.current?.closest("main");
      // The application expands immediately; native fullscreen is optional on mobile browsers.
      void frame?.requestFullscreen?.().catch(() => {});
    }
  };
  const returnToLive = () => {
    historyRequest.current?.abort();
    setEnabled(true);
    setPositionOverview(false);
    setTradeHistory(null);
    setTradeLoading(false);
    setReplay(null);
    setPlaying(false);
    setNotice("");
  };
  const changeResolution = (value: Resolution) => {
    returnToLive();
    setResolution(value);
  };
  const changeSymbol = (value: LiveSymbol) => {
    returnToLive();
    setSymbol(value);
  };
  useEffect(() => () => historyRequest.current?.abort(), []);
  const getChart = () => (chart.current && !chart.current.isDisposed() ? chart.current : null);
  const zoom = (delta: number) => {
    const c = getChart();
    if (!c) return;
    const z = (c.getOption().dataZoom as { start: number; end: number }[])[0];
    if (!z) return;
    const center = (z.start + z.end) / 2,
      span = Math.max(3, Math.min(100, (z.end - z.start) * delta));
    c.dispatchAction({
      type: "dataZoom",
      start: Math.max(0, center - span / 2),
      end: Math.min(100, center + span / 2),
    });
  };
  const range = (start: number) =>
    getChart()?.dispatchAction({ type: "dataZoom", start, end: 100 });
  const resetZoom = () => {
    const c = getChart();
    const total = history?.bars.length ?? 0;
    if (!c || total <= 1) return;
    const visible = Math.min(96, total);
    const startIndex = Math.max(0, total - visible);
    c.dispatchAction({
      type: "dataZoom",
      start: (startIndex / (total - 1)) * 100,
      end: 100,
    });
  };
  const addDrawing = (drawing: Drawing) => {
    setDrawings((d) => ({ ...d, [symbol]: [...(d[symbol] ?? []), drawing].slice(-100) }));
    setRedo([]);
  };
  const undo = () => {
    const last = drawings[symbol]?.at(-1);
    if (last) {
      setRedo((r) => [...r, last]);
      setDrawings((d) => ({ ...d, [symbol]: (d[symbol] ?? []).slice(0, -1) }));
    }
  };
  const redoDrawing = () => {
    const last = redo.at(-1);
    if (last) {
      setDrawings((d) => ({ ...d, [symbol]: [...(d[symbol] ?? []), last] }));
      setRedo((r) => r.slice(0, -1));
    }
  };
  const screenshot = () => {
    const c = getChart();
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#06080b" });
    a.download = `${symbol}-${resolution}.png`;
    a.click();
  };
  const exportBars = () => {
    if (!history) return;
    const blob = new Blob(
      [
        "time,open,high,low,close,volume\n" +
          history.bars
            .map((b) =>
              [new Date(b.time).toISOString(), b.open, b.high, b.low, b.close, b.volume].join(","),
            )
            .join("\n"),
      ],
      { type: "text/csv" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `${symbol}-${resolution}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const startReplay = () => {
    if (replay) {
      returnToLive();
      return;
    }
    if (!history || history.bars.length < 2) {
      setNotice("Attends le chargement des bougies.");
      return;
    }
    const bars = tradeHistory ? history.bars : history.bars.slice(0, -1);
    if (bars.length < 2) return;
    const frozen = { ...history, bars: [...bars] };
    setPositionOverview(false);
    setTradeHistory(null);
    setPlaying(false);
    setReplay(frozen);
    setReplayIndex(replayStart(bars.length));
    setNotice("");
    setTool("cursor");
  };
  const chooseTool = (value: DrawingTool) => {
    setTool(value);
    setDrawingMenu(false);
    setNotice(
      value === "cursor"
        ? ""
        : value === "measure"
          ? "Choisis deux bougies · ou utilise deux doigts."
          : value === "horizontal" || value === "vertical"
            ? "Un point sur le graphique."
            : "Deux points sur le graphique.",
    );
  };
  const drawingOptions = [
    { value: "trend", label: "Ligne de tendance", Icon: ChartLine },
    { value: "horizontal", label: "Ligne horizontale", Icon: Minus },
    { value: "vertical", label: "Ligne verticale", Icon: MoveVertical },
    { value: "ray", label: "Demi-droite", Icon: ArrowUpRight },
    { value: "arc", label: "Arc", Icon: Spline },
    { value: "rectangle", label: "Rectangle", Icon: Square },
  ] as const;
  return (
    <div ref={host} className={s.terminal} data-expanded={fullscreen}>
      <a href="#market-chart" className="sr-only focus:not-sr-only">
        Aller au graphique
      </a>
      <div className={s.screen}>
        <div className={s.top}>
          <span className={s.brand}>
            TJ <span className={s.muted}>/</span> Terminal
          </span>
          <span className={s.muted}>
            {symbol.replace("USDT", "")} · {resolution}
          </span>
          <span className={s.badge}>Binance Spot · Bots démo / testnet</span>
        </div>
        <header className={s.toolbar}>
          <select
            aria-label="Crypto en direct"
            value={symbol}
            onChange={(e) => changeSymbol(e.target.value as LiveSymbol)}
          >
            {LIVE_SYMBOLS.map((v) => (
              <option key={v} value={v}>
                {v.replace("USDT", " / USDT")}
              </option>
            ))}
          </select>
          <span className={s.divider} />
          <select
            aria-label="Unité de temps en direct"
            value={resolution}
            onChange={(e) => changeResolution(e.target.value as Resolution)}
          >
            {(["1m", "5m", "15m", "1h", "1d"] as const).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <button
            className={s.button}
            aria-label={line ? "Afficher les bougies" : "Afficher la courbe"}
            aria-pressed={line}
            onClick={() => setLine((v) => !v)}
          >
            {line ? <ChartLine size={18} /> : <CandlestickChart size={18} />}
          </button>
          <span className={s.divider} />
          <button
            aria-label="Ajouter des indicateurs"
            title="Ajouter des indicateurs"
            className={`${s.button} ${indicatorDialog ? s.active : ""}`}
            onClick={() => setIndicatorDialog(true)}
          >
            <ChartNoAxesCombined size={18} />
            <span className={s.label}>Indicateurs</span>
          </button>
          <button
            className={s.button}
            aria-label="Créer une alerte de prix"
            onClick={() => {
              setAlertReference(snapshot?.price ?? null);
              setAlertPrice(snapshot ? String(snapshot.price) : "");
              setAlertDialog(true);
            }}
          >
            <BellPlus size={18} />
            <span className={s.label}>Alerte</span>
          </button>
          <button
            className={`${s.button} ${replay ? s.active : ""}`}
            aria-label="Replay des bougies"
            aria-pressed={!!replay}
            onClick={startReplay}
            disabled={!replay && (!history || history.bars.length < 2)}
          >
            <Rewind size={18} />
            <span className={s.label}>Replay</span>
          </button>
          <span className={s.divider} />
          <button
            className={s.button}
            aria-label="Annuler le dernier tracé"
            onClick={undo}
            disabled={!drawings[symbol]?.length}
          >
            <Undo2 size={17} />
          </button>
          <button
            className={s.button}
            aria-label="Rétablir le tracé"
            onClick={redoDrawing}
            disabled={!redo.length}
          >
            <Redo2 size={17} />
          </button>
          <span className={s.spacer} />
          <button
            className={s.button}
            aria-label={fullscreen ? "Quitter le plein écran" : "Plein écran"}
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <button
            className={s.button}
            aria-label="Exporter le graphique"
            title="Exporter"
            onClick={() => setExportDialog(true)}
          >
            <Download size={18} />
          </button>
        </header>
        {triggered.length > 0 && (
          <div role="alert" className={s.notice}>
            {triggered.map((a) => (
              <span key={a.id}>
                Alerte {a.symbol} : {a.direction === "above" ? "au-dessus de" : "en dessous de"}{" "}
                {priceNumber(a.price)} USDT{" "}
                <button
                  className={s.button}
                  aria-label="Fermer l’alerte déclenchée"
                  onClick={() => setAlerts((v) => v.filter((x) => x.id !== a.id))}
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
        {notice && (
          <div role="status" className={s.notice}>
            {notice}
            <button
              className={s.button}
              aria-label="Fermer le message"
              onClick={() => setNotice("")}
            >
              <X size={13} />
            </button>
          </div>
        )}
        {error && (
          <div role="alert" className={s.notice}>
            {error}
          </div>
        )}
        {replay && (
          <div className={s.replay}>
            <strong>REPLAY</strong>
            <button
              className={s.button}
              aria-label={playing ? "Suspendre le replay" : "Lire le replay"}
              onClick={() => {
                if (!playing && replayIndex >= replay.bars.length)
                  setReplayIndex(replayStart(replay.bars.length));
                setPlaying((v) => !v);
              }}
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              className={s.button}
              aria-label="Bougie précédente"
              disabled={replayIndex <= 2}
              onClick={() => {
                setPlaying(false);
                setReplayIndex((i) => Math.max(2, i - 1));
              }}
            >
              <StepBack size={16} />
            </button>
            <button
              className={s.button}
              aria-label="Bougie suivante"
              disabled={replayIndex >= replay.bars.length}
              onClick={() => {
                setPlaying(false);
                setReplayIndex((i) => Math.min(replay.bars.length, i + 1));
              }}
            >
              <StepForward size={16} />
            </button>
            <input
              aria-label="Position du replay"
              type="range"
              min={1}
              max={replay.bars.length}
              value={replayIndex}
              onChange={(e) => {
                setPlaying(false);
                setReplayIndex(Number(e.target.value));
              }}
            />
            <span data-replay-progress>
              {replayIndex} / {replay.bars.length}
            </span>
            <select
              aria-label="Vitesse du replay"
              value={replaySpeed}
              onChange={(e) => setReplaySpeed(Number(e.target.value))}
            >
              {[0.5, 1, 2, 4].map((v) => (
                <option key={v} value={v}>
                  {v}×
                </option>
              ))}
            </select>
            <button className={s.button} onClick={returnToLive}>
              Retour au direct
            </button>
          </div>
        )}
        <div className={s.workspace}>
          <aside className={s.tools} aria-label="Outils de dessin">
            <button
              className={`${s.button} ${tool === "cursor" ? s.active : ""}`}
              aria-label="Suivre le cours"
              aria-pressed={tool === "cursor"}
              onClick={() => chooseTool("cursor")}
            >
              <Crosshair size={19} />
            </button>
            <div
              className={s.drawingMenu}
              onMouseEnter={() => setDrawingMenu(true)}
              onMouseLeave={() => setDrawingMenu(false)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setDrawingMenu(false);
              }}
            >
              <button
                className={`${s.button} ${!["cursor", "measure"].includes(tool) ? s.active : ""}`}
                aria-label="Outils de dessin"
                aria-expanded={drawingMenu}
                aria-controls="market-drawing-menu"
                aria-haspopup="menu"
                onClick={() => setDrawingMenu(true)}
              >
                <PencilRuler size={19} />
              </button>
              {drawingMenu && (
                <div
                  id="market-drawing-menu"
                  className={s.drawingPopover}
                  role="menu"
                  aria-label="Dessiner sur le graphique"
                >
                  {drawingOptions.map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      role="menuitem"
                      className={`${s.button} ${tool === value ? s.active : ""}`}
                      onClick={() => chooseTool(value)}
                    >
                      <Icon size={17} />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className={`${s.button} ${tool === "measure" ? s.active : ""}`}
              aria-label="Comparer les cours en pourcentage"
              aria-pressed={tool === "measure"}
              onClick={() => chooseTool(tool === "measure" ? "cursor" : "measure")}
            >
              <Ruler size={19} />
            </button>
            <span className={s.divider} />
            <button className={s.button} aria-label="Zoom avant" onClick={() => zoom(0.7)}>
              <ZoomIn size={19} />
            </button>
            <button className={s.button} aria-label="Zoom arrière" onClick={() => zoom(1.4)}>
              <ZoomOut size={19} />
            </button>
            <button
              className={s.button}
              aria-label="Réinitialiser le zoom"
              title="Réinitialiser le zoom"
              onClick={resetZoom}
            >
              <RotateCcw size={18} />
            </button>
            <span className={s.spacer} />
            <button
              className={s.button}
              aria-label="Effacer les tracés"
              onClick={() => {
                setDrawings((d) => ({ ...d, [symbol]: [] }));
                setRedo([]);
                setNotice("Tracés effacés pour cette crypto.");
              }}
            >
              <Trash2 size={18} />
            </button>
          </aside>
          <section
            id="market-chart"
            className={s.surface}
            aria-label="Grand graphique des cryptomonnaies"
          >
            <div className={s.quote}>
              <span className={s.price} data-live-price>
                {history
                  ? priceNumber(history.price).replace(/([,.]\d*?[1-9])0+$|[,.]0+$/, "$1")
                  : "—"}{" "}
                USDT
              </span>
              <span className={history && history.changePct < 0 ? s.down : s.up}>
                {history && !replay && !tradeHistory
                  ? `${history.changePct >= 0 ? "+" : ""}${number(history.changePct, 2)} %`
                  : "Cours historique"}
              </span>
              <span className={s.muted}>
                {INDICATOR_CATALOG.filter((item) => indicators[item.key])
                  .map((item) => (item.key === "wma" ? `WMA ${period}` : item.name))
                  .join(" · ")}
              </span>
              <span className={s.spacer} />
              <span className={s.muted} data-live-status>
                {tradeHistory
                  ? positionOverview
                    ? "Toutes les positions"
                    : "Historique du trade"
                  : replay
                    ? "Replay"
                    : status}
              </span>
            </div>
            <div className={s.chartViewport}>
              {history ? (
                <Canvas
                  key={`${symbol}:${resolution}:${replay ? "replay" : (tradeHistory?.fetchedAt ?? "live")}`}
                  history={history}
                  price={history.price}
                  period={period}
                  indicators={indicators}
                  log={log}
                  line={line}
                  drawings={drawings[symbol] ?? []}
                  tool={tool}
                  events={symbolTrades
                    .flatMap((trade) => trade.events)
                    .filter(
                      (event) =>
                        !replay ||
                        event.time < (history.bars.at(-1)?.time ?? 0) + RESOLUTIONS[resolution],
                    )}
                  levels={symbolTrades
                    .flatMap((trade) => trade.levels)
                    .filter(
                      (level) =>
                        !replay ||
                        level.time < (history.bars.at(-1)?.time ?? 0) + RESOLUTIONS[resolution],
                    )}
                  alerts={alerts.filter((a) => a.symbol === symbol && !a.triggered)}
                  timeZone={timeZone}
                  height="100%"
                  fullPeriod={!!tradeHistory}
                  replayMode={!!replay}
                  onReady={(c) => {
                    chart.current = c;
                  }}
                  onDraw={addDrawing}
                  onMeasure={setNotice}
                />
              ) : (
                <p role="status" style={{ height: "100%", padding: 30 }}>
                  Connexion au marché…
                </p>
              )}
            </div>
            <div
              className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-2 text-[11px] text-muted-foreground"
              aria-label="Légende du graphique"
            >
              <span>
                <span className="text-sky-400">▲</span> Entrée
              </span>
              <span>
                <span className="text-amber-400">◆</span> Sortie
              </span>
              <span title="Stop loss de référence · paramètres actuels du bot">
                <span className="text-loss">■</span> SL
              </span>
              <span title="Take profit de référence · paramètres actuels du bot">
                <span className="text-profit">■</span> TP
              </span>
              <span>Références</span>
            </div>
            <div className={s.range}>
              <button
                className={`${s.button} ${positionOverview ? s.active : ""}`}
                aria-label="Afficher les positions du bot"
                aria-pressed={positionOverview}
                disabled={!symbolTrades.length || tradeLoading}
                onClick={() => {
                  if (positionOverview || tradeHistory) returnToLive();
                  else {
                    setReplay(null);
                    setPlaying(false);
                    setPositionOverview(true);
                  }
                }}
              >
                Positions
              </button>
              {tradeHistory && !replay && (
                <button
                  className={s.button}
                  aria-label="Retour au cours en direct"
                  onClick={returnToLive}
                >
                  Direct
                </button>
              )}
              <button
                className={s.button}
                aria-label="Afficher toutes les bougies"
                onClick={() => range(0)}
              >
                Tout
              </button>
              <a className={s.button} href="#market-trade-history">
                Trades · {symbolTrades.length}
              </a>
              <button
                className={s.button}
                aria-label={enabled ? "Mettre en pause" : "Reprendre le direct"}
                onClick={() => setEnabled((v) => !v)}
              >
                {enabled ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <span className={s.spacer} />
              <span className={s.muted} data-live-updated>
                {receivedAt ? new Date(receivedAt).toISOString().slice(11, 19) : "—"} UTC
              </span>
              <button
                className={`${s.button} ${log ? s.active : ""}`}
                aria-pressed={log}
                onClick={() => setLog((v) => !v)}
              >
                log
              </button>
            </div>
          </section>
        </div>
      </div>
      <MarketTradeHistory
        trades={trades}
        symbol={symbol}
        timeZone={timeZone}
        container={host.current}
        onShowTrade={(trade) => {
          void showTrade(trade);
          host.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />
      <Dialog open={indicatorDialog} onOpenChange={setIndicatorDialog}>
        <DialogContent container={host.current}>
          <DialogHeader>
            <DialogTitle>Indicateurs</DialogTitle>
            <DialogDescription>
              Ajoutez une moyenne sur le prix ou un oscillateur dans son propre panneau.
            </DialogDescription>
          </DialogHeader>
          <input
            aria-label="Rechercher un indicateur"
            placeholder="Rechercher : RSI, EMA, MACD…"
            value={indicatorSearch}
            onChange={(e) => setIndicatorSearch(e.target.value)}
            className="rounded border bg-background px-3 py-2 text-sm"
          />
          <div className="max-h-[48dvh] overflow-y-auto space-y-2">
            {INDICATOR_CATALOG.filter((item) =>
              `${item.name} ${item.description}`
                .toLowerCase()
                .includes(indicatorSearch.toLowerCase()),
            ).map((item) => (
              <label
                key={item.key}
                className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 hover:bg-secondary"
              >
                <input
                  type="checkbox"
                  checked={indicators[item.key]}
                  onChange={(e) =>
                    setIndicators((value) => ({ ...value, [item.key]: e.target.checked }))
                  }
                />
                <span className="flex-1">
                  <span className="block text-sm font-medium">{item.name}</span>
                  <span className="block text-xs text-muted-foreground">{item.description}</span>
                </span>
                <span className="text-xs text-muted-foreground">{item.group}</span>
              </label>
            ))}
          </div>
          {indicators.wma && (
            <label className="flex items-center gap-3 text-sm">
              Période WMA
              <input
                aria-label="Période WMA"
                type="number"
                min={3}
                max={100}
                value={period}
                className="w-20 rounded border bg-background px-2 py-1"
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isInteger(value) && value >= 3 && value <= 100) setPeriod(value);
                }}
              />
            </label>
          )}
          <div className="flex items-center justify-between gap-3">
            <button
              className="rounded border px-3 py-2 text-sm"
              onClick={() => setIndicators({ ...NO_INDICATORS })}
            >
              Retirer tous les indicateurs
            </button>
            <button
              className="rounded bg-brand px-4 py-2 text-sm text-white"
              onClick={() => setIndicatorDialog(false)}
            >
              Terminé
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={exportDialog} onOpenChange={setExportDialog}>
        <DialogContent container={host.current}>
          <DialogHeader>
            <DialogTitle>Exporter le graphique</DialogTitle>
            <DialogDescription>
              Choisissez une image du graphique ou les données des bougies affichées.
            </DialogDescription>
          </DialogHeader>
          <button
            className="rounded border p-3 text-left text-sm hover:bg-secondary"
            onClick={() => {
              screenshot();
              setExportDialog(false);
            }}
          >
            Image PNG
          </button>
          <button
            className="rounded border p-3 text-left text-sm hover:bg-secondary"
            onClick={() => {
              exportBars();
              setExportDialog(false);
            }}
          >
            Bougies CSV
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={alertDialog} onOpenChange={setAlertDialog}>
        <DialogContent container={host.current}>
          <DialogHeader>
            <DialogTitle>Alerte de prix · {symbol.replace("USDT", " / USDT")}</DialogTitle>
            <DialogDescription>
              Les alertes fonctionnent sur la crypto sélectionnée tant que cet onglet reste ouvert,
              en direct. Elles sont conservées pendant cette session.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const price =
                alertMode === "percent"
                  ? percentAlertPrice(alertReference ?? 0, Number(alertPercent), direction)
                  : Number(alertPrice);
              if (price != null && Number.isFinite(price) && price > 0) {
                setAlerts((a) => [
                  ...a,
                  { id: crypto.randomUUID(), symbol, price, direction, triggered: false },
                ]);
                setAlertDialog(false);
                setNotice(
                  `Alerte créée : ${symbol} ${direction === "above" ? "≥" : "≤"} ${priceNumber(price)} USDT.`,
                );
              }
            }}
          >
            <div className="flex gap-2" aria-label="Type d’alerte">
              {(["percent", "price"] as const).map((mode) => (
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm ${alertMode === mode ? "border-brand text-brand" : "text-muted-foreground"}`}
                  aria-pressed={alertMode === mode}
                  key={mode}
                  onClick={() => setAlertMode(mode)}
                >
                  {mode === "percent" ? "Variation %" : "Prix USDT"}
                </button>
              ))}
            </div>
            {alertMode === "percent" && (
              <p className="text-xs text-muted-foreground">
                Cours de référence :{" "}
                {alertReference == null ? "Indisponible" : `${priceNumber(alertReference)} USDT`}
              </p>
            )}
            <label className="block text-sm">
              Déclenchement
              <select
                className="mt-1 block w-full rounded border bg-background p-2"
                value={direction}
                onChange={(e) => setDirection(e.target.value as typeof direction)}
              >
                <option value="above">
                  {alertMode === "percent" ? "Hausse" : "Prix supérieur ou égal"}
                </option>
                <option value="below">
                  {alertMode === "percent" ? "Baisse" : "Prix inférieur ou égal"}
                </option>
              </select>
            </label>
            <label className="block text-sm">
              {alertMode === "percent" ? "Variation (%)" : "Prix USDT"}
              <input
                required
                aria-label={
                  alertMode === "percent" ? "Pourcentage de l’alerte" : "Prix de l’alerte"
                }
                className="mt-1 block w-full rounded border bg-background p-2"
                type="number"
                min="0.0000000001"
                max={
                  alertMode === "percent" ? (direction === "below" ? 99.999999 : 1000) : undefined
                }
                step="any"
                value={alertMode === "percent" ? alertPercent : alertPrice}
                onChange={(e) =>
                  alertMode === "percent"
                    ? setAlertPercent(e.target.value)
                    : setAlertPrice(e.target.value)
                }
              />
            </label>
            {alertMode === "percent" && (
              <p className="text-sm" data-alert-target>
                {(() => {
                  const target = percentAlertPrice(
                    alertReference ?? 0,
                    Number(alertPercent),
                    direction,
                  );
                  return target == null
                    ? "Variation invalide"
                    : `Seuil : ${priceNumber(target)} USDT`;
                })()}
              </p>
            )}
            <button
              type="submit"
              disabled={
                alertMode === "percent" &&
                percentAlertPrice(alertReference ?? 0, Number(alertPercent), direction) == null
              }
              className="rounded bg-brand px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              Créer l’alerte
            </button>
          </form>
          {alerts.length > 0 && (
            <ul className="space-y-2 text-sm">
              {alerts.map((a) => (
                <li key={a.id}>
                  {a.symbol} {a.direction === "above" ? "≥" : "≤"} {priceNumber(a.price)} ·{" "}
                  {a.triggered ? "Déclenchée" : "Active"}{" "}
                  <button
                    aria-label="Supprimer l’alerte"
                    className="ml-2 text-loss"
                    onClick={() => setAlerts((v) => v.filter((x) => x.id !== a.id))}
                  >
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
