// Use direct API for maximal stability and free tier access
const getHFEndpoint = (modelId) => `https://api-inference.huggingface.co/models/${modelId}`;

export const getHFResponse = async (apiKey, history, message, contextData) => {
    if (!apiKey) throw new Error("Le jeton Hugging Face est manquant");

    // Using a lighter model (1.5B) which is much more stable on the free tier and avoids timeouts
    const MODEL_ID = "Qwen/Qwen2.5-1.5B-Instruct";
    const API_URL = getHFEndpoint(MODEL_ID);

    let contextStr = (typeof contextData === 'string') ? contextData : "Données indisponibles.";

    const systemPrompt = `Tu es l'Expert Agricole Chefchaouen. 
    ### RÈGLES :
    1. PRIORITÉ : Toujours <PROVINCIAL_TOTALS_VERIFIED> pour les totaux.
    2. CLASSEMENTS : Lis <DÉTAILS_DES_COMMUNES_POUR_CLASSEMENT>.
    3. RIGUEUR : Ne confonds jamais Superficie et Rendement.
    4. VÉRITÉ : Ne cite que les chiffres du contexte.
    5. RÉPONSE : Commence par "Action : [Analyse...]".

    CONTEXTE :
    ${contextStr}`;

    const prompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${message}<|im_end|>\n<|im_start|>assistant\n`;

    try {
        console.log("Requesting HF Direct (Qwen 1.5B)...");
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "x-wait-for-model": "true"
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    max_new_tokens: 500,
                    temperature: 0.1,
                    do_sample: false,
                    wait_for_model: true
                }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erreur HF (${response.status})`);
        }

        const result = await response.json();
        let text = Array.isArray(result) ? result[0].generated_text : result.generated_text;

        if (text && text.includes('assistant\n')) {
            text = text.split('assistant\n').pop().split('<|im_end|>')[0].trim();
        }
        return text || "Aucune réponse générée.";

    } catch (err) {
        console.error("HF API Error:", err);
        return "⚠️ Problème de connexion (Failed to fetch). Cela arrive quand le serveur est surchargé. Réessayez dans 10 secondes.";
    }
};

export const detectCategory = async (apiKey, message, config) => {
    if (!apiKey) return null;

    const MODEL_ID = "Qwen/Qwen2.5-1.5B-Instruct";
    const API_URL = getHFEndpoint(MODEL_ID);

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
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "x-wait-for-model": "true"
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: { max_new_tokens: 10, temperature: 0.1, wait_for_model: true }
            }),
        });

        if (!response.ok) return null;

        const result = await response.json();
        let text = Array.isArray(result) ? result[0].generated_text : result.generated_text;
        if (text && text.includes('assistant\n')) {
            text = text.split('assistant\n').pop().split('<|im_end|>')[0].trim();
        }

        if (text.includes("GLOBAL_VEGETAL")) return "GLOBAL_VEGETAL";
        if (text.includes("GLOBAL_ANIMAL")) return "GLOBAL_ANIMAL";

        const matches = text.match(/\d+/);
        return (matches && config.some(c => c.gid === matches[0])) ? matches[0] : null;

    } catch (e) {
        return null;
    }
};
