import { TrendingUp, TrendingDown, Activity, Target, PieChart, Wallet, AlertTriangle, BarChart3, LogOut, Download } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import React, { useState, useCallback } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { useLivePrices } from '@/hooks/useLivePrices';
import { StatsCard } from '@/components/StatsCard';
import { AddTradeDialog } from '@/components/AddTradeDialog';
import { TradesTable } from '@/components/TradesTable';
import { LivePriceIndicator } from '@/components/LivePriceIndicator';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { KiteImportDialog, ParsedCSVTrade } from '@/components/KiteImportDialog';

const Index = () => {
  const { trades, loading, addTrade, addExit, deleteTrade, deleteExit, updateCurrentPrice, updateCurrentSL, editTrade, editExit, getStats, importKiteHoldings, importKiteOrders, importCSVTrades } = useTrades();
  const { signOut, user } = useAuth();
  const stats = getStats();

  const handlePriceUpdate = useCallback((tradeId: string, price: number) => {
    updateCurrentPrice(tradeId, price, true);
  }, [updateCurrentPrice]);

  const { isRefreshing, lastRefresh, refreshNow } = useLivePrices({
    trades,
    onPriceUpdate: handlePriceUpdate,
    intervalMs: 300000, // Refresh every 5 minutes
    enabled: !loading && trades.length > 0,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Kite Connect integration state
  const [kiteToken, setKiteToken] = useState<string | null>(null);
  const [kiteError, setKiteError] = useState<string | null>(null);
  const [kiteLoading, setKiteLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  // Fetch and auto-import holdings
  const fetchAndSyncHoldings = React.useCallback(async (accessToken: string, showToast = true) => {
    setSyncing(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/kite-auth?action=holdings&access_token=${accessToken}`);
      const holdingsData = await res.json();
      
      if (holdingsData.holdings && holdingsData.holdings.length > 0) {
        const result = await importKiteHoldings(holdingsData.holdings);
        setLastSync(new Date());
        if (showToast && result.imported > 0) {
          // Toast is already shown in importKiteHoldings
        }
      }
    } catch (error) {
      console.error('Failed to sync holdings:', error);
      if (showToast) {
        setKiteError('Failed to sync holdings');
      }
    } finally {
      setSyncing(false);
    }
  }, [SUPABASE_URL, importKiteHoldings]);

  // Handle Kite login redirect - auto-import on successful login
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestToken = params.get('request_token');
    if (requestToken && !kiteToken) {
      setKiteLoading(true);
      // Clear the URL params
      window.history.replaceState({}, document.title, window.location.pathname);
      
      fetch(`${SUPABASE_URL}/functions/v1/kite-auth?action=token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_token: requestToken })
      })
        .then(res => res.json())
        .then(async (data) => {
          if (data.access_token) {
            setKiteToken(data.access_token);
            // Auto-import holdings immediately after login
            await fetchAndSyncHoldings(data.access_token);
          } else {
            setKiteError(data.error || 'Failed to get access token');
          }
        })
        .catch(() => setKiteError('Failed to get access token'))
        .finally(() => setKiteLoading(false));
    }
  }, [kiteToken, SUPABASE_URL, fetchAndSyncHoldings]);

  // Periodic background sync every 5 minutes when connected
  React.useEffect(() => {
    if (!kiteToken) return;

    const intervalId = setInterval(() => {
      fetchAndSyncHoldings(kiteToken, false); // Silent sync (no toast)
    }, SYNC_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [kiteToken, fetchAndSyncHoldings, SYNC_INTERVAL_MS]);

  const handleKiteLogin = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/kite-auth?action=login-url`);
      const data = await res.json();
      if (data.login_url) {
        window.location.href = data.login_url;
      }
    } catch {
      setKiteError('Failed to get login URL');
    }
  };

  const handleManualSync = async () => {
    if (!kiteToken) return;
    await fetchAndSyncHoldings(kiteToken);
  };

  const handleImportTodaysOrders = async () => {
    if (!kiteToken) return;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/kite-auth?action=orders&access_token=${kiteToken}`);
    const data = await res.json();
    if (data.orders) {
      await importKiteOrders(data.orders);
    }
  };

  const handleImportCSV = async (csvTrades: ParsedCSVTrade[]) => {
    return await importCSVTrades(csvTrades);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center glow-primary">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Trade Journal</h1>
                <p className="text-xs text-muted-foreground">Track your trades & exits</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <LivePriceIndicator
                isRefreshing={isRefreshing}
                lastRefresh={lastRefresh}
                onRefresh={refreshNow}
              />
              <AddTradeDialog onAddTrade={addTrade} />

              {/* Theme toggle (hidden on small screens) */}
              <div className="hidden md:block">
                <ThemeToggle />
              </div>

              <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button> 
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 flex-1">
        {/* Kite Connect Button and Sync Status */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Button onClick={handleKiteLogin} disabled={kiteLoading || !!kiteToken} variant="outline">
            {kiteLoading ? 'Connecting...' : kiteToken ? 'Connected to Kite' : 'Connect Kite Account'}
          </Button>
          {kiteToken && (
            <Button onClick={handleManualSync} disabled={syncing} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              {syncing ? 'Syncing...' : 'Sync Holdings'}
            </Button>
          )}
          <KiteImportDialog
            kiteToken={kiteToken}
            onImportTodaysOrders={handleImportTodaysOrders}
            onImportCSV={handleImportCSV}
          />
          {kiteToken && lastSync && (
            <span className="text-xs text-muted-foreground">
              Last sync: {lastSync.toLocaleTimeString()}
            </span>
          )}
          {kiteError && <span className="text-destructive text-sm">{kiteError}</span>}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse text-muted-foreground">Loading trades...</div>
          </div>
        ) : (
          <>
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8 auto-rows-fr">
          <StatsCard
            title="Total Exposure"
            value={formatCurrency(stats.totalExposure)}
            icon={BarChart3}
          />
          <StatsCard
            title="Total Risk"
            value={formatCurrency(stats.totalRisk)}
            icon={AlertTriangle}
            trend={stats.totalRisk > 0 ? 'down' : stats.totalRisk < 0 ? 'up' : 'neutral'}
          />
          <StatsCard
            title="Unrealized P&L"
            value={formatCurrency(stats.unrealizedPnl)}
            icon={TrendingUp}
            trend={stats.unrealizedPnl > 0 ? 'up' : stats.unrealizedPnl < 0 ? 'down' : 'neutral'}
          />
          <StatsCard
            title="Booked P&L"
            value={formatCurrency(stats.totalPnl)}
            icon={Wallet}
            trend={stats.totalPnl > 0 ? 'up' : stats.totalPnl < 0 ? 'down' : 'neutral'}
          />
          <StatsCard
            title="Win Rate"
            value={`${stats.winRate.toFixed(1)}%`}
            icon={Target}
            trend={stats.winRate >= 50 ? 'up' : stats.winRate > 0 ? 'down' : 'neutral'}
            subtitle={`${stats.winningTrades}W / ${stats.losingTrades}L`}
          />
          <StatsCard
            title="Open / Total"
            value={`${stats.openTrades} / ${stats.totalTrades}`}
            icon={PieChart}
            subtitle={`${stats.closedTrades} closed`}
          />
        </div>

        {/* Trades Table */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Your Trades</h2>
          <TradesTable
            trades={trades}
            onAddExit={addExit}
            onDeleteTrade={deleteTrade}
            onDeleteExit={deleteExit}
            onUpdateCurrentPrice={updateCurrentPrice}
            onUpdateCurrentSL={updateCurrentSL}
            onEditTrade={editTrade}
            onEditExit={editExit}
          />
        </div>
          </>
        )}
      </main>

      <Footer paypalEmail="mukulag@gmail.com" />
    </div>
  );
};

export default Index;
