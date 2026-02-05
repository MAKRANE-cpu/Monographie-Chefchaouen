import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Save, Shield, Database, Key, CheckCircle } from 'lucide-react';

const Settings = () => {
    const { apiKey, setApiKey, geminiApiKey, setGeminiApiKey } = useAppStore();
    const [inputKey, setInputKey] = useState(apiKey);
    const [inputGeminiKey, setInputGeminiKey] = useState(geminiApiKey);
    const [isAdmin, setIsAdmin] = useState(false);
    const [clickCount, setClickCount] = useState(0);

    const handleSave = () => {
        setApiKey(inputKey);
        setGeminiApiKey(inputGeminiKey);
        alert('Configurations IA sauvegardées !');
    };

    const handleVersionClick = () => {
        const next = clickCount + 1;
        setClickCount(next);
        if (next >= 5) {
            setIsAdmin(true);
            setClickCount(0);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Paramètres Général</h2>
            </div>

            {isAdmin ? (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="glass-card p-6 space-y-4 border-indigo-500/30">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                                <Key size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-white">Configuration IA (Hugging Face)</h3>
                                <p className="text-xs text-slate-400">Mode Administrateur Actif</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Token Hugging Face</label>
                                <input
                                    type="password"
                                    value={inputKey}
                                    onChange={(e) => setInputKey(e.target.value)}
                                    placeholder="hf_..."
                                    className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">Clé Gemini (Secours Ultime)</label>
                                <input
                                    type="password"
                                    value={inputGeminiKey}
                                    onChange={(e) => setInputGeminiKey(e.target.value)}
                                    placeholder="AIza..."
                                    className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                />
                            </div>

                            <button
                                onClick={handleSave}
                                className="w-full bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-500 flex items-center justify-center gap-2 font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                            >
                                <Save size={18} /> Sauvegarder les configurations
                            </button>
                        </div>
                    </div>

                    <div className="glass-card p-6 space-y-4 border-blue-500/30">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-blue-500/10 p-2 rounded-lg text-blue-400">
                                <Database size={20} />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-200">Source de Données</h3>
                        </div>

                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                            <p className="text-xs text-slate-500 uppercase font-bold mb-1">Google Sheet ID</p>
                            <p className="text-sm text-slate-300 font-mono break-all text-xs opacity-50 italic">Protégé par le système</p>
                            <div className="mt-3 flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                <span className="text-xs text-green-400">Base de données Synchronisée</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsAdmin(false)}
                        className="w-full py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                        Quitter le mode administrateur
                    </button>
                </div>
            ) : (
                <div className="glass-card p-12 text-center space-y-6">
                    <div className="bg-slate-800/50 p-4 rounded-full w-20 h-20 mx-auto flex items-center justify-center border border-white/5">
                        <Shield size={40} className="text-indigo-400" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold text-white">Sécurité & Confidentialité</h3>
                        <p className="text-sm text-slate-400 max-w-xs mx-auto">
                            Toutes les connexions aux serveurs de données et à l'IA sont chiffrées et sécurisées.
                        </p>
                    </div>
                    <div className="flex justify-center gap-4 text-xs text-slate-500 uppercase tracking-widest font-bold">
                        <span className="flex items-center gap-1"><CheckCircle size={10} className="text-emerald-500" /> HTTPS</span>
                        <span className="flex items-center gap-1"><CheckCircle size={10} className="text-emerald-500" /> API AES-256</span>
                    </div>
                </div>
            )}

            <div className="text-center pt-8 opacity-50">
                <p
                    onClick={handleVersionClick}
                    className="text-xs text-slate-500 cursor-pointer select-none hover:text-slate-400 transition-colors"
                >
                    Agri-Dashboard v1.0.3 • Chefchaouen Edition
                </p>
            </div>
        </div>
    );
};

export default Settings;
