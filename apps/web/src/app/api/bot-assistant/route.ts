import { bad, handler, ok, requireValue, RequestError } from "@/server/api";
import {
  answerBotAssistant,
  readBotAssistantRequest,
  readBotAssistantState,
} from "@/server/bot-assistant";

export const GET = handler(async () => ok(await readBotAssistantState()));

export const POST = handler(async (request: Request) => {
  const text = await request.text();
  requireValue(text.length <= 64000, "Demande trop longue.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return bad("Demande JSON invalide.");
  }
  const parsed = readBotAssistantRequest(body);
  try {
    return ok(await answerBotAssistant(parsed));
  } catch (error) {
    if (error instanceof RequestError) return bad(error.message);
    // Never forward provider errors, request payloads, keys or raw bot responses.
    return bad(
      "L’assistant est momentanément indisponible. Réessaie ; aucun changement n’a été appliqué.",
      502,
    );
  }
});
