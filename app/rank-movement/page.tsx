"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

// Dummy data matching the screenshot exactly
const initialTopThreePlayers = [
    {
        id: 2,
        position: "2nd",
        name: "Calvin Joseph",
        fullName: "Calvin Joseph",
        initials: "CJ",
        rating: 1279,
        tier: "PLATINUM PHOENIX",
        ratingChange: 0,
    },
    {
        id: 1,
        position: "1st",
        name: "PR",
        fullName: "PR",
        initials: "PR",
        rating: 1307,
        tier: "PLATINUM PHOENIX",
        ratingChange: 0,
    },
    {
        id: 3,
        position: "3rd",
        name: "HARY LIE",
        fullName: "Hary Lie",
        initials: "HL",
        rating: 1233,
        tier: "PLATINUM PHOENIX",
        ratingChange: 0,
    },
];

const initialLeaderboardData = [
    { rank: 4, name: "Brian Alexander", tier: "PLATINUM PHOENIX", rating: 1220, initials: "BA", ratingChange: 0 },
    { rank: 5, name: "Delroy Kumara", tier: "GOLDEN FALCON", rating: 1170, initials: "DK", ratingChange: 0 },
    { rank: "1st", name: "Miko", tier: "GOLDEN FALCON", rating: 1169, initials: "MK", ratingChange: 0 },
    { rank: 6, name: "Yosam / Yohanes Samuel", tier: "GOLDEN FALCON", rating: 1169, initials: "YS", ratingChange: 0 },
    { rank: 8, name: "HerKu (rovo) / HERRY\nKUHUELA", tier: "SILVER HAWK", rating: 1146, initials: "HK", ratingChange: 0 },
    { rank: 9, name: "Donny Kwandindo", tier: "SILVER HAWK", rating: 1132, initials: "DK", ratingChange: 0 },
    { rank: 10, name: "Denny Guna Panjalu", tier: "SILVER HAWK", rating: 1114, initials: "DG", ratingChange: 0 },
];

const getTierColor = (tier: string) => {
    switch (tier) {
        case "PLATINUM PHOENIX":
            return "#e5e4e2"; // Platinum
        case "GOLDEN FALCON":
            return "#ffd700"; // Gold
        case "SILVER HAWK":
            return "#c0c0c0"; // Silver
        case "BRONZE MERLIN":
            return "#cd7f32"; // Bronze
        case "EMERALD DOVE":
            return "#50c878"; // Emerald
        default:
            return "#ffffff";
    }
};

// Generate a unique gradient for avatar based on initials
const getAvatarGradient = (initials: string) => {
    const gradients = [
        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
        "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
        "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
        "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
    ];
    const index = initials.charCodeAt(0) % gradients.length;
    return gradients[index];
};

export default function RankMovement() {
    const [topThreePlayers, setTopThree] = useState<any[]>(initialTopThreePlayers);
    const [leaderboardData, setLeaderboardData] = useState<any[]>(initialLeaderboardData);
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const filteredLeaderboard = leaderboardData.filter((player) =>
        (player.name && player.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (player.tier && player.tier.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch the latest MVP period
                const { data: latestPeriod } = await supabase
                    .from('mvp_periods')
                    .select('id, name')
                    .order('year', { ascending: false })
                    .order('month', { ascending: false })
                    .limit(1)
                    .single();

                if (!latestPeriod) {
                    console.log("No MVP period found");
                    return;
                }

                // Fetch MVP entries with player data, sorted by rating_gain
                const { data, error } = await supabase
                    .from('mvp_entries')
                    .select(`
                        rank,
                        rating_gain,
                        events_count,
                        players (
                            full_name,
                            alternate_name,
                            initials,
                            divisions (name, color)
                        )
                    `)
                    .eq('period_id', latestPeriod.id)
                    .order('rating_gain', { ascending: false });

                if (error) {
                    console.error("Supabase error:", error);
                    return;
                }

                if (data && data.length > 0) {
                    // Transform data
                    const parsed = data.map((item: any, idx: number) => ({
                        rank: idx + 1,
                        name: item.players?.full_name || "",
                        fullName: item.players?.full_name || "",
                        initials: item.players?.initials || item.players?.full_name?.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase() || "XX",
                        tier: item.players?.divisions?.name || "SILVER HAWK",
                        rating: item.rating_gain,
                        ratingChange: 0,
                        eventsCount: item.events_count
                    }));

                    // Assign rank labels
                    parsed.forEach((p: any, idx: number) => {
                        if (idx === 0) p.rank = "1st";
                        else if (idx === 1) p.rank = "2nd";
                        else if (idx === 2) p.rank = "3rd";
                        else p.rank = idx + 1;
                    });

                    if (parsed.length >= 3) {
                        const top3 = [
                            { ...parsed[1], position: "2nd" },
                            { ...parsed[0], position: "1st" },
                            { ...parsed[2], position: "3rd" },
                        ];
                        setTopThree(top3);
                        setLeaderboardData(parsed.slice(3));
                    } else {
                        setLeaderboardData(parsed);
                    }
                }
            } catch (e) {
                console.error("Failed to fetch leaderboard data", e);
            }
        };

        fetchData();
    }, []);

    return (
        <div
            className="min-h-screen w-full"
            style={{
                background: "linear-gradient(180deg, #0c1929 0%, #132238 40%, #0c1929 100%)",
                minWidth: "100%",
                display: "flex",
                justifyContent: "center"
            }}
        >
            {/* Background city overlay effect */}
            <div
                className="fixed inset-0 opacity-25 pointer-events-none"
                style={{
                    background: "radial-gradient(ellipse at 50% 15%, rgba(40,70,100,0.5) 0%, transparent 55%)",
                }}
            />

            <div className="relative w-full max-w-[560px] mx-auto px-6" style={{ paddingTop: "140px", paddingBottom: "40px" }}>
                {/* Header Title */}
                <header className="text-center">
                    <h1
                        className="text-[22px] font-extrabold tracking-[0.2em] text-white uppercase"
                        style={{ fontFamily: "Inter, sans-serif", marginBottom: "30px" }}
                    >
                        RANK MOVEMENT
                    </h1>
                </header>

                {/* Podium Section - Top 3 */}
                <section className="relative" style={{ marginBottom: "30px" }}>
                    <div className="flex items-end justify-center gap-1 sm:gap-4 scale-90 sm:scale-100 origin-bottom">
                        {/* 2nd Place - Left */}
                        <div className="flex flex-col items-center w-[100px] sm:w-[130px]">
                            <span className="text-[#8a9bb3] text-[11px] sm:text-[13px] font-semibold mb-2 sm:mb-3 w-full text-center">2nd</span>
                            <div
                                className="relative mb-3 rounded-full flex items-center justify-center"
                                style={{
                                    width: "72px",
                                    height: "72px",
                                    border: "3px solid #6b7c93",
                                    background: getAvatarGradient(topThreePlayers[0].initials),
                                }}
                            >
                                <span className="text-white text-xl font-bold">{topThreePlayers[0].initials}</span>
                            </div>
                            <p className="text-white text-[13px] font-semibold text-center w-full leading-tight px-1 h-[32px] flex items-center justify-center">
                                {topThreePlayers[0].name}
                            </p>
                            <p className="text-white text-[16px] font-bold my-1">
                                {topThreePlayers[0].rating}
                            </p>
                            <div className="text-center leading-tight">
                                <p className="text-[9px] font-bold tracking-wide" style={{ color: getTierColor(topThreePlayers[0].tier) }}>
                                    PLATINUM
                                </p>
                                <p className="text-[9px] font-bold tracking-wide" style={{ color: getTierColor(topThreePlayers[0].tier) }}>
                                    PHOENIX
                                </p>
                            </div>
                        </div>

                        {/* 1st Place - Center (elevated) */}
                        <div className="flex flex-col items-center relative w-[140px]" style={{ marginTop: "-10px" }}>
                            <span className="text-[#d4a853] text-[13px] font-semibold mb-3 w-full text-center">1st</span>
                            <div
                                className="relative mb-3 rounded-full flex items-center justify-center"
                                style={{
                                    width: "88px",
                                    height: "88px",
                                    border: "4px solid #d4a853",
                                    boxShadow: "0 0 24px rgba(212,168,83,0.35)",
                                    background: getAvatarGradient(topThreePlayers[1].initials),
                                }}
                            >
                                <span className="text-white text-2xl font-bold">{topThreePlayers[1].initials}</span>
                            </div>
                            <p className="text-white text-[15px] font-bold text-center w-full leading-tight px-1 h-[36px] flex items-center justify-center">
                                {topThreePlayers[1].name}
                            </p>
                            <p className="text-white text-[18px] font-bold my-1">
                                {topThreePlayers[1].rating}
                            </p>
                            <div className="text-center leading-tight">
                                <p className="text-[9px] font-bold tracking-wide" style={{ color: getTierColor(topThreePlayers[1].tier) }}>
                                    PLATINUM
                                </p>
                                <p className="text-[9px] font-bold tracking-wide" style={{ color: getTierColor(topThreePlayers[1].tier) }}>
                                    PHOENIX
                                </p>
                            </div>
                        </div>

                        {/* 3rd Place - Right */}
                        <div className="flex flex-col items-center w-[100px] sm:w-[130px]">
                            <span className="text-[#cd7f32] text-[11px] sm:text-[13px] font-semibold mb-3 w-full text-center">3rd</span>
                            <div
                                className="relative mb-3 rounded-full flex items-center justify-center"
                                style={{
                                    width: "72px",
                                    height: "72px",
                                    border: "3px solid #cd7f32",
                                    background: getAvatarGradient(topThreePlayers[2].initials),
                                }}
                            >
                                <span className="text-white text-xl font-bold">{topThreePlayers[2].initials}</span>
                            </div>
                            <p className="text-white text-[13px] font-semibold text-center w-full leading-tight px-1 h-[32px] flex items-center justify-center">
                                {topThreePlayers[2].name}
                            </p>
                            <p className="text-white text-[16px] font-bold my-1">
                                {topThreePlayers[2].rating}
                            </p>
                            <div className="text-center leading-tight">
                                <p className="text-[9px] font-bold tracking-wide" style={{ color: getTierColor(topThreePlayers[2].tier) }}>
                                    PLATINUM
                                </p>
                                <p className="text-[9px] font-bold tracking-wide" style={{ color: getTierColor(topThreePlayers[2].tier) }}>
                                    PHOENIX
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Table Section */}
                <section
                    className="overflow-hidden"
                    style={{
                        background: "#162036",
                        borderRadius: "16px",
                        border: "1px solid #2a3f5f",
                        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
                    }}
                >
                    {/* Table Header */}
                    <div
                        className="sticky top-0 z-10"
                        style={{
                            background: "#1a2744",
                            borderBottom: "2px solid #d4a853",
                        }}
                    >
                        <div
                            className="grid items-center"
                            style={{
                                gridTemplateColumns: "50px 1fr 100px",
                                padding: "20px 16px"
                            }}
                        >
                            <span className="text-white text-[13px] font-bold">RANK</span>
                            <div className="flex items-center gap-2">
                                {isSearchActive ? (
                                    <input
                                        autoFocus
                                        type="text"
                                        className="bg-transparent border-b border-white text-white text-[13px] outline-none w-full placeholder-gray-400"
                                        placeholder="Search..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onBlur={() => {
                                            if (!searchQuery) setIsSearchActive(false);
                                        }}
                                    />
                                ) : (
                                    <>
                                        <svg
                                            onClick={() => setIsSearchActive(true)}
                                            className="w-4 h-4 text-white opacity-80 cursor-pointer hover:opacity-100 transition-opacity"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                            />
                                        </svg>
                                        <span
                                            onClick={() => setIsSearchActive(true)}
                                            className="text-white text-[13px] font-bold cursor-pointer hover:text-gray-300 transition-colors"
                                        >
                                            NAME / TIER
                                        </span>
                                    </>
                                )}
                            </div>
                            <span className="text-white text-[13px] font-bold text-right">RATING GAIN</span>
                        </div>
                    </div>

                    {/* Table Body */}
                    <div>
                        {filteredLeaderboard.map((player, index) => (
                            <div
                                key={`${player.rank}-${index}`}
                                className="grid items-center transition-colors duration-150 hover:brightness-110"
                                style={{
                                    gridTemplateColumns: "50px 1fr 100px",
                                    padding: "20px 16px",
                                    background: index % 2 === 0 ? "#1a2744" : "#162036",
                                    borderBottom: index < filteredLeaderboard.length - 1 ? "1px solid rgba(42,63,95,0.5)" : "none",
                                }}
                            >
                                {/* Rank */}
                                <div className="flex items-center justify-center">
                                    <span className="text-white text-[15px] font-semibold">
                                        {player.rank}
                                    </span>
                                </div>

                                {/* Name & Tier with Avatar */}
                                <div className="flex items-center gap-3">
                                    {/* Avatar with initials */}
                                    <div
                                        className="flex-shrink-0 rounded-full flex items-center justify-center"
                                        style={{
                                            width: "40px",
                                            height: "40px",
                                            border: "2px solid #3a4f6f",
                                            background: getAvatarGradient(player.initials),
                                        }}
                                    >
                                        <span className="text-white text-xs font-bold">{player.initials}</span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-white text-[13px] font-medium leading-tight whitespace-pre-line">
                                            {player.name}
                                        </p>
                                        <p
                                            className="text-[11px] font-bold tracking-wide"
                                            style={{ color: getTierColor(player.tier) }}
                                        >
                                            {player.tier}
                                        </p>
                                    </div>
                                </div>

                                {/* Rating */}
                                <div className="text-right">
                                    <span className="text-white text-[20px] font-bold">
                                        {player.rating}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Footer spacing */}
                <div className="h-12"></div>
            </div>
        </div>
    );
}

