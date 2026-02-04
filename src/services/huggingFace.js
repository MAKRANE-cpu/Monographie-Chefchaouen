// Use direct API for maximal stability and free tier access
const getHFEndpoint = (modelId) => `https://api-inference.huggingface.co/models/${modelId}`;

export const getHFResponse = async (apiKey, history, message, contextData) => {
    if (!apiKey) throw new Error("Le jeton Hugging Face est manquant");

    // Qwen 2.5 7B is the best free-tier model for data analysis
    const MODEL_ID = "Qwen/Qwen2.5-7B-Instruct";
    const API_URL = getHFEndpoint(MODEL_ID);

    let contextStr = (typeof contextData === 'string') ? contextData : "Données indisponibles.";

    const systemPrompt = `Tu es l'Expert Agricole Chefchaouen. 
    ### RÈGLES D'OR :
    1. PRIORITÉ : Toujours utiliser <PROVINCIAL_TOTALS_VERIFIED> pour les synthèses.
    2. RIGUEUR : Pour les classements, lis <DÉTAILS_DES_COMMUNES_POUR_CLASSEMENT>.
    3. FORMAT : Chaque commune est listée ligne par ligne. Ne confonds jamais Superficie et Rendement.
    4. VÉRITÉ : Ne cite que les chiffres du contexte.
    5. FORMAT RÉPONSE : Commence par "Action : [Analyse...]".

    CONTEXTE :
    ${contextStr}`;

    // Format for Qwen ChatML
    let prompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n`;

    // Add history (last 4 messages)
    history.filter(m => m.role === 'user' || m.role === 'model').slice(-4).forEach(m => {
        const role = m.role === 'model' ? 'assistant' : 'user';
        prompt += `<|im_start|>${role}\n${m.content}<|im_end|>\n`;
    });

    // Add current message
    prompt += `<|im_start|>user\n${message}<|im_end|>\n<|im_start|>assistant\n`;

    try {
        console.log("Requesting HF Direct (Chat: Qwen)...");
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: { max_new_tokens: 1000, temperature: 0.1, do_sample: false }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erreur HF (${response.status}): ${errorText.substring(0, 100)}`);
        }

        const result = await response.json();
        let text = Array.isArray(result) ? result[0].generated_text : result.generated_text;

        if (text && text.includes('assistant\n')) {
            text = text.split('assistant\n').pop().split('<|im_end|>')[0].trim();
        }
        return text || "Aucune réponse générée.";

    } catch (err) {
        console.error("HF API Error:", err);
        if (err.message.includes('loading')) return "⏳ Chargement du modèle... réessayez dans 30s.";
        return "Erreur Hugging Face: " + (err.message || "Connexion échouée");
    }
};

/**
 * AI Router: Detects which data category corresponds to the user's question.
 */
export const detectCategory = async (apiKey, message, config) => {
    if (!apiKey) return null;

    const MODEL_ID = "Qwen/Qwen2.5-1.5B-Instruct"; // 1.5B is faster for detection
    const API_URL = getHFEndpoint(MODEL_ID);

    const categoriesStr = config.map(c => `- GID: ${c.gid} | Label: ${c.label}`).join("\n");

    const systemPrompt = `Tu es un trieur de données. Retourne UNIQUEMENT le GID.
    BASES :
    ${categoriesStr}
    RÈGLES :
    - Question sur culture/production/olivier/blé -> GLOBAL_VEGETAL
    - Question sur animaux/vache/lait -> GLOBAL_ANIMAL
    - Sinon le GID spécifique.
    Réponse: [GID]`;

    const prompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${message}<|im_end|>\n<|im_start|>assistant\n`;

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                inputs: prompt,
                parameters: { max_new_tokens: 10, temperature: 0.1 }
            }),
        });

        if (!response.ok) return null;

        const result = await response.json();
        let text = Array.isArray(result) ? result[0].generated_text : result.generated_text;
        if (text && text.includes('assistant\n')) {
            text = text.split('assistant\n').pop().split('<|im_end|>')[0].trim();
        }

        console.log("Router Response:", text);

        if (text.includes("GLOBAL_VEGETAL")) return "GLOBAL_VEGETAL";
        if (text.includes("GLOBAL_ANIMAL")) return "GLOBAL_ANIMAL";

        const matches = text.match(/\d+/);
        return (matches && config.some(c => c.gid === matches[0])) ? matches[0] : null;

    } catch (e) {
        console.error("Routing Error:", e);
        return null;
    }
};
