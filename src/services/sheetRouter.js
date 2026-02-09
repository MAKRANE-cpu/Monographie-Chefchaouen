/**
 * Smart Sheet Router - Version Améliorée
 * Priorité aux expressions de plusieurs mots
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
                // Multi-word phrases get MUCH higher priority
                const wordCount = keyword.split(' ').length;
                if (wordCount > 1) {
                    score += keyword.length * wordCount * 3; // Triple boost for phrases
                } else {
                    score += keyword.length;
                }
            }
        });

        if (score > bestScore) {
            bestScore = score;
            bestMatch = config;
        }
    });

    return bestMatch && bestScore > 0 ? bestMatch : null;
};
