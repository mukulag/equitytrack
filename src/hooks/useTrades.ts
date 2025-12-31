import { useState, useEffect } from 'react';
import { Trade, Exit, TradeType } from '@/types/trade';

const STORAGE_KEY = 'trading-journal-trades';

export const useTrades = () => {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setTrades(JSON.parse(stored));
    }
  }, []);

  const saveTrades = (newTrades: Trade[]) => {
    setTrades(newTrades);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newTrades));
  };

  const addTrade = (trade: Omit<Trade, 'id' | 'exits' | 'status' | 'totalPnl' | 'remainingQuantity'>) => {
    const newTrade: Trade = {
      ...trade,
      id: crypto.randomUUID(),
      exits: [],
      status: 'OPEN',
      totalPnl: 0,
      remainingQuantity: trade.quantity,
    };
    saveTrades([newTrade, ...trades]);
  };

  const addExit = (tradeId: string, exitData: Omit<Exit, 'id' | 'pnl'>) => {
    const updatedTrades = trades.map((trade) => {
      if (trade.id !== tradeId) return trade;

      const pnl =
        trade.tradeType === 'LONG'
          ? (exitData.exitPrice - trade.entryPrice) * exitData.quantity
          : (trade.entryPrice - exitData.exitPrice) * exitData.quantity;

      const newExit: Exit = {
        ...exitData,
        id: crypto.randomUUID(),
        pnl,
      };

      const exits = [...trade.exits, newExit];
      const totalExitedQty = exits.reduce((sum, e) => sum + e.quantity, 0);
      const remainingQuantity = trade.quantity - totalExitedQty;
      const totalPnl = exits.reduce((sum, e) => sum + e.pnl, 0);

      let status: Trade['status'] = 'OPEN';
      if (remainingQuantity === 0) status = 'CLOSED';
      else if (totalExitedQty > 0) status = 'PARTIAL';

      return {
        ...trade,
        exits,
        status,
        totalPnl,
        remainingQuantity,
      };
    });

    saveTrades(updatedTrades);
  };

  const deleteTrade = (tradeId: string) => {
    saveTrades(trades.filter((t) => t.id !== tradeId));
  };

  const deleteExit = (tradeId: string, exitId: string) => {
    const updatedTrades = trades.map((trade) => {
      if (trade.id !== tradeId) return trade;

      const exits = trade.exits.filter((e) => e.id !== exitId);
      const totalExitedQty = exits.reduce((sum, e) => sum + e.quantity, 0);
      const remainingQuantity = trade.quantity - totalExitedQty;
      const totalPnl = exits.reduce((sum, e) => sum + e.pnl, 0);

      let status: Trade['status'] = 'OPEN';
      if (remainingQuantity === 0) status = 'CLOSED';
      else if (totalExitedQty > 0) status = 'PARTIAL';

      return {
        ...trade,
        exits,
        status,
        totalPnl,
        remainingQuantity,
      };
    });

    saveTrades(updatedTrades);
  };

  const getStats = () => {
    const totalTrades = trades.length;
    const openTrades = trades.filter((t) => t.status !== 'CLOSED').length;
    const closedTrades = trades.filter((t) => t.status === 'CLOSED').length;
    const totalPnl = trades.reduce((sum, t) => sum + t.totalPnl, 0);
    const winningTrades = trades.filter((t) => t.status === 'CLOSED' && t.totalPnl > 0).length;
    const losingTrades = trades.filter((t) => t.status === 'CLOSED' && t.totalPnl < 0).length;
    const winRate = closedTrades > 0 ? (winningTrades / closedTrades) * 100 : 0;

    return {
      totalTrades,
      openTrades,
      closedTrades,
      totalPnl,
      winningTrades,
      losingTrades,
      winRate,
    };
  };

  return {
    trades,
    addTrade,
    addExit,
    deleteTrade,
    deleteExit,
    getStats,
  };
};
