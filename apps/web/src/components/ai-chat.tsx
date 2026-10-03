"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, MessageCirclePlus, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { AiSettingsPayload } from "@/lib/ai-settings";
import { AI_PROVIDER_NAMES } from "@/lib/ai-settings";
import type { AiChatReply } from "@/lib/ai-chat-contract";
import { useApi } from "@/lib/use-api";
import { BotAiConnection as AiConnection } from "./bot-ai-connection";
import styles from "./ai-chat.module.css";

type Message = { id: number; role: "user" | "assistant"; content: string };

export function AiChat({ initialMessage = "" }: { initialMessage?: string }) {
  const { data, error, loading, refresh } = useApi<AiSettingsPayload>("/api/settings");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState(initialMessage);
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const composing = useRef(false);
  const request = useRef<AbortController | null>(null);
  const id = useRef(0);
  const configured = Boolean(data?.aiConfigured);

  useEffect(() => {
    if (!input.current) return;
    input.current.style.height = "44px";
    input.current.style.height = `${Math.min(140, Math.max(44, input.current.scrollHeight))}px`;
  }, [text]);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy]);
  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );

  const send = async (message: string) => {
    const clean = message.trim();
    if (!clean || !configured || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 65000);
    const history = messages
      .slice(-10)
      .map(({ role, content }) => ({ role, content: content.slice(0, 2000) }));
    setMessages((items) => [...items, { id: id.current++, role: "user", content: clean }]);
    setText("");
    setFailure("");
    setBusy(true);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: clean, ...(history.length ? { history } : {}) }),
        signal: controller.signal,
      });
      const reply = (await response.json()) as AiChatReply & { error?: string };
      if (!response.ok) throw new Error(reply.error ?? "L’IA est indisponible.");
      if (controller.signal.aborted) return;
      setMessages((items) => [
        ...items,
        { id: id.current++, role: "assistant", content: reply.answer },
      ]);
    } catch (cause) {
      setFailure(
        controller.signal.aborted
          ? "La réponse a pris trop de temps. Réessaie."
          : cause instanceof Error
            ? cause.message
            : "Connexion interrompue.",
      );
      setText(clean);
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send(text);
  };

  return (
    <div className={styles.studio}>
      <div className={styles.toolbar}>
        <span className={styles.provider}>
          <Sparkles size={16} aria-hidden="true" />
          {configured && data ? AI_PROVIDER_NAMES[data.aiProvider] : "Discussion IA"}
          <span className={`${styles.dot} ${configured ? "bg-profit" : "bg-muted-foreground"}`} />
        </span>
        <button
          className={styles.reset}
          type="button"
          disabled={busy || !messages.length}
          onClick={() => {
            setMessages([]);
            setFailure("");
            setText("");
            input.current?.focus();
          }}
          aria-label="Nouvelle conversation"
        >
          <MessageCirclePlus size={19} />
        </button>
      </div>
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 text-xs text-loss"
        >
          <span>Connexion indisponible.</span>
          <button onClick={refresh} type="button" className="text-brand">
            Réessayer
          </button>
        </div>
      )}
      <section className={styles.chat} aria-label="Conversation avec l’IA">
        <div
          ref={list}
          className={styles.messages}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {!messages.length && (
            <div className={styles.empty}>
              <span className={styles.icon}>
                <Sparkles size={26} aria-hidden="true" />
              </span>
              <h2>Que veux-tu savoir ?</h2>
              <p>
                {loading
                  ? "Chargement…"
                  : configured
                    ? "Une question, une idée ou ton journal."
                    : "Connecte OpenAI pour utiliser les modèles de ChatGPT."}
              </p>
              {configured && (
                <div className={styles.prompts}>
                  {[
                    "Analyse mon journal",
                    "Explique le RSI simplement",
                    "Comment lire mes graphiques ?",
                  ].map((prompt) => (
                    <button
                      type="button"
                      key={prompt}
                      disabled={busy}
                      onClick={() => void send(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={message.role === "user" ? styles.user : styles.assistant}
            >
              {message.role === "user" ? (
                <p>{message.content}</p>
              ) : (
                <ReactMarkdown
                  skipHtml
                  components={{
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              )}
            </div>
          ))}
          {busy && (
            <span role="status" className="animate-pulse text-xs text-muted-foreground">
              L’IA répond…
            </span>
          )}
        </div>
        <form onSubmit={submit} className={styles.composerArea}>
          <label className="sr-only" htmlFor="ai-message">
            Message à l’IA
          </label>
          <div className={styles.composer}>
            <textarea
              ref={input}
              id="ai-message"
              rows={1}
              value={text}
              maxLength={4000}
              disabled={busy || !configured || loading}
              onChange={(event) => setText(event.target.value)}
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
                  if (!busy) void send(text);
                }
              }}
              placeholder={configured ? "Écris ton message…" : "Connecte l’IA pour commencer"}
            />
            <button
              type="submit"
              className={styles.send}
              disabled={busy || !configured || !text.trim()}
              aria-label="Envoyer le message"
            >
              <ArrowUp size={20} />
            </button>
          </div>
          {failure && (
            <p role="alert" className="mt-2 text-xs text-loss">
              {failure}
            </p>
          )}
          {configured && <p className={styles.note}>{data?.aiModel}</p>}
        </form>
      </section>
      <AiConnection onSaved={refresh} showWhenMissing />
    </div>
  );
}
