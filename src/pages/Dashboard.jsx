import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { SHEET_CONFIG } from '../store/sheetsConfig';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Layers, AlertCircle, FileSpreadsheet, Sprout, TrendingUp } from 'lucide-react';

const Dashboard = () => {
    const { sheets, currentSheetId, loadData, isLoading, error, setSheetId } = useAppStore();

    const defaultId = SHEET_CONFIG[0].gid;
    const [activeTab, setActiveTab] = useState(currentSheetId === '0' ? defaultId : currentSheetId);

    useEffect(() => {
        if (!sheets[activeTab]) {
            loadData(activeTab);
        }
    }, [activeTab]);

    const currentData = useMemo(() => sheets[activeTab] || [], [sheets, activeTab]);

    const processedData = useMemo(() => {
        if (!currentData.length) return { chartData: [], areaColumns: [], yieldColumns: [], otherColumns: [], allKeys: [] };

        const validRows = currentData.filter(r => r && typeof r === 'object');
        if (!validRows.length) return { chartData: [], areaColumns: [], yieldColumns: [], otherColumns: [], allKeys: [] };

        const firstRow = validRows[0];
        const keys = Object.keys(firstRow);
        const nameKey = keys.find(k => k.toLowerCase().includes('commune') || k.toLowerCase().includes('cercle') || k.toLowerCase().includes('nom')) || keys[0];

        // IDENTIFY NUMERIC COLUMNS
        const numericCandidates = keys.filter(k => k !== nameKey && !k.toLowerCase().includes('code') && !k.toLowerCase().includes('id'));

        // FILTER OUT EMPTY COLUMNS (Optimization: Don't show columns that are 0 everywhere)
        // We check if at least one row has a non-zero value for this column
        const activeMetrics = numericCandidates.filter(key => {
            return validRows.some(row => {
                const val = Number(row[key]);
                return !isNaN(val) && val > 0;
            });
        });

        const areaColumns = [];
        const yieldColumns = [];
        const otherColumns = [];

        activeMetrics.forEach(k => {
            const lowerK = k.toLowerCase();
            if (lowerK.includes('ha') || lowerK.includes('superficie') || lowerK.includes('bour') || lowerK.includes('irrigu') || lowerK.includes('forêt') || lowerK.includes('parcours')) {
                areaColumns.push(k);
            } else if (lowerK.includes('qkx') || lowerK.includes('rdt') || lowerK.includes('rendement') || lowerK.includes('poids') || lowerK.includes('tonne')) {
                yieldColumns.push(k);
            } else {
                otherColumns.push(k);
            }
        });

        const chartsToShow = [...areaColumns, ...yieldColumns, ...otherColumns];

        // MAP ROWS & FILL DOWN COMMUNE NAME
        let lastUnknownName = "N/A";

        const chartData = validRows.map(row => {
            let nameVal = String(row[nameKey] || '').trim();

            // Fill down logic: if name is empty but we have data, use last known name
            if (!nameVal && lastUnknownName !== "N/A") {
                nameVal = lastUnknownName;
            } else if (nameVal) {
                lastUnknownName = nameVal;
            }

            const item = { name: nameVal || "N/A" };
            if (item.name === 'S/T' || item.name.includes('TOTAL')) return null;

            chartsToShow.forEach(key => {
                const val = Number(row[key]) || 0;
                item[key] = val;
            });

            item._raw = row;
            return item;
        }).filter(Boolean);

        // NORMALIZATION HELPER FOR HEADERS
        const norm = (s) => String(s || '').toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
            .replace(/['’‘`]/g, "'") // normalize apostrophes
            .replace(/[^a-z0-9]/g, ''); // alphanumeric only

        // REORDER COLUMNS FOR COOPERATIVES
        const isCoop = keys.some(k => norm(k).includes('nomcooperative'));
        let finalKeys = [...keys];
        let finalChartData = chartData;

        if (isCoop) {
            // Find specific keys by normalized matching
            const keyMap = {
                name: keys.find(k => norm(k).includes('commune')),
                nom: keys.find(k => norm(k).includes('nomcooperative')),
                type: keys.find(k => norm(k).includes('activite')),
                adherents: keys.find(k => norm(k).includes('adherent'))
            };

            const priorityCols = [keyMap.nom, keyMap.adherents].filter(Boolean);
            const otherCols = keys.filter(k => !priorityCols.includes(k) && k !== keyMap.name);

            // Reconstruct: [NameKey, ...Priority, ...Others]
            finalKeys = [keyMap.name || nameKey, ...priorityCols, ...otherCols].filter(k => keys.includes(k));

            // AGGREGATION LOGIC FOR COOPERATIVES
            const groups = {};
            chartData.forEach(item => {
                const groupName = item.name;
                if (!groups[groupName]) {
                    groups[groupName] = { name: groupName, _coops: [] };
                    chartsToShow.forEach(key => groups[groupName][key] = 0);
                }

                // Sum metrics (if any)
                chartsToShow.forEach(key => {
                    groups[groupName][key] += (Number(item[key]) || 0);
                });

                // Add to detailed list using mapped keys
                groups[groupName]._coops.push({
                    nom: item._raw[keyMap.nom] || '-',
                    type: item._raw[keyMap.type] || '-',
                    adherents: item._raw[keyMap.adherents] || 0
                });
            });
            finalChartData = Object.values(groups);
        }

        return {
            chartData: finalChartData,
            areaColumns,
            yieldColumns,
            otherColumns: (areaColumns.length === 0 && yieldColumns.length === 0) ? chartsToShow : otherColumns,
            allKeys: finalKeys
        };
    }, [currentData]);

    const handleTabChange = (gid) => {
        setActiveTab(gid);
        setSheetId(gid);
    };

    const categories = Object.entries(
        SHEET_CONFIG.reduce((acc, item) => {
            (acc[item.category] = acc[item.category] || []).push(item);
            return acc;
        }, {})
    );

    return (
        <div className="space-y-6 pb-20">
            {/* Header & Categorized Tabs */}
            <div className="space-y-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Monographie Provinciale</h2>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                    {categories.map(([cat, items]) => (
                        <div key={cat} className="flex-none snap-start">
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase mb-2 pl-1 tracking-wider">{cat}</h3>
                            <div className="flex bg-slate-800/50 p-1 rounded-xl gap-1">
                                {items.map(tab => (
                                    <button
                                        key={tab.gid}
                                        onClick={() => handleTabChange(tab.gid)}
                                        className={`px-3 py-2 rounded-lg text-[10px] font-medium transition-all whitespace-nowrap ${activeTab === tab.gid
                                            ? 'bg-indigo-600 text-white shadow shadow-indigo-500/20'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {error ? (
                <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-200">
                    <AlertCircle />
                    <div>
                        <h3 className="font-bold">Erreur de Chargement</h3>
                        <p className="text-sm opacity-80">{error}</p>
                    </div>
                </div>
            ) : isLoading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-indigo-300 animate-pulse text-xs uppercase tracking-widest">Chargement des données...</p>
                </div>
            ) : (
                <>
                    {/* AREA CHART */}
                    {processedData.areaColumns.length > 0 && (
                        <div className="glass-card p-4 space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wide flex items-center gap-2">
                                    <Sprout size={16} className="text-amber-400" /> Superficies (Ha)
                                </h3>
                            </div>
                            <div style={{ height: `${Math.max(400, processedData.chartData.length * 30)}px` }} className="w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={processedData.chartData} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={120} interval={0} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                        {processedData.areaColumns.map((col, idx) => (
                                            <Bar key={col} dataKey={col} fill={['#f59e0b', '#10b981', '#6366f1'][idx % 3]} radius={[0, 4, 4, 0]} barSize={12} name={col.replace(/_/g, ' ')} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* YIELD/OTHER CHART */}
                    {(processedData.yieldColumns.length > 0 || processedData.otherColumns.length > 0) && (
                        <div className="glass-card p-4 space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wide flex items-center gap-2">
                                    <TrendingUp size={16} className="text-cyan-400" /> {processedData.yieldColumns.length ? 'Rendements & Production' : 'Données'}
                                </h3>
                            </div>
                            <div style={{ height: `${Math.max(400, processedData.chartData.length * 30)}px` }} className="w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={processedData.chartData} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={120} interval={0} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                        {[...processedData.yieldColumns, ...processedData.otherColumns].map((col, idx) => (
                                            <Bar key={col} dataKey={col} fill={['#06b6d4', '#ec4899', '#8b5cf6'][idx % 3]} radius={[0, 4, 4, 0]} barSize={12} name={col.replace(/_/g, ' ')} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* FULL DATA TABLE */}
                    <div className="space-y-2">
                        <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wide px-1">Tableau de Données Complet</h3>
                        <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-900/50">
                            <table className="w-full text-xs text-left whitespace-nowrap">
                                <thead className="bg-slate-800 text-slate-400 sticky top-0">
                                    <tr>
                                        {processedData.allKeys.map(col => (
                                            <th key={col} className="p-3 font-semibold border-b border-slate-700">{col.replace(/_/g, ' ')}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800 text-slate-300">
                                    {processedData.chartData.map((row, i) => (
                                        <tr key={i} className="hover:bg-white/5">
                                            {processedData.allKeys.map(col => (
                                                <td key={col} className={`p-3 border-r border-slate-800/50 ${col === processedData.allKeys[0] ? 'font-medium text-white sticky left-0 bg-slate-900' : ''}`}>
                                                    {/* Render raw value */}
                                                    {row._raw ? row._raw[col] : row[col]}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// CUSTOM TOOLTIP TO HIDE ZERO VALUES
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        // CHECK FOR COOPERATIVE AGGREGATED DATA
        const coops = payload[0].payload._coops;

        // Strict filtering for standard charts: Only show items with value > 0
        const nonZeroParams = payload.filter(p => p.value > 0);

        // IF COOPERATIVES, RENDER SPECIAL LIST
        if (coops && coops.length > 0) {
            return (
                <div className="bg-slate-900/95 backdrop-blur border border-slate-700 p-3 rounded-lg shadow-xl z-50 max-w-xs">
                    <p className="text-white font-bold text-xs mb-2 border-b border-slate-700 pb-1">{label} ({coops.length})</p>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {coops.map((coop, i) => (
                            <div key={i} className="text-[10px] text-slate-300 border-b border-slate-800/50 last:border-0 pb-1">
                                <div className="flex gap-1 justify-between"><span className="text-indigo-400">Nom:</span> <span className="font-bold text-white max-w-[150px] truncate">{coop.nom}</span></div>
                                <div className="flex gap-1 justify-between"><span className="text-slate-500">Type:</span> <span className="max-w-[150px] truncate">{coop.type}</span></div>
                                <div className="flex gap-1 justify-between"><span className="text-slate-500">Adhérents:</span> <span className="text-white">{coop.adherents}</span></div>
                            </div>
                        ))}
                    </div>
                    {/* Show total if needed */}
                    {nonZeroParams.length > 0 && <div className="mt-2 pt-2 border-t border-slate-700 text-xs font-bold text-emerald-400 text-right">
                        Total: {nonZeroParams[0].value.toLocaleString()}
                    </div>}
                </div>
            );
        }

        if (nonZeroParams.length === 0) return null;

        return (
            <div className="bg-slate-900/95 backdrop-blur border border-slate-700 p-3 rounded-lg shadow-xl z-50">
                <p className="text-white font-bold text-xs mb-2 border-b border-slate-700 pb-1">{label}</p>
                {nonZeroParams.map((entry, index) => (
                    <div key={index} className="flex items-center gap-3 text-xs py-0.5">
                        <span className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: entry.fill, color: entry.fill }}></span>
                        {/* Trim the name to be cleaner if it's too long, optional */}
                        <span className="text-slate-300 max-w-[150px] truncate">{entry.name.replace('Nature du sol en % de la Superficie:', '')}:</span>
                        <span className="text-white font-mono ml-auto font-medium pl-4">{entry.value.toLocaleString()}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export default Dashboard;
