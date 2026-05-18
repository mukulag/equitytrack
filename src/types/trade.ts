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
  notes: string;
  exits: Exit[];
  status: TradeStatus;
  totalPnl: number;
  remainingQuantity: number;
  bookedProfit: number;
  isMtf?: boolean;
  marginContribution?: number | null;
}
