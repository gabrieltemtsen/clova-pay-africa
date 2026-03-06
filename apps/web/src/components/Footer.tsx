"use client";

import Link from "next/link";
import { ShieldCheck, Twitter, Github, Linkedin } from "lucide-react";

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
                            A decentralized routing protocol for instant, secure, zero-fee global payments. Built for businesses across Africa.
                        </p>
                        <div className="flex items-center gap-4">
                            <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                                <Twitter className="w-5 h-5" />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                                <Github className="w-5 h-5" />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                                <Linkedin className="w-5 h-5" />
                            </a>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold text-white mb-4">Product</h4>
                        <ul className="space-y-3">
                            <li><Link href="#features" className="text-gray-400 hover:text-white transition-colors text-sm">Features</Link></li>
                            <li><Link href="#use-cases" className="text-gray-400 hover:text-white transition-colors text-sm">Use Cases</Link></li>
                            <li><Link href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Pricing</Link></li>
                            <li><Link href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Supported Assets</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-white mb-4">Developers</h4>
                        <ul className="space-y-3">
                            <li><Link href="/docs" className="text-gray-400 hover:text-white transition-colors text-sm">Documentation</Link></li>
                            <li><Link href="#" className="text-gray-400 hover:text-white transition-colors text-sm">API Reference</Link></li>
                            <li><Link href="#" className="text-gray-400 hover:text-white transition-colors text-sm">GitHub Repo</Link></li>
                            <li><Link href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Status</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-white mb-4">Company</h4>
                        <ul className="space-y-3">
                            <li><Link href="#" className="text-gray-400 hover:text-white transition-colors text-sm">About Us</Link></li>
                            <li><Link href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Careers</Link></li>
                            <li><Link href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Privacy Policy</Link></li>
                            <li><Link href="#" className="text-gray-400 hover:text-white transition-colors text-sm">Terms of Service</Link></li>
                        </ul>
                    </div>

                </div>

                <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-gray-500 text-sm">© {new Date().getFullYear()} ClovaPay Africa. Powered by PayCrest.</p>
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-sm text-gray-500">All systems operational</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};
