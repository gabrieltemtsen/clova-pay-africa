"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Code, Zap } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const sidebarLinks = [
    {
        title: "Getting Started",
        icon: <BookOpen className="w-4 h-4" />,
        items: [
            { name: "Introduction", href: "/docs" },
            { name: "Quickstart", href: "/docs/quickstart" },
        ],
    },
    {
        title: "API Reference",
        icon: <Code className="w-4 h-4" />,
        items: [
            { name: "Authentication", href: "/docs/api/auth" },
            { name: "Create Order", href: "/docs/api/orders" },
            { name: "Webhooks", href: "/docs/api/webhooks" },
        ],
    },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="min-h-screen bg-black flex flex-col">
            <Navbar />

            <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex pt-24 pb-16">

                {/* Sidebar */}
                <aside className="hidden md:block w-64 shrink-0 pr-8 border-r border-white/10 overflow-y-auto">
                    <div className="sticky top-24">
                        <h2 className="text-xl font-bold mb-8 gradient-text">Documentation</h2>

                        <div className="space-y-8">
                            {sidebarLinks.map((section, idx) => (
                                <div key={idx}>
                                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-200 uppercase tracking-wider mb-4">
                                        {section.icon}
                                        {section.title}
                                    </h3>
                                    <ul className="space-y-2">
                                        {section.items.map((link, jdx) => {
                                            const isActive = pathname === link.href;
                                            return (
                                                <li key={jdx}>
                                                    <Link
                                                        href={link.href}
                                                        className={`block px-3 py-2 rounded-lg text-sm transition-colors ${isActive
                                                                ? "bg-blue-600/10 text-blue-400 font-medium"
                                                                : "text-gray-400 hover:text-white hover:bg-white/5"
                                                            }`}
                                                    >
                                                        {link.name}
                                                    </Link>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ))}
                        </div>

                        <div className="mt-12 p-4 rounded-xl glassmorphism border border-emerald-500/20 bg-emerald-500/5">
                            <div className="flex items-center gap-2 text-emerald-400 mb-2">
                                <Zap className="w-4 h-4" />
                                <span className="font-semibold text-sm">Need Help?</span>
                            </div>
                            <p className="text-xs text-gray-400 mb-3">Join our Discord community or contact developer support.</p>
                            <button className="w-full py-2 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors">
                                Get Support
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 md:pl-12 min-w-0 max-w-3xl">
                    <div className="prose prose-invert prose-blue max-w-none">
                        {children}
                    </div>
                </main>

            </div>

            <Footer />
        </div>
    );
}
