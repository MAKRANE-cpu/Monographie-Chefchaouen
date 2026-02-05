import { HfInference } from "@huggingface/inference";
import { getGeminiResponse } from "./gemini";

/**
 * AI Service for Chefchaouen Dashboard
 * Implementation of the "Triple Shield" Resilience Strategy.
 */

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

/**
 * Primary Chat Logic with Gemini Fallback
 */
export const getHFResponse = async (apiKey, history, message, contextData, geminiKey = null) => {
    if (!apiKey) throw new Error("Le jeton Hugging Face est manquant");

    const hf = new HfInference(apiKey);
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
        return `<|im_start|>system\n${systemPrompt}${isFallback ? "\n(NOTE: Réponds de manière très concise)" : ""}<|im_end|>\n` +
            history.filter(m => m.role === 'user' || m.role === 'model').slice(-4).map(m =>
                `<|im_start|>${m.role === 'model' ? 'assistant' : 'user'}\n${m.content}<|im_end|>`
            ).join('\n') +
            `\n<|im_start|>user\n${message}<|im_end|>\n<|im_start|>assistant\n`;
    };

    try {
        console.log("Tier 1: Requesting Qwen 7B...");
        const response = await fetchWithRetry(() => hf.textGeneration({
            model: PRIMARY_MODEL,
            inputs: generatePrompt(),
            parameters: { max_new_tokens: 800, temperature: 0.1, wait_for_model: true }
        }), 2);
        return parseResponse(response.generated_text);
    } catch (err) {
        console.warn("Tier 1 failed. Trying Tier 2 (1.5B)...");
        try {
            const response = await fetchWithRetry(() => hf.textGeneration({
                model: FALLBACK_MODEL,
                inputs: generatePrompt(true),
                parameters: { max_new_tokens: 400, temperature: 0.1, wait_for_model: true }
            }), 2);
            return parseResponse(response.generated_text);
        } catch (finalErr) {
            if (geminiKey) {
                console.warn("HF Overloaded. Using Gemini Tier 3 (Ultimate Resilience)...");
                return await getGeminiResponse(geminiKey, history, message, contextData);
            }
            throw finalErr;
        }
    }
};

/**
 * Enhanced Router: Detects GID + INTENT (Summary vs Detail)
 */
export const detectCategory = async (apiKey, message, config) => {
    if (!apiKey) return null;

    const hf = new HfInference(apiKey);
    const MODEL_ID = "Qwen/Qwen2.5-1.5B-Instruct";

    const categoriesStr = config.map(c => `- GID: ${c.gid} | Label: ${c.label}`).join("\n");

    const systemPrompt = `Tu es un trieur de données. Retourne UNIQUEMENT : [GID]|[INTENT].
    INTENT doit être 'SUMMARY' (totaux, culture dominante, général) ou 'DETAIL' (classement, top 3, commune spécifique).
    BASES :
    ${categoriesStr}
    RÈGLES :
    - Question sur culture, production, agriculture -> GLOBAL_VEGETAL
    - Question sur animaux, bétail -> GLOBAL_ANIMAL
    - Sinon, le GID exact.
    Réponse: [GID]|[INTENT]`;

    const prompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${message}<|im_end|>\n<|im_start|>assistant\n`;

    try {
        const response = await fetchWithRetry(() => hf.textGeneration({
            model: MODEL_ID,
            inputs: prompt,
            parameters: { max_new_tokens: 20, temperature: 0.1, wait_for_model: true }
        }), 2);

        let text = parseResponse(response.generated_text);
        console.log("Router Intent:", text);

        const parts = text.split('|');
        const detectedGid = parts[0].trim();
        const intent = parts[1] ? parts[1].trim() : 'SUMMARY';

        const cleanedGid = detectedGid.match(/\d+/) ? detectedGid.match(/\d+/)[0] : detectedGid;
        const finalIntent = (intent === 'DETAIL') ? 'DETAIL' : 'SUMMARY';

        if (cleanedGid === "GLOBAL_VEGETAL" || cleanedGid === "GLOBAL_ANIMAL" || config.some(c => c.gid === cleanedGid)) {
            return { gid: cleanedGid, intent: finalIntent };
        }
        return null;

    } catch (e) {
        console.error("Routing Error:", e);
        return null;
    }
};
