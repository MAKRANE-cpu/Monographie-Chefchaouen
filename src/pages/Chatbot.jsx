import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getHFResponse } from '../services/huggingFace';
import { Send, User, Bot, AlertTriangle, Sparkles } from 'lucide-react';

const Chatbot = () => {
    const { apiKey, data } = useAppStore();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([
        { role: 'model', content: "Bonjour ! Je suis votre assistant du service de la protection sociale et des statistiques." }
    ]);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;
        if (!apiKey) {
            alert("Veuillez configurer votre Token Hugging Face dans les Paramètres.");
            return;
        }

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        // Feedback message
        setMessages(prev => [...prev, { role: 'model', content: "🔍 Identification du volet de données..." }]);

        try {
            // STEP 1: AI Routing (Detect which sheet contains the answer)
            const { SHEET_CONFIG } = await import('../store/sheetsConfig');
            const hfService = await import('../services/huggingFace');

            console.log("AI Routing starts for:", input);
            const detectedGid = await hfService.detectCategory(apiKey, input, SHEET_CONFIG);

            let targetData = useAppStore.getState().data;

            // STEP 2: Fetch and use the correct data
            if (detectedGid && detectedGid.startsWith('GLOBAL_')) {
                const category = detectedGid === 'GLOBAL_VEGETAL' ? 'Végétal' : 'Animal';
                const relevantConfigs = SHEET_CONFIG.filter(c => c.category === category);

                setMessages(prev => {
                    const next = [...prev];
                    next[next.length - 1].content = `🌐 Analyse globale du volet **${category}** (${relevantConfigs.length} modules)...`;
                    return next;
                });

                const allData = await useAppStore.getState().loadAllSheets(relevantConfigs);

                // Merge all rows from these sheets
                targetData = [];
                relevantConfigs.forEach(c => {
                    if (allData[c.gid]) {
                        // Tag each row with its source label for AI clarity
                        const taggedRows = allData[c.gid].map(r => ({ ...r, "_volet": c.label }));
                        targetData.push(...taggedRows);
                    }
                });
            } else if (detectedGid) {
                const configItem = SHEET_CONFIG.find(c => c.gid === detectedGid);
                setMessages(prev => {
                    const next = [...prev];
                    next[next.length - 1].content = `📊 Analyse du volet : **${configItem ? configItem.label : detectedGid}**...`;
                    return next;
                });

                if (detectedGid !== useAppStore.getState().currentSheetId) {
                    if (!useAppStore.getState().sheets[detectedGid]) {
                        await useAppStore.getState().loadData(detectedGid);
                    }
                    targetData = useAppStore.getState().sheets[detectedGid];
                }
            } else {
                setMessages(prev => {
                    const next = [...prev];
                    next[next.length - 1].content = `🔍 Analyse globale... (Suggérez un volet spécifique pour plus de précision)`;
                    return next;
                });
            }

            // Fallback for empty data
            if (!targetData || targetData.length === 0) {
                if (useAppStore.getState().data.length === 0) {
                    await useAppStore.getState().loadData(SHEET_CONFIG[0].gid);
                }
                targetData = useAppStore.getState().data;
            }

            // STEP 3: Format Context (Dense & Clean) + GROUPED PROVINCIAL AGGREGATION
            const provincialGroups = {};
            const isGlobal = detectedGid && detectedGid.startsWith('GLOBAL_');

            // Comprehensive Technical Header Mapping
            const headerLabelMap = {
                // Céréales
                'sup_bt_ha': 'Blé Tendre (ha)', 'rdt_bt': 'Rendement Blé Tendre (qx/ha)',
                'sup_bd_ha': 'Blé Dur (ha)', 'rdt_bd': 'Rendement Blé Dur (qx/ha)',
                'sup_orge_ha': 'Orge (ha)', 'rdt_orge': 'Rendement Orge (qx/ha)',
                'sup_maïs_ha': 'Maïs (ha)', 'rdt_maïs': 'Rendement Maïs (qx/ha)',
                'sup_avoine_ha': 'Avoine (ha)', 'rdt_avoine': 'Rendement Avoine (qx/ha)',
                // Maraîchage
                'suptomate_ha': 'Tomate (ha)', 'rdt_tomate': 'Rendement Tomate (qx/ha)',
                'sup_p.terre_ha': 'Pomme de Terre (ha)', 'rdt_p.terre': 'Rendement Pomme de Terre (qx/ha)',
                'sup_carotte_ha': 'Carotte (ha)', 'rdt_carotte': 'Rendement Carotte (qx/ha)',
                'sup_navet_ha': 'Navet (ha)', 'rdt_navet': 'Rendement Navet (qx/ha)',
                'sup_haricot-vert_ha': 'Haricot-vert (ha)', 'rdt_haricot-vert': 'Rendement Haricot-vert (qx/ha)',
                'sup_p.p v_ha': 'Petit Pois (ha)', 'rdt_p.p v': 'Rendement Petit Pois (qx/ha)',
                'sup_fève-vert_ha': 'Fève-vert (ha)', 'rdt_fève-vert': 'Rendement Fève-vert (qx/ha)',
                'sup_oignon_ha': 'Oignon (ha)', 'rdt_oignon': 'Rendement Oignon (qx/ha)',
                'sup_courgette_ha': 'Courgette (ha)', 'rdt_courgette': 'Rendement Courgette (qx/ha)',
                'sup_ail_ha': 'Ail (ha)', 'rdt_ail': 'Rendement Ail (qx/ha)',
                'sup_piment_ha': 'Piment (ha)', 'rdt_piment': 'Rendement Piment (qx/ha)',
                'sup_aubergine_ha': 'Aubergine (ha)', 'rdt_aubergine': 'Rendement Aubergine (qx/ha)',
                'sup_choux_ha': 'Choux (ha)', 'rdt_choux': 'Rendement Choux (qx/ha)',
                'sup_concombre_ha': 'Concombre (ha)', 'rdt_concombre': 'Rendement Concombre (qx/ha)',
                'sup_pastèque_ha': 'Pastèque (ha)', 'rdt_pastèque': 'Rendement Pastèque (qx/ha)',
                'sup_melon_ha': 'Melon (ha)', 'rdt_melon': 'Rendement Melon (qx/ha)',
                // Fallbacks
                'sup_p.terre': 'Pomme de Terre (ha)',
                'sup_pomme de terre': 'Pomme de Terre (ha)'
            };

            const normalizeKey = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

            const dynamicRows = targetData.map(r => {
                const cleanedRow = {};
                const sourceVolet = r["_volet"] || "Donnée";
                if (!provincialGroups[sourceVolet]) provincialGroups[sourceVolet] = {};

                Object.keys(r).forEach(k => {
                    const val = r[k];
                    if (val === null || val === undefined || val === '') return;
                    const lowK = k.toLowerCase();
                    if (lowK.includes('id') || lowK.includes('code') || k === 'index' || k === '_volet') return;

                    // Header Normalization & Module Prefixing
                    const normK = normalizeKey(k);
                    let label = headerLabelMap[normK] || (k.includes(':') ? k.split(':').pop().trim() : k);

                    // Add units if missing and appropriate
                    if (k.includes('%') && !label.includes('%')) label += " (%)";
                    if (lowK.includes(' ha') && !label.includes('(ha)')) label += " (ha)";

                    // Unique Key for the AI (Module Prefixed)
                    const fullKey = `[${sourceVolet}] ${label}`;

                    // Logic for summation
                    const numericVal = parseFloat(String(val).replace(/[^0-9.,]/g, '').replace(',', '.'));
                    if (!isNaN(numericVal) && !label.includes('%')) {
                        const sumK = normalizeKey(label);
                        if (!provincialGroups[sourceVolet][sumK]) {
                            provincialGroups[sourceVolet][sumK] = { total: 0, label: label };
                        }
                        provincialGroups[sourceVolet][sumK].total += numericVal;
                    }

                    cleanedRow[fullKey] = val;
                });
                return cleanedRow;
            });

            // Build a very strong hierarchical Provincial Summary
            let provincialSummaryStr = "<PROVINCIAL_TOTALS_VERIFIED>\n";
            Object.entries(provincialGroups).forEach(([volet, entries]) => {
                provincialSummaryStr += `\n--- Volet: ${volet} ---\n`;
                // Sort by total for dominant cultures
                const sorted = Object.values(entries).sort((a, b) => b.total - a.total);
                sorted.forEach(e => {
                    if (e.total > 0) {
                        provincialSummaryStr += `- ${e.label} : ${e.total.toLocaleString('fr-FR')} (TOTAL PROVINCE)\n`;
                    }
                });
            });
            provincialSummaryStr += "</PROVINCIAL_TOTALS_VERIFIED>";

            // Optimized line-by-line details (skipping empty/zero values for token efficiency)
            const rowsStr = dynamicRows.map(row => {
                const commune = row["[Donnée] Commune"] || row["[Céréales] Commune"] || row["[Maraîchage] Commune"] || Object.values(row)[0];
                let rowSummary = `\nCOMMUNE: ${commune}\n`;
                let hasData = false;

                Object.entries(row).forEach(([k, v]) => {
                    const isCommuneKey = k.toLowerCase().includes('commune');
                    const isValueSignificant = v !== null && v !== undefined && v !== '' && v !== 0 && v !== '0';

                    if (!isCommuneKey && isValueSignificant) {
                        rowSummary += `  - ${k}: ${v}\n`;
                        hasData = true;
                    }
                });
                return hasData ? rowSummary : "";
            }).filter(s => s !== "").join('');

            const contextStr = `${provincialSummaryStr}\n\n<DÉTAILS_DES_COMMUNES_POUR_CLASSEMENT>\n${rowsStr}\n</DÉTAILS_DES_COMMUNES_POUR_CLASSEMENT>`;

            // Remove the temporary routing message
            setMessages(prev => prev.slice(0, -1));

            const currentLabel = detectedGid
                ? SHEET_CONFIG.find(c => c.gid === detectedGid)?.label
                : useAppStore.getState().currentSheetId
                    ? SHEET_CONFIG.find(c => c.gid === useAppStore.getState().currentSheetId)?.label
                    : "Données Actuelles";

            const responseText = await hfService.getHFResponse(apiKey, messages, input, contextStr, currentLabel);

            setMessages(prev => [...prev, { role: 'model', content: responseText }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'model', content: "Error: " + error.message }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full relative">
            {!apiKey && (
                <div className="absolute top-2 left-2 right-2 z-50 bg-amber-500/90 backdrop-blur text-white p-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg">
                    <AlertTriangle size={16} />
                    <span>Veuillez configurer votre Token Hugging Face dans les Paramètres.</span>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-4">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-4 rounded-2xl backdrop-blur-md shadow-sm border ${msg.role === 'user'
                            ? 'bg-indigo-600/80 border-indigo-500/50 text-white rounded-br-none'
                            : 'bg-slate-800/80 border-slate-700/50 text-slate-200 rounded-bl-none'
                            }`}>
                            <div className="flex items-center gap-2 mb-2 opacity-60 text-[10px] uppercase font-bold tracking-wider">
                                {msg.role === 'user' ? <User size={10} /> : <Sparkles size={10} className="text-amber-400" />}
                                <span>{msg.role === 'user' ? 'Vous' : 'Assistant Service'}</span>
                            </div>
                            <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5">
                            <div className="flex gap-1.5">
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75"></span>
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-150"></span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 glass-nav">
                <div className="flex gap-2 relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Posez une question sur les données..."
                        className="flex-1 p-4 bg-slate-900/50 border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-white placeholder-slate-500"
                        disabled={loading || !apiKey}
                    />
                    <button
                        onClick={handleSend}
                        disabled={loading || !apiKey}
                        className="bg-indigo-600 text-white p-4 rounded-xl hover:bg-indigo-500 disabled:opacity-50 transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
                    >
                        <Send size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Chatbot;
