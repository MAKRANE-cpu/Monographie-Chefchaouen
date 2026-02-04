import { HfInference } from "@huggingface/inference";

export const getHFResponse = async (apiKey, history, message, contextData) => {
    if (!apiKey) throw new Error("Le jeton Hugging Face est manquant");

    const hf = new HfInference(apiKey);

    // Switch to a very reliable chat model on the SDK
    const MODEL_ID = "mistralai/Mistral-7B-Instruct-v0.2";

    let contextStr = (typeof contextData === 'string') ? contextData : "Données indisponibles.";

    const systemPrompt = `Tu es l'Expert Agricole Chefchaouen. 
    ### RÈGLES :
    1. PRIORITÉ : Toujours <PROVINCIAL_TOTALS_VERIFIED> pour les totaux.
    2. CLASSEMENTS : Lis <DÉTAILS_DES_COMMUNES_POUR_CLASSEMENT>.
    3. RIGUEUR : Ne confonds jamais Superficie et Rendement.
    4. RÉPONSE : Commence par "Action : [Analyse...]".

    CONTEXTE :
    ${contextStr}`;

    const prompt = `<s>[INST] ${systemPrompt}\n\nHistorique récent:\n${history.map(m => `${m.role}: ${m.content}`).join('\n')}\n\nUtilisateur: ${message} [/INST]`;

    try {
        console.log("Requesting HF via SDK (Mistral)...");
        const response = await hf.textGeneration({
            model: MODEL_ID,
            inputs: prompt,
            parameters: {
                max_new_tokens: 500,
                temperature: 0.1,
                wait_for_model: true
            }
        });

        let text = response.generated_text;
        if (text && text.includes('[/INST]')) {
            text = text.split('[/INST]').pop().trim();
        }
        return text || "Aucune réponse générée.";

    } catch (err) {
        console.error("HF SDK Error:", err);
        return "⚠️ Erreur technique (Inference). Hugging Face est surchargé. Essayez de rafraîchir ou de changer le jeton.";
    }
};

export const detectCategory = async (apiKey, message, config) => {
    if (!apiKey) return null;

    const hf = new HfInference(apiKey);
    const MODEL_ID = "Qwen/Qwen2.5-1.5B-Instruct";

    const categoriesStr = config.map(c => `- GID: ${c.gid} | Label: ${c.label}`).join("\n");

    const systemPrompt = `Retourne UNIQUEMENT le GID.
    BASES :
    ${categoriesStr}
    RÈGLES :
    - Question sur culture -> GLOBAL_VEGETAL
    - Question sur animaux -> GLOBAL_ANIMAL
    - Sinon le GID.`;

    const prompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${message}<|im_end|>\n<|im_start|>assistant\n`;

    try {
        const response = await hf.textGeneration({
            model: MODEL_ID,
            inputs: prompt,
            parameters: {
                max_new_tokens: 10,
                temperature: 0.1,
                wait_for_model: true
            }
        });

        let text = response.generated_text;
        if (text && text.includes('assistant\n')) {
            text = text.split('assistant\n').pop().trim();
        }

        if (text.includes("GLOBAL_VEGETAL")) return "GLOBAL_VEGETAL";
        if (text.includes("GLOBAL_ANIMAL")) return "GLOBAL_ANIMAL";

        const matches = text.match(/\d+/);
        return (matches && config.some(c => c.gid === matches[0])) ? matches[0] : null;

    } catch (e) {
        console.error("Routing SDK Error:", e);
        return null;
    }
};
