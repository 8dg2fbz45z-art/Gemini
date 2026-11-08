import React, { useState } from 'react';
import { X, Building2, PlusCircle, Check } from 'lucide-react';

export default function FirmWatchlistModal({
  isOpen,
  onClose,
  lawFirms = [],
  onToggleWatchFirm,
  onAddCustomFirm,
  onSelectFirmFilter,
}) {
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [vaultRank, setVaultRank] = useState('');
  const [amLawRevenueRank, setAmLawRevenueRank] = useState('');
  const [dealVolumeTier, setDealVolumeTier] = useState('Tier 1 — Corporate & M&A');

  if (!isOpen) return null;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim() || !shortName.trim()) return;
    await onAddCustomFirm({
      name: name.trim(),
      shortName: shortName.trim(),
      vaultRank: vaultRank ? Number(vaultRank) : null,
      amLawRevenueRank: amLawRevenueRank ? Number(amLawRevenueRank) : null,
      dealVolumeTier,
    });
    setName('');
    setShortName('');
    setVaultRank('');
    setAmLawRevenueRank('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-parchment-50 dark:bg-ink-950 border border-stone-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-crimson-400" />
            <div>
              <h2 className="font-serif text-lg font-bold">
                Leading US Law Firms Watchlist (Vault vs. Am Law Revenue vs. Deal Volume)
              </h2>
              <p className="text-xs text-slate-300">
                Treats Vault prestige rankings, Am Law gross revenue rankings, and league-table deal volume as distinct institutional measures.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-ink-900">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-slate-800 bg-parchment-100 dark:bg-ink-950 font-mono text-[11px] uppercase text-slate-500">
                  <th className="py-3 px-4">Watched</th>
                  <th className="py-3 px-4">Law Firm</th>
                  <th className="py-3 px-4">Vault Prestige</th>
                  <th className="py-3 px-4">AmLaw Revenue</th>
                  <th className="py-3 px-4">Deal / Case Volume Profile</th>
                  <th className="py-3 px-4 text-right">Mentions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-slate-800">
                {lawFirms.map((firm) => (
                  <tr
                    key={firm.id}
                    className="hover:bg-parchment-50/70 dark:hover:bg-ink-950/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <button
                        onClick={() => onToggleWatchFirm(firm.id, !firm.isWatched)}
                        className={`w-5 h-5 rounded flex items-center justify-center border ${
                          firm.isWatched
                            ? 'bg-crimson-700 border-crimson-700 text-white'
                            : 'border-stone-300 dark:border-slate-700'
                        }`}
                      >
                        {firm.isWatched && <Check className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => {
                          onSelectFirmFilter(firm.id);
                          onClose();
                        }}
                        className="font-serif font-bold text-sm text-slate-900 dark:text-white hover:text-crimson-700 text-left"
                      >
                        {firm.name}
                      </button>
                      <div className="text-[11px] text-slate-500">
                        {firm.coreStrengths?.join(' • ')}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {firm.vaultRank ? `#${firm.vaultRank}` : '—'}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {firm.amLawRevenueRank ? `#${firm.amLawRevenueRank}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {firm.dealVolumeTier}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-crimson-700 dark:text-crimson-400">
                      {firm.mentionCount || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Custom Law Firm Form */}
          <form
            onSubmit={handleAdd}
            className="p-4 rounded-xl bg-white dark:bg-ink-900 border border-stone-200 dark:border-slate-800 space-y-3"
          >
            <h3 className="font-serif font-bold text-sm text-slate-900 dark:text-white">
              Add Custom Law Firm to Watchlist
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              <input
                type="text"
                placeholder="Full Firm Name (e.g., Debevoise & Plimpton LLP)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="lg:col-span-2 px-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-slate-700 bg-parchment-50 dark:bg-ink-950"
              />
              <input
                type="text"
                placeholder="Short Name (e.g., Debevoise)"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-slate-700 bg-parchment-50 dark:bg-ink-950"
              />
              <input
                type="number"
                placeholder="Vault Rank #"
                value={vaultRank}
                onChange={(e) => setVaultRank(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-slate-700 bg-parchment-50 dark:bg-ink-950"
              />
              <input
                type="number"
                placeholder="AmLaw Rev Rank #"
                value={amLawRevenueRank}
                onChange={(e) => setAmLawRevenueRank(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-slate-700 bg-parchment-50 dark:bg-ink-950"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-crimson-700 text-white hover:bg-crimson-800"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add Firm to Watchlist</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
