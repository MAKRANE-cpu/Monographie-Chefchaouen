export const getHFResponse = async (apiKey, history, message, contextData) => {
    if (!apiKey) throw new Error("Le jeton Hugging Face est manquant");

    // Using the OpenAI-compatible endpoint on the Hugging Face Router
    // Qwen/Qwen2.5-7B-Instruct is a top-tier chat model supported on this endpoint
    const API_URL = "https://router.huggingface.co/v1/chat/completions";
    const MODEL_ID = "Qwen/Qwen2.5-7B-Instruct";

    // 1. Use the pre-formatted context string or format it if it's an array
    let contextStr = "";
    if (typeof contextData === 'string') {
        contextStr = contextData;
    } else if (Array.isArray(contextData) && contextData.length > 0) {
        const keys = Object.keys(contextData[0]);
        contextStr += "| " + keys.join(" | ") + " |\n";
        contextStr += "| " + keys.map(() => "---").join(" | ") + " |\n";
        contextData.slice(0, 50).forEach(row => {
            contextStr += "| " + keys.map(k => row[k] ?? "").join(" | ") + " |\n";
        });
    } else {
        contextStr = "Aucune donnée disponible dans le tableau actuel.";
    }

    // 2. Build Messages (OpenAI Format) - REFACTORED FOR MISTRAL
    const systemPrompt = `Tu es un expert agricole pour la province de Chefchaouen (Maroc). 
            
            ### LOGIQUE DE NAVIGATION :
            1. Avant de répondre, analyse les mots-clés de la question.
            2. Si la donnée n'est pas dans le volet actuel, suggère le volet le plus probable.
            
            ### CONSIGNES DE RÉPONSE :
            1. **PRIORITÉ AUX TOTAUX** : Utilise TOUJOURS <PROVINCIAL_TOTALS_VERIFIED> pour les synthèses et la culture dominante.
            2. **RIGUEUR COMMUNE PAR COMMUNE** : Pour identifier une commune (ex: 'Top 1 pomme de terre'), lis <DÉTAILS_DES_COMMUNES_POUR_CLASSEMENT>. 
            3. **FORMAT DES DONNÉES** : Chaque commune est listée avec des lignes de type "- [Module] Nom Culture: Valeur". Vérifie IMPÉRATIVEMENT le nom de la culture et son unité (ha vs qx/ha).
            4. **HALLUCINATION INTERDITE** : Si tu ne trouves pas une ligne précise "- [Module] X: Y", ne l'invente pas. 
            5. **RECONNAISSANCE** : Si l'utilisateur conteste un chiffre (ex: "Tamarot n'a pas 100 ha"), relis chaque ligne de Tamarot dans la section détails et cite le chiffre exact que tu y trouves.
            6. FORMAT : Commence TOUJOURS par "Action : [Analyse globale des volets X, Y]...".

            DONNÉES LOCALES (Province de Chefchaouen) :
            \`\`\`
            ${contextStr}
            \`\`\`
            `;

    try {
        console.log("Sending request to HF Inference API (Mistral Mode)...");
        const MODEL_ID = "mistralai/Mistral-7B-Instruct-v0.3";
        const API_URL = `https://api-inference.huggingface.co/models/${MODEL_ID}`;

        const historyStr = history.filter(m => m.role === 'user' || m.role === 'model')
            .slice(-4)
            .map(m => `${m.role === 'model' ? 'Assistant' : 'Utilisateur'}: ${m.content}`)
            .join('\n');

        const response = await fetch(API_URL, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({
                inputs: `<s>[INST] ${systemPrompt}\n\nHistorique:\n${historyStr}\n\nQuestion: ${message} [/INST]`,
                parameters: {
                    max_new_tokens: 1000,
                    temperature: 0.2,
                    do_sample: false
                }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("HF Error Details:", response.status, errorText);
            throw new Error(`Erreur HF (${response.status}): ${errorText.substring(0, 100)}...`);
        }

        const result = await response.json();
        const rawRes = Array.isArray(result) ? result[0].generated_text : result.generated_text;

        if (rawRes) {
            // Mistral often returns the prompt too, so we clean it
            return rawRes.includes('[/INST]') ? rawRes.split('[/INST]').pop().trim() : rawRes.trim();
        }

        return "Aucune réponse générée.";

    } catch (err) {
        console.error("HF API Error:", err);
        if (err.message && err.message.includes('loading')) {
            return "⏳ Le modèle est en cours de chargement sur Hugging Face. Réessayez dans 30 secondes.";
        }
        return "Erreur Hugging Face: " + (err.message || err);
    }
};

/**
 * AI Router: Detects which data category corresponds to the user's question.
 */
export const detectCategory = async (apiKey, message, config) => {
    if (!apiKey) return null;

    const MODEL_ID = "Qwen/Qwen2.5-7B-Instruct";
    const API_URL = `https://api-inference.huggingface.co/models/${MODEL_ID}`;

    const categoriesStr = config.map(c => `- GID: ${c.gid} | Catégorie: ${c.category} | Label: ${c.label}`).join("\n");

    const systemPrompt = `Tu es un moteur de recherche ultra-précis. 
    Retourne UNIQUEMENT le GID de la base de données.
    BASES DISPONIBLES :
    ${categoriesStr}
    RÈGLES :
    - Si Question sur "culture", "production", "olivier", "blé" -> GLOBAL_VEGETAL
    - Si Question sur "animaux", "vache", "lait" -> GLOBAL_ANIMAL
    - Sinon GID le plus proche.
    REPONSE: [GID ou GLOBAL_XXX] uniquement.`;

    try {
        const response = await fetch(API_URL, {
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            method: "POST",
            body: JSON.stringify({
                inputs: `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\nQuestion: "${message}"<|im_end|>\n<|im_start|>assistant\n`,
                parameters: { max_new_tokens: 10, temperature: 0.1 }
            }),
        });

        if (!response.ok) return null;

        const result = await response.json();
        const rawResponse = Array.isArray(result) ? result[0].generated_text : result.generated_text;
        const cleaned = rawResponse ? rawResponse.split('assistant\n').pop().trim() : "";

        console.log("Router Response:", cleaned);

        if (cleaned.includes("GLOBAL_VEGETAL")) return "GLOBAL_VEGETAL";
        if (cleaned.includes("GLOBAL_ANIMAL")) return "GLOBAL_ANIMAL";

        const matches = cleaned.match(/\d+/);
        const detectedGid = matches ? matches[0] : null;

        if (config.some(c => c.gid === detectedGid)) return detectedGid;
        return null;
    } catch (e) {
        console.error("Routing Error:", e);
        return null;
    }
};
