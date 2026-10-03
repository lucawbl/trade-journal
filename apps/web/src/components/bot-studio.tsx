"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowUp,
  Bot,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import type {
  BotAssistantBot,
  BotAssistantProposal,
  BotAssistantReply,
  BotAssistantState,
  BotRiskParameters,
} from "@/lib/bot-assistant-contract";
import { number } from "@/lib/journal-format";
import { useApi } from "@/lib/use-api";
import { BotAiConnection } from "./bot-ai-connection";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { TooltipProvider } from "./ui/tooltip";
import styles from "./bot-studio.module.css";

type Message = { id: number; role: "user" | "assistant"; content: string; mode?: "ai" | "local" };
const pct = (value: number | undefined) => (value === undefined ? "—" : `${number(value, 2)} %`);

export function BotStudio() {
  const { data, error, loading, refresh } = useApi<BotAssistantState>("/api/bot-assistant");
  const [selected, setSelected] = useState("bybit-demo-doge");
  const [busy, setBusy] = useState(false);
  const selectedBot = data?.bots.find((bot) => bot.id === selected) ?? data?.bots[0];

  return (
    <TooltipProvider>
      <div className={styles.studio}>
        {loading && !data && (
          <p role="status" className="py-8 text-sm text-muted-foreground">
            Lecture des bots…
          </p>
        )}
        {error && (
          <div role="alert" className="rounded-xl border bg-card p-5 text-sm">
            <p className="text-loss">Impossible de lire les bots.</p>
            <Button variant="outline" className="mt-3" onClick={refresh}>
              Réessayer
            </Button>
          </div>
        )}
        {data && (
          <div className={styles.toolbar}>
            <label htmlFor="bot-selection" className={styles.botSelection}>
              <Bot size={17} aria-hidden="true" />
              <span className="sr-only">Choisir le bot</span>
              <select
                id="bot-selection"
                value={selectedBot?.id ?? ""}
                disabled={busy}
                onChange={(event) => setSelected(event.target.value)}
              >
                {data.bots.map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.label}
                  </option>
                ))}
              </select>
            </label>
            <span className={styles.connectionStatus}>
              <span className={data.aiConfigured ? "bg-profit" : "bg-muted-foreground"} />
              {data.aiConfigured ? "IA configurée" : "IA à connecter"}
            </span>
          </div>
        )}
        {selectedBot && (
          <BotWorkspace
            key={selectedBot.id}
            initialBot={selectedBot}
            aiConfigured={data?.aiConfigured ?? false}
            onBusyChange={setBusy}
          />
        )}
        <BotAiConnection onSaved={refresh} />
      </div>
    </TooltipProvider>
  );
}

function BotWorkspace({
  initialBot,
  aiConfigured,
  onBusyChange,
}: {
  initialBot: BotAssistantBot;
  aiConfigured: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [latestBot, setLatestBot] = useState<BotAssistantBot | null>(null);
  const bot = latestBot ?? initialBot;
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<BotAssistantProposal | null>(null);
  const [stopLoss, setStopLoss] = useState(
    initialBot.current ? String(initialBot.current.stopLossPct) : "",
  );
  const [takeProfit, setTakeProfit] = useState(
    initialBot.current ? String(initialBot.current.takeProfitPct) : "",
  );
  const [exported, setExported] = useState(false);
  const draftChanged = Boolean(
    proposal &&
    (Number(stopLoss.replace(",", ".")) !== proposal.proposed.stopLossPct ||
      Number(takeProfit.replace(",", ".")) !== proposal.proposed.takeProfitPct),
  );
  const requestRef = useRef<AbortController | null>(null);
  const nextId = useRef(0);
  const messagesBox = useRef<HTMLDivElement>(null);
  const questionInput = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);

  useEffect(() => {
    const input = questionInput.current;
    if (!input) return;
    input.style.height = "44px";
    input.style.height = `${Math.min(120, Math.max(44, input.scrollHeight))}px`;
  }, [question]);

  useEffect(() => {
    setLatestBot(null);
  }, [initialBot]);

  useEffect(
    () => () => {
      requestRef.current?.abort();
      onBusyChange(false);
    },
    [onBusyChange],
  );
  useEffect(() => {
    if (!messages.length && !busy) return;
    messagesBox.current?.scrollTo({ top: messagesBox.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy]);

  const ask = async (text: string, proposed?: BotRiskParameters) => {
    const clean = text.trim();
    if (!clean || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 65000);
    setBusy(true);
    onBusyChange(true);
    setFailure("");
    const history = messages
      .slice(-6)
      .map(({ role, content }) => ({ role, content: content.slice(0, 2000) }));
    setMessages((items) => [...items, { id: nextId.current++, role: "user", content: clean }]);
    setQuestion("");
    try {
      const response = await fetch("/api/bot-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: bot.accountId,
          question: clean,
          ...(history.length ? { history } : {}),
          ...(proposed ? { proposed } : {}),
        }),
        signal: controller.signal,
      });
      const reply = (await response.json()) as BotAssistantReply & { error?: string };
      if (!response.ok) throw new Error(reply.error ?? "L’assistant est indisponible.");
      if (controller.signal.aborted) return;
      setLatestBot(reply.bot);
      setMessages((items) => [
        ...items,
        { id: nextId.current++, role: "assistant", content: reply.answer, mode: reply.mode },
      ]);
      setProposal(reply.proposal);
      setExported(false);
      if (reply.proposal) {
        setStopLoss(String(reply.proposal.proposed.stopLossPct));
        setTakeProfit(String(reply.proposal.proposed.takeProfitPct));
      }
    } catch (cause) {
      setFailure(
        controller.signal.aborted
          ? "La réponse a pris trop de temps. Réessaie."
          : cause instanceof Error
            ? cause.message
            : "Impossible d’envoyer ta demande.",
      );
      setQuestion(clean);
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setBusy(false);
        onBusyChange(false);
      }
    }
  };

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
      takeProfitPct > 1000
    ) {
      setFailure("SL : entre 0 et 100 %. TP : entre 0 et 1 000 %, valeurs positives.");
      return;
    }
    void ask(
      `Compare ce brouillon aux réglages actuels : SL ${pct(stopLossPct)}, TP ${pct(takeProfitPct)}.`,
      { stopLossPct, takeProfitPct },
    );
  };

  const download = () => {
    if (!proposal || draftChanged) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            type: "bot-settings-draft",
            version: 1,
            createdAt: new Date().toISOString(),
            accountId: bot.accountId,
            symbol: bot.symbol,
            applied: false,
            current: proposal.current,
            proposed: {
              stop_loss_pct: proposal.proposed.stopLossPct,
              take_profit_pct: proposal.proposed.takeProfitPct,
            },
            reason: proposal.reason,
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
    <div className={styles.workspace}>
      <section className={styles.chat} aria-label={`Discussion avec le bot ${bot.label}`}>
        <div
          ref={messagesBox}
          className={styles.messages}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {!messages.length && (
            <div className={styles.empty}>
              <div className={styles.assistantIcon}>
                <Bot size={22} aria-hidden="true" />
              </div>
              <h2>Que veux-tu améliorer sur {bot.label} ?</h2>
              <p>
                {aiConfigured
                  ? "Pose ta question ou prépare un nouveau SL / TP."
                  : "Compare tes SL / TP. La discussion IA s’active après connexion."}
              </p>
              <div className={styles.prompts}>
                {["Explique mes réglages actuels", "Compare SL 2 % et TP 4 %"].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={busy}
                    onClick={() => void ask(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={message.role === "user" ? styles.userMessage : styles.assistantMessage}
            >
              {message.role === "assistant" && (
                <span className={styles.messageMode}>
                  {message.mode === "ai" ? "Assistant IA" : "Calcul local"}
                </span>
              )}
              <p>{message.content}</p>
            </div>
          ))}
          {busy && (
            <p role="status" className="animate-pulse text-xs text-muted-foreground">
              {aiConfigured ? "L’IA examine ta demande…" : "Calcul en cours…"}
            </p>
          )}
        </div>
        <form
          className={styles.composerArea}
          onSubmit={(event) => {
            event.preventDefault();
            void ask(question);
          }}
        >
          <label htmlFor="bot-question" className="sr-only">
            Ta question sur le bot
          </label>
          <div className={styles.composer}>
            <textarea
              ref={questionInput}
              id="bot-question"
              rows={1}
              value={question}
              maxLength={4000}
              disabled={busy}
              onChange={(event) => setQuestion(event.target.value)}
              onCompositionStart={() => {
                composing.current = true;
              }}
              onCompositionEnd={() => {
                composing.current = false;
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing &&
                  !composing.current &&
                  event.keyCode !== 229
                ) {
                  event.preventDefault();
                  if (!busy) void ask(question);
                }
              }}
              placeholder="Écris ta demande…"
              aria-describedby="bot-composer-note"
            />
            <button
              type="submit"
              className={styles.send}
              disabled={busy || !question.trim()}
              aria-label="Envoyer la demande"
            >
              <ArrowUp size={20} aria-hidden="true" />
            </button>
          </div>
          {failure && (
            <p role="alert" className="mt-2 text-xs text-loss">
              {failure}
            </p>
          )}
          <p id="bot-composer-note" className={styles.composerNote}>
            Brouillon uniquement · aucun réglage envoyé au bot.
          </p>
        </form>
      </section>
      {proposal && (
        <details className={`${styles.panel} ${styles.proposal}`} open>
          <summary className={styles.panelSummary}>
            <span className="font-medium">Proposition SL / TP</span>
            <span className={styles.summaryEnd}>
              <span className="text-[11px] text-muted-foreground">Non appliqué</span>
              <ChevronDown size={16} aria-hidden="true" />
            </span>
          </summary>
          <div className={styles.panelContent}>
            <div className={styles.proposalLevels}>
              {[
                { label: "Stop loss", key: "stopLossPct" as const, color: "text-loss" },
                { label: "Take profit", key: "takeProfitPct" as const, color: "text-profit" },
              ].map((item) => (
                <div key={item.key}>
                  <span className={`text-xs ${item.color}`}>{item.label}</span>
                  <span className="tnum flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {pct(proposal.current?.[item.key])}
                    </span>
                    <ChevronRight className="size-3 text-muted-foreground" aria-hidden="true" />
                    <strong>{pct(proposal.proposed[item.key])}</strong>
                  </span>
                </div>
              ))}
            </div>
            <div className={styles.proposalMetrics}>
              <span>
                Gain / perte <strong>{number(proposal.rewardRisk)}×</strong>
              </span>
              <span>
                Seuil théorique <strong>{pct(proposal.breakEvenWinRate)}</strong>
              </span>
            </div>
            <details className={styles.explanation}>
              <summary>Comprendre cette proposition</summary>
              <p>{proposal.reason}</p>
              <p>Calculs avant frais, glissement et sorties partielles.</p>
            </details>
            <Button variant="outline" disabled={busy || draftChanged} onClick={download}>
              <ArrowDownToLine />
              Exporter le brouillon
            </Button>
            {draftChanged && (
              <p role="status" className="text-xs text-muted-foreground">
                Compare les pourcentages modifiés pour actualiser la proposition.
              </p>
            )}
            {exported && !draftChanged && (
              <p role="status" className="text-xs text-profit">
                Brouillon téléchargé, non appliqué au bot.
              </p>
            )}
          </div>
        </details>
      )}
      <details className={styles.panel}>
        <summary className={styles.panelSummary}>
          <span className="flex items-center gap-2 font-medium">
            <SlidersHorizontal size={15} aria-hidden="true" />
            Comparer mes SL / TP
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <form className={styles.panelContent} onSubmit={compare}>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="bot-sl" className="text-xs">
                SL (%)
              </Label>
              <Input
                id="bot-sl"
                inputMode="decimal"
                required
                value={stopLoss}
                disabled={busy}
                onChange={(event) => setStopLoss(event.target.value)}
                placeholder="0,8"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label htmlFor="bot-tp" className="text-xs">
                TP (%)
              </Label>
              <Input
                id="bot-tp"
                inputMode="decimal"
                required
                value={takeProfit}
                disabled={busy}
                onChange={(event) => setTakeProfit(event.target.value)}
                placeholder="1,2"
              />
            </div>
          </div>
          <Button type="submit" className="w-fit max-w-full" disabled={busy}>
            Comparer le brouillon
          </Button>
        </form>
      </details>
      <details className={styles.panel}>
        <summary className={styles.panelSummary}>
          <span className="font-medium">Réglages et résultats</span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className={styles.panelContent}>
          <dl className={styles.currentMetrics}>
            <div>
              <dt className="text-loss">Stop loss</dt>
              <dd>{pct(bot.current?.stopLossPct)}</dd>
            </div>
            <div>
              <dt className="text-profit">Take profit</dt>
              <dd>{pct(bot.current?.takeProfitPct)}</dd>
            </div>
            <div>
              <dt>Résultat clôturé</dt>
              <dd
                className={
                  bot.summary.netPnl < 0 ? "text-loss" : bot.summary.netPnl > 0 ? "text-profit" : ""
                }
              >
                {number(bot.summary.netPnl)} {bot.summary.currency}
              </dd>
            </div>
            <div>
              <dt>Réussite</dt>
              <dd>{bot.summary.winRate === null ? "—" : pct(bot.summary.winRate * 100)}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            {bot.summary.closedTrades} clôturés · {bot.summary.openTrades} ouverts
          </p>
          {!bot.current && <p className="text-xs text-loss">Réglages indisponibles.</p>}
        </div>
      </details>
    </div>
  );
}
