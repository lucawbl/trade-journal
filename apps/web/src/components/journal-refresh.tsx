"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function JournalRefresh() {
  const router = useRouter();
  const [automatic, setAutomatic] = useState(false);
  const [pending, startTransition] = useTransition();
  const [updated, setUpdated] = useState(false);
  useEffect(() => {
    try {
      setAutomatic(localStorage.getItem("journal-auto-refresh") === "true");
    } catch {}
  }, []);
  const changeAutomatic = (value: boolean) => {
    setAutomatic(value);
    try {
      localStorage.setItem("journal-auto-refresh", String(value));
    } catch {}
  };
  const refresh = () => {
    startTransition(() => router.refresh());
    setUpdated(true);
  };

  useEffect(() => {
    if (!automatic) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !pending) {
        startTransition(() => router.refresh());
        setUpdated(true);
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [automatic, pending, router]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3 text-xs">
      <button
        type="button"
        onClick={refresh}
        disabled={pending}
        className="rounded-md border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
      >
        {pending ? "Actualisation…" : "Actualiser les données"}
      </button>
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={automatic}
          onChange={(event) => changeAutomatic(event.target.checked)}
          className="h-4 w-4 accent-[var(--brand)]"
        />
        Automatique · 30 s
      </label>
      <span role="status" aria-live="polite" className="text-muted-foreground">
        {pending
          ? "Lecture du journal en cours…"
          : updated
            ? "Journal actualisé"
            : "Données chargées à l’ouverture de la page"}
      </span>
      {automatic && (
        <span className="text-muted-foreground">En pause lorsque cet onglet est masqué.</span>
      )}
    </div>
  );
}
