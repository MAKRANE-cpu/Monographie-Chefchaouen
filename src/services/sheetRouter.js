/**
 * Smart Sheet Router - Version Robuste
 * Gère les variations (de/du/des) et les fautes mineures
 */

export const detectBestSheet = (userQuestion, sheetConfigs) => {
    const inputLower = userQuestion.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    // Nettoyer la question pour faciliter le matching (enlever de/du/des)
    const normalizedInput = inputLower.replace(/\b(de|du|des|le|la|les|un|une)\b/g, ' ').replace(/\s+/g, ' ').trim();

    sheetConfigs.forEach(config => {
        const keywords = config.keywords.toLowerCase().split(',');
        let score = 0;

        keywords.forEach(kw => {
            const keyword = kw.trim();
            const normalizedKeyword = keyword.replace(/\b(de|du|des|le|la|les|un|une)\b/g, ' ').replace(/\s+/g, ' ').trim();

            // Match exact de l'expression (priorité maximale)
            if (inputLower.includes(keyword)) {
                const wordCount = keyword.split(' ').length;
                score += keyword.length * wordCount * 5;
            }
            // Match normalisé (flexible : nature de sol vs nature du sol)
            else if (normalizedInput.includes(normalizedKeyword)) {
                const wordCount = normalizedKeyword.split(' ').length;
                score += normalizedKeyword.length * wordCount * 3;
            }
            // Match partiel par mot
            else {
                const kwWords = normalizedKeyword.split(' ').filter(w => w.length > 3);
                kwWords.forEach(word => {
                    if (normalizedInput.includes(word)) {
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
