"use client";

import { useState, type FormEvent } from "react";
import { ArrowDownToLine, Bot, ChevronDown } from "lucide-react";
import type {
  BotAssistantBot,
  BotAssistantState,
  BotRiskParameters,
} from "@/lib/bot-assistant-contract";
import { number, timestamp } from "@/lib/journal-format";
import { useApi } from "@/lib/use-api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { TooltipProvider } from "./ui/tooltip";
import styles from "./bot-studio.module.css";

const pct = (value: number) => `${number(value, 2)} %`;

function RiskDiagram({ risk, title }: { risk: BotRiskParameters | null; title: string }) {
  const total = risk ? risk.stopLossPct + risk.takeProfitPct : 0;
  const lossWidth = total ? (risk!.stopLossPct / total) * 480 : 0;
  const entry = 12 + lossWidth;
  return (
    <section className={styles.card} aria-label={title}>
      <h2>{title}</h2>
      {risk ? (
        <>
          <div className={styles.levels}>
            <div>
              <span className="text-loss">SL</span>
              <strong>{pct(risk.stopLossPct)}</strong>
            </div>
            <div>
              <span className="text-profit">TP</span>
              <strong>{pct(risk.takeProfitPct)}</strong>
            </div>
          </div>
          <svg
            viewBox="0 0 504 112"
            className={styles.riskDiagram}
            role="img"
            aria-label={`Distance du stop loss ${pct(risk.stopLossPct)} et du take profit ${pct(risk.takeProfitPct)} autour de l’entrée`}
          >
            <rect
              x="12"
              y="22"
              width={lossWidth}
              height="56"
              rx="2"
              fill="var(--loss)"
              opacity="0.2"
            />
            <rect
              x={entry}
              y="22"
              width={480 - lossWidth}
              height="56"
              rx="2"
              fill="var(--profit)"
              opacity="0.2"
            />
            <line x1="12" x2={entry} y1="50" y2="50" stroke="var(--loss)" strokeWidth="3" />
            <line x1={entry} x2="492" y1="50" y2="50" stroke="var(--profit)" strokeWidth="3" />
            <line
              x1={entry}
              x2={entry}
              y1="12"
              y2="87"
              stroke="var(--foreground)"
              strokeWidth="1.5"
            />
            <circle cx={entry} cy="50" r="5" fill="var(--foreground)" />
            <text
              x={Math.max(40, Math.min(464, entry))}
              y="105"
              textAnchor="middle"
              fill="var(--muted-foreground)"
              fontSize="13"
            >
              Entrée
            </text>
          </svg>
          <div className={styles.riskStats}>
            <span>
              Ratio <strong>{number(risk.takeProfitPct / risk.stopLossPct)}×</strong>
            </span>
            <span>
              Seuil <strong>{pct((risk.stopLossPct / total) * 100)}</strong>
            </span>
          </div>
          <p className={styles.note}>Théorique · hors frais et glissement</p>
        </>
      ) : (
        <p className={styles.empty}>Réglages indisponibles</p>
      )}
    </section>
  );
}

function Outcomes({ bot }: { bot: BotAssistantBot }) {
  const { summary } = bot;
  const outcomes = [
    { label: "Gagnants", count: summary.wins, color: "var(--profit)" },
    { label: "Perdants", count: summary.losses, color: "var(--loss)" },
    { label: "Équilibre", count: summary.breakeven, color: "var(--muted-foreground)" },
  ];
  const circumference = 2 * Math.PI * 55;
  let offset = 0;
  return (
    <section className={styles.card} aria-label="Clôtures et positions">
      <h2>Clôtures</h2>
      <div className={styles.outcomes}>
        <div className={styles.donut}>
          <svg
            viewBox="0 0 140 140"
            role="img"
            aria-label={`Réussite ${summary.winRate === null ? "indisponible" : pct(summary.winRate * 100)}, ${outcomes.map((item) => `${item.count} ${item.label.toLowerCase()}`).join(", ")}`}
          >
            <circle cx="70" cy="70" r="55" fill="none" stroke="var(--secondary)" strokeWidth="14" />
            {outcomes.map((item) => {
              const length = summary.closedTrades
                ? (item.count / summary.closedTrades) * circumference
                : 0;
              const start = offset;
              offset += length;
              return (
                <circle
                  key={item.label}
                  cx="70"
                  cy="70"
                  r="55"
                  fill="none"
                  stroke={item.color}
                  strokeWidth="14"
                  strokeDasharray={`${length} ${circumference}`}
                  strokeDashoffset={-start}
                  transform="rotate(-90 70 70)"
                />
              );
            })}
          </svg>
          <div aria-hidden="true">
            <strong>
              {summary.winRate === null ? "—" : `${number(summary.winRate * 100, 0)} %`}
            </strong>
            <span>Réussite</span>
          </div>
        </div>
        <dl className={styles.legend}>
          {outcomes.map((item) => (
            <div key={item.label}>
              <dt>
                <span style={{ background: item.color }} />
                {item.label}
              </dt>
              <dd>{item.count}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className={styles.positions}>
        <span>
          Clôturées <strong>{summary.closedTrades}</strong>
        </span>
        <span>
          En cours <strong>{summary.openTrades}</strong>
        </span>
      </div>
    </section>
  );
}

function Results({ bot }: { bot: BotAssistantBot }) {
  const items = [
    { label: "Clôturé", value: bot.summary.netPnl },
    { label: "Réalisé", value: bot.summary.realizedPnl },
    { label: "Frais", value: -bot.summary.fees },
  ];
  const largest = Math.max(...items.map((item) => Math.abs(item.value))) || 1;
  return (
    <section className={styles.card} aria-label="Résultats du bot">
      <div className={styles.cardHeading}>
        <h2>Résultats</h2>
        <span>{bot.summary.currency}</span>
      </div>
      <div className={styles.moneyBars}>
        {items.map((item) => {
          const width = (Math.abs(item.value) / largest) * 50;
          return (
            <div key={item.label} className={styles.moneyRow}>
              <span>{item.label}</span>
              <div className={styles.moneyTrack} aria-hidden="true">
                <span
                  style={{
                    left: `${item.value < 0 ? 50 - width : 50}%`,
                    width: `${width}%`,
                    background: item.value < 0 ? "var(--loss)" : "var(--profit)",
                  }}
                />
              </div>
              <strong
                className={item.value < 0 ? "text-loss" : item.value > 0 ? "text-profit" : ""}
              >
                {item.value > 0 ? "+" : ""}
                {number(item.value)}
              </strong>
            </div>
          );
        })}
      </div>
      <details className={styles.help}>
        <summary>Lire ces résultats</summary>
        <p>
          Clôturé : positions entièrement fermées. Réalisé : sorties partielles incluses. Résultats
          nets après frais ; frais affichés séparément.
        </p>
      </details>
    </section>
  );
}

export function BotStudio() {
  const { data, error, loading, refresh } = useApi<BotAssistantState>("/api/bot-assistant");
  const [selected, setSelected] = useState("bybit-demo-doge");
  const bot = data?.bots.find((item) => item.id === selected) ?? data?.bots[0];
  return (
    <TooltipProvider>
      <div className={styles.studio}>
        {loading && !data && (
          <p role="status" className={styles.empty}>
            Lecture des bots…
          </p>
        )}
        {error && (
          <div role="alert" className={styles.card}>
            <p className="text-sm text-loss">Bots indisponibles.</p>
            <Button variant="outline" className="mt-3" onClick={refresh}>
              Réessayer
            </Button>
          </div>
        )}
        {bot && (
          <>
            <div className={styles.toolbar}>
              <label htmlFor="bot-selection" className={styles.botSelection}>
                <Bot size={17} aria-hidden="true" />
                <span className="sr-only">Choisir le bot</span>
                <select
                  id="bot-selection"
                  value={bot.id}
                  onChange={(event) => setSelected(event.target.value)}
                >
                  {data?.bots.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              {bot.current && (
                <span className={styles.readAt} title="Réglages lus sur le bot">
                  {timestamp(bot.current.fetchedAt, "UTC")}
                </span>
              )}
            </div>
            <BotWorkspace key={bot.id} bot={bot} />
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

function BotWorkspace({ bot }: { bot: BotAssistantBot }) {
  const [stopLoss, setStopLoss] = useState(bot.current ? String(bot.current.stopLossPct) : "");
  const [takeProfit, setTakeProfit] = useState(
    bot.current ? String(bot.current.takeProfitPct) : "",
  );
  const [draft, setDraft] = useState<{
    current: BotRiskParameters | null;
    proposed: BotRiskParameters;
    createdAt: string;
  } | null>(null);
  const [failure, setFailure] = useState("");
  const [exported, setExported] = useState(false);
  const draftChanged = Boolean(
    draft &&
    (Number(stopLoss.replace(",", ".")) !== draft.proposed.stopLossPct ||
      Number(takeProfit.replace(",", ".")) !== draft.proposed.takeProfitPct),
  );
  const compare = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const stopLossPct = Number(stopLoss.replace(",", "."));
    const takeProfitPct = Number(takeProfit.replace(",", "."));
    if (
      !Number.isFinite(stopLossPct) ||
      stopLossPct <= 0 ||
      stopLossPct >= 100 ||
      !Number.isFinite(takeProfitPct) ||
      takeProfitPct <= 0 ||
      takeProfitPct > 1000 ||
      !Number.isFinite(takeProfitPct / stopLossPct)
    ) {
      setFailure("SL : 0 à 100 % exclus. TP : 0 à 1 000 %, valeur positive. Ratio fini requis.");
      return;
    }
    setFailure("");
    setExported(false);
    setDraft({
      current: bot.current
        ? { stopLossPct: bot.current.stopLossPct, takeProfitPct: bot.current.takeProfitPct }
        : null,
      proposed: { stopLossPct, takeProfitPct },
      createdAt: new Date().toISOString(),
    });
  };
  const download = () => {
    if (!draft || draftChanged) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            type: "bot-settings-draft",
            version: 1,
            createdAt: draft.createdAt,
            accountId: bot.accountId,
            symbol: bot.symbol,
            applied: false,
            current: draft.current,
            proposed: {
              stop_loss_pct: draft.proposed.stopLossPct,
              take_profit_pct: draft.proposed.takeProfitPct,
            },
            reason: "Brouillon manuel comparé localement. Aucun réglage envoyé au bot.",
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${bot.label.toLowerCase()}-reglages-brouillon.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(true);
  };
  return (
    <div className={styles.visualGrid}>
      <RiskDiagram risk={bot.current} title="SL / TP actuels" />
      <Outcomes bot={bot} />
      <Results bot={bot} />
      <section className={styles.card} aria-label="Comparer un brouillon">
        <div className={styles.cardHeading}>
          <h2>Brouillon</h2>
          <span>Non appliqué</span>
        </div>
        <form className={styles.draftForm} onSubmit={compare}>
          <div className={styles.inputs}>
            <div>
              <Label htmlFor="bot-sl" className="text-xs text-loss">
                SL (%)
              </Label>
              <Input
                id="bot-sl"
                inputMode="decimal"
                required
                value={stopLoss}
                onChange={(event) => setStopLoss(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="bot-tp" className="text-xs text-profit">
                TP (%)
              </Label>
              <Input
                id="bot-tp"
                inputMode="decimal"
                required
                value={takeProfit}
                onChange={(event) => setTakeProfit(event.target.value)}
              />
            </div>
          </div>
          <div className={styles.actions}>
            <Button type="submit">Comparer</Button>
            {draft && (
              <Button
                type="button"
                variant="outline"
                disabled={draftChanged}
                onClick={download}
                aria-label="Exporter le brouillon en JSON"
              >
                <ArrowDownToLine aria-hidden="true" />
                JSON
              </Button>
            )}
          </div>
        </form>
        {failure && (
          <p role="alert" className="mt-3 text-xs text-loss">
            {failure}
          </p>
        )}
        {draftChanged && (
          <p role="status" className="mt-3 text-xs text-muted-foreground">
            Recompare avant l’export.
          </p>
        )}
        {exported && !draftChanged && (
          <p role="status" className="mt-3 text-xs text-profit">
            JSON téléchargé.
          </p>
        )}
        <details className={styles.help}>
          <summary>
            À propos du brouillon <ChevronDown size={13} aria-hidden="true" />
          </summary>
          <p>
            Comparaison locale uniquement. Le bot continue avec ses réglages actuels ; aucun ordre
            ni changement n’est envoyé. Ratio et seuil théoriques, hors frais, glissement et sorties
            partielles.
          </p>
        </details>
      </section>
      {draft && (
        <div className={styles.draftPreview}>
          <RiskDiagram risk={draft.proposed} title="SL / TP du brouillon" />
        </div>
      )}
    </div>
  );
}
