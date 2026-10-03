import type { AiProvider } from "./ai-settings";

export interface AiChatRequest {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

export interface AiChatReply {
  answer: string;
  provider: AiProvider;
  model: string;
}
