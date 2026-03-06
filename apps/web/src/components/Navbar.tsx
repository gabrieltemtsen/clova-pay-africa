"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export const Navbar = () => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <header
            className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
                scrolled
                    ? "glassmorphism border-white/10 shadow-lg shadow-black/20"
                    : "bg-transparent border-transparent"
            )}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-20">
                    {/* Logo */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/30">
                            <ShieldCheck className="w-6 h-6 text-white" />
                        </div>
                        <Link href="/" className="font-bold text-2xl tracking-tight">
                            Clova<span className="text-blue-500">Pay</span>
                        </Link>
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-8">
                        <Link href="#features" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                            Features
                        </Link>
                        <Link href="#use-cases" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                            Use Cases
                        </Link>
                        <Link href="/docs" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                            Developers
                        </Link>
                    </nav>

                    {/* CTA Buttons */}
                    <div className="hidden md:flex items-center gap-4">
                        <Link href="/docs" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                            Login
                        </Link>
                        <Link
                            href="/docs"
                            className="group relative inline-flex h-10 items-center justify-center overflow-hidden rounded-full bg-blue-600 px-6 font-medium text-neutral-50 duration-300 hover:bg-blue-500"
                        >
                            <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
                                <div className="relative h-full w-8 bg-white/20" />
                            </div>
                            <span className="flex items-center gap-2">
                                Get Started <ArrowRight className="w-4 h-4" />
                            </span>
                        </Link>
                    </div>

                    {/* Mobile menu button */}
                    <div className="flex md:hidden items-center">
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="text-gray-300 hover:text-white transition-colors"
                        >
                            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden glassmorphism border-t border-white/10"
                    >
                        <div className="px-4 pt-2 pb-6 space-y-1">
                            <Link
                                href="#features"
                                className="block px-3 py-4 text-base font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors border-b border-white/5"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                Features
                            </Link>
                            <Link
                                href="#use-cases"
                                className="block px-3 py-4 text-base font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors border-b border-white/5"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                Use Cases
                            </Link>
                            <Link
                                href="/docs"
                                className="block px-3 py-4 text-base font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                Developers
                            </Link>
                            <div className="mt-6">
                                <Link
                                    href="/docs"
                                    className="w-full flex items-center justify-center h-12 rounded-xl bg-blue-600 font-medium text-white hover:bg-blue-500 transition-colors"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    Get Started
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
};
