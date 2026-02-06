"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    const navLinks = [
        { name: "Leaderboard", href: "/" },
        { name: "Rank Movement", href: "/rank-movement" },
    ];

    return (
        <nav className="fixed top-0 w-full z-50 bg-[#1a2744]/90 backdrop-blur-sm border-b border-[#2a3f5f] text-white">
            <div className="w-full px-4">
                <div className="relative flex items-center justify-between h-16">
                    {/* Logo - Left */}
                    <div className="flex-shrink-0 font-bold text-xl tracking-wider text-[#d4a853]" style={{ marginLeft: '20px' }}>
                        <Link href="/">MINTON3T</Link>
                    </div>

                    {/* Desktop Menu - Centered */}
                    <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2">
                        <div className="flex items-baseline" style={{ gap: '40px' }}>
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    className={`rounded-md text-sm font-bold transition-colors ${pathname === link.href
                                        ? "text-[#d4a853]"
                                        : "text-gray-400 hover:text-white"
                                        }`}
                                    style={{ padding: '8px 20px' }}
                                >
                                    {link.name}
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="flex md:hidden" style={{ marginRight: '20px' }}>
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            type="button"
                            className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white focus:outline-none"
                            aria-controls="mobile-menu"
                            aria-expanded="false"
                        >
                            <span className="sr-only">Open main menu</span>
                            {!isOpen ? (
                                <svg
                                    className="block h-6 w-6"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    aria-hidden="true"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M4 6h16M4 12h16M4 18h16"
                                    />
                                </svg>
                            ) : (
                                <svg
                                    className="block h-6 w-6"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    aria-hidden="true"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isOpen && (
                <div className="md:hidden bg-[#162036] border-b border-[#2a3f5f]" id="mobile-menu">
                    <div className="px-6 py-6 space-y-4">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                onClick={() => setIsOpen(false)}
                                className={`block px-4 py-5 rounded-lg text-lg font-bold transition-all ${pathname === link.href
                                    ? "text-[#d4a853] bg-[#0c1929]"
                                    : "text-gray-300 hover:text-white hover:bg-[#1a2744]"
                                    }`}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </nav>
    );
}
