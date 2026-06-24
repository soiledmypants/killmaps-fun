import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Transaction } from "../lib/types";
import { usePlayer } from "../lib/player";
import { shortWallet, solscanTx } from "../lib/config";
import { Receipt } from "../components/icons";

const TYPE_LABEL: Record<string, { label: string; cls: string }> = {
  settlement: { label: "Ledger settlement", cls: "text-accent" },
  creator_reward: { label: "Creator payout", cls: "text-accent" },
  player_reward: { label: "Player payout", cls: "text-verify" },
};

export default function Transactions() {
  const { config } = usePlayer();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const cluster = config?.solscanCluster || "mainnet";

  useEffect(() => {
    api.transactions().then(setTxs).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-1">
        <Receipt size={22} className="text-accent" /> Transactions
      </h1>
      <p className="text-steel text-sm mb-6">Reward claims and treasury payouts. Rewards accrue to a ledger and are paid in batches — never per kill.</p>

      <div className="panel overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2.5 border-b border-base-500 label">
          <div className="col-span-3">Type</div>
          <div className="col-span-3">Wallet</div>
          <div className="col-span-2 text-right">Amount</div>
          <div className="col-span-2 text-right">Status</div>
          <div className="col-span-2 text-right">Tx</div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-steel text-sm">Loading…</div>
        ) : txs.length === 0 ? (
          <div className="p-12 text-center text-steel text-sm">No transactions yet. Reward claims will appear here.</div>
        ) : (
          txs.map((t) => {
            const meta = TYPE_LABEL[t.type] || { label: t.type, cls: "text-steel" };
            return (
              <div key={t.id} className="grid grid-cols-12 px-4 py-3 border-b border-base-600 items-center text-sm hover:bg-base-700/40">
                <div className={`col-span-3 font-semibold ${meta.cls}`}>{meta.label}</div>
                <div className="col-span-3 font-mono text-steel">{shortWallet(t.wallet, 5)}</div>
                <div className="col-span-2 text-right font-mono text-white">${typeof t.amount === "number" ? t.amount.toFixed(2) : t.amount}</div>
                <div className="col-span-2 text-right font-mono text-steel">{t.status}</div>
                <div className="col-span-2 text-right">
                  {t.onchain ? (
                    <a href={solscanTx(t.tx_hash, cluster)} target="_blank" rel="noreferrer" className="text-accent hover:underline font-mono text-xs">
                      {shortWallet(t.tx_hash, 4)}
                    </a>
                  ) : (
                    <span className="text-steel/50 text-xs">recorded</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
