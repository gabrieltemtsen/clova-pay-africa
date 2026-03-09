"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function DocsIntroduction() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">
                Overview
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight">ClovaPay Africa</h1>

            <p className="text-xl text-gray-400 leading-relaxed mb-8">
                ClovaPay Africa is a crypto-to-fiat offramp API. You send stablecoins — we deliver Nigerian Naira to any bank account automatically.
            </p>

            <p className="text-gray-300 leading-relaxed mb-10">
                The API is built for developers and AI agents. Every protected endpoint is gated via the <strong className="text-white">x402 protocol</strong> (Thirdweb), meaning your agent can discover the price, attach a micropayment proof, and call the API — with no dashboard signup or manual key rotation. Internal/admin calls use the <code className="text-blue-300 bg-white/5 px-1 rounded">OWNER_API_KEY</code> header bypass.
            </p>

            {/* What you can do */}
            <div className="my-10">
                <div className="p-6 rounded-2xl border border-white/10 glassmorphism hover:border-blue-500/30 transition-colors max-w-lg">
                    <h3 className="text-lg font-bold text-white mb-2">Offramp stablecoins</h3>
                    <p className="text-gray-400 text-sm mb-4">Get a quote, create an order, send crypto to the deposit address. Naira hits the bank account automatically once the deposit is confirmed on-chain.</p>
                    <Link href="/docs/quickstart" className="text-blue-400 text-sm font-medium hover:text-blue-300">Quickstart guide →</Link>
                </div>
            </div>

            {/* How it works */}
            <h2 className="text-2xl font-bold mt-12 mb-6">How an offramp works</h2>
            <ol className="space-y-6 mb-10">
                {[
                    {
                        n: "1",
                        title: "POST /v1/quotes",
                        desc: "Pass the asset (cUSD_CELO, USDC_BASE, or USDCX_STACKS), amount, and destination currency (NGN). Get back the exchange rate, fee breakdown, and a quote that's valid for 5 minutes."
                    },
                    {
                        n: "2",
                        title: "POST /v1/orders",
                        desc: "Submit recipient bank details (account number, bank code, account name). We create a Paycrest order and return a deposit address unique to this transaction."
                    },
                    {
                        n: "3",
                        title: "Send crypto to depositAddress",
                        desc: "Transfer exactly the quoted amount to the returned deposit address. Our on-chain verifier checks the transaction on Celo, Base, or Stacks."
                    },
                    {
                        n: "4",
                        title: "NGN lands in bank account",
                        desc: "Once confirmed, Paycrest processes the NGN transfer. A webhook fires to POST /v1/webhooks/paycrest when the order is fulfilled or fails."
                    }
                ].map((step) => (
                    <li key={step.n} className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-blue-400 text-sm font-bold">{step.n}</span>
                        </div>
                        <div>
                            <code className="text-blue-300 text-sm font-mono">{step.title}</code>
                            <p className="text-gray-400 text-sm mt-1 leading-relaxed">{step.desc}</p>
                        </div>
                    </li>
                ))}
            </ol>

            {/* Supported assets */}
            <h2 className="text-2xl font-bold mt-12 mb-4">Supported assets (Phase 1)</h2>
            <div className="overflow-x-auto mb-10">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/10 text-gray-400">
                            <th className="text-left py-3 pr-6 font-medium">Asset key</th>
                            <th className="text-left py-3 pr-6 font-medium">Token</th>
                            <th className="text-left py-3 pr-6 font-medium">Network</th>
                            <th className="text-left py-3 font-medium">Deposit mechanism</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        <tr>
                            <td className="py-3 pr-6"><code className="text-blue-300 bg-white/5 px-1 rounded">cUSD_CELO</code></td>
                            <td className="py-3 pr-6 text-gray-300">cUSD</td>
                            <td className="py-3 pr-6 text-gray-300">Celo</td>
                            <td className="py-3 text-gray-300">Paycrest deposit address</td>
                        </tr>
                        <tr>
                            <td className="py-3 pr-6"><code className="text-blue-300 bg-white/5 px-1 rounded">USDC_BASE</code></td>
                            <td className="py-3 pr-6 text-gray-300">USDC</td>
                            <td className="py-3 pr-6 text-gray-300">Base</td>
                            <td className="py-3 text-gray-300">Paycrest deposit address</td>
                        </tr>
                        <tr>
                            <td className="py-3 pr-6"><code className="text-blue-300 bg-white/5 px-1 rounded">USDCX_STACKS</code></td>
                            <td className="py-3 pr-6 text-gray-300">USDCx</td>
                            <td className="py-3 pr-6 text-gray-300">Stacks</td>
                            <td className="py-3 text-gray-300">Clarity contract (<code className="text-xs text-gray-400">clova-deposit.clar</code>), include <code className="text-xs text-gray-400">orderId</code> as memo</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Fees */}
            <div className="p-5 rounded-xl bg-blue-900/20 border-l-4 border-blue-500 mb-6">
                <h4 className="font-bold text-blue-400 mb-2">Fee structure</h4>
                <ul className="text-sm text-blue-100/70 space-y-1">
                    <li>• FX spread: 3% margin over market rate (locked into the quote)</li>
                    <li>• Platform fee: 150 bps (1.5%) applied to the gross NGN amount</li>
                    <li>• Both fees are visible in every <code className="text-blue-300">/v1/quotes</code> response before you commit</li>
                </ul>
            </div>

            {/* Order expiry */}
            <div className="p-5 rounded-xl bg-amber-900/20 border-l-4 border-amber-500">
                <h4 className="font-bold text-amber-400 mb-2">Order expiry</h4>
                <p className="text-sm text-amber-100/70">
                    Orders expire after 30 minutes with no deposit. Expired orders are automatically marked <code className="text-amber-300">expired</code> by the background expiry worker. Rates are locked for 5 minutes from the time of quoting.
                </p>
            </div>
        </motion.div>
    );
}
