"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  AI_DEFAULT_MODELS,
  AI_PROVIDER_NAMES,
  AI_PROVIDERS,
  type AiProvider,
  type AiSettingsPayload,
} from "@/lib/ai-settings";
import { postJson, useApi } from "@/lib/use-api";

export function BotAiConnection({ onSaved }: { onSaved?: () => void }) {
  const { data, error, loading, refresh } = useApi<AiSettingsPayload>("/api/settings");
  const [provider, setProvider] = useState<AiProvider>("openai");
  const [model, setModel] = useState(AI_DEFAULT_MODELS.openai);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [saved, setSaved] = useState(false);
  const saving = useRef(false);
  const id = useId();

  useEffect(() => {
    if (!data) return;
    setProvider(data.aiProvider);
    setModel(data.aiModel);
  }, [data]);

  const connection = data?.aiConnections[provider];
  const environment = connection?.source === "environment";
  const disabled = busy || loading || !data;
  const name = AI_PROVIDER_NAMES[provider];
  const ready = Boolean(connection?.configured || apiKey.trim());
  const inputClass =
    "mt-1 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50";

  const save = async () => {
    if (disabled || saving.current || !model.trim() || !ready) return;
    saving.current = true;
    setBusy(true);
    setFailure("");
    setSaved(false);
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
      refresh();
      onSaved?.();
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Réessayez dans un instant.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  return (
    <details className="group min-w-0 rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm [&::-webkit-details-marker]:hidden">
        <span className="font-medium">Connexion IA</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {loading
            ? "Chargement…"
            : error
              ? "Indisponible"
              : data?.aiConfigured
                ? `${AI_PROVIDER_NAMES[data.aiProvider]} · configurée`
                : "À connecter"}
          <ChevronDown size={16} aria-hidden="true" className="group-open:rotate-180" />
        </span>
      </summary>
      <div className="space-y-3 border-t p-4">
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
          <label htmlFor={`${id}-model`} className="min-w-0 text-xs text-muted-foreground">
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
                setFailure("");
              }}
            />
          </label>
        </div>
        <label htmlFor={`${id}-key`} className="block text-xs text-muted-foreground">
          Clé API {name}
          <input
            id={`${id}-key`}
            type="password"
            value={apiKey}
            disabled={disabled || environment}
            className={inputClass}
            maxLength={4096}
            placeholder={connection?.configured ? "Clé configurée" : "Colle ta clé API"}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setApiKey(event.target.value);
              setSaved(false);
              setFailure("");
            }}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          {environment
            ? "Clé fournie par le serveur : modification depuis Railway."
            : connection?.configured
              ? "Laisse le champ vide pour conserver la clé. Une nouvelle clé la remplace."
              : "La clé est chiffrée sur le serveur. Les requêtes utilisent ton compte IA."}
        </p>
        {(error || failure) && (
          <p role="alert" className="text-xs text-loss">
            {failure
              ? `Enregistrement impossible : ${failure}`
              : `Chargement impossible : ${error}`}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={disabled || !model.trim() || !ready}
            onClick={save}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Enregistrement…" : "Enregistrer la connexion"}
          </button>
          {saved && (
            <span role="status" className="text-xs text-profit">
              Connexion enregistrée.
            </span>
          )}
        </div>
      </div>
    </details>
  );
}
