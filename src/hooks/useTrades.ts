import { useState, useEffect, useCallback } from 'react';
import { Trade, Exit } from '@/types/trade';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const useTrades = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchTrades = useCallback(async () => {
    if (!user) {
      setTrades([]);
      setLoading(false);
      return;
    }

    try {
      const { data: tradesData, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .order('created_at', { ascending: false });

      if (tradesError) throw tradesError;

      const { data: exitsData, error: exitsError } = await supabase
        .from('exits')
        .select('*');

      if (exitsError) throw exitsError;

      const tradesWithExits: Trade[] = (tradesData || []).map((trade) => {
        const tradeExits = (exitsData || [])
          .filter((exit) => exit.trade_id === trade.id)
          .map((exit) => ({
            id: exit.id,
            exitDate: exit.exit_date,
            exitPrice: Number(exit.exit_price),
            quantity: Number(exit.quantity),
            pnl: Number(exit.pnl),
          }));

        return {
          id: trade.id,
          symbol: trade.symbol,
          tradeType: trade.trade_type as 'LONG' | 'SHORT',
          entryDate: trade.entry_date,
          entryTime: trade.entry_time || undefined,
          entryPrice: Number(trade.entry_price),
          quantity: Number(trade.quantity),
          setupStopLoss: trade.setup_stop_loss ? Number(trade.setup_stop_loss) : undefined,
          currentStopLoss: trade.current_stop_loss ? Number(trade.current_stop_loss) : undefined,
          target: trade.target ? Number(trade.target) : undefined,
          targetRPT: trade.target_rpt ? Number(trade.target_rpt) : undefined,
          currentPrice: trade.current_price ? Number(trade.current_price) : undefined,
          notes: trade.notes || undefined,
          exits: tradeExits,
          status: trade.status as 'OPEN' | 'PARTIAL' | 'CLOSED',
          totalPnl: Number(trade.total_pnl),
          remainingQuantity: Number(trade.remaining_quantity),
          bookedProfit: Number(trade.booked_profit),
        };
      });

      setTrades(tradesWithExits);
    } catch (error: any) {
      toast.error('Failed to fetch trades');
      console.error('Fetch trades error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const addTrade = async (trade: Omit<Trade, 'id' | 'exits' | 'status' | 'totalPnl' | 'remainingQuantity' | 'bookedProfit'>) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('trades').insert({
        user_id: user.id,
        symbol: trade.symbol,
        trade_type: trade.tradeType,
        entry_date: trade.entryDate,
        entry_time: null,
        entry_price: trade.entryPrice,
        quantity: trade.quantity,
        setup_stop_loss: trade.setupStopLoss || null,
        current_stop_loss: trade.currentStopLoss || null,
        target: trade.target || null,
        target_rpt: trade.targetRPT || null,
        current_price: trade.currentPrice || null,
        notes: trade.notes || null,
        remaining_quantity: trade.quantity,
      });

      if (error) throw error;
      toast.success('Trade added successfully');
      fetchTrades();
    } catch (error: any) {
      toast.error('Failed to add trade');
      console.error('Add trade error:', error);
    }
  };

  const addExit = async (tradeId: string, exitData: Omit<Exit, 'id' | 'pnl'>) => {
    if (!user) return;

    const trade = trades.find((t) => t.id === tradeId);
    if (!trade) return;

    const pnl =
      trade.tradeType === 'LONG'
        ? (exitData.exitPrice - trade.entryPrice) * exitData.quantity
        : (trade.entryPrice - exitData.exitPrice) * exitData.quantity;

    try {
      const { error: exitError } = await supabase.from('exits').insert({
        trade_id: tradeId,
        exit_date: exitData.exitDate,
        exit_price: exitData.exitPrice,
        quantity: exitData.quantity,
        pnl: pnl,
      });

      if (exitError) throw exitError;

      const newRemainingQty = trade.remainingQuantity - exitData.quantity;
      const newBookedProfit = trade.bookedProfit + pnl;
      const newTotalPnl = trade.totalPnl + pnl;

      let newStatus: 'OPEN' | 'PARTIAL' | 'CLOSED' = 'OPEN';
      if (newRemainingQty === 0) newStatus = 'CLOSED';
      else if (trade.quantity - newRemainingQty > 0) newStatus = 'PARTIAL';

      const { error: updateError } = await supabase
        .from('trades')
        .update({
          remaining_quantity: newRemainingQty,
          booked_profit: newBookedProfit,
          total_pnl: newTotalPnl,
          status: newStatus,
        })
        .eq('id', tradeId);

      if (updateError) throw updateError;

      toast.success('Exit recorded successfully');
      fetchTrades();
    } catch (error: any) {
      toast.error('Failed to add exit');
      console.error('Add exit error:', error);
    }
  };

  const deleteTrade = async (tradeId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('trades').delete().eq('id', tradeId);
      if (error) throw error;
      toast.success('Trade deleted');
      fetchTrades();
    } catch (error: any) {
      toast.error('Failed to delete trade');
      console.error('Delete trade error:', error);
    }
  };

  const deleteExit = async (tradeId: string, exitId: string) => {
    if (!user) return;

    const trade = trades.find((t) => t.id === tradeId);
    if (!trade) return;

    const exitToDelete = trade.exits.find((e) => e.id === exitId);
    if (!exitToDelete) return;

    try {
      const { error: deleteError } = await supabase.from('exits').delete().eq('id', exitId);
      if (deleteError) throw deleteError;

      const remainingExits = trade.exits.filter((e) => e.id !== exitId);
      const totalExitedQty = remainingExits.reduce((sum, e) => sum + e.quantity, 0);
      const newRemainingQty = trade.quantity - totalExitedQty;
      const newBookedProfit = remainingExits.reduce((sum, e) => sum + e.pnl, 0);
      const newTotalPnl = newBookedProfit;

      let newStatus: 'OPEN' | 'PARTIAL' | 'CLOSED' = 'OPEN';
      if (newRemainingQty === 0) newStatus = 'CLOSED';
      else if (totalExitedQty > 0) newStatus = 'PARTIAL';

      const { error: updateError } = await supabase
        .from('trades')
        .update({
          remaining_quantity: newRemainingQty,
          booked_profit: newBookedProfit,
          total_pnl: newTotalPnl,
          status: newStatus,
        })
        .eq('id', tradeId);

      if (updateError) throw updateError;

      toast.success('Exit deleted');
      fetchTrades();
    } catch (error: any) {
      toast.error('Failed to delete exit');
      console.error('Delete exit error:', error);
    }
  };

const updateCurrentPrice = async (tradeId: string, currentPrice: number | null, silent = false) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('trades')
        .update({ current_price: currentPrice })
        .eq('id', tradeId);

      if (error) throw error;
      
      // Update local state immediately for live price updates
      setTrades(prev => prev.map(t => 
        t.id === tradeId ? { ...t, currentPrice: currentPrice ?? undefined } : t
      ));
    } catch (error: any) {
      if (!silent) {
        toast.error('Failed to update price');
      }
      console.error('Update price error:', error);
    }
  };

  const updateCurrentSL = async (tradeId: string, currentStopLoss: number | null) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('trades')
        .update({ current_stop_loss: currentStopLoss })
        .eq('id', tradeId);

      if (error) throw error;
      fetchTrades();
    } catch (error: any) {
      toast.error('Failed to update stop loss');
      console.error('Update SL error:', error);
    }
  };

  const getStats = () => {
    const totalTrades = trades.length;
    const openTrades = trades.filter((t) => t.status !== 'CLOSED').length;
    const closedTrades = trades.filter((t) => t.status === 'CLOSED').length;
    const totalPnl = trades.reduce((sum, t) => sum + t.totalPnl, 0);
    const winningTrades = trades.filter((t) => t.status === 'CLOSED' && t.totalPnl > 0).length;
    const losingTrades = trades.filter((t) => t.status === 'CLOSED' && t.totalPnl < 0).length;
    const winRate = closedTrades > 0 ? (winningTrades / closedTrades) * 100 : 0;

    const unrealizedPnl = trades.reduce((sum, t) => {
      if (t.currentPrice && t.remainingQuantity > 0) {
        const pnl = t.tradeType === 'LONG'
          ? (t.currentPrice - t.entryPrice) * t.remainingQuantity
          : (t.entryPrice - t.currentPrice) * t.remainingQuantity;
        return sum + pnl;
      }
      return sum;
    }, 0);

    const totalExposure = trades
      .filter((t) => t.status !== 'CLOSED')
      .reduce((sum, t) => sum + t.entryPrice * t.remainingQuantity, 0);

    const totalRisk = trades
      .filter((t) => t.status !== 'CLOSED')
      .reduce((sum, t) => {
        const sl = t.currentStopLoss ?? t.setupStopLoss;
        if (sl) {
          const risk = t.tradeType === 'LONG'
            ? (t.entryPrice - sl) * t.remainingQuantity
            : (sl - t.entryPrice) * t.remainingQuantity;
          return sum + Math.max(0, risk);
        }
        return sum;
      }, 0);

    return {
      totalTrades,
      openTrades,
      closedTrades,
      totalPnl,
      winningTrades,
      losingTrades,
      winRate,
      unrealizedPnl,
      totalExposure,
      totalRisk,
    };
  };

  return {
    trades,
    loading,
    addTrade,
    addExit,
    deleteTrade,
    deleteExit,
    updateCurrentPrice,
    updateCurrentSL,
    getStats,
  };
};
