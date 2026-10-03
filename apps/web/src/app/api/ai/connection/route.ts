import { AI_PROVIDER_NAMES } from "@/lib/ai-settings";
import { aiConfigured, runAi } from "@/server/ai";
import { bad, handler, ok, requireValue } from "@/server/api";
import { getAiModel, getAiProvider } from "@/server/settings";

/** Tests only the saved connection; caller-supplied keys, prompts and models are rejected. */
export const POST = handler(async (request: Request) => {
  const text = await request.text();
  requireValue(text.length <= 1024, "Le test de connexion n’accepte aucun paramètre.");
  if (text.trim()) {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      return bad("Le test de connexion attend une demande vide.");
    }
    requireValue(
      value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0,
      "Le test de connexion n’accepte ni clé, ni modèle, ni message dans la demande.",
    );
  }

  const provider = getAiProvider();
  if (!aiConfigured())
    return bad(
      `Ajoute une clé API ${AI_PROVIDER_NAMES[provider]} puis enregistre-la avant le test.`,
    );
  const model = getAiModel(provider);

  try {
    const answer = await runAi("Réponds seulement OK.", 64);
    if (!answer.trim()) return bad("L’IA n’a renvoyé aucune réponse. Réessaie le test.", 502);
    return ok({ connected: true, provider, model });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    // runAi exposes only these sanitized categories. Never relay its message or raw errors.
    if (message.startsWith("AI is not configured"))
      return bad("La clé IA n’est plus disponible. Enregistre une clé avant de réessayer.");
    if (message.startsWith("AI authentication_error:"))
      return bad(
        "La clé IA a été refusée. Vérifie la clé et ses permissions chez le fournisseur.",
        502,
      );
    if (message.startsWith("AI billing:"))
      return bad("Le compte IA manque de crédits ou de quota. Vérifie sa facturation.", 502);
    if (message.startsWith("AI rate limit:"))
      return bad("Le fournisseur IA limite les demandes. Réessaie dans un instant.", 429);
    if (message.startsWith("AI model unavailable:"))
      return bad("Ce modèle IA est indisponible pour ta clé. Vérifie le modèle choisi.", 502);
    return bad("Le test IA a échoué. Vérifie la connexion et les réglages, puis réessaie.", 502);
  }
});
