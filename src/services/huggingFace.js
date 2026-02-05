import { HfInference } from "@huggingface/inference";

/**
 * AI Service for Chefchaouen Dashboard
 * Using Qwen 2.5 family for high-precision agricultural data analysis.
 */

// Exponential backoff retry helper
const fetchWithRetry = async (fn, maxRetries = 3) => {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (err.message.includes("503") || err.message.toLowerCase().includes("overloaded") || err.message.toLowerCase().includes("loading")) {
                const wait = Math.pow(2, i) * 1000;
                console.log(`HF busy, retrying in ${wait}ms...`);
                await new Promise(resolve => setTimeout(resolve, wait));
                continue;
            }
            throw err;
        }
    }
    throw lastError;
};

export const getHFResponse = async (apiKey, history, message, contextData) => {
    if (!apiKey) throw new Error("Le jeton Hugging Face est manquant");

    const hf = new HfInference(apiKey);

    // Qwen 2.5 7B: Excellent for data analysis and following complex constraints
    const MODEL_ID = "Qwen/Qwen2.5-7B-Instruct";

    let contextStr = (typeof contextData === 'string') ? contextData : "Données indisponibles.";

    const systemPrompt = `Tu es l'Expert Agricole Chefchaouen. 
    ### RÈGLES CRITIQUES :
    1. PRIORITÉ : Utilise TOUJOURS <PROVINCIAL_TOTALS_VERIFIED> pour les synthèses et totaux.
    2. CLASSEMENTS : Utilise <DÉTAILS_DES_COMMUNES_POUR_CLASSEMENT> UNIQUEMENT pour identifier une commune spécifique.
    3. RIGUEUR : Ne confonds jamais Superficie (ha) et Rendement (qx/ha).
    4. VÉRITÉ : Ne cite que les chiffres explicitement présents dans le contexte.
    5. FORMAT : Commence par "Action : [Analyse...]".

    CONTEXTE :
    ${contextStr}`;

    // Qwen ChatML format
    const prompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n` +
        history.filter(m => m.role === 'user' || m.role === 'model').slice(-4).map(m =>
            `<|im_start|>${m.role === 'model' ? 'assistant' : 'user'}\n${m.content}<|im_end|>`
        ).join('\n') +
        `\n<|im_start|>user\n${message}<|im_end|>\n<|im_start|>assistant\n`;

    try {
        console.log("Requesting HF (Qwen 7B)...");
        const response = await fetchWithRetry(() => hf.textGeneration({
            model: MODEL_ID,
            inputs: prompt,
            parameters: {
                max_new_tokens: 800,
                temperature: 0.1,
                wait_for_model: true
            }
        }));

        let text = response.generated_text;
        if (text && text.includes('assistant\n')) {
            text = text.split('assistant\n').pop().split('<|im_end|>')[0].trim();
        }
        return text || "Aucune réponse générée.";

    } catch (err) {
        console.error("HF Final Error:", err);
        return "⚠️ Service temporairement surchargé. Essayez de reformuler ou de rafraîchir la page (Hugging Face Free Tier).";
    }
};

export const detectCategory = async (apiKey, message, config) => {
    if (!apiKey) return null;

    const hf = new HfInference(apiKey);
    // Qwen 1.5B: Extremely fast for classification
    const MODEL_ID = "Qwen/Qwen2.5-1.5B-Instruct";

    const categoriesStr = config.map(c => `- GID: ${c.gid} | Label: ${c.label}`).join("\n");

    const systemPrompt = `Tu es un trieur de données. Retourne UNIQUEMENT le GID correspondant à la demande.
    BASES DISPONIBLES :
    ${categoriesStr}
    RÈGLES D'ORIENTATION :
    - Question sur culture, production, olivier, blé -> GLOBAL_VEGETAL
    - Question sur animaux, bétail, lait -> GLOBAL_ANIMAL
    - Sinon, le GID le plus proche.
    Réponse: [GID]`;

    const prompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${message}<|im_end|>\n<|im_start|>assistant\n`;

    try {
        const response = await fetchWithRetry(() => hf.textGeneration({
            model: MODEL_ID,
            inputs: prompt,
            parameters: {
                max_new_tokens: 10,
                temperature: 0.1,
                wait_for_model: true
            }
        }), 2);

        let text = response.generated_text;
        if (text && text.includes('assistant\n')) {
            text = text.split('assistant\n').pop().split('<|im_end|>')[0].trim();
        }

        if (text.includes("GLOBAL_VEGETAL")) return "GLOBAL_VEGETAL";
        if (text.includes("GLOBAL_ANIMAL")) return "GLOBAL_ANIMAL";

        const matches = text.match(/\d+/);
        return (matches && config.some(c => c.gid === matches[0])) ? matches[0] : null;

    } catch (e) {
        console.error("Routing Error:", e);
        return null;
    }
};
