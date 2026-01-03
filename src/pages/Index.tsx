import { TrendingUp, TrendingDown, Activity, Target, PieChart, Wallet, AlertTriangle, BarChart3, LogOut } from 'lucide-react';
import { useTrades } from '@/hooks/useTrades';
import { useLivePrices } from '@/hooks/useLivePrices';
import { StatsCard } from '@/components/StatsCard';
import { AddTradeDialog } from '@/components/AddTradeDialog';
import { TradesTable } from '@/components/TradesTable';
import { LivePriceIndicator } from '@/components/LivePriceIndicator';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useCallback } from 'react';

const Index = () => {
  const { trades, loading, addTrade, addExit, deleteTrade, deleteExit, updateCurrentPrice, updateCurrentSL, editTrade, editExit, getStats } = useTrades();
  const { signOut, user } = useAuth();
  const stats = getStats();

  const handlePriceUpdate = useCallback((tradeId: string, price: number) => {
    updateCurrentPrice(tradeId, price, true);
  }, [updateCurrentPrice]);

  const { isRefreshing, lastRefresh, refreshNow } = useLivePrices({
    trades,
    onPriceUpdate: handlePriceUpdate,
    intervalMs: 60000, // Refresh every minute
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

  return (
    <div className="min-h-screen bg-background">
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
              <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse text-muted-foreground">Loading trades...</div>
          </div>
        ) : (
          <>
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatsCard
            title="Total Exposure"
            value={formatCurrency(stats.totalExposure)}
            icon={BarChart3}
          />
          <StatsCard
            title="Total Risk"
            value={formatCurrency(stats.totalRisk)}
            icon={AlertTriangle}
            trend={stats.totalRisk > 0 ? 'down' : 'neutral'}
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
    </div>
  );
};

export default Index;
