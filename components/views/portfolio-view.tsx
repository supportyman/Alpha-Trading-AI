'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Wallet, PieChart, Plus, Pencil, Trash2, X, Check, Loader2,
  RefreshCw, AlertTriangle, LogIn, LogOut, Lock, Mail, KeyRound,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLiveMarket, formatPrice } from '@/lib/use-live-market';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--warning))',
  'hsl(var(--success))',
  'hsl(200 80% 55%)',
  'hsl(330 70% 55%)',
  'hsl(270 60% 60%)',
  'hsl(160 60% 45%)',
];

interface DbHolding {
  id: string;
  symbol: string;
  name: string;
  amount: number;
  cost_basis: number;
  added_at: string;
}

interface HoldingForm {
  symbol: string;
  name: string;
  amount: string;
  cost_basis: string;
}

const EMPTY_FORM: HoldingForm = { symbol: '', name: '', amount: '', cost_basis: '' };

const KNOWN_NAMES: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', BNB: 'BNB',
  XRP: 'Ripple', ADA: 'Cardano', AVAX: 'Avalanche', DOGE: 'Dogecoin',
  DOT: 'Polkadot', LINK: 'Chainlink', MATIC: 'Polygon', UNI: 'Uniswap',
  ATOM: 'Cosmos', LTC: 'Litecoin', USDT: 'Tether', USDC: 'USD Coin',
};

// ─── Auth Modal ────────────────────────────────────────────────────────────────
function AuthModal({ onClose }: { onClose?: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setSuccess(null);
    if (!email.trim() || !password) { setErr('Email and password are required.'); return; }
    if (password.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    setBusy(true);
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) {
        if (error.message.toLowerCase().includes('already')) {
          setErr('An account with this email already exists. Sign in instead.');
        } else {
          setErr(error.message);
        }
      } else {
        setSuccess('Account created — you are now signed in.');
        onClose?.();
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setErr('Invalid email or password.');
      } else {
        onClose?.();
      }
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-7 shadow-2xl">
        {/* Lock icon header */}
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 ring-2 ring-primary/30">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-base font-bold">Portfolio is private</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {mode === 'signin'
              ? 'Sign in to view and manage your holdings.'
              : 'Create an account to start tracking your portfolio.'}
          </p>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Email address"
              className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Password (min 6 characters)"
              className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </div>

          {err && <p className="text-xs text-destructive">{err}</p>}
          {success && <p className="text-xs text-success">{success}</p>}

          <Button className="w-full" onClick={submit} disabled={busy}>
            {busy ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Please wait…</>
            ) : mode === 'signin' ? (
              <><LogIn className="mr-2 h-4 w-4" /> Sign In</>
            ) : (
              <><Check className="mr-2 h-4 w-4" /> Create Account</>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setErr(null); }}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main View ─────────────────────────────────────────────────────────────────
export function PortfolioView() {
  const { user, loading: authLoading } = useAuth();
  const coins = useLiveMarket(5000);
  const [holdings, setHoldings] = useState<DbHolding[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<HoldingForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const loadHoldings = useCallback(async () => {
    if (!user) { setHoldings([]); return; }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('portfolio_holdings')
      .select('*')
      .order('added_at', { ascending: true });
    if (err) {
      setError('Failed to load portfolio. Please try again.');
    } else {
      setHoldings(data ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadHoldings(); }, [loadHoldings]);

  const enriched = useMemo(() => {
    return holdings.map((h, i) => {
      const coin = coins.find((c) => c.symbol.startsWith(h.symbol.toUpperCase() + '/'));
      const price = coin?.price ?? (h.symbol.toUpperCase() === 'USDT' || h.symbol.toUpperCase() === 'USDC' ? 1 : 0);
      const value = h.amount * price;
      const pnl = value - h.cost_basis;
      const pnlPct = h.cost_basis > 0 ? (pnl / h.cost_basis) * 100 : 0;
      const color = COLORS[i % COLORS.length];
      return { ...h, price, value, pnl, pnlPct, color };
    });
  }, [holdings, coins]);

  const totalValue  = enriched.reduce((s, h) => s + h.value, 0);
  const totalCost   = enriched.reduce((s, h) => s + h.cost_basis, 0);
  const totalPnl    = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (h: DbHolding) => {
    setEditId(h.id);
    setForm({ symbol: h.symbol, name: h.name, amount: String(h.amount), cost_basis: String(h.cost_basis) });
    setFormError(null);
    setShowModal(true);
  };

  const handleSymbolChange = (val: string) => {
    const sym = val.toUpperCase().replace(/[^A-Z]/g, '');
    const knownName = KNOWN_NAMES[sym] ?? '';
    setForm((f) => ({ ...f, symbol: sym, name: f.name || knownName }));
  };

  const saveHolding = async () => {
    setFormError(null);
    const sym = form.symbol.trim().toUpperCase();
    if (!sym) { setFormError('Symbol is required.'); return; }
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) { setFormError('Amount must be a positive number.'); return; }
    const cost = parseFloat(form.cost_basis);
    if (isNaN(cost) || cost < 0) { setFormError('Cost basis must be 0 or more.'); return; }

    setSaving(true);
    const payload = { symbol: sym, name: form.name.trim() || (KNOWN_NAMES[sym] ?? sym), amount: amt, cost_basis: cost };

    if (editId) {
      const { error: err } = await supabase.from('portfolio_holdings').update(payload).eq('id', editId);
      if (err) { setFormError('Failed to update holding.'); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('portfolio_holdings').insert(payload);
      if (err) { setFormError('Failed to add holding.'); setSaving(false); return; }
    }

    setSaving(false);
    setShowModal(false);
    await loadHoldings();
  };

  const deleteHolding = async (id: string) => {
    await supabase.from('portfolio_holdings').delete().eq('id', id);
    await loadHoldings();
  };

  const signOut = () => supabase.auth.signOut();

  // Show auth gate if not signed in (and auth check is done)
  if (!authLoading && !user) {
    return <AuthModal />;
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          label="Total Value"
          value={loading || authLoading ? '…' : `$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        />
        <SummaryCard
          label="Total P&L"
          value={loading || authLoading ? '…' : `${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          tone={totalPnl >= 0 ? 'success' : 'destructive'}
        />
        <SummaryCard
          label="Return"
          value={loading || authLoading ? '…' : `${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}%`}
          tone={totalPnlPct >= 0 ? 'success' : 'destructive'}
        />
        <SummaryCard
          label="Holdings"
          value={loading || authLoading ? '…' : String(enriched.length)}
          badge={
            <Badge variant="outline" className="text-[10px] font-normal border-success/40 text-success">
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Live
            </Badge>
          }
        />
      </div>

      {/* Signed-in as banner + sign out */}
      {user && (
        <div className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/20 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
              {user.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <span className="text-xs text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{user.email}</span>
            </span>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <Button variant="ghost" size="sm" className="ml-auto h-7 px-2" onClick={loadHoldings}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {(loading || authLoading) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card><CardContent className="p-6"><div className="h-40 animate-pulse rounded-lg bg-secondary/50" /></CardContent></Card>
          <Card className="lg:col-span-2"><CardContent className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-secondary/50" />)}
          </CardContent></Card>
        </div>
      )}

      {!loading && !authLoading && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Allocation donut */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <PieChart className="h-4 w-4 text-primary" />
                Allocation
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              {enriched.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No holdings yet</div>
              ) : (
                <>
                  <AllocationDonut holdings={enriched} total={totalValue} />
                  <div className="mt-4 w-full space-y-2">
                    {enriched.map((h) => (
                      <div key={h.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: h.color }} />
                          <span className="font-medium">{h.symbol}</span>
                        </div>
                        <span className="text-muted-foreground">
                          {totalValue > 0 ? ((h.value / totalValue) * 100).toFixed(1) : '0.0'}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Holdings table */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4 text-accent" />
                Holdings
              </CardTitle>
              <Button size="sm" variant="outline" onClick={openAdd}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add
              </Button>
            </CardHeader>
            <CardContent className="px-2">
              {enriched.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Wallet className="mb-3 h-10 w-10 opacity-20" />
                  <p className="text-sm text-muted-foreground">No holdings yet.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={openAdd}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add your first holding
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-12 gap-2 border-b border-border px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span className="col-span-3">Asset</span>
                    <span className="col-span-2 text-right">Amount</span>
                    <span className="col-span-2 text-right">Live Price</span>
                    <span className="col-span-2 text-right">Value</span>
                    <span className="col-span-2 text-right">P&L</span>
                    <span className="col-span-1" />
                  </div>
                  {enriched.map((h) => (
                    <div
                      key={h.id}
                      className="group grid grid-cols-12 items-center gap-2 border-b border-border/50 px-3 py-3 text-sm transition-colors hover:bg-secondary/30"
                    >
                      <div className="col-span-3 flex items-center gap-2">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                          style={{ background: h.color + '30', color: h.color }}
                        >
                          {h.symbol.slice(0, 3)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold">{h.symbol}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{h.name}</p>
                        </div>
                      </div>
                      <span className="col-span-2 text-right font-mono text-xs">
                        {h.amount % 1 === 0 ? h.amount.toLocaleString() : h.amount}
                      </span>
                      <span className="col-span-2 text-right font-mono text-xs text-muted-foreground">
                        {h.price > 0 ? `$${formatPrice(h.price)}` : <span className="text-warning text-[10px]">loading…</span>}
                      </span>
                      <span className="col-span-2 text-right font-mono text-xs font-medium">
                        ${h.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                      <span className={cn(
                        'col-span-2 text-right font-mono text-xs font-medium',
                        h.pnl >= 0 ? 'text-success' : 'text-destructive'
                      )}>
                        {h.pnl >= 0 ? '+' : ''}${Math.abs(h.pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        <span className="ml-0.5 text-[9px] opacity-70">
                          ({h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(1)}%)
                        </span>
                      </span>
                      <div className="col-span-1 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button onClick={() => openEdit(h)} className="rounded p-1 text-muted-foreground hover:text-primary" title="Edit">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={() => deleteHolding(h.id)} className="rounded p-1 text-muted-foreground hover:text-destructive" title="Remove">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add / Edit Holding Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-bold">{editId ? 'Edit Holding' : 'Add Holding'}</h3>
              <button onClick={() => setShowModal(false)} className="rounded p-1 hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <FormField label="Symbol (e.g. BTC, ETH, SOL)">
                <input
                  value={form.symbol}
                  onChange={(e) => handleSymbolChange(e.target.value)}
                  placeholder="BTC"
                  maxLength={10}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm uppercase outline-none placeholder:normal-case placeholder:text-muted-foreground focus:border-primary"
                />
              </FormField>
              <FormField label="Name (optional)">
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Bitcoin"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                />
              </FormField>
              <FormField label="Amount (how many coins you hold)">
                <input
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="1.5"
                  type="number"
                  min="0"
                  step="any"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                />
              </FormField>
              <FormField label="Cost Basis (total USD you paid)">
                <input
                  value={form.cost_basis}
                  onChange={(e) => setForm((f) => ({ ...f, cost_basis: e.target.value }))}
                  placeholder="50000"
                  type="number"
                  min="0"
                  step="any"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                />
              </FormField>
              {formError && <p className="text-xs text-destructive">{formError}</p>}
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button className="flex-1" onClick={saveHolding} disabled={saving}>
                  {saving
                    ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving…</>
                    : <><Check className="mr-1.5 h-3.5 w-3.5" /> {editId ? 'Update' : 'Add'}</>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone, badge }: {
  label: string; value: string; tone?: 'success' | 'destructive'; badge?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="mt-1 flex items-center gap-2">
          <p className={cn('text-xl font-bold', tone === 'success' ? 'text-success' : tone === 'destructive' ? 'text-destructive' : '')}>
            {value}
          </p>
          {badge}
        </div>
      </CardContent>
    </Card>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function AllocationDonut({ holdings, total }: {
  holdings: { id: string; symbol: string; value: number; color: string }[];
  total: number;
}) {
  const radius = 70;
  const stroke = 22;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90">
      <circle cx="90" cy="90" r={radius} fill="none" stroke="hsl(var(--secondary))" strokeWidth={stroke} />
      {holdings.map((h) => {
        const pct = total > 0 ? h.value / total : 0;
        const dash = pct * circ;
        const seg = (
          <circle key={h.id} cx="90" cy="90" r={radius} fill="none"
            stroke={h.color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset}
          />
        );
        offset += dash;
        return seg;
      })}
      <text x="90" y="86" textAnchor="middle" transform="rotate(90 90 90)" fill="hsl(var(--muted-foreground))" fontSize="10">Total</text>
      <text x="90" y="100" textAnchor="middle" transform="rotate(90 90 90)" fill="hsl(var(--foreground))" fontSize="14" fontWeight="700">
        ${(total / 1000).toFixed(0)}K
      </text>
    </svg>
  );
}
