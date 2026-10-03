import { AI_PROVIDER_NAMES } from "@/lib/ai-settings";
import { aiConfigured } from "@/server/ai";
import { answerAiChat, readAiChatRequest } from "@/server/ai-chat";
import { bad, handler, ok, requireValue } from "@/server/api";
import { getAiProvider } from "@/server/settings";

export const POST = handler(async (request: Request) => {
  const text = await request.text();
  requireValue(Buffer.byteLength(text, "utf8") <= 100000, "La demande est trop longue.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return bad("La demande de discussion est invalide.");
  }
  const parsed = readAiChatRequest(value);
  if (!aiConfigured()) {
    const provider = getAiProvider();
    return bad(
      `Ajoute une clé API ${AI_PROVIDER_NAMES[provider]} dans « Connecter l’IA » pour activer la discussion. Ton abonnement ChatGPT ne connecte pas automatiquement ce site.`,
    );
  }
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(60000)]);
  try {
    return ok(await answerAiChat(parsed, signal));
  } catch (error) {
    if (signal.aborted)
      return bad("La réponse IA a pris trop de temps ou a été interrompue. Réessaie.", 504);
    const message = error instanceof Error ? error.message : "";
    // Only recognized runAi categories are translated; raw errors and provider bodies stay private.
    if (message.startsWith("AI is not configured"))
      return bad("La clé IA n’est plus disponible. Enregistre une clé dans « Connecter l’IA ».");
    if (message.startsWith("AI authentication_error:"))
      return bad(
        "La clé IA a été refusée. Vérifie la clé et ses permissions dans « Connecter l’IA ».",
        502,
      );
    if (message.startsWith("AI billing:"))
      return bad("Le compte IA manque de crédits ou de quota. Vérifie sa facturation.", 502);
    if (message.startsWith("AI rate limit:"))
      return bad("Le fournisseur IA limite les demandes. Réessaie dans un instant.", 429);
    if (message.startsWith("AI model unavailable:"))
      return bad(
        "Ce modèle IA est indisponible pour ta clé. Vérifie le modèle choisi dans la connexion IA.",
        502,
      );
    return bad(
      "La discussion IA est momentanément indisponible. Vérifie la connexion puis réessaie.",
      502,
    );
  }
});
