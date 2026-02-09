/**
 * Smart Sheet Router
 * Détecte la meilleure feuille Google Sheets basée sur les mots-clés
 */

export const detectBestSheet = (userQuestion, sheetConfigs) => {
    const inputLower = userQuestion.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    sheetConfigs.forEach(config => {
        const keywords = config.keywords.toLowerCase().split(',');
        let score = 0;

        keywords.forEach(kw => {
            const keyword = kw.trim();
            if (inputLower.includes(keyword)) {
                // Longer keywords = more specific = higher priority
                score += keyword.length;
            }
        });

        if (score > bestScore) {
            bestScore = score;
            bestMatch = config;
        }
    });

    return bestMatch && bestScore > 0 ? bestMatch : null;
};
