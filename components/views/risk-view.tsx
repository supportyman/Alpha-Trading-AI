'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ShieldCheck,
  Calculator,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Loader2,
  Scale,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import type { JournalEntry } from '@/lib/types';
import { formatPrice } from '@/lib/use-live-market';
import { cn } from '@/lib/utils';

export function RiskView() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Position calculator state
  const [accountSize, setAccountSize] = useState(200000);
  const [riskPct, setRiskPct] = useState(2);
  const [entry, setEntry] = useState(118450);
  const [stop, setStop] = useState(117600);

  // Risk/Reward calculator state
  const [rrPortfolioSize, setRrPortfolioSize] = useState(1000);
  const [rrMargin, setRrMargin] = useState(10);
  const [rrLeverage, setRrLeverage] = useState(100);
  const [rrDirection, setRrDirection] = useState<'long' | 'short'>('long');
  const [rrEntryPrice, setRrEntryPrice] = useState(81000);
  const [rrExitPrice, setRrExitPrice] = useState(84000);
  const [rrStopPrice, setRrStopPrice] = useState(79500);

  const riskAmount = (accountSize * riskPct) / 100;
  const stopDistance = Math.abs(entry - stop);
  const positionSize = stopDistance > 0 ? riskAmount / stopDistance : 0;
  const positionValue = positionSize * entry;

  // Risk/Reward calculator derived values
  const rrIsLong = rrDirection === 'long';
  const rrEntryNum = Number(rrEntryPrice) || 0;
  const rrExitNum = Number(rrExitPrice) || 0;
  const rrStopNum = Number(rrStopPrice) || 0;
  const rrMarginNum = Number(rrMargin) || 0;
  const rrLevNum = Number(rrLeverage) || 0;
  const rrPortfolioNum = Number(rrPortfolioSize) || 0;

  // Notional position value = margin × leverage (e.g. $10 × 100x = $1000)
  const rrPositionValue = rrMarginNum * rrLevNum;
  // Position size in units = notional / entry price
  const rrPositionUnits = rrEntryNum > 0 ? rrPositionValue / rrEntryNum : 0;
  // Price distances
  const rrStopDistance = Math.abs(rrEntryNum - rrStopNum);
  const rrTargetDistance = Math.abs(rrExitNum - rrEntryNum);
  const rrStopPct = rrEntryNum > 0 ? (rrStopDistance / rrEntryNum) * 100 : 0;
  const rrTargetPct = rrEntryNum > 0 ? (rrTargetDistance / rrEntryNum) * 100 : 0;
  // Profit and Loss in actual dollars
  const rrProfit = rrPositionUnits * rrTargetDistance;
  const rrLoss = rrPositionUnits * rrStopDistance;
  // Return on margin (ROE) — how much you gain/lose relative to your margin
  const rrProfitRoe = rrMarginNum > 0 ? (rrProfit / rrMarginNum) * 100 : 0;
  const rrLossRoe = rrMarginNum > 0 ? (rrLoss / rrMarginNum) * 100 : 0;
  // What % of portfolio this margin represents
  const rrMarginOfPortfolio = rrPortfolioNum > 0 ? (rrMarginNum / rrPortfolioNum) * 100 : 0;
  // Risk/Reward ratio
  const rrRatio = rrLoss > 0 ? rrProfit / rrLoss : 0;
  // Is the trade valid (profit > 0 and direction makes sense)
  const rrValidLong = rrIsLong && rrExitNum > rrEntryNum && rrStopNum < rrEntryNum;
  const rrValidShort = !rrIsLong && rrExitNum < rrEntryNum && rrStopNum > rrEntryNum;
  const rrValid = rrValidLong || rrValidShort;

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .order('opened_at', { ascending: false });
    if (!error && data) setEntries(data as JournalEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const addEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      symbol: String(form.get('symbol')),
      direction: String(form.get('direction')),
      entry_price: Number(form.get('entry_price')),
      exit_price: Number(form.get('exit_price')) || null,
      stop_loss: Number(form.get('stop_loss')) || null,
      take_profit: Number(form.get('take_profit')) || null,
      position_size: Number(form.get('position_size')) || null,
      confidence: Number(form.get('confidence')) || null,
      outcome: String(form.get('outcome')),
      pnl: Number(form.get('pnl')) || null,
      notes: String(form.get('notes')) || null,
    };
    const { error } = await supabase.from('journal_entries').insert(payload);
    if (!error) {
      setShowForm(false);
      loadEntries();
    }
  };

  const deleteEntry = async (id: string) => {
    const { error } = await supabase.from('journal_entries').delete().eq('id', id);
    if (!error) loadEntries();
  };

  // Stats
  const wins = entries.filter((e) => e.outcome === 'win');
  const losses = entries.filter((e) => e.outcome === 'loss');
  const winRate = entries.length > 0 ? (wins.length / (wins.length + losses.length)) * 100 : 0;
  const totalPnl = entries.reduce((sum, e) => sum + (e.pnl || 0), 0);
  const maxDrawdown = 8.4;

  return (
    <div className="space-y-6">
      {/* Risk stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <RiskStat label="Daily Risk Limit" value="3%" sub="$6,000 max loss" tone="primary" />
        <RiskStat label="Max Drawdown" value={`${maxDrawdown}%`} sub="Limit: 15%" tone="warning" />
        <RiskStat label="Win Rate" value={`${winRate.toFixed(1)}%`} sub={`${wins.length}W / ${losses.length}L`} tone="success" />
        <RiskStat label="Total P&L" value={`$${totalPnl.toLocaleString()}`} sub="Realized" tone={totalPnl >= 0 ? 'success' : 'destructive'} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Position size calculator */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4 text-primary" />
              Position Size Calculator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Account Size ($)</Label>
                <Input
                  type="number"
                  value={accountSize}
                  onChange={(e) => setAccountSize(Number(e.target.value))}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Risk per Trade (%)</Label>
                <Input
                  type="number"
                  value={riskPct}
                  step="0.5"
                  onChange={(e) => setRiskPct(Number(e.target.value))}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Entry Price</Label>
                <Input
                  type="number"
                  value={entry}
                  onChange={(e) => setEntry(Number(e.target.value))}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Stop Loss Price</Label>
                <Input
                  type="number"
                  value={stop}
                  onChange={(e) => setStop(Number(e.target.value))}
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-4">
              <CalcRow label="Risk Amount" value={`$${riskAmount.toLocaleString()}`} />
              <CalcRow label="Stop Distance" value={`$${stopDistance.toFixed(2)} (${((stopDistance / entry) * 100).toFixed(2)}%)`} />
              <div className="my-2 border-t border-border" />
              <CalcRow label="Position Size" value={`${positionSize.toFixed(4)} units`} highlight />
              <CalcRow label="Position Value" value={`$${positionValue.toLocaleString()}`} highlight />
            </div>
          </CardContent>
        </Card>

        {/* Risk limits */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-accent" />
              Risk Management Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <RiskSetting label="Max Daily Loss" value="3% of account" />
            <RiskSetting label="Max Open Positions" value="5" />
            <RiskSetting label="Max Risk per Trade" value="2% of account" />
            <RiskSetting label="Max Portfolio Risk" value="8% total" />
            <RiskSetting label="Min Risk/Reward" value="1:2" />
            <RiskSetting label="Min Signal Confidence" value="80%" />
            <RiskSetting label="Trailing Stop Default" value="ATR-based" />
            <RiskSetting label="Max Weekly Drawdown" value="15%" />
          </CardContent>
        </Card>
      </div>

      {/* Risk/Reward Calculator */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4 text-accent" />
              Risk/Reward Calculator
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                setRrPortfolioSize(1000);
                setRrMargin(10);
                setRrLeverage(100);
                setRrDirection('long');
                setRrEntryPrice(81000);
                setRrExitPrice(84000);
                setRrStopPrice(79500);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Inputs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <Label className="text-xs">Portfolio Size ($)</Label>
              <Input
                type="number"
                value={rrPortfolioSize}
                onChange={(e) => setRrPortfolioSize(Number(e.target.value))}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Margin / Trade Amount ($)</Label>
              <Input
                type="number"
                value={rrMargin}
                step="any"
                onChange={(e) => setRrMargin(Number(e.target.value))}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Leverage (x)</Label>
              <Input
                type="number"
                value={rrLeverage}
                step="1"
                onChange={(e) => setRrLeverage(Number(e.target.value))}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Direction</Label>
              <Select value={rrDirection} onValueChange={(v) => setRrDirection(v as 'long' | 'short')}>
                <SelectTrigger className="mt-1 font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">LONG</SelectItem>
                  <SelectItem value="short">SHORT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Entry Price</Label>
              <Input
                type="number"
                value={rrEntryPrice}
                step="any"
                onChange={(e) => setRrEntryPrice(Number(e.target.value))}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Exit Price (Target)</Label>
              <Input
                type="number"
                value={rrExitPrice}
                step="any"
                onChange={(e) => setRrExitPrice(Number(e.target.value))}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Stop Loss Price</Label>
              <Input
                type="number"
                value={rrStopPrice}
                step="any"
                onChange={(e) => setRrStopPrice(Number(e.target.value))}
                className="mt-1 font-mono"
              />
            </div>
          </div>

          {/* Results */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Risk side */}
            <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <div className="mb-2 flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-destructive">Risk (Loss)</span>
              </div>
              <CalcRow label="Stop Distance" value={`${rrStopDistance.toFixed(2)} (${rrStopPct.toFixed(2)}%)`} />
              <CalcRow label="Max Loss" value={`${rrLoss.toLocaleString()}`} highlight />
              <CalcRow label="Loss on Margin (ROE)" value={`-${rrLossRoe.toFixed(2)}%`} />
              <CalcRow label="Loss of Portfolio" value={`-${((rrLoss / rrPortfolioSize) * 100).toFixed(2)}%`} />
            </div>

            {/* Reward side */}
            <div className="space-y-2 rounded-lg border border-success/20 bg-success/5 p-4">
              <div className="mb-2 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-success" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-success">Reward (Profit if Target Hit)</span>
              </div>
              <CalcRow label="Target Distance" value={`${rrTargetDistance.toFixed(2)} (${rrTargetPct.toFixed(2)}%)`} />
              <CalcRow label="Potential Profit" value={`${rrProfit.toLocaleString()}`} highlight />
              <CalcRow label="Profit on Margin (ROE)" value={`+${rrProfitRoe.toFixed(2)}%`} />
              <CalcRow label="Profit of Portfolio" value={`+${((rrProfit / rrPortfolioSize) * 100).toFixed(2)}%`} />
            </div>
          </div>

          {/* Position & margin details */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Position Details
              </div>
              <CalcRow label="Margin (Your Money)" value={`${rrMarginNum.toLocaleString()}`} highlight />
              <CalcRow label="Leverage" value={`${rrLevNum}x`} />
              <CalcRow label="Position Value (Notional)" value={`${rrPositionValue.toLocaleString()}`} highlight />
              <CalcRow label="Position Size" value={`${rrPositionUnits.toFixed(4)} units`} />
              <CalcRow label="Margin of Portfolio" value={`${rrMarginOfPortfolio.toFixed(2)}%`} />
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Trade Summary
              </div>
              <CalcRow label="Risk/Reward Ratio" value={rrRatio > 0 ? `1 : ${rrRatio.toFixed(2)}` : '—'} highlight />
              <CalcRow
                label="Margin (Cost)"
                value={`${rrMarginNum.toLocaleString()}`}
              />
              <CalcRow
                label="Potential Profit"
                value={`${rrProfit.toLocaleString()}`}
              />
              <CalcRow
                label="Potential Loss"
                value={`${rrLoss.toLocaleString()}`}
              />
              <CalcRow
                label="Total Position Value"
                value={`${rrPositionValue.toLocaleString()}`}
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">Setup Quality</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'px-2 py-0 text-[10px] font-bold',
                    rrValid && rrRatio >= 2 ? 'border-success/40 text-success' : '',
                    rrValid && rrRatio >= 1 && rrRatio < 2 ? 'border-warning/40 text-warning' : '',
                    !rrValid || rrRatio < 1 ? 'border-destructive/40 text-destructive' : '',
                  )}
                >
                  {!rrValid
                    ? 'Invalid Setup'
                    : rrRatio >= 3
                      ? 'Excellent'
                      : rrRatio >= 2
                        ? 'Good'
                        : rrRatio >= 1
                          ? 'Acceptable'
                          : 'Poor'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Validation warning */}
          {!rrValid && (
            <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              <span>
                {rrIsLong
                  ? 'For a LONG: exit price must be above entry, and stop loss must be below entry.'
                  : 'For a SHORT: exit price must be below entry, and stop loss must be above entry.'}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trade journal */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" />
            Trade Journal
          </CardTitle>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> {showForm ? 'Cancel' : 'New Entry'}
          </Button>
        </CardHeader>
        <CardContent>
          {showForm && (
            <form onSubmit={addEntry} className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 md:grid-cols-4">
              <FormField name="symbol" label="Symbol" placeholder="BTC/USDT" required />
              <FormField name="direction" label="Direction" placeholder="LONG" required />
              <FormField name="entry_price" label="Entry Price" type="number" placeholder="118450" required />
              <FormField name="exit_price" label="Exit Price" type="number" placeholder="121500" />
              <FormField name="stop_loss" label="Stop Loss" type="number" placeholder="117600" />
              <FormField name="take_profit" label="Take Profit" type="number" placeholder="121500" />
              <FormField name="position_size" label="Position Size ($)" type="number" placeholder="5000" />
              <FormField name="confidence" label="Confidence (%)" type="number" placeholder="87" />
              <FormField name="outcome" label="Outcome" placeholder="win" />
              <FormField name="pnl" label="P&L ($)" type="number" placeholder="1500" />
              <div className="col-span-2 md:col-span-2">
                <FormField name="notes" label="Notes" placeholder="Bullish BOS on 4H" />
              </div>
              <div className="col-span-2 flex items-end md:col-span-4">
                <Button type="submit" className="w-full">
                  Save Entry
                </Button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No journal entries yet. Add your first trade to start tracking.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-2 py-2 font-semibold">Symbol</th>
                    <th className="px-2 py-2 font-semibold">Dir</th>
                    <th className="px-2 py-2 text-right font-semibold">Entry</th>
                    <th className="px-2 py-2 text-right font-semibold">Exit</th>
                    <th className="px-2 py-2 text-right font-semibold">SL</th>
                    <th className="px-2 py-2 text-right font-semibold">Size</th>
                    <th className="px-2 py-2 text-right font-semibold">P&L</th>
                    <th className="px-2 py-2 font-semibold">Outcome</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b border-border/50 text-xs hover:bg-secondary/30">
                      <td className="px-2 py-2.5 font-medium">{e.symbol}</td>
                      <td className="px-2 py-2.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            'px-1.5 py-0 text-[10px]',
                            e.direction === 'LONG' ? 'border-success/40 text-success' : 'border-destructive/40 text-destructive'
                          )}
                        >
                          {e.direction}
                        </Badge>
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono">${formatPrice(e.entry_price)}</td>
                      <td className="px-2 py-2.5 text-right font-mono">{e.exit_price ? `$${formatPrice(e.exit_price)}` : '—'}</td>
                      <td className="px-2 py-2.5 text-right font-mono">{e.stop_loss ? `$${formatPrice(e.stop_loss)}` : '—'}</td>
                      <td className="px-2 py-2.5 text-right font-mono">{e.position_size ? `$${e.position_size.toLocaleString()}` : '—'}</td>
                      <td className={cn('px-2 py-2.5 text-right font-mono font-semibold', (e.pnl || 0) >= 0 ? 'text-success' : 'text-destructive')}>
                        {e.pnl != null ? `${e.pnl >= 0 ? '+' : ''}$${e.pnl.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-2 py-2.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            'px-1.5 py-0 text-[10px] capitalize',
                            e.outcome === 'win' && 'border-success/40 text-success',
                            e.outcome === 'loss' && 'border-destructive/40 text-destructive',
                            e.outcome === 'open' && 'text-accent'
                          )}
                        >
                          {e.outcome}
                        </Badge>
                      </td>
                      <td className="px-2 py-2.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteEntry(e.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RiskStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: 'primary' | 'warning' | 'success' | 'destructive';
}) {
  const colors = {
    primary: 'text-primary',
    warning: 'text-warning',
    success: 'text-success',
    destructive: 'text-destructive',
  };
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn('mt-1 text-xl font-bold', colors[tone])}>{value}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function CalcRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('font-mono text-sm', highlight ? 'font-bold text-primary' : 'text-foreground')}>
        {value}
      </span>
    </div>
  );
}

function RiskSetting({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
      <span className="text-xs font-medium">{label}</span>
      <span className="font-mono text-xs text-primary">{value}</span>
    </div>
  );
}

function FormField({
  name,
  label,
  type = 'text',
  placeholder,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        step={type === 'number' ? 'any' : undefined}
        className="mt-1 h-9 text-sm"
      />
    </div>
  );
}
