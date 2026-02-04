import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { SHEET_CONFIG } from '../store/sheetsConfig';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileDown, FileText, Loader2, CheckCircle } from 'lucide-react';

const Report = () => {
    const { sheets, loadAllSheets } = useAppStore();
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState('');

    const generateProfessionalPDF = async () => {
        setGenerating(true);
        try {
            setProgress('Chargement de toutes les données...');
            const allSheets = await loadAllSheets(SHEET_CONFIG);

            setProgress('Initialisation du rapport...');
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // --- PAGE DE GARDE ---
            doc.setFillColor(30, 58, 138); // Royal Blue
            doc.rect(0, 0, pageWidth, pageHeight, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(28);
            doc.text("MONOGRAPHIE PROVINCIALE", pageWidth / 2, 80, { align: "center" });

            doc.setFontSize(36);
            doc.setFont("helvetica", "bold");
            doc.text("CHEFCHAOUEN", pageWidth / 2, 100, { align: "center" });

            doc.setLineWidth(2);
            doc.setDrawColor(255, 255, 255);
            doc.line(pageWidth / 4, 110, (pageWidth * 3) / 4, 110);

            doc.setFontSize(14);
            doc.setFont("helvetica", "normal");
            doc.text("Direction Provinciale de l'Agriculture", pageWidth / 2, 125, { align: "center" });

            doc.setFontSize(10);
            doc.text(`Édition : ${new Date().getFullYear()}`, pageWidth / 2, 260, { align: "center" });
            doc.text(`Généré le : ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, 268, { align: "center" });

            // --- CHAPITRES PAR CATÉGORIE ---
            const categories = [...new Set(SHEET_CONFIG.map(c => c.category))];

            categories.forEach((cat, catIdx) => {
                doc.addPage();
                setProgress(`Génération du chapitre : ${cat}...`);

                // Header
                doc.setFillColor(241, 245, 249);
                doc.rect(0, 0, pageWidth, 25, 'F');
                doc.setTextColor(30, 58, 138);
                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.text(`Chapitre ${catIdx + 1} : ${cat.toUpperCase()}`, 14, 16);

                let currentY = 40;

                // Loop sheets in this category
                const catSheets = SHEET_CONFIG.filter(c => c.category === cat);
                catSheets.forEach(config => {
                    const data = allSheets[config.gid] || [];
                    if (data.length === 0) return;

                    doc.setTextColor(64, 64, 64);
                    doc.setFontSize(12);
                    doc.text(config.label, 14, currentY);
                    currentY += 8;

                    const headers = Object.keys(data[0]).filter(h => !h.toLowerCase().includes('id') && !h.toLowerCase().includes('code'));
                    const rows = data.slice(0, 15).map(row => headers.map(h => row[h] || '-'));

                    autoTable(doc, {
                        startY: currentY,
                        head: [headers.map(h => h.replace(/[:_]/g, ' ').replace('Nature du sol en % de la Superficie', 'Type Sol'))],
                        body: rows,
                        theme: 'striped',
                        styles: { fontSize: 7, cellPadding: 2 },
                        headStyles: { fillColor: [30, 58, 138], textColor: 255 },
                        margin: { left: 14, right: 14 }
                    });

                    currentY = doc.lastAutoTable.finalY + 15;

                    // Add new page if needed
                    if (currentY > pageHeight - 40) {
                        doc.addPage();
                        currentY = 30;
                    }
                });
            });

            // Footer for all pages except cover
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 2; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text(`Monographie Provinciale de Chefchaouen - Page ${i} / ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: "center" });
            }

            doc.save(`Monographie_Chefchaouen_${new Date().getFullYear()}.pdf`);
            setProgress('Terminé !');
            setTimeout(() => setProgress(''), 3000);
        } catch (error) {
            console.error(error);
            setProgress('Erreur lors de la génération.');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full p-6">
            <div className="w-full max-w-2xl glass-card p-12 text-center space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="relative inline-block">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full"></div>
                    <div className="relative bg-slate-800 p-6 rounded-3xl border border-white/10 shadow-2xl">
                        {generating ? (
                            <Loader2 size={64} className="text-indigo-400 animate-spin" />
                        ) : progress === 'Terminé !' ? (
                            <CheckCircle size={64} className="text-emerald-400 animate-bounce" />
                        ) : (
                            <FileText size={64} className="text-indigo-400" />
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <h2 className="text-3xl font-bold text-white tracking-tight">Rapport Officiel</h2>
                    <p className="text-slate-400 text-lg">Générer la Monographie Provinciale Complète</p>
                </div>

                <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 text-left space-y-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Contenu du Rapport</h4>
                    <ul className="grid grid-cols-2 gap-3 text-sm text-slate-300">
                        <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" /> 28 Volets de données</li>
                        <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" /> Structure par Chapitres</li>
                        <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" /> Synthèse Agricole</li>
                        <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" /> Données Démographiques</li>
                    </ul>
                </div>

                <button
                    onClick={generateProfessionalPDF}
                    disabled={generating}
                    className="group relative w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
                >
                    <span className="flex items-center justify-center gap-3">
                        {generating ? progress : (
                            <>
                                <FileDown size={24} className="group-hover:translate-y-1 transition-transform" />
                                Télécharger la Monographie (PDF)
                            </>
                        )}
                    </span>
                </button>

                <p className="text-[10px] text-slate-500 italic">
                    Note : Ce processus peut prendre quelques secondes pour agréger l'ensemble des bases de données.
                </p>
            </div>
        </div>
    );
};

export default Report;
