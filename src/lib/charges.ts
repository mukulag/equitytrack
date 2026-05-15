// Zerodha charges (equity delivery & MTF) + MTF interest calculator
// Reference: https://zerodha.com/charges/

import { Trade, Exit } from '@/types/trade';

export const MTF_DAILY_RATE = 0.000399; // 0.0399% per day (~14.56% p.a.)
export const DEFAULT_MARGIN_RATIO = 0.25; // 25% user contribution by default

interface LegInput {
  turnover: number;
  side: 'BUY' | 'SELL';
  isMtf: boolean;
  qty: number;
}

export interface LegCharges {
  brokerage: number;
  stt: number;
  exchange: number;
  sebi: number;
  stamp: number;
  gst: number;
  dp: number;
  total: number;
}

export function computeLegCharges({ turnover, side, isMtf }: LegInput): LegCharges {
  const brokerage = isMtf ? Math.min(turnover * 0.0003, 20) : 0; // MTF: 0.03% capped ₹20; Delivery: free
  const stt = turnover * 0.001; // 0.1% buy & sell
  const exchange = turnover * 0.0000297; // NSE 0.00297%
  const sebi = turnover * 0.000001; // ₹10/crore
  const stamp = side === 'BUY' ? turnover * 0.00015 : 0; // 0.015% on buy
  const gst = (brokerage + exchange + sebi) * 0.18;
  // DP charges: ₹15.34 per scrip on sell, delivery only (not MTF pledged)
  const dp = side === 'SELL' && !isMtf ? 15.34 : 0;
  const total = brokerage + stt + exchange + sebi + stamp + gst + dp;
  return { brokerage, stt, exchange, sebi, stamp, gst, dp, total };
}

function daysBetween(from: string, to: Date): number {
  const start = new Date(from);
  const ms = to.getTime() - start.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export interface TradeMetrics {
  entryCharges: number;
  exitCharges: number;
  totalCharges: number;
  mtfInterest: number;
  costBasis: number; // entry value (full)
  fundedAmount: number; // 0 if not MTF
  unrealizedPnl: number;
  grossPnl: number; // booked + unrealized
  netPnl: number; // gross - charges - interest
  netMarginPercent: number; // netPnl / capitalDeployed * 100
  capitalDeployed: number; // for MTF: marginContribution; else: full entry value
}

export function computeTradeMetrics(trade: Trade, now: Date = new Date()): TradeMetrics {
  const entryValue = trade.entryPrice * trade.quantity;
  const entryLeg = computeLegCharges({
    turnover: entryValue,
    side: trade.tradeType === 'SHORT' ? 'SELL' : 'BUY',
    isMtf: !!trade.isMtf,
    qty: trade.quantity,
  });

  let exitCharges = 0;
  for (const ex of trade.exits) {
    const turnover = ex.exitPrice * ex.quantity;
    exitCharges += computeLegCharges({
      turnover,
      side: trade.tradeType === 'SHORT' ? 'BUY' : 'SELL',
      isMtf: !!trade.isMtf,
      qty: ex.quantity,
    }).total;
  }

  // MTF interest: funded portion × daily rate × days held (per share)
  let mtfInterest = 0;
  let fundedAmount = 0;
  if (trade.isMtf) {
    const marginContrib =
      trade.marginContribution != null && trade.marginContribution > 0
        ? trade.marginContribution
        : entryValue * DEFAULT_MARGIN_RATIO;
    fundedAmount = Math.max(0, entryValue - marginContrib);
    const fundedPerShare = trade.quantity > 0 ? fundedAmount / trade.quantity : 0;

    // Interest on exited shares: until each exit date
    for (const ex of trade.exits) {
      const days = daysBetween(trade.entryDate, new Date(ex.exitDate));
      mtfInterest += fundedPerShare * ex.quantity * MTF_DAILY_RATE * days;
    }
    // Interest on remaining (open) shares: until today
    if (trade.remainingQuantity > 0) {
      const days = daysBetween(trade.entryDate, now);
      mtfInterest += fundedPerShare * trade.remainingQuantity * MTF_DAILY_RATE * days;
    }
  }

  const unrealizedPnl =
    trade.currentPrice && trade.remainingQuantity > 0
      ? (trade.tradeType === 'SHORT'
          ? (trade.entryPrice - trade.currentPrice)
          : (trade.currentPrice - trade.entryPrice)) * trade.remainingQuantity
      : 0;

  const grossPnl = trade.bookedProfit + unrealizedPnl;
  const totalCharges = entryLeg.total + exitCharges;
  const netPnl = grossPnl - totalCharges - mtfInterest;

  const capitalDeployed = trade.isMtf
    ? (trade.marginContribution != null && trade.marginContribution > 0
        ? trade.marginContribution
        : entryValue * DEFAULT_MARGIN_RATIO)
    : entryValue;

  const netMarginPercent = capitalDeployed > 0 ? (netPnl / capitalDeployed) * 100 : 0;

  return {
    entryCharges: entryLeg.total,
    exitCharges,
    totalCharges,
    mtfInterest,
    costBasis: entryValue,
    fundedAmount,
    unrealizedPnl,
    grossPnl,
    netPnl,
    netMarginPercent,
    capitalDeployed,
  };
}
