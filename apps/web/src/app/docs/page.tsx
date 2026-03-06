"use client";

import { motion } from "framer-motion";

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

            <h1 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight">Introduction to ClovaPay</h1>

            <p className="text-xl text-gray-400 leading-relaxed mb-10">
                Welcome to ClovaPay Africa. We provide a decentralized routing protocol for instant, secure, and zero-fee global payments, specifically tailored for African markets.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-10">
                <div className="p-6 rounded-2xl border border-white/10 glassmorphism hover:border-blue-500/30 transition-colors">
                    <h3 className="text-lg font-bold text-white mb-2">For Senders</h3>
                    <p className="text-gray-400 text-sm mb-4">Integrate the API to programmatically send multi-chain assets to local fiat bank accounts.</p>
                    <a href="/docs/quickstart" className="text-blue-400 text-sm font-medium hover:text-blue-300">View Sender Guide →</a>
                </div>

                <div className="p-6 rounded-2xl border border-white/10 glassmorphism hover:border-purple-500/30 transition-colors">
                    <h3 className="text-lg font-bold text-white mb-2">For Providers</h3>
                    <p className="text-gray-400 text-sm mb-4">Supply liquidity via Webhooks to earn fees on global transfer volumes across our protocol.</p>
                    <a href="#" className="text-purple-400 text-sm font-medium hover:text-purple-300">View Provider Guide →</a>
                </div>
            </div>

            <h2 className="text-2xl font-bold mt-12 mb-4">How It Works</h2>
            <ol className="list-decimal list-outside ml-5 space-y-4 text-gray-300 mb-10">
                <li><strong>Create Order:</strong> Connect your wallet or API and create an order specifying source token (USDC, USDT, etc.), destination fiat (NGN, KES, etc.), and recipient bank details.</li>
                <li><strong>Aggregate & Route:</strong> The protocol finds the most efficient liquidity nodes utilizing the PayCrest network standard without extracting protocol fees.</li>
                <li><strong>Instant Settlement:</strong> Liquidity providers receive the crypto on-chain and disburse the equivalent fiat instantly to the recipient.</li>
            </ol>

            <div className="p-5 rounded-xl bg-blue-900/20 border-l-4 border-blue-500 mb-8">
                <h4 className="flex items-center gap-2 font-bold text-blue-400 mb-2">Supported Fiat Assets</h4>
                <p className="text-sm text-blue-100/70">
                    We currently support NGN (Nigeria), KES (Kenya), UGX (Uganda), with more markets regularly added via PayCrest integrations.
                </p>
            </div>

        </motion.div>
    );
}
