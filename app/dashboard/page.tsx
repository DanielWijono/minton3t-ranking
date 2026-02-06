"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

interface MVPEntry {
    rank: number;
    name: string;
    alternateName?: string;
    ratingGain: number;
    eventsCount: number;
    division: string;
}

interface Division {
    id: string;
    name: string;
    color: string;
}

export default function Dashboard() {
    const router = useRouter();
    // Dashboard Mode
    const [uploadType, setUploadType] = useState<"leaderboard" | "mvp">("leaderboard");

    // Leaderboard State
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [fileName, setFileName] = useState("");
    const [isSyncing, setIsSyncing] = useState(false);

    // MVP State
    const [mvpPreviewData, setMvpPreviewData] = useState<MVPEntry[]>([]);
    const [mvpFileName, setMvpFileName] = useState("");
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [divisions, setDivisions] = useState<Division[]>([]);

    // Fetch divisions for MVP
    useEffect(() => {
        const fetchDivisions = async () => {
            const { data } = await supabase.from("divisions").select("*");
            if (data) setDivisions(data);
        };
        fetchDivisions();
    }, []);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: "binary" });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            // Get raw data
            const data = XLSX.utils.sheet_to_json(ws);

            // Transform logic
            const transformed = data.map((row: any, idx: number) => {
                // Parse Name for split
                const rawName = row["NAME"] || "";
                let username = rawName;
                let fullName = rawName;

                if (rawName.includes("/")) {
                    const parts = rawName.split("/").map((s: string) => s.trim());
                    username = parts[0]; // "HerKu (rovo)"
                    fullName = parts[1]; // "HERRY KUHUELA"
                }

                // Initials generation
                let initials = "";
                const nameParts = username.split(" ");
                if (nameParts.length >= 2) {
                    initials = nameParts[0][0] + nameParts[1][0];
                } else {
                    initials = username.substring(0, 2);
                }
                initials = initials.toUpperCase();

                return {
                    id: idx, // Temp ID
                    rank: row["RANK"],
                    username, // Display Name
                    name: username, // For compatibility
                    fullName,
                    initials,
                    rating: row["RATING"],
                    tier: row["DIVISION"],
                };
            });

            setParsedData(transformed);
        };
        reader.readAsBinaryString(file);
    };

    const handleMVPFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setMvpFileName(file.name);

        const reader = new FileReader();
        reader.onload = (event) => {
            const data = event.target?.result;
            const workbook = XLSX.read(data, { type: "binary" });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            const entries: MVPEntry[] = jsonData.map((row: unknown) => {
                const r = row as Record<string, unknown>;
                const fullName = String(r["NAME"] || "");
                let name = fullName;
                let alternateName: string | undefined;

                // Handle names like "HerKu (rovo) / HERRY KUHUELA"
                if (fullName.includes(" / ")) {
                    const parts = fullName.split(" / ");
                    name = parts[0].trim();
                    alternateName = parts[1].trim();
                }

                return {
                    rank: Number(r["NO"]) || 0,
                    name,
                    alternateName,
                    ratingGain: Number(r["RATING GAIN"]) || 0,
                    eventsCount: Number(r["EVENT"]) || 0,
                    division: String(r["DIVISION"] || "").trim().toUpperCase(),
                };
            });

            setMvpPreviewData(entries);
        };
        reader.readAsBinaryString(file);
    };

    const handleMVPSync = async () => {
        if (mvpPreviewData.length === 0) return;
        setIsSyncing(true);

        try {
            // Find or create the period
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const periodName = `${monthNames[selectedMonth - 1]} ${selectedYear}`;

            let periodId: string;

            // Check if period exists
            const { data: existingPeriod } = await supabase
                .from("mvp_periods")
                .select("id")
                .eq("month", selectedMonth)
                .eq("year", selectedYear)
                .single();

            if (existingPeriod) {
                periodId = existingPeriod.id;
                // Delete existing entries for this period
                await supabase.from("mvp_entries").delete().eq("period_id", periodId);
            } else {
                // Create new period
                const { data: newPeriod } = await supabase
                    .from("mvp_periods")
                    .insert({ name: periodName, month: selectedMonth, year: selectedYear })
                    .select("id")
                    .single();
                periodId = newPeriod?.id;
            }

            // Process each entry
            for (const entry of mvpPreviewData) {
                // Find division
                const division = divisions.find(
                    (d) => d.name.toUpperCase() === entry.division.toUpperCase()
                );

                // Find or create player
                let playerId: string;
                const { data: existingPlayer } = await supabase
                    .from("players")
                    .select("id")
                    .eq("full_name", entry.name)
                    .single();

                if (existingPlayer) {
                    playerId = existingPlayer.id;
                    // Update player with alternate name and division if needed
                    await supabase
                        .from("players")
                        .update({
                            alternate_name: entry.alternateName,
                            division_id: division?.id,
                        })
                        .eq("id", playerId);
                } else {
                    // Create new player
                    const { data: newPlayer } = await supabase
                        .from("players")
                        .insert({
                            full_name: entry.name,
                            username: entry.name.toLowerCase().replace(/\s+/g, "_"),
                            initials: entry.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .substring(0, 2)
                                .toUpperCase(),
                            alternate_name: entry.alternateName,
                            division_id: division?.id,
                        })
                        .select("id")
                        .single();
                    playerId = newPlayer?.id;
                }

                // Create MVP entry
                await supabase.from("mvp_entries").insert({
                    period_id: periodId,
                    player_id: playerId,
                    rank: entry.rank,
                    rating_gain: entry.ratingGain,
                    events_count: entry.eventsCount,
                });
            }

            alert("MVP Data synced successfully!");
            setMvpPreviewData([]);
            setMvpFileName("");
        } catch (error: any) {
            console.error("Import error:", error);
            alert("Failed to sync MVP data: " + error.message);
        } finally {
            setIsSyncing(false);
        }
    };

    const getDivisionColor = (divisionName: string): string => {
        const division = divisions.find(
            (d) => d.name.toUpperCase() === divisionName.toUpperCase()
        );
        return division?.color || "#6b7280";
    };

    return (
        <div
            className="min-h-screen w-full text-white p-8"
            style={{
                background: "linear-gradient(180deg, #0c1929 0%, #132238 40%, #0c1929 100%)",
                display: "flex",
                justifyContent: "center",
            }}
        >
            <div className="max-w-4xl w-full mx-auto">
                <h1
                    className="text-3xl font-bold text-center"
                    style={{ marginBottom: "64px" }}
                >
                    Admin Dashboard
                </h1>

                {/* Upload Type Selector */}
                <div className="flex justify-center mb-8 gap-4">
                    <button
                        onClick={() => setUploadType("leaderboard")}
                        className={`px-6 py-2 rounded-lg font-semibold transition-colors border ${uploadType === "leaderboard"
                                ? "bg-[#d4a853] text-black border-[#d4a853]"
                                : "bg-transparent text-gray-400 border-[#2a3f5f] hover:text-white"
                            }`}
                    >
                        League / Leaderboard
                    </button>
                    <button
                        onClick={() => setUploadType("mvp")}
                        className={`px-6 py-2 rounded-lg font-semibold transition-colors border ${uploadType === "mvp"
                                ? "bg-[#d4a853] text-black border-[#d4a853]"
                                : "bg-transparent text-gray-400 border-[#2a3f5f] hover:text-white"
                            }`}
                    >
                        MVP
                    </button>
                </div>

                {/* LEADERBOARD UPLOAD */}
                {uploadType === "leaderboard" && (
                    <>
                        <div
                            className="bg-[#162036] p-6 rounded-xl border border-[#2a3f5f]"
                            style={{ marginBottom: "48px" }}
                        >
                            <h2 className="text-xl font-semibold mb-8">
                                Upload Leaderboard Excel
                            </h2>
                            <div className="flex items-center gap-4">
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-[#2a3f5f] border-dashed rounded-lg cursor-pointer hover:bg-[#1a2744] transition-colors">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <svg className="w-8 h-8 mb-4 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
                                        </svg>
                                        <p className="text-sm text-gray-400" style={{ marginBottom: "24px" }}>
                                            <span className="font-semibold">Click to upload</span> or drag and drop
                                        </p>
                                        <p className="text-xs text-gray-500">.XLSX or .CSV files</p>
                                    </div>
                                    <input type="file" className="hidden" accept=".xlsx, .csv" onChange={handleFileUpload} />
                                </label>
                            </div>
                            {fileName && <p className="mt-2 text-sm text-green-400">Selected: {fileName}</p>}
                        </div>

                        {/* Leaderboard Preview */}
                        {parsedData.length > 0 && (
                            <div className="bg-[#162036] p-6 rounded-xl border border-[#2a3f5f]">
                                <div className="flex justify-between items-center" style={{ marginBottom: "40px" }}>
                                    <h2 className="text-xl font-semibold">Preview Data ({parsedData.length} entries)</h2>
                                    <button
                                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={isSyncing}
                                        onClick={async () => {
                                            setIsSyncing(true);
                                            try {
                                                const { error: deleteError } = await supabase
                                                    .from('players')
                                                    .delete()
                                                    .neq('id', '00000000-0000-0000-0000-000000000000');

                                                if (deleteError) throw new Error("Delete failed: " + deleteError.message);

                                                const playersToInsert = parsedData.map(p => ({
                                                    username: p.username,
                                                    full_name: p.fullName,
                                                    initials: p.initials,
                                                }));

                                                const { data: insertedPlayers, error: insertError } = await supabase
                                                    .from('players')
                                                    .insert(playersToInsert)
                                                    .select();

                                                if (insertError) throw new Error("Insert players failed: " + insertError.message);
                                                if (!insertedPlayers) throw new Error("No players inserted");

                                                const statsToInsert = parsedData.map(row => {
                                                    const player = insertedPlayers.find(p => p.username === row.username);
                                                    if (!player) return null;
                                                    return {
                                                        player_id: player.id,
                                                        rating: row.rating,
                                                        tier: row.tier,
                                                        rank: row.rank
                                                    };
                                                }).filter(s => s !== null);

                                                const { error: statsError } = await supabase
                                                    .from('leaderboard_stats')
                                                    .insert(statsToInsert);

                                                if (statsError) throw new Error("Insert stats failed: " + statsError.message);

                                                alert("Leaderboard synced successfully to Supabase!");
                                                setParsedData([]);
                                                setFileName("");
                                                router.push("/");
                                            } catch (error: any) {
                                                console.error("Sync error:", error);
                                                alert("Failed to sync: " + error.message);
                                            } finally {
                                                setIsSyncing(false);
                                            }
                                        }}
                                    >
                                        {isSyncing ? "Syncing..." : "Confirm Sync"}
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left text-gray-300">
                                        <thead className="text-xs text-gray-400 uppercase bg-[#1a2744]">
                                            <tr>
                                                <th scope="col" className="px-6 py-4">Rank</th>
                                                <th scope="col" className="px-6 py-4">Display Name</th>
                                                <th scope="col" className="px-6 py-4">Full Name</th>
                                                <th scope="col" className="px-6 py-4">Rating</th>
                                                <th scope="col" className="px-6 py-4">Tier</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parsedData.map((row, idx) => (
                                                <tr key={idx} className="border-b border-[#2a3f5f] hover:bg-[#1a2744]">
                                                    <td className="px-6 py-5 font-medium text-white">{row.rank}</td>
                                                    <td className="px-6 py-5 text-white">{row.username}</td>
                                                    <td className="px-6 py-5 text-gray-400">{row.fullName}</td>
                                                    <td className="px-6 py-5 font-bold text-white">{row.rating}</td>
                                                    <td className="px-6 py-5">{row.tier}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* MVP UPLOAD */}
                {uploadType === "mvp" && (
                    <>
                        <div
                            className="bg-[#162036] p-6 rounded-xl border border-[#2a3f5f]"
                            style={{ marginBottom: "48px" }}
                        >
                            <h2 className="text-xl font-semibold mb-6">
                                Upload MVP Excel
                            </h2>

                            {/* Date Selectors */}
                            <div className="flex gap-4 mb-6">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Month</label>
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                        className="bg-[#0f1829] text-white px-4 py-2 rounded-lg border border-[#2a3f5f] focus:border-[#d4a853] outline-none"
                                    >
                                        {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => (
                                            <option key={m} value={i + 1}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Year</label>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        className="bg-[#0f1829] text-white px-4 py-2 rounded-lg border border-[#2a3f5f] focus:border-[#d4a853] outline-none"
                                    >
                                        {[2024, 2025, 2026, 2027].map((y) => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-[#2a3f5f] border-dashed rounded-lg cursor-pointer hover:bg-[#1a2744] transition-colors">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <svg className="w-8 h-8 mb-4 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
                                        </svg>
                                        <p className="text-sm text-gray-400" style={{ marginBottom: "24px" }}>
                                            <span className="font-semibold">Click to upload</span> or drag and drop
                                        </p>
                                        <p className="text-xs text-gray-500">.XLSX or .CSV files (Structure: No, Name, Rating Gain, Event, Division)</p>
                                    </div>
                                    <input type="file" className="hidden" accept=".xlsx, .csv" onChange={handleMVPFileUpload} />
                                </label>
                            </div>
                            {mvpFileName && <p className="mt-2 text-sm text-green-400">Selected: {mvpFileName}</p>}
                        </div>

                        {/* MVP Preview */}
                        {mvpPreviewData.length > 0 && (
                            <div className="bg-[#162036] p-6 rounded-xl border border-[#2a3f5f]">
                                <div className="flex justify-between items-center" style={{ marginBottom: "40px" }}>
                                    <h2 className="text-xl font-semibold">
                                        Preview MVP Data for {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][selectedMonth - 1]} {selectedYear}
                                    </h2>
                                    <button
                                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={isSyncing}
                                        onClick={handleMVPSync}
                                    >
                                        {isSyncing ? "Syncing..." : "Confirm Sync"}
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left text-gray-300">
                                        <thead className="text-xs text-gray-400 uppercase bg-[#1a2744]">
                                            <tr>
                                                <th scope="col" className="px-6 py-4">Rank</th>
                                                <th scope="col" className="px-6 py-4">Name</th>
                                                <th scope="col" className="px-6 py-4">Rating Gain</th>
                                                <th scope="col" className="px-6 py-4">Events</th>
                                                <th scope="col" className="px-6 py-4">Division</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {mvpPreviewData.map((row, idx) => (
                                                <tr key={idx} className="border-b border-[#2a3f5f] hover:bg-[#1a2744]">
                                                    <td className="px-6 py-5 font-medium text-white">{row.rank}</td>
                                                    <td className="px-6 py-5 text-white">
                                                        {row.name}
                                                        {row.alternateName && (
                                                            <span className="text-gray-400 text-xs ml-2">({row.alternateName})</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-5 font-bold text-green-400">+{row.ratingGain}</td>
                                                    <td className="px-6 py-5">{row.eventsCount}</td>
                                                    <td className="px-6 py-5">
                                                        <span
                                                            className="px-2 py-1 rounded text-xs font-semibold"
                                                            style={{ backgroundColor: getDivisionColor(row.division) + "20", color: getDivisionColor(row.division) }}
                                                        >
                                                            {row.division}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}

            </div>
        </div>
    );
}
