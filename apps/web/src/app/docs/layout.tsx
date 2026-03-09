"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Github } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const sidebarLinks = [
    {
        title: "Getting Started",
        icon: <BookOpen className="w-4 h-4" />,
        items: [
            { name: "Introduction", href: "/docs" },
            { name: "Quickstart", href: "/docs/quickstart" },
            { name: "Playground", href: "/docs/playground" },
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

                        <a
                            href="https://github.com/gabrieltemtsen/clova-pay-africa"
                            target="_blank"
                            rel="noreferrer"
                            className="mt-12 flex items-center gap-2 px-4 py-3 rounded-xl glassmorphism border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors text-sm"
                        >
                            <Github className="w-4 h-4" />
                            View on GitHub
                        </a>
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
