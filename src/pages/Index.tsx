import { TrendingUp, Activity, Target, PieChart, Wallet, BarChart3, LogOut, CheckCircle2, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { groupTradesBySymbol, computeGroupedMetrics } from '@/lib/groupTrades';
import type { TypeFilter } from '@/components/TradesTable';
import { toast } from 'sonner';

const KITE_TOKEN_KEY = 'kite_access_token';
const KITE_TOKEN_EXPIRY_KEY = 'kite_token_expiry';
const SYNC_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes between auto-syncs

function getStoredToken(): string | null {
  try {
    const token = localStorage.getItem(KITE_TOKEN_KEY);
    const expiry = localStorage.getItem(KITE_TOKEN_EXPIRY_KEY);
    if (!token || !expiry || Date.now() > parseInt(expiry)) {
      localStorage.removeItem(KITE_TOKEN_KEY);
      localStorage.removeItem(KITE_TOKEN_EXPIRY_KEY);
      return null;
    }
    return token;
  } catch { return null; }
}

function storeToken(token: string) {
  try {
    // Kite tokens expire at 6 AM IST (00:30 UTC) the following day
    const expiry = new Date();
    expiry.setUTCHours(0, 30, 0, 0);
    if (expiry.getTime() <= Date.now()) expiry.setDate(expiry.getDate() + 1);
    localStorage.setItem(KITE_TOKEN_KEY, token);
    localStorage.setItem(KITE_TOKEN_EXPIRY_KEY, expiry.getTime().toString());
  } catch {}
}

function clearStoredToken() {
  try {
    localStorage.removeItem(KITE_TOKEN_KEY);
    localStorage.removeItem(KITE_TOKEN_EXPIRY_KEY);
  } catch {}
}

function formatLastSync(date: Date): string {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

const Index = () => {
  const { trades, loading, addTrade, addExit, deleteTrade, deleteExit, updateCurrentPrice, editTrade, editExit, importKiteHoldings, importKiteOrders, importCSVTrades, clearAllTrades } = useTrades();
  const { signOut } = useAuth();

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

  const [typeFilter, setTypeFilter] = useState<TypeFilter>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('tradesTypeFilter');
      if (v === 'MANUAL' || v === 'IPO') return v;
    }
    return 'ALL';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('tradesTypeFilter', typeFilter);
  }, [typeFilter]);

  const counts = React.useMemo(() => ({
    ALL: trades.length,
    MANUAL: trades.filter((t) => t.tradeType !== 'IPO').length,
    IPO: trades.filter((t) => t.tradeType === 'IPO').length,
  }), [trades]);

  const filteredTrades = React.useMemo(() => trades.filter((t) => {
    if (typeFilter === 'IPO') return t.tradeType === 'IPO';
    if (typeFilter === 'MANUAL') return t.tradeType !== 'IPO';
    return true;
  }), [trades, typeFilter]);

  const groupedTrades = React.useMemo(() => groupTradesBySymbol(filteredTrades), [filteredTrades]);

  const stats = React.useMemo(() => {
    const groups = groupedTrades;
    const totalTrades = groups.length;
    const openTrades = groups.filter((g) => g.status !== 'CLOSED').length;
    const closedTrades = groups.filter((g) => g.status === 'CLOSED').length;
    const winningTrades = groups.filter((g) => g.status === 'CLOSED' && g.totalPnl > 0).length;
    const losingTrades = groups.filter((g) => g.status === 'CLOSED' && g.totalPnl < 0).length;
    const winRate = closedTrades > 0 ? (winningTrades / closedTrades) * 100 : 0;
    const totalPnl = filteredTrades.reduce((s, t) => s + t.totalPnl, 0);

    let unrealizedPnl = 0;
    let totalExposure = 0;
    for (const g of groups) {
      const m = computeGroupedMetrics(g);
      unrealizedPnl += m.unrealizedPnl;
      if (g.status !== 'CLOSED') totalExposure += g.entryPrice * g.remainingQuantity;
    }
    return { totalTrades, openTrades, closedTrades, totalPnl, winningTrades, losingTrades, winRate, unrealizedPnl, totalExposure };
  }, [groupedTrades, filteredTrades]);

  const handlePriceUpdate = useCallback((tradeId: string, price: number) => {
    updateCurrentPrice(tradeId, price, true);
  }, [updateCurrentPrice]);

  const { isRefreshing, lastRefresh, refreshNow } = useLivePrices({
    trades,
    onPriceUpdate: handlePriceUpdate,
    intervalMs: 300000,
    enabled: !loading && trades.length > 0,
  });

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);

  // Zerodha / Kite Connect state
  const [kiteToken, setKiteToken] = useState<string | null>(() => getStoredToken());
  const [kiteError, setKiteError] = useState<string | null>(null);
  const [kiteLoading, setKiteLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Refs so effects with empty dep arrays can read current values
  const kiteTokenRef = useRef(kiteToken);
  const lastSyncRef = useRef<Date | null>(null);
  const syncingRef = useRef(false);
  const importHoldingsRef = useRef(importKiteHoldings);
  const importOrdersRef = useRef(importKiteOrders);

  useEffect(() => { kiteTokenRef.current = kiteToken; }, [kiteToken]);
  useEffect(() => { importHoldingsRef.current = importKiteHoldings; }, [importKiteHoldings]);
  useEffect(() => { importOrdersRef.current = importKiteOrders; }, [importKiteOrders]);

  const syncWithZerodha = async (token: string, silent = true) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const [holdingsRes, ordersRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/functions/v1/kite-holdings?access_token=${token}`),
        fetch(`${SUPABASE_URL}/functions/v1/kite-auth?action=orders&access_token=${token}`),
      ]);

      const holdingsData = holdingsRes.ok ? await holdingsRes.json() : null;
      const ordersData = ordersRes.ok ? await ordersRes.json() : null;

      // Token expired = Kite explicitly returns a token error (not a timeout/server error)
      const tokenError = (d: any) => d?.error && /token/i.test(d.error);
      if (tokenError(holdingsData) || tokenError(ordersData) || (holdingsRes.status === 403 || ordersRes.status === 403)) {
        clearStoredToken();
        setKiteToken(null);
        kiteTokenRef.current = null;
        setKiteError('Zerodha session expired — please reconnect');
        return;
      }

      let imported = 0, exits = 0;

      if (holdingsData?.holdings?.length > 0) {
        console.log('[Zerodha sync] Holdings from API:', holdingsData.holdings.map((h: any) =>
          `${h.tradingsymbol}: qty=${h.quantity} t1=${h.t1_quantity} avg=₹${h.average_price}`
        ));
        const r = await importHoldingsRef.current(holdingsData.holdings);
        imported += r.imported;
      } else if (!holdingsRes.ok) {
        console.warn('[Zerodha sync] Holdings fetch failed (status', holdingsRes.status, ') — will retry next sync');
      }

      if (ordersData?.orders?.length > 0) {
        const r = await importOrdersRef.current(ordersData.orders);
        imported += r.imported;
        exits += r.exitsAdded ?? 0;
      }

      const now = new Date();
      lastSyncRef.current = now;
      setLastSync(now);
      setKiteError(null);

      if (!silent && (imported > 0 || exits > 0)) {
        const parts: string[] = [];
        if (imported > 0) parts.push(`${imported} trades`);
        if (exits > 0) parts.push(`${exits} exits`);
        toast.success(`Synced ${parts.join(' and ')} from Zerodha`);
      } else if (!silent) {
        toast.info('Already up to date');
      }
    } catch (err) {
      console.error('Zerodha sync failed:', err);
      if (!silent) toast.error('Failed to sync with Zerodha');
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  };

  // Auto-sync on mount if a valid token is stored
  useEffect(() => {
    const token = getStoredToken();
    if (token) syncWithZerodha(token, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-sync when the user switches back to this tab, throttled to every 30 min
  useEffect(() => {
    const handleFocus = () => {
      const token = kiteTokenRef.current;
      if (!token) return;
      const last = lastSyncRef.current;
      if (!last || Date.now() - last.getTime() > SYNC_COOLDOWN_MS) {
        syncWithZerodha(token, true);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Zerodha OAuth callback (request_token in URL after redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestToken = params.get('request_token');
    if (!requestToken || kiteTokenRef.current) return;

    setKiteLoading(true);
    window.history.replaceState({}, document.title, window.location.pathname);

    fetch(`${SUPABASE_URL}/functions/v1/kite-auth?action=token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_token: requestToken }),
    })
      .then(res => res.json())
      .then(async (data) => {
        if (data.access_token) {
          storeToken(data.access_token);
          setKiteToken(data.access_token);
          kiteTokenRef.current = data.access_token;
          await syncWithZerodha(data.access_token, false);
        } else {
          setKiteError(data.error || 'Failed to connect to Zerodha');
        }
      })
      .catch(() => setKiteError('Failed to connect to Zerodha'))
      .finally(() => setKiteLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKiteLogin = async () => {
    setKiteError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/kite-auth?action=login-url`);
      const data = await res.json();
      if (data.login_url) window.location.href = data.login_url;
    } catch {
      setKiteError('Failed to get Zerodha login URL');
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
        {/* Zerodha sync status bar */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          {kiteToken ? (
            <div className="flex items-center gap-2 text-sm">
              {syncing
                ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                : <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              }
              <span className="text-muted-foreground">
                {syncing ? 'Syncing with Zerodha...' : `Zerodha synced${lastSync ? ` · ${formatLastSync(lastSync)}` : ''}`}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {kiteError && <AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
              <Button onClick={handleKiteLogin} disabled={kiteLoading} variant="outline" size="sm">
                {kiteLoading ? 'Connecting...' : kiteError ? 'Reconnect Zerodha' : 'Connect Zerodha'}
              </Button>
              {kiteError && <span className="text-xs text-muted-foreground">{kiteError}</span>}
            </div>
          )}
          <KiteImportDialog onImportCSV={handleImportCSV} />
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              if (window.confirm('Delete ALL trades and exits? This cannot be undone.')) {
                clearAllTrades();
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Reset
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse text-muted-foreground">Loading trades...</div>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8 auto-rows-fr">
              <StatsCard title="Total Exposure" value={formatCurrency(stats.totalExposure)} icon={BarChart3} />
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
                trades={groupedTrades}
                typeFilter={typeFilter}
                setTypeFilter={setTypeFilter}
                counts={counts}
                onAddExit={addExit}
                onDeleteTrade={deleteTrade}
                onDeleteExit={deleteExit}
                onUpdateCurrentPrice={updateCurrentPrice}
                onEditTrade={editTrade}
                onEditExit={editExit}
              />
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Index;
