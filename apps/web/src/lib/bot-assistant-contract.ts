import type { BotRisk } from "./bot-risk";

export interface BotRiskParameters {
  stopLossPct: number;
  takeProfitPct: number;
}

export interface BotAssistantBot {
  id: string;
  accountId: string;
  symbol: string;
  label: string;
  current: BotRisk | null;
  summary: {
    closedTrades: number;
    wins: number;
    losses: number;
    breakeven: number;
    openTrades: number;
    netPnl: number;
    realizedPnl: number;
    fees: number;
    winRate: number | null;
    currency: string;
  };
}

export interface BotAssistantState {
  aiConfigured: boolean;
  canApply: false;
  bots: BotAssistantBot[];
}

export interface BotAssistantRequest {
  accountId: string;
  question: string;
  proposed?: BotRiskParameters;
  history?: { role: "user" | "assistant"; content: string }[];
}

export interface BotAssistantProposal {
  current: BotRiskParameters | null;
  proposed: BotRiskParameters;
  rewardRisk: number;
  /** Theoretical percentage before fees, slippage and partial exits. */
  breakEvenWinRate: number;
  reason: string;
  applied: false;
}

export interface BotAssistantReply {
  mode: "ai" | "local";
  aiConfigured: boolean;
  canApply: false;
  answer: string;
  bot: BotAssistantBot;
  proposal: BotAssistantProposal | null;
}
