"use client";

import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Footer } from "@/components/Footer";
import { ArrowRight, Terminal, Wallet, Building2, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-black overflow-x-hidden selection:bg-blue-500/30">
      <Navbar />
      <Hero />

      {/* How It Works */}
      <section id="how-it-works" className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">How it works</h2>
            <p className="text-gray-400 text-lg">Four steps from stablecoin to bank account. The whole thing is automated — you just call the API.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-10 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

            {[
              {
                step: "01",
                title: "Get a quote",
                desc: "POST /v1/quotes with your asset and amount. Get back the NGN rate, fee breakdown, and expiry.",
                color: "blue"
              },
              {
                step: "02",
                title: "Create an order",
                desc: "POST /v1/orders with recipient bank details. We return a Paycrest deposit address unique to your order.",
                color: "indigo"
              },
              {
                step: "03",
                title: "Send crypto",
                desc: "Send exactly the quoted amount to the deposit address. We verify the transaction on-chain automatically.",
                color: "violet"
              },
              {
                step: "04",
                title: "NGN lands in bank",
                desc: "Once confirmed, naira is transferred to the recipient's account. Webhook fires when settled.",
                color: "purple"
              }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="relative p-6 rounded-2xl glassmorphism border border-white/5 hover:border-white/10 transition-all"
              >
                <div className={`text-4xl font-black mb-4 text-${item.color}-500/30`}>{item.step}</div>
                <h3 className="text-lg font-bold mb-2 text-white">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported Assets & Fees */}
      <section id="supported-assets" className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

            {/* Assets */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Supported assets</h2>
              <p className="text-gray-400 mb-8">Phase 1 covers three stablecoin rails into NGN. More corridors coming as we expand.</p>

              <div className="space-y-4">
                {[
                  { token: "cUSD", network: "Celo", key: "cUSD_CELO", status: "live", color: "emerald" },
                  { token: "USDC", network: "Base", key: "USDC_BASE", status: "live", color: "blue" },
                  { token: "USDCx", network: "Stacks", key: "USDCX_STACKS", status: "live", color: "indigo", note: "Via Clarity contract deposit" },
                ].map((asset) => (
                  <div key={asset.key} className="flex items-center justify-between p-4 rounded-xl glassmorphism border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full bg-${asset.color}-500/10 border border-${asset.color}-500/20 flex items-center justify-center`}>
                        <span className={`text-xs font-bold text-${asset.color}-400`}>{asset.token[0]}</span>
                      </div>
                      <div>
                        <div className="font-semibold text-white">{asset.token} <span className="text-gray-500 font-normal text-sm">on {asset.network}</span></div>
                        {asset.note && <div className="text-xs text-gray-500 mt-0.5">{asset.note}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400 text-sm font-medium">Live</span>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between p-4 rounded-xl border border-dashed border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-500">+</span>
                    </div>
                    <div className="text-gray-500 text-sm">More assets & corridors</div>
                  </div>
                  <span className="text-gray-600 text-sm">Coming soon</span>
                </div>
              </div>
            </motion.div>

            {/* Fee structure */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Transparent fees</h2>
              <p className="text-gray-400 mb-8">Every quote includes a full breakdown before you commit a single token.</p>

              <div className="p-6 rounded-2xl glassmorphism border border-white/10 space-y-5 mb-6">
                <div className="flex justify-between items-center pb-4 border-b border-white/5">
                  <span className="text-gray-400 text-sm">Example: 100 USDC → NGN</span>
                  <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full">Live quote</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Market rate</span>
                  <span className="text-white text-sm font-mono">₦1,550 / USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">FX spread (3%)</span>
                  <span className="text-white text-sm font-mono">₦1,503.50 / USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Platform fee (1.5%)</span>
                  <span className="text-orange-400 text-sm font-mono">- ₦2,255.25</span>
                </div>
                <div className="flex justify-between pt-4 border-t border-white/10">
                  <span className="text-white font-semibold">You receive</span>
                  <span className="text-emerald-400 font-bold font-mono">₦148,094.75</span>
                </div>
              </div>

              <div className="flex gap-2 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-amber-200/70 text-xs leading-relaxed">
                  Rates are locked for 5 minutes after quoting. Orders expire after 30 minutes if no deposit is received.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section id="use-cases" className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Who it&apos;s for</h2>
            <p className="text-gray-400 text-lg">If you hold crypto and need naira in a bank account, Clova handles it.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Terminal className="w-8 h-8 text-blue-400" />,
                title: "Developers & AI agents",
                desc: "Integrate via REST API or x402 micropayments. Your agents can autonomously convert stables to fiat without a dashboard or manual approval step.",
                cta: "View API docs",
                href: "/docs"
              },
              {
                icon: <Wallet className="w-8 h-8 text-purple-400" />,
                title: "DeFi protocols",
                desc: "Pay contributors, grant recipients, or yield earners directly to Nigerian bank accounts from your on-chain treasury — no OTC desk needed.",
                cta: "See order flow",
                href: "/docs/quickstart"
              },
              {
                icon: <Building2 className="w-8 h-8 text-emerald-400" />,
                title: "Businesses & freelancers",
                desc: "Get paid in stablecoins globally, convert to NGN at a transparent rate, land directly in your GTB or Zenith account. No crypto exchange required.",
                cta: "Get started",
                href: "/docs"
              }
            ].map((useCase, idx) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                key={idx}
                className="p-8 rounded-3xl glassmorphism border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent hover:border-blue-500/20 transition-all duration-500 group"
              >
                <div className="mb-4">{useCase.icon}</div>
                <h3 className="text-xl font-bold mb-3">{useCase.title}</h3>
                <p className="text-gray-400 mb-6 text-sm leading-relaxed">{useCase.desc}</p>
                <Link href={useCase.href} className="flex items-center text-blue-400 text-sm font-medium group-hover:text-blue-300 transition-colors">
                  {useCase.cta} <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* x402 / agent-native block */}
      <section className="py-24 relative z-10 overflow-hidden">
        <div className="absolute inset-0 bg-blue-900/10 [mask-image:linear-gradient(to_bottom,transparent,black,transparent)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-medium border border-purple-500/20 mb-6">
                x402 · Agent-native
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Built for AI agents from day one</h2>
              <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                Every paid endpoint is gated via the x402 protocol (Thirdweb). An AI agent can discover the price, pay a micropayment on-chain, and call the API — no API key signup, no human in the loop.
              </p>
              <ul className="space-y-4 mb-8">
                {[
                  { icon: <Lock className="text-emerald-400 w-5 h-5" />, text: "Pay-per-call: $0.001 per quote, $0.02 per payout order" },
                  { icon: <Terminal className="text-blue-400 w-5 h-5" />, text: "Owner bypass via OWNER_API_KEY for internal/admin calls" },
                  { icon: <CheckCircle2 className="text-purple-400 w-5 h-5" />, text: "Standard HTTP — any language, any framework, any agent runtime" },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="mt-1 bg-white/5 p-1 rounded-full">{item.icon}</div>
                    <span className="text-gray-300 text-sm">{item.text}</span>
                  </li>
                ))}
              </ul>
              <Link href="/docs" className="inline-flex items-center justify-center h-12 px-6 rounded-full bg-white text-black font-semibold hover:bg-gray-200 transition-colors">
                Read the docs
              </Link>
            </motion.div>

            {/* Code snippet */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              <div className="rounded-2xl border border-white/10 bg-[#0d0d0d] overflow-hidden shadow-2xl">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-green-500/70" />
                  <span className="ml-3 text-xs text-gray-500 font-mono">offramp.sh</span>
                </div>
                <pre className="p-6 text-xs font-mono leading-relaxed overflow-x-auto">
                  <code>
                    <span className="text-gray-500"># 1. Get a quote</span>{"\n"}
                    <span className="text-purple-400">curl</span> <span className="text-blue-300">-X POST</span> https://clova-pay-africa-production.up.railway.app/v1/quotes <span className="text-blue-300">\</span>{"\n"}
                    {"  "}<span className="text-blue-300">-H</span> <span className="text-green-300">&quot;x-api-key: $OWNER_API_KEY&quot;</span> <span className="text-blue-300">\</span>{"\n"}
                    {"  "}<span className="text-blue-300">-d</span> <span className="text-yellow-300">&apos;&#123;&quot;asset&quot;:&quot;USDC_BASE&quot;,&quot;amountCrypto&quot;:&quot;100&quot;,&quot;destinationCurrency&quot;:&quot;NGN&quot;&#125;&apos;</span>{"\n"}
                    {"\n"}
                    <span className="text-gray-500"># 2. Create an order</span>{"\n"}
                    <span className="text-purple-400">curl</span> <span className="text-blue-300">-X POST</span> https://clova-pay-africa-production.up.railway.app/v1/orders <span className="text-blue-300">\</span>{"\n"}
                    {"  "}<span className="text-blue-300">-d</span> <span className="text-yellow-300">&apos;&#123;</span>{"\n"}
                    {"    "}<span className="text-yellow-300">&quot;asset&quot;: &quot;USDC_BASE&quot;,</span>{"\n"}
                    {"    "}<span className="text-yellow-300">&quot;amountCrypto&quot;: &quot;100&quot;,</span>{"\n"}
                    {"    "}<span className="text-yellow-300">&quot;recipient&quot;: &#123;</span>{"\n"}
                    {"      "}<span className="text-yellow-300">&quot;accountName&quot;: &quot;John Doe&quot;,</span>{"\n"}
                    {"      "}<span className="text-yellow-300">&quot;accountNumber&quot;: &quot;0123456789&quot;,</span>{"\n"}
                    {"      "}<span className="text-yellow-300">&quot;bankCode&quot;: &quot;058&quot;</span>{"\n"}
                    {"    "}<span className="text-yellow-300">&#125;</span>{"\n"}
                    {"  "}<span className="text-yellow-300">&#125;&apos;</span>{"\n"}
                    {"\n"}
                    <span className="text-gray-500"># 3. Send USDC to depositAddress from response</span>{"\n"}
                    <span className="text-gray-500"># 4. Naira hits bank account automatically ✓</span>
                  </code>
                </pre>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 relative z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/30 to-purple-600/30 blur-3xl opacity-50 rounded-[100px] pointer-events-none" />
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glassmorphism rounded-[40px] p-12 md:p-20 text-center border border-white/10 relative overflow-hidden"
          >
            <h2 className="text-4xl md:text-6xl font-bold mb-6 text-balance">Crypto in. African fiat out.</h2>
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
              Three stablecoin rails. One API. Local currency in bank accounts across Africa — Nigeria live, more corridors shipping.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Link href="/docs/quickstart" className="h-14 px-8 rounded-full bg-white text-black font-bold flex items-center justify-center hover:scale-105 transition-transform w-full sm:w-auto">
                Try the API
              </Link>
              <Link href="https://github.com/gabrieltemtsen/clova-pay-africa" target="_blank" className="h-14 px-8 rounded-full border border-white/20 text-white font-bold flex items-center justify-center hover:bg-white/10 transition-colors w-full sm:w-auto">
                View on GitHub
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
