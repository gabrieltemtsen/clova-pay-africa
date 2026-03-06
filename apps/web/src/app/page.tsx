"use client";

import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Footer } from "@/components/Footer";
import { ArrowRight, Wallet, Lock, Activity, Globe, Zap } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-black overflow-x-hidden selection:bg-blue-500/30">
      <Navbar />

      <Hero />

      {/* Use Cases Section */}
      <section id="use-cases" className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Designed for Every Scale</h2>
            <p className="text-gray-400 text-lg">Whether you are a global enterprise or a DeFi protocol, ClovaPay offers seamless routing for fiat and stablecoin settlements.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { title: "Crypto Businesses", desc: "Automate yield payouts to bank accounts, settle NFT marketplace royalties in local currency.", icon: <Wallet className="w-8 h-8 text-blue-400 pb-2" /> },
              { title: "Financial Services", desc: "Offer faster, cheaper international remittances and microfinance loan disbursements.", icon: <Activity className="w-8 h-8 text-indigo-400 pb-2" /> },
              { title: "E-Commerce", desc: "Accept crypto payments globally and settle seamlessly in local fiat currencies like NGN, KES.", icon: <Globe className="w-8 h-8 text-purple-400 pb-2" /> },
            ].map((useCase, idx) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                key={idx}
                className="p-8 rounded-3xl glassmorphism border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent hover:border-blue-500/30 transition-all duration-500 group"
              >
                {useCase.icon}
                <h3 className="text-2xl font-bold mb-3">{useCase.title}</h3>
                <p className="text-gray-400 mb-6">{useCase.desc}</p>
                <div className="flex items-center text-blue-400 text-sm font-medium group-hover:text-blue-300 transition-colors cursor-pointer">
                  Learn more <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Protocol Architecture Teaser */}
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
              <h2 className="text-3xl md:text-5xl font-bold mb-6">Powered by the PayCrest Network</h2>
              <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                We utilize abstract, decentralized nodes to source liquidity in real-time. This eliminates closed-loop legacy systems, removes compliance bottlenecks, and ensures you receive the best possible rates at zero protocol fees.
              </p>

              <ul className="space-y-4 mb-8">
                {[
                  { icon: <Lock className="text-emerald-400 w-5 h-5" />, text: "Encrypted Recipient Data & Embedded Compliance" },
                  { icon: <Zap className="text-blue-400 w-5 h-5" />, text: "Instant Multi-Chain Support (Base, Celo, etc.)" },
                  { icon: <Activity className="text-purple-400 w-5 h-5" />, text: "Standardized instructions across all liquidity providers" },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="mt-1 bg-white/5 p-1 rounded-full">{item.icon}</div>
                    <span className="text-gray-300">{item.text}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/docs"
                className="inline-flex items-center justify-center h-12 px-6 rounded-full bg-white text-black font-semibold hover:bg-gray-200 transition-colors"
              >
                Read the Documentation
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="relative"
            >
              {/* Abstract visual representation of nodes */}
              <div className="aspect-square rounded-full border border-white/10 flex items-center justify-center p-8 relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-purple-500/20 rounded-full blur-3xl" />
                <div className="w-full h-full rounded-full border border-dashed border-white/20 animate-[spin_60s_linear_infinite] absolute" />
                <div className="w-3/4 h-3/4 rounded-full border border-white/5 animate-[spin_40s_linear_infinite_reverse] absolute" />

                <div className="glassmorphism p-8 rounded-2xl relative z-10 w-full max-w-sm shadow-2xl border-white/10 border transform hover:scale-105 transition-transform duration-500">
                  <div className="flex justify-between items-center mb-6">
                    <div className="text-sm text-gray-400">Transaction Request</div>
                    <div className="text-emerald-400 text-xs font-mono bg-emerald-400/10 px-2 py-1 rounded">SECURE</div>
                  </div>
                  <div className="space-y-4">
                    <div className="h-2 w-full bg-white/5 rounded overflow-hidden">
                      <div className="h-full bg-blue-500 w-3/4" />
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded overflow-hidden">
                      <div className="h-full bg-purple-500 w-1/2" />
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded overflow-hidden">
                      <div className="h-full bg-emerald-500 w-full" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/30 to-purple-600/30 blur-3xl opacity-50 rounded-[100px] pointer-events-none" />
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glassmorphism rounded-[40px] p-12 md:p-20 text-center border border-white/10 relative overflow-hidden"
          >
            <h2 className="text-4xl md:text-6xl font-bold mb-6 text-balance">Ready to route payments globally?</h2>
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
              Integrate with a single API to connect to deep liquidity across borders with instant settlement.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Link href="/docs" className="h-14 px-8 rounded-full bg-white text-black font-bold flex items-center justify-center hover:scale-105 transition-transform w-full sm:w-auto">
                Explore API Docs
              </Link>
              <Link href="#" className="h-14 px-8 rounded-full border border-white/20 text-white font-bold flex items-center justify-center hover:bg-white/10 transition-colors w-full sm:w-auto">
                Contact Sales
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
