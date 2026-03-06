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

            <h1 className="text-4xl font-extrabold mb-6 tracking-tight">Quickstart Guide</h1>

            <p className="text-lg text-gray-400 leading-relaxed mb-10">
                Get up and running with the ClovaPay API in minutes. Learn how to authenticate, resolve bank accounts, and create a payout order.
            </p>

            <h2 className="text-2xl font-bold mt-12 mb-4">1. Authentication</h2>
            <p className="text-gray-300 mb-4">
                All requests to the Clova API endpoints must be authenticated via the <code>x-api-key</code> header.
                Requests are gated and priced using the x402 protocol, meaning you may need to attach micropayment proofs for external usage.
            </p>

            <div className="bg-[#1e1e1e] p-4 rounded-xl border border-white/10 mb-8 overflow-x-auto">
                <pre className="text-sm font-mono text-gray-300">
                    <code>
                        <span className="text-purple-400">curl</span> <span className="text-blue-300">-X</span> GET https://api.clovapay.africa/v1/health \<br />
                        <span className="text-blue-300">-H</span> <span className="text-green-300">"x-api-key: YOUR_API_KEY"</span>
                    </code>
                </pre>
            </div>

            <h2 className="text-2xl font-bold mt-12 mb-4">2. Resolve Account Details</h2>
            <p className="text-gray-300 mb-4">
                Before creating an order, verify the recipient's bank account details using the resolving endpoint.
            </p>

            <div className="bg-[#1e1e1e] p-4 rounded-xl border border-white/10 mb-8 overflow-x-auto">
                <pre className="text-sm font-mono text-gray-300">
                    <code>
                        <span className="text-purple-400">curl</span> <span className="text-blue-300">-X</span> POST https://api.clovapay.africa/v1/recipients/resolve \<br />
                        <span className="text-blue-300">-H</span> <span className="text-green-300">"x-api-key: YOUR_API_KEY"</span> \<br />
                        <span className="text-blue-300">-H</span> <span className="text-green-300">"Content-Type: application/json"</span> \<br />
                        <span className="text-blue-300">-d</span> <span className="text-yellow-300">'{'{'}"accountNumber": "0123456789", "bankCode": "058"{'}'}'</span>
                    </code>
                </pre>
            </div>

            <h2 className="text-2xl font-bold mt-12 mb-4">3. Create an Order</h2>
            <p className="text-gray-300 mb-4">
                Once verified, submit an order. The API will secure an exchange rate quote and return a unique crypto deposit address.
                Once you deposit funds to that address, the system automatically fulfills the fiat payout.
            </p>

            <div className="bg-[#1e1e1e] p-4 rounded-xl border border-white/10 mb-8 overflow-x-auto">
                <pre className="text-sm font-mono text-gray-300">
                    <code>
                        <span className="text-gray-500">// Example Response from POST /v1/orders</span><br />
                        {'{'}<br />
                        <span className="text-blue-300">"orderId"</span>: <span className="text-green-300">"ord_550e8400..."</span>,<br />
                        <span className="text-blue-300">"asset"</span>: <span className="text-green-300">"USDC_BASE"</span>,<br />
                        <span className="text-blue-300">"depositAddress"</span>: <span className="text-green-300">"0x123abc..."</span>,<br />
                        <span className="text-blue-300">"status"</span>: <span className="text-green-300">"awaiting_deposit"</span>,<br />
                        <span className="text-blue-300">"rate"</span>: <span className="text-orange-300">1450.50</span><br />
                        {'}'}
                    </code>
                </pre>
            </div>

        </motion.div>
    );
}
