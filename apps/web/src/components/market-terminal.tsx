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
  StepForward,
  Undo2,
  Redo2,
  Maximize,
  Minimize,
  Crosshair,
  Minus,
  Spline,
  Ruler,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Download,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { useLiveMarket } from "@/hooks/use-live-market";
import { LIVE_SYMBOLS, type LiveSymbol, type LiveSnapshot } from "@/lib/live-market";
import type { Resolution } from "@/lib/market-data";
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
import { tradePath } from "@/lib/trade-links";
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
const EMPTY: TerminalTrade["events"] = [];
const NO_LEVELS: TerminalTrade["levels"] = [];
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
  const router = useRouter();
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
  const [panel, setPanel] = useState(false),
    [notice, setNotice] = useState("");
  const [alertDialog, setAlertDialog] = useState(false),
    [alertPrice, setAlertPrice] = useState(""),
    [direction, setDirection] = useState<"above" | "below">("above"),
    [alerts, setAlerts] = useState<Alert[]>([]);
  const [replay, setReplay] = useState<LiveSnapshot | null>(null),
    [replayIndex, setReplayIndex] = useState(0),
    [playing, setPlaying] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState("");
  const [tradeHistory, setTradeHistory] = useState<LiveSnapshot | null>(null);
  const [tradeLoading, setTradeLoading] = useState(false);
  const showTrade = async () => {
    if (!selected || tradeLoading) return;
    setTradeLoading(true);
    try {
      const response = await fetch(`/api/trades/${encodeURIComponent(selected.key)}/chart`);
      const data = await response.json();
      if (!response.ok || !data.bars?.length)
        throw new Error(data.error ?? "Aucune bougie disponible");
      setPlaying(false);
      setReplay(null);
      setResolution(data.resolution);
      setTradeHistory({
        ...data,
        price: data.bars.at(-1).close,
        changePct: 0,
        marketTime: Date.now(),
      });
      setNotice("Période du trade affichée. Les rectangles partent de sa bougie d’entrée.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Historique indisponible");
    } finally {
      setTradeLoading(false);
    }
  };
  const chart = useRef<TerminalChart | null>(null),
    host = useRef<HTMLDivElement>(null);
  const { snapshot, status, error, receivedAt } = useLiveMarket(
    symbol,
    resolution,
    enabled && !replay && !tradeHistory,
  );
  const symbolTrades = trades.filter((t) => t.symbol === symbol);
  const selected =
    symbolTrades.find((t) => t.key === selectedTrade) ??
    symbolTrades.find((t) => t.status === "open") ??
    symbolTrades[0];
  const [positionOverview, setPositionOverview] = useState(true);
  useEffect(() => {
    if (!positionOverview || !symbolTrades[0]) {
      setTradeHistory(null);
      return;
    }
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
              ? saved.drawings[pair]
                  .filter(
                    (d: Drawing) =>
                      ["trend", "horizontal", "measure"].includes(d.kind) &&
                      Array.isArray(d.points) &&
                      d.points.length > 0 &&
                      d.points.length <= 2 &&
                      d.points.every(
                        (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite),
                      ),
                  )
                  .slice(-100)
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
    chart.current = null;
    setRedo([]);
    setReplay(null);
    setPlaying(false);
    setTool("cursor");
  }, [symbol, resolution]);
  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === host.current);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!document.fullscreenElement) setFullscreen(false);
        setTool("cursor");
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
      700,
    );
    return () => clearInterval(timer);
  }, [playing, replay]);
  useEffect(() => {
    if (!snapshot || !enabled || replay || snapshot.symbol !== symbol) return;
    setAlerts((previous) =>
      previous.map((a) =>
        a.symbol === symbol &&
        !a.triggered &&
        (a.direction === "above" ? snapshot.price >= a.price : snapshot.price <= a.price)
          ? { ...a, triggered: true }
          : a,
      ),
    );
  }, [snapshot, symbol, enabled, replay]);
  const history = useMemo(
    () =>
      tradeHistory && tradeHistory.symbol === symbol && tradeHistory.resolution === resolution
        ? tradeHistory
        : replay && replay.symbol === symbol && replay.resolution === resolution
          ? {
              ...replay,
              bars: replay.bars.slice(0, replayIndex),
              price: replay.bars[Math.max(0, replayIndex - 1)]?.close ?? replay.price,
            }
          : snapshot?.symbol === symbol && snapshot.resolution === resolution
            ? snapshot
            : null,
    [snapshot, replay, replayIndex, symbol, resolution, tradeHistory],
  );
  const triggered = alerts.filter((a) => a.triggered);
  const toggleFullscreen = async () => {
    if (fullscreen) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    } else {
      setFullscreen(true);
      try {
        await host.current?.requestFullscreen?.();
      } catch {}
    }
  };
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
      setReplay(null);
      setPlaying(false);
      return;
    }
    if (!snapshot) return;
    const frozen = { ...snapshot, bars: snapshot.bars.slice(0, -1) };
    setReplay(frozen);
    setReplayIndex(Math.max(15, frozen.bars.length - 60));
    setNotice("Replay sur les bougies chargées. Aucune opération envoyée au bot.");
  };
  const toolButton = (value: DrawingTool, label: string, Icon: typeof Crosshair) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={tool === value}
      className={`${s.button} ${tool === value ? s.active : ""}`}
      onClick={() => {
        setTool(value);
        setNotice(
          value === "cursor"
            ? ""
            : value === "horizontal"
              ? "Cliquez sur le graphique pour poser un niveau."
              : "Cliquez sur deux points du graphique.",
        );
      }}
    >
      <Icon size={19} />
    </button>
  );
  const chartHeight = panel
    ? "clamp(430px, calc(100dvh - 365px), 1200px)"
    : "clamp(470px, calc(100dvh - 190px), 1500px)";
  return (
    <div
      ref={host}
      className={s.terminal}
      style={fullscreen ? { position: "fixed", inset: 0, zIndex: 50, overflow: "auto" } : undefined}
    >
      <a href="#market-chart" className="sr-only focus:not-sr-only">
        Aller au graphique
      </a>
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
          onChange={(e) => setSymbol(e.target.value as LiveSymbol)}
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
          onChange={(e) => setResolution(e.target.value as Resolution)}
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
          <button className={s.button} aria-label="Fermer le message" onClick={() => setNotice("")}>
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
            onClick={() => setPlaying((v) => !v)}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            className={s.button}
            aria-label="Bougie suivante"
            onClick={() => setReplayIndex((i) => Math.min(replay.bars.length, i + 1))}
          >
            <StepForward size={16} />
          </button>
          <input
            aria-label="Position du replay"
            type="range"
            min={15}
            max={replay.bars.length}
            value={replayIndex}
            onChange={(e) => setReplayIndex(Number(e.target.value))}
          />
          <span>
            {replayIndex} / {replay.bars.length}
          </span>
          <button
            className={s.button}
            onClick={() => {
              setReplay(null);
              setPlaying(false);
              setNotice("");
            }}
          >
            Retour au direct
          </button>
        </div>
      )}
      <div className={s.workspace}>
        <aside className={s.tools} aria-label="Outils de dessin">
          {toolButton("cursor", "Suivre le cours · deux doigts pour mesurer", Crosshair)}
          {toolButton("trend", "Ligne de tendance", Spline)}
          {toolButton("horizontal", "Ligne horizontale", Minus)}
          {toolButton("measure", "Mesurer une variation", Ruler)}
          <span className={s.divider} />
          <button className={s.button} aria-label="Zoom avant" onClick={() => zoom(0.7)}>
            <ZoomIn size={19} />
          </button>
          <button className={s.button} aria-label="Zoom arrière" onClick={() => zoom(1.4)}>
            <ZoomOut size={19} />
          </button>
          <button
            className={s.button}
            aria-label="Recentrer le graphique"
            onClick={() => range(60)}
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
              {history ? priceNumber(history.price) : "—"} USDT
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
          {history ? (
            <Canvas
              key={`${symbol}:${resolution}:${tradeHistory?.fetchedAt ?? "live"}`}
              history={history}
              price={history.price}
              period={period}
              indicators={indicators}
              log={log}
              line={line}
              drawings={drawings[symbol] ?? []}
              tool={tool}
              events={symbolTrades.flatMap((trade) => trade.events)}
              levels={symbolTrades.flatMap((trade) => trade.levels)}
              timeZone={timeZone}
              height={chartHeight}
              fullPeriod={!!tradeHistory}
              onReady={(c) => {
                chart.current = c;
              }}
              onDraw={addDrawing}
              onMeasure={setNotice}
            />
          ) : (
            <p role="status" style={{ height: chartHeight, padding: 30 }}>
              Connexion au marché…
            </p>
          )}
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
            <span>
              <span className="text-loss">■</span> Stop loss
            </span>
            <span>
              <span className="text-profit">■</span> Take profit
            </span>
          </div>
          {tradeHistory && (
            <button
              className={s.button}
              onClick={() => {
                setPositionOverview(false);
                setTradeHistory(null);
              }}
            >
              Retour au cours en direct
            </button>
          )}
          <div className={s.range}>
            <button
              className={`${s.button} ${positionOverview ? s.active : ""}`}
              aria-pressed={positionOverview}
              onClick={() => setPositionOverview((value) => !value)}
            >
              Positions du bot
            </button>
            <button className={s.button} onClick={() => range(0)}>
              Toutes les bougies
            </button>
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
          <div className={s.tabs}>
            <button
              id="chart-trades-toggle"
              className={`${s.button} ${panel ? s.active : ""}`}
              aria-expanded={panel}
              aria-controls="chart-trades-panel"
              onClick={() => setPanel((value) => !value)}
            >
              Trade affiché <span aria-hidden="true">{panel ? "−" : "+"}</span>
            </button>
          </div>
          {panel && (
            <section
              id="chart-trades-panel"
              aria-labelledby="chart-trades-toggle"
              className={s.panel}
            >
              <div className={s.config}>
                <label className="min-w-0 flex-1 flex-wrap">
                  Sélectionner le trade
                  <select
                    aria-label="Trade affiché sur le graphique"
                    className="min-w-0 w-full max-w-full rounded border bg-background p-2"
                    value={selected?.key ?? ""}
                    onChange={(event) => setSelectedTrade(event.target.value)}
                  >
                    {symbolTrades.length ? (
                      symbolTrades.map((trade) => (
                        <option key={trade.key} value={trade.key}>
                          {trade.openedAt.replace("T", " ").slice(0, 16)} ·{" "}
                          {trade.status === "open" ? "Ouvert" : "Clôturé"}
                        </option>
                      ))
                    ) : (
                      <option>Aucun trade</option>
                    )}
                  </select>
                </label>
                <button
                  className={s.button}
                  disabled={tradeLoading || !selected}
                  onClick={showTrade}
                >
                  {tradeLoading ? "Chargement…" : "Voir la position sur le graphique"}
                </button>
                <button className={s.button} onClick={() => router.refresh()}>
                  Actualiser les trades
                </button>
              </div>
              {selected && (
                <>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className={s.muted}>Prix moyen d’entrée</dt>
                      <dd>{priceNumber(selected.avgEntry)} USDT</dd>
                    </div>
                    <div>
                      <dt className={s.muted}>Quantité restante</dt>
                      <dd>{number(selected.openQuantity, 6)}</dd>
                    </div>
                    <div>
                      <dt className={s.muted}>Résultat déjà réalisé</dt>
                      <dd className={selected.netPnl < 0 ? s.down : s.up}>
                        {number(selected.netPnl, 4)} USDT
                      </dd>
                    </div>
                  </dl>
                  <a className="mt-4 inline-block text-sm" href={tradePath(selected.key)}>
                    Détail des exécutions
                  </a>
                </>
              )}
              <p className={`${s.muted} mt-3`}>
                ▲ Entrées · ◆ Sorties · Un bloc SL/TP par achat, jusqu’à l’exécution suivante
                (repère visuel). Rectangles ancrés au cours Binance (bougie d’entrée réelle ;
                chargez la période du trade si elle est hors écran), calculés avec les paramètres
                actuels du bot. Les exécutions démo/testnet peuvent différer des prix Binance Spot.
              </p>
            </section>
          )}
        </section>
      </div>
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
              const price = Number(alertPrice);
              if (Number.isFinite(price) && price > 0) {
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
            <label className="block text-sm">
              Déclenchement
              <select
                className="mt-1 block w-full rounded border bg-background p-2"
                value={direction}
                onChange={(e) => setDirection(e.target.value as typeof direction)}
              >
                <option value="above">Prix supérieur ou égal</option>
                <option value="below">Prix inférieur ou égal</option>
              </select>
            </label>
            <label className="block text-sm">
              Prix USDT
              <input
                required
                aria-label="Prix de l’alerte"
                className="mt-1 block w-full rounded border bg-background p-2"
                type="number"
                min="0.0000000001"
                step="any"
                value={alertPrice}
                onChange={(e) => setAlertPrice(e.target.value)}
              />
            </label>
            <button type="submit" className="rounded bg-brand px-4 py-2 text-sm text-white">
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
