// Standard OpenAI-compatible endpoint for stability and CORS friendliness
const HF_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions";

export const getHFResponse = async (apiKey, history, message, contextData) => {
    if (!apiKey) throw new Error("Le jeton Hugging Face est manquant");

    // Mistral 7B is very stable on the free tier router
    const MODEL_ID = "mistralai/Mistral-7B-Instruct-v0.3";

    let contextStr = (typeof contextData === 'string') ? contextData : "Aucune donnée disponible.";

    const systemPrompt = `Tu es un expert agricole pour la province de Chefchaouen (Maroc). 
            
            ### CONSIGNES DE RÉPONSE :
            1. **PRIORITÉ AUX TOTAUX** : Utilise TOUJOURS <PROVINCIAL_TOTALS_VERIFIED> pour les synthèses.
            2. **RIGUEUR COMMUNE** : Pour identifier une commune, lis <DÉTAILS_DES_COMMUNES_POUR_CLASSEMENT>. 
            3. **FORMAT DES DONNÉES** : Chaque commune est listée avec des lignes "- [Module] Nom Culture: Valeur". Vérifie IMPÉRATIVEMENT le nom et l'unité.
            4. **HALLUCINATION INTERDITE** : Ne cite que les chiffres présents dans le texte.
            5. FORMAT : Commence par "Action : [Analyse globale]...".

            DONNÉES LOCALES :
            \`\`\`
            ${contextStr}
            \`\`\`
            `;

    const messages = [
        { role: "system", content: systemPrompt },
        ...history.filter(m => m.role === 'user' || m.role === 'model')
            .slice(-4)
            .map(m => ({
                role: m.role === 'model' ? 'assistant' : 'user',
                content: m.content
            })),
        { role: "user", content: message }
    ];

    try {
        console.log("Requesting HF Router (Chat)...");
        const response = await fetch(HF_ROUTER_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: MODEL_ID,
                messages: messages,
                max_tokens: 1000,
                temperature: 0.2
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erreur HF (${response.status}): ${errorText.substring(0, 100)}`);
        }

        const result = await response.json();
        return result.choices?.[0]?.message?.content?.trim() || "Aucune réponse générée.";

    } catch (err) {
        console.error("HF API Error:", err);
        return "Erreur Hugging Face: " + (err.message || "Problème de connexion");
    }
};

/**
 * AI Router: Detects which data category corresponds to the user's question.
 */
export const detectCategory = async (apiKey, message, config) => {
    if (!apiKey) return null;

    const MODEL_ID = "Qwen/Qwen2.5-7B-Instruct"; // Qwen is excellent for classification
    const categoriesStr = config.map(c => `- GID: ${c.gid} | Label: ${c.label}`).join("\n");

    const systemPrompt = `Tu es un moteur de recherche ultra-précis. Retourne UNIQUEMENT le GID.
    BASES :
    ${categoriesStr}
    RÈGLES :
    - Question sur culture/production/olivier/blé -> GLOBAL_VEGETAL
    - Question sur animaux/vache/lait -> GLOBAL_ANIMAL
    - Sinon GID exact.
    REPONSE: [GID ou GLOBAL_XXX] uniquement.`;

    try {
        const response = await fetch(HF_ROUTER_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: MODEL_ID,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Question: "${message}"` }
                ],
                max_tokens: 10,
                temperature: 0.1
            }),
        });

        if (!response.ok) return null;

        const result = await response.json();
        const cleaned = result.choices?.[0]?.message?.content?.trim() || "";

        console.log("Router Response:", cleaned);

        if (cleaned.includes("GLOBAL_VEGETAL")) return "GLOBAL_VEGETAL";
        if (cleaned.includes("GLOBAL_ANIMAL")) return "GLOBAL_ANIMAL";

        const matches = cleaned.match(/\d+/);
        return (matches && config.some(c => c.gid === matches[0])) ? matches[0] : null;

    } catch (e) {
        console.error("Routing Error:", e);
        return null;
    }
};
