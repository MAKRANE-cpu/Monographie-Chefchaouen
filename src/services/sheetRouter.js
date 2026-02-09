/**
 * Smart Sheet Router - Version Ultra-Robuste (Fuzzy)
 * Gère les variations (de/du/des), les accents, et les fautes de frappe mineures (lettres doublées)
 */

const normalizeText = (text) => {
    return text.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Supprime les accents
        .replace(/\b(de|du|des|le|la|les|un|une|l|d|nombre|nbr|quantite|liste)\b/g, ' ') // Supprime les stop-words
        .replace(/(.)\1+/g, '$1') // Réduit les lettres doubles
        .replace(/\s+/g, ' ')
        .trim();
};

export const detectBestSheet = (userQuestion, sheetConfigs) => {
    const inputLower = userQuestion.toLowerCase();
    const inputNormalized = normalizeText(userQuestion);

    let bestMatch = null;
    let bestScore = 0;

    sheetConfigs.forEach(config => {
        const keywords = config.keywords.toLowerCase().split(',');
        let score = 0;

        keywords.forEach(kw => {
            const keyword = kw.trim();
            const keywordNormalized = normalizeText(keyword);

            // 1. Match exact de l'expression originale (Priorité 1)
            if (inputLower.includes(keyword)) {
                const wordCount = keyword.split(' ').length;
                score += keyword.length * wordCount * 10;
            }
            // 2. Match normalisé (Typos & Accents) (Priorité 2)
            else if (inputNormalized.includes(keywordNormalized)) {
                const wordCount = keywordNormalized.split(' ').length;
                score += keywordNormalized.length * wordCount * 5;
            }
            // 3. Match partiel par mot (Priorité 3)
            else {
                const kwWords = keywordNormalized.split(' ').filter(w => w.length > 3);
                kwWords.forEach(word => {
                    if (inputNormalized.includes(word)) {
                        score += word.length;
                    }
                });
            }
        });

        if (score > bestScore) {
            bestScore = score;
            bestMatch = config;
        }
    });

    if (bestMatch && bestScore > 0) {
        console.log(`🎯 Router Best Match: ${bestMatch.label} (Score: ${bestScore})`);
    } else {
        console.warn("⚠️ No confident match found by Router");
    }

    return bestMatch && bestScore > 0 ? bestMatch : null;
};
