"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowUp,
  Bot,
  ChevronRight,
  MessageCircle,
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
import { Textarea } from "./ui/textarea";
import { TooltipProvider } from "./ui/tooltip";

type Message = { id: number; role: "user" | "assistant"; content: string; mode?: "ai" | "local" };
const pct = (value: number | undefined) => (value === undefined ? "—" : `${number(value, 2)} %`);

export function BotStudio() {
  const { data, error, loading, refresh } = useApi<BotAssistantState>("/api/bot-assistant");
  const [selected, setSelected] = useState("bybit-demo-doge");
  const [busy, setBusy] = useState(false);
  const selectedBot = data?.bots.find((bot) => bot.id === selected) ?? data?.bots[0];

  return (
    <TooltipProvider>
      <div className="min-w-0 space-y-4">
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
          <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Choisir le bot">
            {data.bots.map((bot) => (
              <button
                key={bot.id}
                type="button"
                disabled={busy}
                aria-pressed={selectedBot?.id === bot.id}
                onClick={() => setSelected(bot.id)}
                className={`min-w-0 rounded-xl border p-3 text-left transition-colors disabled:opacity-60 sm:p-4 ${selectedBot?.id === bot.id ? "border-brand bg-brand/10" : "bg-card hover:bg-secondary"}`}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${bot.current ? "bg-profit" : "bg-muted-foreground"}`}
                  />
                  {bot.label}
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground sm:text-xs">
                  {bot.current ? "Réglages lus" : "Indisponible"}
                </span>
              </button>
            ))}
          </div>
        )}
        <BotAiConnection onSaved={refresh} />
        {selectedBot && (
          <BotWorkspace
            key={selectedBot.id}
            initialBot={selectedBot}
            aiConfigured={data?.aiConfigured ?? false}
            onBusyChange={setBusy}
          />
        )}
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
      if (reply.proposal) {
        setProposal(reply.proposal);
        setStopLoss(String(reply.proposal.proposed.stopLossPct));
        setTakeProfit(String(reply.proposal.proposed.takeProfitPct));
        setExported(false);
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
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
      <section
        className="min-w-0 overflow-hidden rounded-xl border bg-card"
        aria-label={`Discussion avec le bot ${bot.label}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-4 sm:px-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <MessageCircle className="size-4 text-brand" />
            Assistant {bot.label}
          </h2>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] ${aiConfigured ? "bg-profit/10 text-profit" : "bg-secondary text-muted-foreground"}`}
          >
            {aiConfigured ? "IA configurée" : "Calculs locaux"}
          </span>
        </div>
        <div
          ref={messagesBox}
          className="max-h-[460px] min-h-[250px] space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {!messages.length && (
            <div className="py-4">
              <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Bot className="size-5" />
              </div>
              <p className="font-medium">Prépare le prochain réglage.</p>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                {aiConfigured
                  ? "L’IA s’appuie sur les réglages et les résultats enregistrés de ce bot."
                  : "Compare tes SL et TP avec des calculs locaux. Connecte l’IA pour discuter de tes résultats et réglages."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["Explique mes réglages actuels", "Compare SL 2 % et TP 4 %"].map((prompt) => (
                  <Button
                    key={prompt}
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void ask(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[94%] rounded-xl px-3.5 py-3 text-sm leading-relaxed sm:max-w-[90%] ${message.role === "user" ? "bg-brand/15" : "border bg-background/40"}`}
              >
                {message.role === "assistant" && (
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {message.mode === "ai" ? "Assistant IA" : "Calcul local"}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              </div>
            </div>
          ))}
          {busy && (
            <p role="status" className="animate-pulse text-xs text-muted-foreground">
              {aiConfigured ? "L’IA examine ta demande…" : "Lecture du bot et calcul…"}
            </p>
          )}
        </div>
        <form
          className="border-t p-4 sm:p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void ask(question);
          }}
        >
          <Label htmlFor="bot-question" className="sr-only">
            Ta question sur le bot
          </Label>
          <div className="flex items-end gap-2">
            <Textarea
              id="bot-question"
              className="min-h-[72px] resize-y"
              value={question}
              maxLength={4000}
              disabled={busy}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ex. : explique mon SL et mon TP…"
            />
            <Button
              type="submit"
              size="icon"
              disabled={busy || !question.trim()}
              aria-label="Envoyer la demande"
            >
              <ArrowUp />
            </Button>
          </div>
          {failure && (
            <p role="alert" className="mt-3 text-xs text-loss">
              {failure}
            </p>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            Les propositions restent des brouillons. Aucun changement envoyé au bot.
          </p>
        </form>
      </section>
      <div className="min-w-0 space-y-4">
        <section className="rounded-xl border bg-card p-4 sm:p-5" aria-label="Réglages actuels">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-semibold">Réglages actuels</h2>
            <span className="text-xs text-muted-foreground">{bot.label}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-loss/20 bg-loss/5 p-3">
              <p className="text-xs text-loss">Stop loss</p>
              <p className="tnum mt-1 text-xl font-semibold">{pct(bot.current?.stopLossPct)}</p>
            </div>
            <div className="rounded-lg border border-profit/20 bg-profit/5 p-3">
              <p className="text-xs text-profit">Take profit</p>
              <p className="tnum mt-1 text-xl font-semibold">{pct(bot.current?.takeProfitPct)}</p>
            </div>
          </div>
          {!bot.current && (
            <p className="mt-3 text-xs text-loss">
              Réglages indisponibles. Aucune valeur supposée.
            </p>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-[11px] text-muted-foreground">Résultat clôturé</dt>
              <dd
                className={`tnum mt-1 font-medium ${bot.summary.netPnl < 0 ? "text-loss" : bot.summary.netPnl > 0 ? "text-profit" : ""}`}
              >
                {number(bot.summary.netPnl)}{" "}
                <span className="text-[10px]">{bot.summary.currency}</span>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Réussite</dt>
              <dd className="tnum mt-1 font-medium">
                {bot.summary.winRate === null ? "—" : pct(bot.summary.winRate * 100)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-[11px] text-muted-foreground">
            {bot.summary.closedTrades} clôturés · {bot.summary.openTrades} ouverts
          </p>
        </section>
        <section
          className="rounded-xl border bg-card p-4 sm:p-5"
          aria-label="Brouillon de réglages"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-semibold">{proposal ? "Proposition" : "Ton brouillon"}</h2>
            <span className="rounded-full bg-secondary px-2 py-1 text-[10px] text-muted-foreground">
              Non appliqué
            </span>
          </div>
          {proposal && (
            <>
              <div className="space-y-3 text-sm">
                {[
                  { label: "Stop loss", key: "stopLossPct" as const, color: "text-loss" },
                  { label: "Take profit", key: "takeProfitPct" as const, color: "text-profit" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-2">
                    <span className={item.color}>{item.label}</span>
                    <span className="tnum flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {pct(proposal.current?.[item.key])}
                      </span>
                      <ChevronRight className="size-3 text-muted-foreground" />
                      <strong>{pct(proposal.proposed[item.key])}</strong>
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-secondary/50 p-3">
                <div>
                  <p className="text-[10px] text-muted-foreground">Gain / perte</p>
                  <p className="tnum mt-1 font-semibold">{number(proposal.rewardRisk)}×</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Seuil théorique</p>
                  <p className="tnum mt-1 font-semibold">{pct(proposal.breakEvenWinRate)}</p>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Avant frais, glissement et sorties partielles.
              </p>
              <p className="mt-3 break-words text-xs leading-relaxed text-muted-foreground">
                {proposal.reason}
              </p>
              <Button
                className="mt-4 w-full"
                variant="outline"
                disabled={busy || draftChanged}
                onClick={download}
              >
                <ArrowDownToLine />
                Exporter le brouillon
              </Button>
              {draftChanged && (
                <p role="status" className="mt-2 text-xs text-muted-foreground">
                  Compare les pourcentages modifiés pour mettre à jour cette proposition.
                </p>
              )}
              {exported && !draftChanged && (
                <p role="status" className="mt-2 text-xs text-profit">
                  Brouillon téléchargé, non appliqué au bot.
                </p>
              )}
            </>
          )}
          <details
            className={proposal ? "mt-4 border-t pt-4" : ""}
            open={proposal ? undefined : true}
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-muted-foreground">
              <SlidersHorizontal className="size-3.5" />
              {proposal ? "Ajuster les pourcentages" : "Comparer mes pourcentages"}
            </summary>
            <form className="mt-4 space-y-3" onSubmit={compare}>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
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
                <div className="space-y-1">
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
              <Button className="w-full" type="submit" disabled={busy}>
                Comparer le brouillon
              </Button>
            </form>
          </details>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            L’application lit les bots. Leur connexion actuelle ne permet pas de leur envoyer des
            réglages.
          </p>
        </section>
      </div>
    </div>
  );
}
