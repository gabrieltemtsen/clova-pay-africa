"use client";

import Link from "next/link";
import { ShieldCheck, Twitter, Github } from "lucide-react";

export const Footer = () => {
    return (
        <footer className="border-t border-white/10 glassmorphism relative z-10 pt-16 pb-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">

                    <div className="col-span-1 md:col-span-1">
                        <Link href="/" className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                                <ShieldCheck className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-bold text-xl tracking-tight">ClovaPay</span>
                        </Link>
                        <p className="text-gray-400 text-sm leading-relaxed mb-6">
                            Crypto-to-fiat offramp for Africa. Send cUSD, USDC or USDCx — receive naira directly in any Nigerian bank account.
                        </p>
                        <div className="flex items-center gap-4">
                            <a href="https://x.com/gabe_temtsen" target="_blank" rel="noreferrer"
                                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                                <Twitter className="w-5 h-5" />
                            </a>
                            <a href="https://github.com/gabrieltemtsen/clova-pay-africa" target="_blank" rel="noreferrer"
                                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                                <Github className="w-5 h-5" />
                            </a>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold text-white mb-4">Product</h4>
                        <ul className="space-y-3">
                            <li><Link href="#how-it-works" className="text-gray-400 hover:text-white transition-colors text-sm">How it works</Link></li>
                            <li><Link href="#supported-assets" className="text-gray-400 hover:text-white transition-colors text-sm">Supported assets</Link></li>
                            <li><Link href="#use-cases" className="text-gray-400 hover:text-white transition-colors text-sm">Use cases</Link></li>
                            <li><Link href="#supported-assets" className="text-gray-400 hover:text-white transition-colors text-sm">Fees</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-white mb-4">Developers</h4>
                        <ul className="space-y-3">
                            <li><Link href="/docs" className="text-gray-400 hover:text-white transition-colors text-sm">Documentation</Link></li>
                            <li><Link href="/docs/quickstart" className="text-gray-400 hover:text-white transition-colors text-sm">Quickstart</Link></li>
                            <li>
                                <a href="https://github.com/gabrieltemtsen/clova-pay-africa" target="_blank" rel="noreferrer"
                                    className="text-gray-400 hover:text-white transition-colors text-sm">
                                    GitHub
                                </a>
                            </li>
                            <li><Link href="/docs" className="text-gray-400 hover:text-white transition-colors text-sm">API Reference</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-white mb-4">Phase 1 scope</h4>
                        <ul className="space-y-3 text-sm">
                            <li className="flex items-center gap-2 text-gray-400">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                                cUSD → NGN (Celo)
                            </li>
                            <li className="flex items-center gap-2 text-gray-400">
                                <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                                USDC → NGN (Base)
                            </li>
                            <li className="flex items-center gap-2 text-gray-400">
                                <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                                USDCx → NGN (Stacks)
                            </li>
                            <li className="flex items-center gap-2 text-gray-500">
                                <span className="w-2 h-2 rounded-full bg-gray-700 flex-shrink-0" />
                                More corridors coming
                            </li>
                        </ul>
                    </div>

                </div>

                <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-gray-500 text-sm">© {new Date().getFullYear()} ClovaPay Africa. Settled via Paycrest.</p>
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-sm text-gray-500">NGN corridor live</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};
