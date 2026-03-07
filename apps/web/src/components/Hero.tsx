"use strict";
"use client";

import { motion } from "framer-motion";
import { ArrowRight, Banknote, Coins, Zap } from "lucide-react";
import Link from "next/link";

const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
    }
};

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
};

export const Hero = () => {
    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
            {/* Background glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-[120px] opacity-50 pointer-events-none" />
            <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[100px] opacity-40 pointer-events-none" />

            {/* Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">

                {/* Badge */}
                <motion.div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full glassmorphism border border-blue-500/30 text-blue-400 text-sm font-medium mb-8"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                >
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    Phase 1 live · Nigeria open · more corridors coming
                </motion.div>

                {/* Headline */}
                <motion.h1
                    className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-balance"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                >
                    <motion.span variants={fadeInUp} className="block">Send crypto.</motion.span>
                    <motion.span variants={fadeInUp} className="block gradient-text mt-2">Get paid in Africa.</motion.span>
                </motion.h1>

                <motion.p
                    className="mt-4 text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto text-balance mb-10"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    Clova Pay Africa converts stablecoins into local fiat and lands the money directly in a bank account — automatically. Nigeria is live. More African corridors coming.
                </motion.p>

                <motion.div
                    className="flex flex-col sm:flex-row gap-4 justify-center items-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                >
                    <Link
                        href="/docs"
                        className="group relative inline-flex items-center justify-center gap-2 h-14 px-8 w-full sm:w-auto rounded-full bg-blue-600 font-semibold text-white shadow-[0_0_40px_-10px_rgba(59,130,246,0.6)] hover:shadow-[0_0_60px_-15px_rgba(59,130,246,0.8)] transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                    >
                        <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
                            <div className="relative h-full w-12 bg-white/20" />
                        </div>
                        Start building <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Link>

                    <Link
                        href="#how-it-works"
                        className="inline-flex items-center justify-center h-14 w-full sm:w-auto px-8 rounded-full font-semibold text-white glassmorphism hover:bg-white/10 transition-colors border border-white/10"
                    >
                        See how it works
                    </Link>
                </motion.div>

                {/* Feature pills */}
                <motion.div
                    className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 max-w-5xl w-full"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                >
                    {[
                        {
                            icon: <Coins className="w-6 h-6 text-blue-400" />,
                            title: "Three stablecoin rails",
                            desc: "cUSD on Celo, USDC on Base, USDCx on Stacks. Send from wherever you hold."
                        },
                        {
                            icon: <Banknote className="w-6 h-6 text-emerald-400" />,
                            title: "Direct bank settlement",
                            desc: "Naira lands in any Nigerian bank account — GTB, Access, Zenith, First Bank and more."
                        },
                        {
                            icon: <Zap className="w-6 h-6 text-purple-400" />,
                            title: "Agent-native API",
                            desc: "Built on x402 — AI agents can call and pay per request programmatically, no dashboard needed."
                        }
                    ].map((feature, i) => (
                        <motion.div
                            key={i}
                            variants={fadeInUp}
                            className="p-6 rounded-2xl glassmorphism border border-white/5 hover:border-white/10 transition-colors text-left group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </div>
    );
};
