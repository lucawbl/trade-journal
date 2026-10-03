"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import {
  AI_DEFAULT_MODELS,
  AI_PROVIDER_NAMES,
  AI_PROVIDERS,
  type AiProvider,
  type AiSettingsPayload,
} from "@/lib/ai-settings";
import { postJson, useApi } from "@/lib/use-api";

export function BotAiConnection({
  onSaved,
  showWhenMissing = false,
}: {
  onSaved?: () => void;
  showWhenMissing?: boolean;
}) {
  const { data, error, loading, refresh } = useApi<AiSettingsPayload>("/api/settings");
  const [provider, setProvider] = useState<AiProvider>("openai");
  const [model, setModel] = useState(AI_DEFAULT_MODELS.openai);
  const [apiKey, setApiKey] = useState("");
  const [phase, setPhase] = useState<"saving" | "testing" | null>(null);
  const [failure, setFailure] = useState("");
  const [saved, setSaved] = useState(false);
  const [verified, setVerified] = useState(false);
  const saving = useRef(false);
  const panel = useRef<HTMLDetailsElement>(null);
  const revealed = useRef(false);
  const id = useId();

  useEffect(() => {
    if (!data) return;
    const next = data.aiConfigured ? data.aiProvider : "openai";
    setProvider(next);
    setModel(data.aiConnections[next].model);
  }, [data]);

  useEffect(() => {
    if (showWhenMissing && data && !data.aiConfigured && !revealed.current) {
      if (panel.current) panel.current.open = true;
      revealed.current = true;
    }
  }, [showWhenMissing, data]);

  const connection = data?.aiConnections[provider];
  const environment = connection?.source === "environment";
  const disabled = phase !== null || loading || !data;
  const name = AI_PROVIDER_NAMES[provider];
  const ready = Boolean(connection?.configured || apiKey.trim());
  const inputClass =
    "mt-1 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50";

  const save = async () => {
    if (disabled || saving.current || !model.trim() || !ready) return;
    saving.current = true;
    setPhase("saving");
    setFailure("");
    setSaved(false);
    setVerified(false);
    let stored = false;
    try {
      await postJson(
        "/api/settings",
        {
          aiProvider: provider,
          aiModel: model.trim(),
          ...(!environment && apiKey.trim() ? { [`${provider}Key`]: apiKey.trim() } : {}),
        },
        "PATCH",
      );
      setApiKey("");
      setSaved(true);
      stored = true;
      refresh();
      onSaved?.();
      setPhase("testing");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch("/api/ai/connection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          signal: controller.signal,
        });
        const result = (await response.json()) as { connected?: boolean; error?: string };
        if (!response.ok || !result.connected)
          throw new Error(result.error ?? "La connexion IA n’a pas été validée.");
      } catch (cause) {
        if (controller.signal.aborted)
          throw new Error("Le fournisseur ne répond pas. Réessaie le test.");
        throw cause;
      } finally {
        clearTimeout(timeout);
      }
      setVerified(true);
    } catch (cause) {
      setFailure(
        `${stored ? "Clé enregistrée, connexion non validée. " : "Enregistrement impossible. "}${cause instanceof Error ? cause.message : "Réessaie dans un instant."}`,
      );
    } finally {
      saving.current = false;
      setPhase(null);
    }
  };

  return (
    <details ref={panel} className="group min-w-0 rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm [&::-webkit-details-marker]:hidden">
        <span className="font-medium">
          {data?.aiConfigured ? "Connexion IA" : "Connecter l’IA"}
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {loading
            ? "Chargement…"
            : error
              ? "Indisponible"
              : verified
                ? "Connexion vérifiée"
                : data?.aiConfigured
                  ? `${AI_PROVIDER_NAMES[data.aiProvider]} · clé enregistrée`
                  : "Clé API nécessaire"}
          <ChevronDown size={16} aria-hidden="true" className="group-open:rotate-180" />
        </span>
      </summary>
      <div className="space-y-3 border-t p-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Ajoute une clé API OpenAI ou Anthropic pour activer la discussion. Ton abonnement ChatGPT
          ne connecte pas automatiquement ce site.
        </p>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label htmlFor={`${id}-provider`} className="min-w-0 text-xs text-muted-foreground">
              Fournisseur
              <select
                id={`${id}-provider`}
                value={provider}
                disabled={disabled}
                className={inputClass}
                onChange={(event) => {
                  const next = event.target.value as AiProvider;
                  setProvider(next);
                  setModel(data?.aiConnections[next].model ?? AI_DEFAULT_MODELS[next]);
                  setApiKey("");
                  setSaved(false);
                  setVerified(false);
                  setFailure("");
                }}
              >
                {AI_PROVIDERS.map((value) => (
                  <option key={value} value={value}>
                    {AI_PROVIDER_NAMES[value]}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={`${id}-key`} className="min-w-0 text-xs text-muted-foreground">
              Clé API {name}
              <input
                id={`${id}-key`}
                type="password"
                value={apiKey}
                disabled={disabled || environment}
                className={inputClass}
                maxLength={4096}
                placeholder={connection?.configured ? "Clé enregistrée" : "Colle ta clé API"}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  setSaved(false);
                  setVerified(false);
                  setFailure("");
                }}
              />
            </label>
          </div>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Modèle et options</summary>
            <label
              htmlFor={`${id}-model`}
              className="mt-3 block min-w-0 text-xs text-muted-foreground"
            >
              Modèle
              <input
                id={`${id}-model`}
                value={model}
                disabled={disabled}
                className={inputClass}
                maxLength={200}
                placeholder={AI_DEFAULT_MODELS[provider]}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => {
                  setModel(event.target.value);
                  setSaved(false);
                  setVerified(false);
                  setFailure("");
                }}
              />
            </label>
          </details>
          <p className="text-xs text-muted-foreground">
            {environment
              ? "Clé fournie par le serveur : modification depuis Railway."
              : connection?.configured
                ? "Laisse le champ vide pour conserver la clé. Une nouvelle clé la remplace."
                : "La clé est chiffrée sur le serveur. Les requêtes utilisent ton compte API."}
          </p>
          {!environment && !connection?.configured && (
            <a
              href={
                provider === "openai"
                  ? "https://platform.openai.com/api-keys"
                  : "https://console.anthropic.com/settings/keys"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
            >
              Obtenir une clé {name}
              <ArrowUpRight size={12} aria-hidden="true" />
            </a>
          )}
          {(error || failure) && (
            <p role="alert" className="text-xs text-loss">
              {failure || `Chargement impossible : ${error}`}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={disabled || !model.trim() || !ready}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {phase === "saving"
                ? "Enregistrement…"
                : phase === "testing"
                  ? "Test de connexion…"
                  : connection?.configured
                    ? "Enregistrer et tester"
                    : "Connecter l’IA"}
            </button>
            {saved && !failure && (
              <span role="status" className="text-xs text-profit">
                {verified
                  ? "IA connectée : réponse du fournisseur reçue."
                  : "Clé enregistrée, test en cours…"}
              </span>
            )}
          </div>
        </form>
      </div>
    </details>
  );
}
