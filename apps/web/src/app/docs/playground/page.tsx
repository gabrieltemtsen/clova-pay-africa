"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Loader2, ChevronDown } from "lucide-react";

const API_BASE = "https://clova-pay-africa-production.up.railway.app";

const BANKS = [
    { name: "Access Bank", code: "ABNGNGLA" },
    { name: "Guaranty Trust Bank", code: "GTBINGLA" },
    { name: "United Bank for Africa", code: "UNAFNGLA" },
    { name: "Zenith Bank", code: "ZEIBNGLA" },
    { name: "First Bank Of Nigeria", code: "FBNINGLA" },
    { name: "OPay", code: "OPAYNGPC" },
    { name: "Kuda Microfinance Bank", code: "KUDANGPC" },
    { name: "PalmPay", code: "PALMNGPC" },
    { name: "Moniepoint MFB", code: "MONINGPC" },
    { name: "Wema Bank", code: "WEMANGLA" },
    { name: "Sterling Bank", code: "NAMENGLA" },
    { name: "FCMB", code: "FCMBNGLA" },
    { name: "Fidelity Bank", code: "FIDTNGLA" },
    { name: "Stanbic IBTC Bank", code: "SBICNGLA" },
    { name: "Union Bank", code: "UBNINGLA" },
    { name: "Polaris Bank", code: "PRDTNGLA" },
    { name: "Providus Bank", code: "PROVNGLA" },
    { name: "Safe Haven MFB", code: "SAHVNGPC" },
];

function JsonDisplay({ data }: { data: unknown }) {
    const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    return (
        <pre className="text-xs font-mono text-gray-300 bg-[#0a0a0a] p-4 rounded-xl border border-white/10 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {text}
        </pre>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="mb-12">
            <h2 className="text-xl font-bold mb-6">{title}</h2>
            {children}
        </div>
    );
}

export default function PlaygroundPage() {
    const [apiKey, setApiKey] = useState("");

    // Quote state
    const [quoteAsset, setQuoteAsset] = useState("USDC_BASE");
    const [quoteAmount, setQuoteAmount] = useState("10");
    const [quoteLoading, setQuoteLoading] = useState(false);
    const [quoteResult, setQuoteResult] = useState<unknown>(null);

    // Order state
    const [orderAsset, setOrderAsset] = useState("USDC_BASE");
    const [orderAmount, setOrderAmount] = useState("10");
    const [orderAccount, setOrderAccount] = useState("");
    const [orderName, setOrderName] = useState("");
    const [orderBank, setOrderBank] = useState("OPAYNGPC");
    const [orderReturn, setOrderReturn] = useState("");
    const [orderLoading, setOrderLoading] = useState(false);
    const [orderResult, setOrderResult] = useState<unknown>(null);

    // Banks state
    const [banksLoading, setBanksLoading] = useState(false);
    const [banksResult, setBanksResult] = useState<unknown>(null);

    const headers = () => ({
        "Content-Type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
    });

    async function fetchQuote() {
        setQuoteLoading(true);
        setQuoteResult(null);
        try {
            const res = await fetch(`${API_BASE}/v1/quotes`, {
                method: "POST",
                headers: headers(),
                body: JSON.stringify({ asset: quoteAsset, amountCrypto: quoteAmount, destinationCurrency: "NGN" }),
            });
            setQuoteResult(await res.json());
        } catch (e: unknown) {
            setQuoteResult({ error: String(e) });
        } finally {
            setQuoteLoading(false);
        }
    }

    async function createOrder() {
        setOrderLoading(true);
        setOrderResult(null);
        try {
            const res = await fetch(`${API_BASE}/v1/orders`, {
                method: "POST",
                headers: headers(),
                body: JSON.stringify({
                    asset: orderAsset,
                    amountCrypto: orderAmount,
                    recipient: { accountName: orderName, accountNumber: orderAccount, bankCode: orderBank },
                    returnAddress: orderReturn,
                }),
            });
            setOrderResult(await res.json());
        } catch (e: unknown) {
            setOrderResult({ error: String(e) });
        } finally {
            setOrderLoading(false);
        }
    }

    async function fetchBanks() {
        setBanksLoading(true);
        setBanksResult(null);
        try {
            const res = await fetch(`${API_BASE}/v1/banks`, { headers: headers() });
            setBanksResult(await res.json());
        } catch (e: unknown) {
            setBanksResult({ error: String(e) });
        } finally {
            setBanksLoading(false);
        }
    }

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                Interactive
            </div>

            <h1 className="text-4xl font-extrabold mb-4 tracking-tight">API Playground</h1>
            <p className="text-lg text-gray-400 leading-relaxed mb-8">
                Test the ClovaPay API live from your browser. Enter your API key below, then try any endpoint.
            </p>

            {/* API Key */}
            <div className="p-5 rounded-xl border border-blue-500/20 bg-blue-500/5 mb-10">
                <label className="block text-sm font-semibold text-blue-400 mb-2">Your API Key</label>
                <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste your x-api-key here — or request one from gabe-dev.vercel.app"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 font-mono"
                />
                <p className="mt-2 text-xs text-gray-500">
                    Don&apos;t have a key? <a href="https://gabe-dev.vercel.app" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">Contact gabedev</a> or use x402 micropayments.
                </p>
            </div>

            {/* Quote */}
            <Section title="GET QUOTE — POST /v1/quotes">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Asset</label>
                        <div className="relative">
                            <select
                                value={quoteAsset}
                                onChange={(e) => setQuoteAsset(e.target.value)}
                                className="w-full appearance-none bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50"
                            >
                                <option value="USDC_BASE">USDC on Base</option>
                                <option value="USDCX_STACKS">USDCx on Stacks</option>
                                <option value="cUSD_CELO">cUSD on Celo</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Amount (crypto)</label>
                        <input
                            type="number"
                            value={quoteAmount}
                            onChange={(e) => setQuoteAmount(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50"
                        />
                    </div>
                </div>
                <button
                    onClick={fetchQuote}
                    disabled={quoteLoading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium text-white transition-colors mb-4"
                >
                    {quoteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Run
                </button>
                {!!quoteResult && <JsonDisplay data={quoteResult} />}
            </Section>

            {/* Order */}
            <Section title="CREATE ORDER — POST /v1/orders">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Asset</label>
                        <div className="relative">
                            <select
                                value={orderAsset}
                                onChange={(e) => setOrderAsset(e.target.value)}
                                className="w-full appearance-none bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50"
                            >
                                <option value="USDC_BASE">USDC on Base</option>
                                <option value="USDCX_STACKS">USDCx on Stacks</option>
                                <option value="cUSD_CELO">cUSD on Celo</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Amount (crypto)</label>
                        <input type="number" value={orderAmount} onChange={(e) => setOrderAmount(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Account Name</label>
                        <input type="text" placeholder="John Doe" value={orderName} onChange={(e) => setOrderName(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Account Number</label>
                        <input type="text" placeholder="0123456789" value={orderAccount} onChange={(e) => setOrderAccount(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Bank</label>
                        <div className="relative">
                            <select value={orderBank} onChange={(e) => setOrderBank(e.target.value)}
                                className="w-full appearance-none bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50">
                                {BANKS.map((b) => (
                                    <option key={b.code} value={b.code}>{b.name} ({b.code})</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Return Address (refund wallet)</label>
                        <input type="text" placeholder="0x..." value={orderReturn} onChange={(e) => setOrderReturn(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 font-mono" />
                    </div>
                </div>
                <button onClick={createOrder} disabled={orderLoading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium text-white transition-colors mb-4">
                    {orderLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Run
                </button>
                {!!orderResult && <JsonDisplay data={orderResult} />}
            </Section>

            {/* Banks */}
            <Section title="LIST BANKS — GET /v1/banks">
                <p className="text-sm text-gray-400 mb-4">Returns all supported payout institutions with their PayCrest institution codes.</p>
                <button onClick={fetchBanks} disabled={banksLoading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium text-white transition-colors mb-4">
                    {banksLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Run
                </button>
                {!!banksResult && <JsonDisplay data={banksResult} />}
            </Section>
        </motion.div>
    );
}
