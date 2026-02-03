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
          tradeType: trade.trade_type as 'LONG' | 'SHORT' | 'IPO',
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

  const editTrade = async (tradeId: string, updates: {
    symbol: string;
    tradeType: 'LONG' | 'SHORT';
    entryDate: string;
    entryPrice: number;
    quantity: number;
    currentPrice: number | null;
    setupStopLoss: number | null;
    currentStopLoss: number | null;
    target: number | null;
    targetRPT: number | null;
    notes: string | null;
  }) => {
    if (!user) return;

    const trade = trades.find((t) => t.id === tradeId);
    if (!trade) return;

    try {
      // Calculate new remaining quantity based on exits
      const totalExited = trade.exits.reduce((sum, e) => sum + e.quantity, 0);
      const newRemainingQty = updates.quantity - totalExited;

      if (newRemainingQty < 0) {
        toast.error('Quantity cannot be less than already exited shares');
        return;
      }

      // Recalculate booked profit with new entry price
      const newBookedProfit = trade.exits.reduce((sum, exit) => {
        const pnl = updates.tradeType === 'LONG'
          ? (exit.exitPrice - updates.entryPrice) * exit.quantity
          : (updates.entryPrice - exit.exitPrice) * exit.quantity;
        return sum + pnl;
      }, 0);

      let newStatus: 'OPEN' | 'PARTIAL' | 'CLOSED' = 'OPEN';
      if (newRemainingQty === 0) newStatus = 'CLOSED';
      else if (totalExited > 0) newStatus = 'PARTIAL';

      const { error } = await supabase
        .from('trades')
        .update({
          symbol: updates.symbol,
          trade_type: updates.tradeType,
          entry_date: updates.entryDate,
          entry_price: updates.entryPrice,
          quantity: updates.quantity,
          current_price: updates.currentPrice,
          setup_stop_loss: updates.setupStopLoss,
          current_stop_loss: updates.currentStopLoss,
          target: updates.target,
          target_rpt: updates.targetRPT,
          notes: updates.notes,
          remaining_quantity: newRemainingQty,
          booked_profit: newBookedProfit,
          total_pnl: newBookedProfit,
          status: newStatus,
        })
        .eq('id', tradeId);

      if (error) throw error;

      // Also update exit PnL values if entry price changed
      if (updates.entryPrice !== trade.entryPrice) {
        for (const exit of trade.exits) {
          const newPnl = updates.tradeType === 'LONG'
            ? (exit.exitPrice - updates.entryPrice) * exit.quantity
            : (updates.entryPrice - exit.exitPrice) * exit.quantity;

          await supabase
            .from('exits')
            .update({ pnl: newPnl })
            .eq('id', exit.id);
        }
      }

      toast.success('Trade updated successfully');
      fetchTrades();
    } catch (error: any) {
      toast.error('Failed to update trade');
      console.error('Edit trade error:', error);
    }
  };

  const editExit = async (tradeId: string, exitId: string, updates: {
    exitDate: string;
    exitPrice: number;
    quantity: number;
  }) => {
    if (!user) return;

    const trade = trades.find((t) => t.id === tradeId);
    if (!trade) return;

    const existingExit = trade.exits.find((e) => e.id === exitId);
    if (!existingExit) return;

    try {
      // Calculate new PnL
      const newPnl = trade.tradeType === 'LONG'
        ? (updates.exitPrice - trade.entryPrice) * updates.quantity
        : (trade.entryPrice - updates.exitPrice) * updates.quantity;

      const { error: exitError } = await supabase
        .from('exits')
        .update({
          exit_date: updates.exitDate,
          exit_price: updates.exitPrice,
          quantity: updates.quantity,
          pnl: newPnl,
        })
        .eq('id', exitId);

      if (exitError) throw exitError;

      // Recalculate trade totals
      const otherExits = trade.exits.filter((e) => e.id !== exitId);
      const totalExitedQty = otherExits.reduce((sum, e) => sum + e.quantity, 0) + updates.quantity;
      const newRemainingQty = trade.quantity - totalExitedQty;
      const newBookedProfit = otherExits.reduce((sum, e) => sum + e.pnl, 0) + newPnl;

      let newStatus: 'OPEN' | 'PARTIAL' | 'CLOSED' = 'OPEN';
      if (newRemainingQty === 0) newStatus = 'CLOSED';
      else if (totalExitedQty > 0) newStatus = 'PARTIAL';

      const { error: updateError } = await supabase
        .from('trades')
        .update({
          remaining_quantity: newRemainingQty,
          booked_profit: newBookedProfit,
          total_pnl: newBookedProfit,
          status: newStatus,
        })
        .eq('id', tradeId);

      if (updateError) throw updateError;

      toast.success('Exit updated successfully');
      fetchTrades();
    } catch (error: any) {
      toast.error('Failed to update exit');
      console.error('Edit exit error:', error);
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
        const sl = t.currentStopLoss; // Use current SL only
        // If there's a current SL defined, compute risk; otherwise treat as risk-free (0)
        if (sl !== undefined && sl !== null) {
          const risk = t.tradeType === 'LONG'
            ? (t.entryPrice - sl) * t.remainingQuantity
            : (sl - t.entryPrice) * t.remainingQuantity;
          // Allow negative risk values (do not clamp to 0)
          return sum + risk;
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

  const importKiteHoldings = async (holdings: any[]) => {
    if (!user) return { imported: 0, skipped: 0 };

    let imported = 0;
    let skipped = 0;

    for (const holding of holdings) {
      try {
        // Check if trade already exists with same symbol and average price
        const { data: existing } = await supabase
          .from('trades')
          .select('id')
          .eq('user_id', user.id)
          .eq('symbol', holding.tradingsymbol)
          .eq('entry_price', holding.average_price)
          .limit(1);

        if (existing && existing.length > 0) {
          skipped++;
          continue;
        }

        // Use today's date as entry date since holdings don't have purchase date
        const entryDate = new Date().toISOString().split('T')[0];

        const { error } = await supabase.from('trades').insert({
          user_id: user.id,
          symbol: holding.tradingsymbol,
          trade_type: 'LONG',
          entry_date: entryDate,
          entry_price: holding.average_price,
          quantity: holding.quantity,
          remaining_quantity: holding.quantity,
          current_price: holding.last_price,
          setup_stop_loss: holding.prev_day_low || null,
          current_stop_loss: holding.prev_day_low || null,
          notes: `Imported from Kite Holdings - ISIN: ${holding.isin || 'N/A'}`,
        });

        if (error) throw error;
        imported++;
      } catch (error) {
        console.error('Failed to import holding:', holding, error);
        skipped++;
      }
    }

    if (imported > 0) {
      toast.success(`Imported ${imported} trades from Kite`);
      fetchTrades();
    }

    return { imported, skipped };
  };

  const importKiteOrders = async (orders: any[]) => {
    if (!user) return { imported: 0, skipped: 0 };

    let imported = 0;
    let skipped = 0;

    // Group orders by symbol to calculate net position
    for (const order of orders) {
      // Only import completed orders
      if (order.status !== 'COMPLETE') {
        skipped++;
        continue;
      }

      try {
        // Check if trade already exists with same symbol, price and date
        const orderDate = order.order_timestamp?.split(' ')[0] || new Date().toISOString().split('T')[0];
        
        const { data: existing } = await supabase
          .from('trades')
          .select('id')
          .eq('user_id', user.id)
          .eq('symbol', order.tradingsymbol)
          .eq('entry_price', order.average_price)
          .eq('entry_date', orderDate)
          .limit(1);

        if (existing && existing.length > 0) {
          skipped++;
          continue;
        }

        const isBuy = order.transaction_type === 'BUY';

        const { error } = await supabase.from('trades').insert({
          user_id: user.id,
          symbol: order.tradingsymbol,
          trade_type: isBuy ? 'LONG' : 'SHORT',
          entry_date: orderDate,
          entry_price: order.average_price,
          quantity: order.filled_quantity || order.quantity,
          remaining_quantity: order.filled_quantity || order.quantity,
          current_price: order.average_price,
          notes: `Imported from Kite - Order ID: ${order.order_id}`,
        });

        if (error) throw error;
        imported++;
      } catch (error) {
        console.error('Failed to import order:', order, error);
        skipped++;
      }
    }

    if (imported > 0) {
      toast.success(`Imported ${imported} orders from Kite`);
      fetchTrades();
    }

    return { imported, skipped };
  };

  const importCSVTrades = async (trades: Array<{
    symbol: string;
    tradeType: 'LONG' | 'SHORT' | 'IPO';
    entryDate: string;
    entryPrice: number;
    quantity: number;
    exits?: Array<{
      exitDate: string;
      exitPrice: number;
      quantity: number;
    }>;
    notes?: string;
  }>) => {
    if (!user) return { imported: 0, skipped: 0 };

    let imported = 0;
    let skipped = 0;
    
    // Group trades by entry date to batch fetch daily lows
    const tradesByDate = new Map<string, typeof trades>();
    for (const trade of trades) {
      const dateKey = trade.entryDate;
      if (!tradesByDate.has(dateKey)) {
        tradesByDate.set(dateKey, []);
      }
      tradesByDate.get(dateKey)!.push(trade);
    }

    // Fetch daily lows for each date
    const dailyLowsMap = new Map<string, number | null>(); // key: symbol_date

    console.log('Fetching daily lows for trades grouped by date:', Array.from(tradesByDate.keys()));

    for (const [entryDate, dateTrades] of tradesByDate) {
      const symbolsForDate = [...new Set(dateTrades.map(t => t.symbol))];
      
      try {
        const { data: dailyData, error: dailyError } = await supabase.functions.invoke('fetch-stock-price', {
          body: { symbols: symbolsForDate, date: entryDate },
        });

        if (dailyError) {
          console.error(`Error fetching daily lows for ${entryDate}:`, dailyError);
        } else if (dailyData?.quotes && Array.isArray(dailyData.quotes)) {
          console.log(`Received quotes for ${entryDate}:`, dailyData.quotes);
          dailyData.quotes.forEach((quote: any) => {
            let low = quote.low;
            if (low === null || low === undefined) {
              if (quote.lows && Array.isArray(quote.lows) && quote.lows.length > 0) {
                const filteredLows = quote.lows.filter((v: number) => v !== null && v !== undefined);
                if (filteredLows.length > 0) {
                  low = Math.min(...filteredLows);
                }
              }
            }
            const key = `${quote.symbol}_${entryDate}`;
            console.log(`Setting daily low for ${key}:`, low);
            dailyLowsMap.set(key, low !== undefined ? low : null);
          });
        } else {
          console.warn(`No valid quotes data received for ${entryDate}:`, dailyData);
        }
      } catch (error) {
        console.error(`Failed to fetch daily lows for ${entryDate}:`, error);
      }
    }

    console.log('Daily lows map:', Array.from(dailyLowsMap.entries()));

    console.log('Starting CSV import. Total trades to import:', trades.length);
    console.log('IPO trades to import:', trades.filter(t => t.tradeType === 'IPO').length);
    console.log('All trades:', JSON.stringify(trades.filter(t => t.tradeType === 'IPO'), null, 2));

    for (const trade of trades) {
      try {
        let finalTrade = trade;
        
        // For IPO trades, fetch the listing date and allotment price from Chittorgarh
        if (trade.tradeType === 'IPO') {
          console.log(`Fetching IPO listing data for ${trade.symbol}...`);
          try {
            const currentYear = new Date().getFullYear();
            const { data: ipoData, error: ipoError } = await supabase.functions.invoke('fetch-ipo-data', {
              body: { symbols: [trade.symbol], year: currentYear },
            });

            if (!ipoError && ipoData?.ipos && Array.isArray(ipoData.ipos) && ipoData.ipos.length > 0) {
              const ipoInfo = ipoData.ipos[0];
              
              if (ipoInfo.listingDate && ipoInfo.allotmentPrice) {
                console.log(`IPO ${trade.symbol}: Listing date=${ipoInfo.listingDate}, Allotment price=${ipoInfo.allotmentPrice}`);
                
                // Update the trade with IPO listing date and allotment price
                finalTrade = {
                  ...trade,
                  entryDate: ipoInfo.listingDate,
                  entryPrice: ipoInfo.allotmentPrice,
                };
              } else {
                console.warn(`Incomplete IPO data for ${trade.symbol}:`, ipoInfo);
              }
            } else {
              console.warn(`No IPO data found for ${trade.symbol}`, ipoData);
            }
          } catch (ipoFetchError) {
            console.warn(`Failed to fetch IPO data for ${trade.symbol}:`, ipoFetchError);
            // Continue with the original data if fetch fails
          }
        }

        // Check for duplicate
        const { data: existing } = await supabase
          .from('trades')
          .select('id')
          .eq('user_id', user.id)
          .eq('symbol', finalTrade.symbol)
          .eq('entry_price', finalTrade.entryPrice)
          .eq('entry_date', finalTrade.entryDate)
          .limit(1);

        if (existing && existing.length > 0) {
          skipped++;
          continue;
        }

        // Calculate total exit quantity
        const totalExitQty = (finalTrade.exits || []).reduce((sum, exit) => sum + exit.quantity, 0);
        const remainingQty = finalTrade.quantity - totalExitQty;
        
        // Calculate booked profit and status
        let bookedProfit = 0;
        let totalPnl = 0;
        let status: 'OPEN' | 'PARTIAL' | 'CLOSED' = 'OPEN';
        
        if ((finalTrade.exits || []).length > 0) {
          for (const exit of finalTrade.exits!) {
            const pnl = (exit.exitPrice - finalTrade.entryPrice) * exit.quantity;
            bookedProfit += pnl;
            totalPnl += pnl;
          }
          
          if (remainingQty === 0) {
            status = 'CLOSED';
          } else if (remainingQty < finalTrade.quantity) {
            status = 'PARTIAL';
          }
        }

        // Get daily low for this symbol on the entry date
        const lowKey = `${finalTrade.symbol}_${finalTrade.entryDate}`;
        let setupSL = dailyLowsMap.get(lowKey);
        if (setupSL === undefined) setupSL = null;
        console.log(`Inserting trade ${finalTrade.symbol} (${finalTrade.entryDate}) with setup SL:`, setupSL);

        const { data: insertedTrade, error: insertError } = await supabase.from('trades').insert({
          user_id: user.id,
          symbol: finalTrade.symbol,
          trade_type: finalTrade.tradeType,
          entry_date: finalTrade.entryDate,
          entry_price: finalTrade.entryPrice,
          quantity: finalTrade.quantity,
          remaining_quantity: remainingQty,
          booked_profit: bookedProfit,
          total_pnl: totalPnl,
          status: status,
          setup_stop_loss: setupSL,
          notes: finalTrade.notes || 'Imported from CSV',
        }).select('id');

        if (insertError) {
          console.error('Insert error for trade:', finalTrade.symbol, insertError);
          console.error('Trade data being inserted:', {
            user_id: user.id,
            symbol: finalTrade.symbol,
            trade_type: finalTrade.tradeType,
            entry_date: finalTrade.entryDate,
            entry_price: finalTrade.entryPrice,
            quantity: finalTrade.quantity,
            remaining_quantity: remainingQty,
            booked_profit: bookedProfit,
            total_pnl: totalPnl,
            status: status,
            setup_stop_loss: setupSL,
            notes: finalTrade.notes || 'Imported from CSV',
          });
          throw insertError;
        }
        if (!insertedTrade || insertedTrade.length === 0) throw new Error('Failed to insert trade');

        const tradeId = insertedTrade[0].id;

        // Insert exits if any
        if ((finalTrade.exits || []).length > 0) {
          const exitsToInsert = (finalTrade.exits || []).map(exit => {
            const exitPnl = (exit.exitPrice - finalTrade.entryPrice) * exit.quantity;
            return {
              trade_id: tradeId,
              exit_date: exit.exitDate,
              exit_price: exit.exitPrice,
              quantity: exit.quantity,
              pnl: exitPnl,
            };
          });

          const { error: exitsError } = await supabase
            .from('exits')
            .insert(exitsToInsert);

          if (exitsError) {
            console.error('Failed to insert exits:', exitsError);
            // Don't fail the whole import, just skip the exits
          }
        }

        imported++;
      } catch (error) {
        console.error('Failed to import trade:', trade, error);
        skipped++;
      }
    }

    if (imported > 0) {
      fetchTrades();
    }

    return { imported, skipped };
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
    editTrade,
    editExit,
    getStats,
    importKiteHoldings,
    importKiteOrders,
    importCSVTrades,
    refetch: fetchTrades,
  };
};
