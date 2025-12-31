import { TrendingUp, TrendingDown, Activity, Target, PieChart, Wallet } from 'lucide-react';
import { useTrades } from '@/hooks/useTrades';
import { StatsCard } from '@/components/StatsCard';
import { AddTradeDialog } from '@/components/AddTradeDialog';
import { TradesTable } from '@/components/TradesTable';

const Index = () => {
  const { trades, addTrade, addExit, deleteTrade, deleteExit, getStats } = useTrades();
  const stats = getStats();

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
            <AddTradeDialog onAddTrade={addTrade} />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total P&L"
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
            title="Open Trades"
            value={stats.openTrades}
            icon={TrendingUp}
          />
          <StatsCard
            title="Closed Trades"
            value={stats.closedTrades}
            icon={PieChart}
            subtitle={`of ${stats.totalTrades} total`}
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
          />
        </div>
      </main>
    </div>
  );
};

export default Index;
