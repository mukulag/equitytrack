export type TradeType = 'LONG' | 'SHORT' | 'IPO';
export type TradeStatus = 'OPEN' | 'PARTIAL' | 'CLOSED';

export interface Exit {
  id: string;
  quantity: number;
  exitPrice: number;
  exitDate: string;
  pnl: number;
}

export interface Trade {
  id: string;
  symbol: string;
  tradeType: TradeType;
  entryDate: string;
  entryPrice: number;
  quantity: number;
  currentPrice: number | null;
  setupStopLoss: number | null;
  currentStopLoss: number | null;
  target: number | null;
  targetRPT: number;
  notes: string;
  exits: Exit[];
  status: TradeStatus;
  totalPnl: number;
  remainingQuantity: number;
  bookedProfit: number;
}
