/**
 * OpenRouter AI Service
 * Uses DeepSeek V3 (free) as primary, Llama 3.3 as fallback
 */

export const getOpenRouterResponse = async (apiKey, history, message, contextData) => {
    if (!apiKey) throw new Error("Clé API OpenRouter manquante.");

    const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

    // Free models on OpenRouter
    const PRIMARY_MODEL = "deepseek/deepseek-chat";
    const FALLBACK_MODEL = "meta-llama/llama-3.3-70b-instruct";

    const systemPrompt = `Tu es l'Expert Agricole Chefchaouen. Réponds aux questions sur les données agricoles (superficies, rendements, communes) avec une précision absolue de 100%. Reste très concis pour économiser les ressources.

### RÈGLES CRITIQUES :
1. PRIORITÉ : Utilise TOUJOURS <PROVINCIAL_TOTALS_VERIFIED> pour les synthèses et totaux.
2. CLASSEMENTS : Utilise <DÉTAILS_DES_COMMUNES_POUR_CLASSEMENT> UNIQUEMENT pour identifier une commune spécifique.
3. RIGUEUR : Ne confonds jamais Superficie (ha) et Rendement (qx/ha).
4. VÉRITÉ : Ne cite que les chiffres explicitement présents dans le contexte.
5. FORMAT : Commence par "Action : [Analyse...]".`;

    // Clean history to ensure it starts with 'user'
    let validHistory = history.filter(msg => msg.role === 'user' || msg.role === 'model');
    const firstUserIndex = validHistory.findIndex(msg => msg.role === 'user');
    if (firstUserIndex !== -1) {
        validHistory = validHistory.slice(firstUserIndex);
    } else {
        validHistory = [];
    }
    validHistory = validHistory.slice(-4);
    if (validHistory.length > 0 && validHistory[0].role === 'model') {
        validHistory = validHistory.slice(1);
    }

    // Context injection
    const contextStr = (typeof contextData === 'string') ? contextData : JSON.stringify(contextData);
    const truncatedContext = contextStr.substring(0, 15000);

    const fullPrompt = `--- CONTEXTE DE DONNÉES AGRI ---\n${truncatedContext}\n\n--- QUESTION UTILISATEUR ---\n${message}`;

    // Build messages array
    const messages = [
        { role: "system", content: systemPrompt },
        ...validHistory.map(msg => ({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.content
        })),
        { role: "user", content: fullPrompt }
    ];

    const tryModel = async (modelId) => {
        console.log(`OpenRouter: Tentative avec ${modelId}...`);

        const response = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": window.location.origin,
                "X-Title": "Chefchaouen Agricultural Dashboard"
            },
            body: JSON.stringify({
                model: modelId,
                messages: messages,
                max_tokens: 800,
                temperature: 0.1
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`${response.status}: ${error}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    };

    // Try primary model, fallback if needed
    try {
        return await tryModel(PRIMARY_MODEL);
    } catch (err) {
        console.warn(`Modèle principal échoué: ${err.message}. Tentative de fallback...`);
        try {
            return await tryModel(FALLBACK_MODEL);
        } catch (finalErr) {
            throw new Error(`Tous les modèles ont échoué: ${finalErr.message}`);
        }
    }
};
