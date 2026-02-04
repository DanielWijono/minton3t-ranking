"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function Dashboard() {
    const router = useRouter();
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [fileName, setFileName] = useState("");
    const [isSyncing, setIsSyncing] = useState(false);

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

    return (
        <div
            className="min-h-screen w-full text-white p-8"
            style={{
                background: "linear-gradient(180deg, #0c1929 0%, #132238 40%, #0c1929 100%)",
            }}
        >
            <div className="max-w-4xl mx-auto">
                <h1
                    className="text-3xl font-bold"
                    style={{ marginBottom: "64px" }}
                >
                    Admin Dashboard
                </h1>

                {/* Upload Section */}
                {/* Upload Section */}
                <div
                    className="bg-[#162036] p-6 rounded-xl border border-[#2a3f5f]"
                    style={{ marginBottom: "48px" }}
                >
                    <h2
                        className="text-xl font-semibold"
                        style={{ marginBottom: "40px" }}
                    >
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

                {/* Preview Section */}
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
                                        // 1. Delete all existing data
                                        // Using a filter that is always true to delete all rows.
                                        // NOTE: Ensure your 'players' table has 'ON DELETE CASCADE' for stats.
                                        const { error: deleteError } = await supabase
                                            .from('players')
                                            .delete()
                                            .neq('id', '00000000-0000-0000-0000-000000000000'); // Hack to delete all

                                        if (deleteError) throw new Error("Delete failed: " + deleteError.message);

                                        // 2. Prepare Match Data
                                        const playersToInsert = parsedData.map(p => ({
                                            username: p.username,
                                            full_name: p.fullName,
                                            initials: p.initials,
                                        }));

                                        // 3. Batch Insert Players
                                        const { data: insertedPlayers, error: insertError } = await supabase
                                            .from('players')
                                            .insert(playersToInsert)
                                            .select();

                                        if (insertError) throw new Error("Insert players failed: " + insertError.message);
                                        if (!insertedPlayers) throw new Error("No players inserted");

                                        // 4. Map back to get IDs for Stats
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

                                        // 5. Batch Insert Stats
                                        const { error: statsError } = await supabase
                                            .from('leaderboard_stats')
                                            .insert(statsToInsert);

                                        if (statsError) throw new Error("Insert stats failed: " + statsError.message);

                                        alert("Leaderboard synced successfully to Supabase!");
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
            </div>
        </div>
    );
}
