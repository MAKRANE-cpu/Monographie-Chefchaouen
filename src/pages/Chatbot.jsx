import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getHFResponse } from '../services/huggingFace';
import { Send, User, Bot, AlertTriangle, Sparkles } from 'lucide-react';

const Chatbot = () => {
    const { apiKey, data } = useAppStore();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([
        { role: 'model', content: 'Bonjour ! Je suis votre assistant agricole IA (via Hugging Face). Je peux analyser les données de superficie, rendement et coopératives.' }
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
            if (detectedGid) {
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
                    next[next.length - 1].content = `⚠️ Volet non détecté. Utilisation des données par défaut...`;
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

            // STEP 3: Format Context (Dense & Clean)
            const dynamicRows = targetData.map(r => {
                const cleanedRow = {};
                Object.keys(r).forEach(k => {
                    const val = r[k];
                    // Skip empty values to keep context dense
                    if (val === null || val === undefined || val === '') return;

                    // Skip internal IDs
                    const lowK = k.toLowerCase();
                    if (lowK.includes('id') || lowK.includes('code') || k === 'index') return;

                    // Clean header but preserve unit
                    let cleanKey = k.includes(':') ? k.split(':').pop().trim() : k;
                    if (k.includes('%')) cleanKey += " (%)";
                    if (k.toLowerCase().includes(' ha')) cleanKey += " (ha)";

                    // Merge similar columns (case-insensitive merge)
                    const existingKey = Object.keys(cleanedRow).find(ek => ek.toLowerCase() === cleanKey.toLowerCase());
                    if (existingKey) {
                        if (typeof val === 'number' && typeof cleanedRow[existingKey] === 'number') {
                            cleanedRow[existingKey] += val;
                        } else {
                            cleanedRow[existingKey] = `${cleanedRow[existingKey]}, ${val}`;
                        }
                    } else {
                        cleanedRow[cleanKey] = val;
                    }
                });
                return cleanedRow;
            });

            // Compact string format: "Commune: X | Key: Y | ..."
            const contextStr = dynamicRows.map(row =>
                Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(' | ')
            ).join('\n');

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
                                <span>{msg.role === 'user' ? 'Vous' : 'IA Analyste'}</span>
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
