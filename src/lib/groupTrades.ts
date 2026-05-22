import { Trade, Exit } from '@/types/trade';
import { computeTradeMetrics, TradeMetrics } from '@/lib/charges';

export interface GroupedTrade extends Trade {
  sourceTrades: Trade[];
}

export function groupTradesBySymbol(trades: Trade[]): GroupedTrade[] {
  const map = new Map<string, Trade[]>();
  for (const t of trades) {
    const key = t.symbol;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }

  const result: GroupedTrade[] = [];
  for (const [symbol, group] of map) {
    const totalQty = group.reduce((s, t) => s + t.quantity, 0);
    const totalCost = group.reduce((s, t) => s + t.entryPrice * t.quantity, 0);
    const avgEntry = totalQty > 0 ? totalCost / totalQty : 0;
    const remainingQty = group.reduce((s, t) => s + t.remainingQuantity, 0);
    const bookedProfit = group.reduce((s, t) => s + t.bookedProfit, 0);
    const totalPnl = group.reduce((s, t) => s + t.totalPnl, 0);
    const currentPrice = group.find((t) => t.currentPrice != null)?.currentPrice ?? null;
    const earliestEntry = group.reduce((min, t) => (t.entryDate < min ? t.entryDate : min), group[0].entryDate);

    // Merge exits (tagged with parent trade id) and renormalize pnl is unnecessary — sum is preserved
    const exits: Exit[] = group
      .flatMap((t) => t.exits)
      .sort((a, b) => a.exitDate.localeCompare(b.exitDate));

    const anyMtf = group.some((t) => t.isMtf);
    const hasIpo = group.some((t) => t.tradeType === 'IPO');
    const tradeType = hasIpo && group.every((t) => t.tradeType === 'IPO') ? 'IPO' : (group[0].tradeType);

    let status: 'OPEN' | 'PARTIAL' | 'CLOSED' = 'OPEN';
    if (remainingQty === 0) status = 'CLOSED';
    else if (totalQty - remainingQty > 0) status = 'PARTIAL';

    result.push({
      id: `group:${symbol}`,
      symbol,
      tradeType: tradeType as Trade['tradeType'],
      entryDate: earliestEntry,
      entryPrice: avgEntry,
      quantity: totalQty,
      currentPrice: currentPrice ?? null,
      notes: '',
      exits,
      status,
      totalPnl,
      remainingQuantity: remainingQty,
      bookedProfit,
      isMtf: anyMtf,
      marginContribution: null,
      sourceTrades: group,
    });
  }

  // Sort: open first by symbol, then closed
  result.sort((a, b) => {
    if (a.status === 'CLOSED' && b.status !== 'CLOSED') return 1;
    if (a.status !== 'CLOSED' && b.status === 'CLOSED') return -1;
    return a.symbol.localeCompare(b.symbol);
  });

  return result;
}

export function computeGroupedMetrics(group: GroupedTrade, now: Date = new Date()): TradeMetrics {
  const parts = group.sourceTrades.map((t) => computeTradeMetrics(t, now));
  const sum = <K extends keyof TradeMetrics>(k: K) =>
    parts.reduce((s, p) => s + (p[k] as number), 0);
  const netPnl = sum('netPnl');
  const capitalDeployed = sum('capitalDeployed');
  return {
    entryCharges: sum('entryCharges'),
    exitCharges: sum('exitCharges'),
    totalCharges: sum('totalCharges'),
    mtfInterest: sum('mtfInterest'),
    costBasis: sum('costBasis'),
    fundedAmount: sum('fundedAmount'),
    unrealizedPnl: sum('unrealizedPnl'),
    grossPnl: sum('grossPnl'),
    netPnl,
    capitalDeployed,
    netMarginPercent: capitalDeployed > 0 ? (netPnl / capitalDeployed) * 100 : 0,
  };
}

export function computeAvgExitPrice(exits: Exit[]): number | null {
  const qty = exits.reduce((s, e) => s + e.quantity, 0);
  if (qty === 0) return null;
  const value = exits.reduce((s, e) => s + e.exitPrice * e.quantity, 0);
  return value / qty;
}
