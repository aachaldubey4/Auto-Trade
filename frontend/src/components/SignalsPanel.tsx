import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useSignals, useUpdateSignalStatus, type SignalsKind } from '../hooks/useSignals';
import type { SignalAction, TradingSignal } from '../types/api';
import SignalExecutionModal from './SignalExecutionModal';
import { api } from '../services/api';
import { useQueryClient } from '@tanstack/react-query';

const normaliseAction = (action: SignalAction): 'BUY' | 'SELL' => {
  if (action === 'BUY' || action === 'SELL') return action;
  return action === 0 ? 'BUY' : 'SELL';
};

const getTimeAgo = (timestamp: string) => {
  const now = new Date();
  const signalTime = new Date(timestamp);
  const diffMs = now.getTime() - signalTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const hours = Math.floor(diffMins / 60);
  return `${hours}h ${diffMins % 60}m ago`;
};

const getSignalStrengthColor = (strength: number) => {
  if (strength >= 80) return 'badge-success';
  if (strength >= 60) return 'badge-warning';
  return 'badge-error';
};

const calculateProfitPercent = (entry: number, target: number) => {
  return ((target - entry) / entry) * 100;
};

const calculateLossPercent = (entry: number, stopLoss: number) => {
  return ((entry - stopLoss) / entry) * 100;
};

const kindLabel: Record<SignalsKind, string> = {
  active: 'Active',
  overnight: 'Overnight',
  intraday: 'Intraday',
};

export default function SignalsPanel() {
  const [kind, setKind] = useState<SignalsKind>('active');
  const [executingSignal, setExecutingSignal] = useState<TradingSignal | null>(null);
  const [generating, setGenerating] = useState(false);
  const query = useSignals(kind);
  const updateStatus = useUpdateSignalStatus();
  const queryClient = useQueryClient();

  const onGenerate = async () => {
    setGenerating(true);
    try {
      const result = await api.signals.generate('Intraday');
      toast.success(`Generated ${result.count ?? 0} signal(s)`);
      queryClient.invalidateQueries({ queryKey: ['signals'] });
    } catch {
      toast.error('Signal generation failed — check backend logs');
    } finally {
      setGenerating(false);
    }
  };

  const signals = useMemo(() => query.data?.signals ?? [], [query.data?.signals]);

  const onUpdateStatus = async (signal: TradingSignal, status: 'expired') => {
    try {
      await updateStatus.mutateAsync({ signalId: signal.id, status });
      toast.success(`Signal ${signal.symbol} marked as ${status}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update signal status');
    }
  };

  return (
    <>
      <div className="card bg-base-200/50 backdrop-blur border border-base-300 shadow-2xl">
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-base-300 pb-4 mb-4">
            <div>
              <h2 className="card-title text-2xl font-black text-primary flex items-center gap-2">
                📊 Trading Signals
              </h2>
              <p className="text-xs opacity-60 mt-1">Generated intraday and overnight execution triggers.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Generate Signals button */}
              <button
                className={`btn btn-sm font-bold bg-gradient-to-r from-primary to-secondary hover:from-primary/95 hover:to-secondary/95 text-primary-content border-none shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 gap-1.5 rounded-xl px-4 ${generating ? 'loading' : ''}`}
                onClick={onGenerate}
                disabled={generating}
              >
                {!generating && <span>⚡</span>}
                <span>{generating ? 'Generating…' : 'Generate Signals'}</span>
              </button>

              {/* Spaced and styled Tab Controls */}
              <div role="tablist" className="flex items-center gap-1.5 p-1 bg-base-300/80 border border-base-200/60 rounded-xl shadow-inner">
                {(['active', 'overnight', 'intraday'] as const).map((k) => (
                  <button
                    key={k}
                    role="tab"
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-250 select-none ${kind === k
                        ? 'bg-primary text-primary-content shadow font-bold'
                        : 'text-base-content/70 hover:text-base-content hover:bg-base-200/50'
                      }`}
                    onClick={() => setKind(k)}
                    type="button"
                  >
                    {kindLabel[k]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-zebra table-xs sm:table-sm">
              <thead>
                <tr>
                  <th className="hidden sm:table-cell">Stock</th>
                  <th>Signal</th>
                  <th>Entry</th>
                  <th className="hidden md:table-cell">Target</th>
                  <th className="hidden md:table-cell">Stop Loss</th>
                  <th className="hidden lg:table-cell">Strength</th>
                  <th className="hidden sm:table-cell">Time</th>
                  <th className="hidden md:table-cell text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {query.isError ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="alert alert-error py-2 rounded-lg">
                        <span>Failed to load signals. Please check connection.</span>
                      </div>
                    </td>
                  </tr>
                ) : query.isLoading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx}>
                      <td className="hidden sm:table-cell">
                        <div className="skeleton h-4 w-24" />
                        <div className="skeleton h-3 w-16 mt-2 hidden md:block" />
                      </td>
                      <td>
                        <div className="skeleton h-6 w-16" />
                        <div className="skeleton h-3 w-12 mt-2 sm:hidden" />
                      </td>
                      <td>
                        <div className="skeleton h-4 w-20" />
                      </td>
                      <td className="hidden md:table-cell">
                        <div className="skeleton h-4 w-20" />
                        <div className="skeleton h-3 w-14 mt-2" />
                      </td>
                      <td className="hidden md:table-cell">
                        <div className="skeleton h-4 w-20" />
                        <div className="skeleton h-3 w-14 mt-2" />
                      </td>
                      <td className="hidden lg:table-cell">
                        <div className="skeleton h-5 w-16" />
                      </td>
                      <td className="hidden sm:table-cell">
                        <div className="skeleton h-3 w-16" />
                      </td>
                      <td className="hidden md:table-cell">
                        <div className="skeleton h-7 w-28 float-right" />
                      </td>
                    </tr>
                  ))
                ) : (
                  signals.map((signal) => {
                    const action = normaliseAction(signal.action);
                    const canUpdate = signal.status === 'active';
                    return (
                      <tr key={signal.id} className="hover:bg-base-200/40 transition-colors duration-150">
                        <td className="hidden sm:table-cell">
                          <div>
                            <div className="font-bold text-xs sm:text-sm">{signal.symbol}</div>
                            <div className="text-xs opacity-70 hidden md:block">
                              {signal.type === 0 ? 'Overnight' : signal.type === 1 ? 'Intraday' : signal.type}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div
                            className={`badge ${action === 'BUY' ? 'badge-success' : 'badge-error'} badge-sm sm:badge-md font-bold text-xs`}
                          >
                            {action}
                          </div>
                          <div className="text-xs sm:hidden mt-1 font-bold">{signal.symbol}</div>
                        </td>
                        <td>
                          <div className="font-semibold text-xs sm:text-sm">₹{signal.entryPrice.toFixed(2)}</div>
                        </td>
                        <td className="hidden md:table-cell">
                          <div>
                            <div className="font-semibold text-success text-xs sm:text-sm">
                              ₹{signal.targetPrice.toFixed(2)}
                            </div>
                            <div className="text-xs text-success font-medium">
                              +{calculateProfitPercent(signal.entryPrice, signal.targetPrice).toFixed(2)}%
                            </div>
                          </div>
                        </td>
                        <td className="hidden md:table-cell">
                          <div>
                            <div className="font-semibold text-error text-xs sm:text-sm">₹{signal.stopLoss.toFixed(2)}</div>
                            <div className="text-xs text-error font-medium">
                              -{calculateLossPercent(signal.entryPrice, signal.stopLoss).toFixed(2)}%
                            </div>
                          </div>
                        </td>
                        <td className="hidden lg:table-cell">
                          <div className={`badge badge-sm font-semibold ${getSignalStrengthColor(signal.signalStrength)}`}>
                            {signal.signalStrength}%
                          </div>
                        </td>
                        <td className="hidden sm:table-cell">
                          <div className="text-xs opacity-70">{getTimeAgo(signal.generatedAt)}</div>
                        </td>
                        <td className="hidden md:table-cell text-right pr-4">
                          <div className="flex gap-2 justify-end">
                            <button
                              className="btn btn-xs bg-success/15 hover:bg-success hover:text-success-content border border-success/30 hover:border-success text-success font-bold px-3 py-1 rounded-lg hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm"
                              type="button"
                              disabled={!canUpdate || updateStatus.isPending}
                              onClick={() => setExecutingSignal(signal)}
                            >
                              Execute
                            </button>
                            <button
                              className="btn btn-xs bg-base-300/40 hover:bg-neutral hover:text-neutral-content border border-base-300 hover:border-neutral text-base-content/80 font-bold px-3 py-1 rounded-lg hover:scale-105 active:scale-95 transition-all duration-200"
                              type="button"
                              disabled={!canUpdate || updateStatus.isPending}
                              onClick={() => onUpdateStatus(signal, 'expired')}
                            >
                              Expire
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="card-actions justify-end mt-4">
            <div className="text-xs opacity-60">
              {query.isLoading
                ? 'Loading…'
                : query.isError
                  ? 'Failed to load signals'
                  : `${signals.length} signal${signals.length !== 1 ? 's' : ''}`}
            </div>
          </div>
        </div>
      </div>
      {executingSignal ? (
        <SignalExecutionModal signal={executingSignal} onClose={() => setExecutingSignal(null)} />
      ) : null}
    </>
  );
}
