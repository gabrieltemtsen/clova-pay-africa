"use client";

import { motion } from "framer-motion";

export default function DocsQuickstart() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">
                Getting Started
            </div>

            <h1 className="text-4xl font-extrabold mb-6 tracking-tight">Quickstart</h1>

            <p className="text-lg text-gray-400 leading-relaxed mb-10">
                Convert USDC on Base to NGN in a Nigerian bank account in four API calls.
            </p>

            {/* Auth */}
            <h2 className="text-2xl font-bold mt-10 mb-3">Authentication</h2>
            <p className="text-gray-300 mb-4 text-sm leading-relaxed">
                There are two ways to access protected endpoints:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="p-5 rounded-xl border border-blue-500/20 bg-blue-500/5">
                    <h3 className="font-bold text-blue-400 mb-2 text-sm">Option 1 — API Key</h3>
                    <p className="text-xs text-gray-400 leading-relaxed mb-3">
                        Contact <a href="https://gabe-dev.vercel.app" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">gabedev</a> to request an API key. Pass it via the <code className="text-blue-300 bg-white/5 px-1 rounded">x-api-key</code> header.
                    </p>
                    <pre className="text-xs font-mono text-gray-300 bg-black/40 p-3 rounded-lg overflow-x-auto">{`curl ... -H "x-api-key: YOUR_KEY"`}</pre>
                </div>
                <div className="p-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                    <h3 className="font-bold text-emerald-400 mb-2 text-sm">Option 2 — x402 Micropayment</h3>
                    <p className="text-xs text-gray-400 leading-relaxed mb-3">
                        Pay per-call using the x402 protocol. Perfect for AI agents — no signup, attach a payment proof in the <code className="text-emerald-300 bg-white/5 px-1 rounded">x-payment</code> header.
                    </p>
                    <pre className="text-xs font-mono text-gray-300 bg-black/40 p-3 rounded-lg overflow-x-auto">{`curl ... -H "x-payment: PROOF"`}</pre>
                </div>
            </div>
            <div className="bg-[#0d0d0d] p-4 rounded-xl border border-white/10 mb-8 overflow-x-auto">
                <pre className="text-sm font-mono text-gray-300 leading-relaxed">
                    {`# Health check — no auth required\ncurl https://clova-pay-africa-production.up.railway.app/v1/health`}
                </pre>
            </div>

            {/* Step 1 */}
            <h2 className="text-2xl font-bold mt-10 mb-3">Step 1 — Get a quote</h2>
            <p className="text-gray-300 mb-4 text-sm leading-relaxed">
                Quotes are valid for 5 minutes. The response includes the live NGN rate, fee breakdown, and what the recipient will actually receive.
            </p>
            <div className="bg-[#0d0d0d] p-4 rounded-xl border border-white/10 mb-4 overflow-x-auto">
                <pre className="text-sm font-mono text-gray-300 leading-relaxed">
                    {`curl -X POST https://clova-pay-africa-production.up.railway.app/v1/quotes \\
  -H "x-api-key: YOUR_OWNER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "asset": "USDC_BASE",
    "amountCrypto": "100",
    "destinationCurrency": "NGN"
  }'`}
                </pre>
            </div>
            <div className="bg-[#0d0d0d] p-4 rounded-xl border border-white/10 mb-8 overflow-x-auto">
                <pre className="text-sm font-mono leading-relaxed">
                    <code>
                        <span className="text-gray-500">// Response</span>{"\n"}
                        {"{"}{"\n"}
                        {"  "}<span className="text-blue-300">&quot;quoteId&quot;</span>: <span className="text-green-300">&quot;q_550e8400...&quot;</span>,{"\n"}
                        {"  "}<span className="text-blue-300">&quot;asset&quot;</span>: <span className="text-green-300">&quot;USDC_BASE&quot;</span>,{"\n"}
                        {"  "}<span className="text-blue-300">&quot;amountCrypto&quot;</span>: <span className="text-green-300">&quot;100&quot;</span>,{"\n"}
                        {"  "}<span className="text-blue-300">&quot;rate&quot;</span>: <span className="text-orange-300">&quot;1503.50&quot;</span>,{"\n"}
                        {"  "}<span className="text-blue-300">&quot;feeBps&quot;</span>: <span className="text-orange-300">150</span>,{"\n"}
                        {"  "}<span className="text-blue-300">&quot;feeNgn&quot;</span>: <span className="text-green-300">&quot;2255.25&quot;</span>,{"\n"}
                        {"  "}<span className="text-blue-300">&quot;receiveNgn&quot;</span>: <span className="text-green-300">&quot;148094.75&quot;</span>,{"\n"}
                        {"  "}<span className="text-blue-300">&quot;expiresAt&quot;</span>: <span className="text-orange-300">1709812800000</span>{"\n"}
                        {"}"}
                    </code>
                </pre>
            </div>

            {/* Step 2 */}
            <h2 className="text-2xl font-bold mt-10 mb-3">Step 2 — Create an order</h2>
            <p className="text-gray-300 mb-4 text-sm leading-relaxed">
                Submit the recipient&apos;s Nigerian bank details. We call Paycrest and return a unique <code className="text-blue-300 bg-white/5 px-1 rounded">depositAddress</code> for this order.
                Use <code className="text-blue-300 bg-white/5 px-1 rounded">GET /v1/banks</code> to look up supported bank codes.
            </p>
            <div className="bg-[#0d0d0d] p-4 rounded-xl border border-white/10 mb-4 overflow-x-auto">
                <pre className="text-sm font-mono text-gray-300 leading-relaxed">
                    {`curl -X POST https://clova-pay-africa-production.up.railway.app/v1/orders \\
  -H "x-api-key: YOUR_OWNER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "asset": "USDC_BASE",
    "amountCrypto": "100",
    "recipient": {
      "accountName": "John Doe",
      "accountNumber": "0123456789",
      "bankCode": "058"
    },
    "returnAddress": "0xYourRefundWallet"
  }'`}
                </pre>
            </div>
            <div className="bg-[#0d0d0d] p-4 rounded-xl border border-white/10 mb-8 overflow-x-auto">
                <pre className="text-sm font-mono leading-relaxed">
                    <code>
                        <span className="text-gray-500">// Response</span>{"\n"}
                        {"{"}{"\n"}
                        {"  "}<span className="text-blue-300">&quot;orderId&quot;</span>: <span className="text-green-300">&quot;ord_abc123...&quot;</span>,{"\n"}
                        {"  "}<span className="text-blue-300">&quot;depositAddress&quot;</span>: <span className="text-green-300">&quot;0xPaycrestDepositAddr...&quot;</span>,{"\n"}
                        {"  "}<span className="text-blue-300">&quot;asset&quot;</span>: <span className="text-green-300">&quot;USDC_BASE&quot;</span>,{"\n"}
                        {"  "}<span className="text-blue-300">&quot;status&quot;</span>: <span className="text-green-300">&quot;awaiting_deposit&quot;</span>,{"\n"}
                        {"  "}<span className="text-blue-300">&quot;receiveNgn&quot;</span>: <span className="text-green-300">&quot;148094.75&quot;</span>,{"\n"}
                        {"  "}<span className="text-blue-300">&quot;expiresAt&quot;</span>: <span className="text-orange-300">1709814600000</span>{"\n"}
                        {"}"}
                    </code>
                </pre>
            </div>

            {/* Step 3 */}
            <h2 className="text-2xl font-bold mt-10 mb-3">Step 3 — Send crypto to depositAddress</h2>
            <p className="text-gray-300 mb-4 text-sm leading-relaxed">
                Transfer <strong className="text-white">exactly 100 USDC</strong> on Base to the <code className="text-blue-300 bg-white/5 px-1 rounded">depositAddress</code> returned in the order response.
                Paycrest detects the deposit and kicks off the NGN transfer automatically.
                The order expires if no deposit arrives within 30 minutes.
            </p>

            {/* Stacks note */}
            <div className="p-5 rounded-xl bg-indigo-900/20 border-l-4 border-indigo-500 mb-8">
                <h4 className="font-bold text-indigo-400 mb-2 text-sm">USDCx on Stacks?</h4>
                <p className="text-sm text-indigo-100/70 leading-relaxed">
                    For <code className="text-indigo-300">USDCX_STACKS</code> orders, <code className="text-indigo-300">depositAddress</code> is the Clova Clarity contract principal.
                    Call <code className="text-indigo-300">deposit(token, amount, memo)</code> on the contract where <code className="text-indigo-300">memo</code> is your <code className="text-indigo-300">orderId</code> encoded as a buffer. This is how our watcher matches the deposit to your order.
                </p>
            </div>

            {/* Step 4 */}
            <h2 className="text-2xl font-bold mt-10 mb-3">Step 4 — Poll or use webhooks</h2>
            <p className="text-gray-300 mb-4 text-sm leading-relaxed">
                Check status by polling or register a webhook endpoint to receive <code className="text-blue-300 bg-white/5 px-1 rounded">order.fulfilled</code> / <code className="text-blue-300 bg-white/5 px-1 rounded">order.failed</code> events.
            </p>
            <div className="bg-[#0d0d0d] p-4 rounded-xl border border-white/10 mb-8 overflow-x-auto">
                <pre className="text-sm font-mono text-gray-300 leading-relaxed">
                    {`# Poll order status
curl https://clova-pay-africa-production.up.railway.app/v1/orders/ord_abc123... \\
  -H "x-api-key: YOUR_OWNER_API_KEY"

# Order statuses: awaiting_deposit → confirming → paid_out → settled
#                                                           ↓
#                                                         failed / expired`}
                </pre>
            </div>

            {/* Order statuses */}
            <h2 className="text-2xl font-bold mt-10 mb-4">Order lifecycle</h2>
            <div className="overflow-x-auto mb-10">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/10 text-gray-400">
                            <th className="text-left py-3 pr-6 font-medium">Status</th>
                            <th className="text-left py-3 font-medium">Meaning</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-300">
                        {[
                            ["awaiting_deposit", "Order created. Waiting for crypto to arrive at depositAddress."],
                            ["confirming", "Deposit detected on-chain. Waiting for confirmations."],
                            ["paid_out", "Paycrest transfer initiated. NGN on its way to the bank."],
                            ["settled", "Bank transfer confirmed. Done."],
                            ["failed", "Paycrest transfer failed. Check failureReason."],
                            ["expired", "No deposit received within 30 minutes."],
                        ].map(([status, desc]) => (
                            <tr key={status}>
                                <td className="py-3 pr-6"><code className="text-blue-300 bg-white/5 px-1 rounded text-xs">{status}</code></td>
                                <td className="py-3 text-gray-400 text-sm">{desc}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

        </motion.div>
    );
}
