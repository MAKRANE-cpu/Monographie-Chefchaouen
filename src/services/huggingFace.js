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

const parseResponse = (text) => {
    if (!text) return "Aucune réponse générée.";
    if (text.includes('assistant\n')) {
        return text.split('assistant\n').pop().split('<|im_end|>')[0].trim();
    }
    return text.trim();
};

export const getHFResponse = async (apiKey, history, message, contextData) => {
    if (!apiKey) throw new Error("Le jeton Hugging Face est manquant");

    const hf = new HfInference(apiKey);

    // Tiered Models: Primary (7B) for depth, Fallback (1.5B) for availability
    const PRIMARY_MODEL = "Qwen/Qwen2.5-7B-Instruct";
    const FALLBACK_MODEL = "Qwen/Qwen2.5-1.5B-Instruct";

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

    const generatePrompt = (isFallback = false) => {
        return `<|im_start|>system\n${systemPrompt}${isFallback ? "\n(NOTE: Réponds de manière concise)" : ""}<|im_end|>\n` +
            history.filter(m => m.role === 'user' || m.role === 'model').slice(-4).map(m =>
                `<|im_start|>${m.role === 'model' ? 'assistant' : 'user'}\n${m.content}<|im_end|>`
            ).join('\n') +
            `\n<|im_start|>user\n${message}<|im_end|>\n<|im_start|>assistant\n`;
    };

    const tryModel = async (modelId, isFallback = false) => {
        return await hf.textGeneration({
            model: modelId,
            inputs: generatePrompt(isFallback),
            parameters: {
                max_new_tokens: isFallback ? 400 : 800,
                temperature: 0.1,
                wait_for_model: true
            }
        });
    };

    try {
        console.log("Tier 1: Requesting Qwen 7B...");
        const response = await fetchWithRetry(() => tryModel(PRIMARY_MODEL), 2);
        return parseResponse(response.generated_text);
    } catch (err) {
        console.warn("Tier 1 failed (Overloaded). Switching to Tier 2 (1.5B)...");
        try {
            const response = await fetchWithRetry(() => tryModel(FALLBACK_MODEL, true), 2);
            return parseResponse(response.generated_text);
        } catch (finalErr) {
            console.error("HF Final Error:", finalErr);
            return "⚠️ Les serveurs de calcul sont actuellement saturés. Veuillez réessayer dans quelques instants ou simplifier votre question.";
        }
    }
};

export const detectCategory = async (apiKey, message, config) => {
    if (!apiKey) return null;

    const hf = new HfInference(apiKey);
    const MODEL_ID = "Qwen/Qwen2.5-1.5B-Instruct";

    const categoriesStr = config.map(c => `- GID: ${c.gid} | Label: ${c.label}`).join("\n");

    const systemPrompt = `Tu es un trieur de données. Retourne UNIQUEMENT le GID de la base de données.
    BASES DISPONIBLES :
    ${categoriesStr}
    RÈGLES :
    - Si Question sur "culture", "production", "olivier", "blé" -> GLOBAL_VEGETAL
    - Si Question sur "animaux", "bétail", "lait" -> GLOBAL_ANIMAL
    - Sinon, le GID le plus proche.
    Réponse: [GID] uniquement.`;

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
