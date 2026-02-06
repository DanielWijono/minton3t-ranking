"use client";

import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabaseClient";

interface MVPEntry {
    rank: number;
    name: string;
    alternateName?: string;
    ratingGain: number;
    eventsCount: number;
    division: string;
}

interface MVPPeriod {
    id: string;
    name: string;
    month: number;
    year: number;
}

interface Division {
    id: string;
    name: string;
    color: string;
}

export default function MVPPage() {
    const [periods, setPeriods] = useState<MVPPeriod[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<string>("");
    const [mvpData, setMvpData] = useState<MVPEntry[]>([]);
    const [divisions, setDivisions] = useState<Division[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadPreview, setUploadPreview] = useState<MVPEntry[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [loading, setLoading] = useState(true);

    // Fetch divisions
    useEffect(() => {
        const fetchDivisions = async () => {
            const { data } = await supabase.from("divisions").select("*");
            if (data) setDivisions(data);
        };
        fetchDivisions();
    }, []);

    // Fetch MVP periods
    useEffect(() => {
        const fetchPeriods = async () => {
            const { data } = await supabase
                .from("mvp_periods")
                .select("*")
                .order("year", { ascending: false })
                .order("month", { ascending: false });
            if (data) {
                setPeriods(data);
                if (data.length > 0) {
                    setSelectedPeriod(data[0].id);
                }
            }
            setLoading(false);
        };
        fetchPeriods();
    }, []);

    // Fetch MVP data for selected period
    const fetchMVPData = useCallback(async () => {
        if (!selectedPeriod) return;

        const { data } = await supabase
            .from("mvp_entries")
            .select(`
                rank,
                rating_gain,
                events_count,
                players (
                    full_name,
                    alternate_name,
                    divisions (name, color)
                )
            `)
            .eq("period_id", selectedPeriod)
            .order("rank", { ascending: true });

        if (data) {
            const entries: MVPEntry[] = data.map((entry) => {
                const player = entry.players as unknown as { full_name: string; alternate_name: string | null; divisions: { name: string; color: string } | null } | null;
                return {
                    rank: entry.rank,
                    name: player?.full_name || "",
                    alternateName: player?.alternate_name || undefined,
                    ratingGain: entry.rating_gain,
                    eventsCount: entry.events_count,
                    division: player?.divisions?.name || "",
                };
            });
            setMvpData(entries);
        }
    }, [selectedPeriod]);

    useEffect(() => {
        fetchMVPData();
    }, [fetchMVPData]);

    // Parse Excel file
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

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

            setUploadPreview(entries);
            setShowPreview(true);
        };
        reader.readAsBinaryString(file);
    };

    // Import data to Supabase
    const handleImport = async () => {
        if (uploadPreview.length === 0) return;
        setIsUploading(true);

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
            for (const entry of uploadPreview) {
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

            // Refresh data
            const { data: updatedPeriods } = await supabase
                .from("mvp_periods")
                .select("*")
                .order("year", { ascending: false })
                .order("month", { ascending: false });
            if (updatedPeriods) {
                setPeriods(updatedPeriods);
                setSelectedPeriod(periodId);
            }

            setShowPreview(false);
            setUploadPreview([]);
        } catch (error) {
            console.error("Import error:", error);
        } finally {
            setIsUploading(false);
        }
    };

    const getDivisionColor = (divisionName: string): string => {
        const division = divisions.find(
            (d) => d.name.toUpperCase() === divisionName.toUpperCase()
        );
        return division?.color || "#6b7280";
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#0f1829] to-[#1a2744] flex items-center justify-center">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0f1829] to-[#1a2744]">
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">MVP Rankings</h1>
                    <p className="text-gray-400">Most Valuable Players by Rating Gain</p>
                </div>

                {/* Upload Section */}
                <div className="bg-[#1a2744]/80 backdrop-blur-sm rounded-xl p-6 mb-8 border border-[#2a3f5f]">
                    <h2 className="text-xl font-semibold text-white mb-4">Upload MVP Data</h2>
                    <div className="flex flex-wrap gap-4 items-end">
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
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Excel/CSV File</label>
                            <input
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleFileUpload}
                                className="bg-[#0f1829] text-white px-4 py-2 rounded-lg border border-[#2a3f5f] file:mr-4 file:py-1 file:px-4 file:rounded-lg file:border-0 file:bg-[#d4a853] file:text-black file:font-semibold file:cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                {/* Upload Preview Modal */}
                {showPreview && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                        <div className="bg-[#1a2744] rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-auto border border-[#2a3f5f]">
                            <h3 className="text-xl font-semibold text-white mb-4">
                                Preview Import - {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][selectedMonth - 1]} {selectedYear}
                            </h3>
                            <div className="overflow-x-auto mb-4">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-gray-400 border-b border-[#2a3f5f]">
                                            <th className="py-2 text-left">Rank</th>
                                            <th className="py-2 text-left">Name</th>
                                            <th className="py-2 text-left">Rating Gain</th>
                                            <th className="py-2 text-left">Events</th>
                                            <th className="py-2 text-left">Division</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {uploadPreview.slice(0, 20).map((entry, i) => (
                                            <tr key={i} className="text-white border-b border-[#2a3f5f]/50">
                                                <td className="py-2">{entry.rank}</td>
                                                <td className="py-2">
                                                    {entry.name}
                                                    {entry.alternateName && (
                                                        <span className="text-gray-400 text-xs ml-2">({entry.alternateName})</span>
                                                    )}
                                                </td>
                                                <td className="py-2 text-green-400">+{entry.ratingGain}</td>
                                                <td className="py-2">{entry.eventsCount}</td>
                                                <td className="py-2">
                                                    <span
                                                        className="px-2 py-1 rounded text-xs font-semibold"
                                                        style={{ backgroundColor: getDivisionColor(entry.division) + "20", color: getDivisionColor(entry.division) }}
                                                    >
                                                        {entry.division}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {uploadPreview.length > 20 && (
                                    <p className="text-gray-400 text-sm mt-2">...and {uploadPreview.length - 20} more entries</p>
                                )}
                            </div>
                            <div className="flex gap-4 justify-end">
                                <button
                                    onClick={() => { setShowPreview(false); setUploadPreview([]); }}
                                    className="px-6 py-2 rounded-lg border border-[#2a3f5f] text-gray-400 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={isUploading}
                                    className="px-6 py-2 rounded-lg bg-[#d4a853] text-black font-semibold hover:bg-[#c49843] transition-colors disabled:opacity-50"
                                >
                                    {isUploading ? "Importing..." : "Import Data"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Period Selector */}
                {periods.length > 0 && (
                    <div className="mb-6">
                        <label className="block text-sm text-gray-400 mb-2">Select Period</label>
                        <select
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(e.target.value)}
                            className="bg-[#0f1829] text-white px-4 py-2 rounded-lg border border-[#2a3f5f] focus:border-[#d4a853] outline-none"
                        >
                            {periods.map((period) => (
                                <option key={period.id} value={period.id}>{period.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* MVP Table */}
                {mvpData.length > 0 ? (
                    <div className="bg-[#1a2744]/80 backdrop-blur-sm rounded-xl overflow-hidden border border-[#2a3f5f]">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-[#0f1829] text-gray-400 text-sm">
                                    <th className="py-4 px-6 text-left">RANK</th>
                                    <th className="py-4 px-6 text-left">NAME</th>
                                    <th className="py-4 px-6 text-center">RATING GAIN</th>
                                    <th className="py-4 px-6 text-center">EVENTS</th>
                                    <th className="py-4 px-6 text-right">DIVISION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mvpData.map((entry, index) => (
                                    <tr
                                        key={index}
                                        className={`border-t border-[#2a3f5f]/50 ${index < 3 ? "bg-gradient-to-r from-[#d4a853]/10 to-transparent" : ""}`}
                                    >
                                        <td className="py-4 px-6">
                                            <span className={`font-bold ${index < 3 ? "text-[#d4a853] text-xl" : "text-white"}`}>
                                                {entry.rank}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="text-white font-semibold">{entry.name}</div>
                                            {entry.alternateName && (
                                                <div className="text-gray-400 text-sm">{entry.alternateName}</div>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className="text-green-400 font-bold">+{entry.ratingGain}</span>
                                        </td>
                                        <td className="py-4 px-6 text-center text-white">{entry.eventsCount}</td>
                                        <td className="py-4 px-6 text-right">
                                            <span
                                                className="px-3 py-1 rounded-full text-xs font-bold"
                                                style={{
                                                    backgroundColor: getDivisionColor(entry.division) + "30",
                                                    color: getDivisionColor(entry.division),
                                                }}
                                            >
                                                {entry.division}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="bg-[#1a2744]/80 backdrop-blur-sm rounded-xl p-12 text-center border border-[#2a3f5f]">
                        <p className="text-gray-400 text-lg">No MVP data available for this period.</p>
                        <p className="text-gray-500 text-sm mt-2">Upload an Excel file to get started.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
