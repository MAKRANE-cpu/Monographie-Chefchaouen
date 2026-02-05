import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Gemini Tertiary Fallback Service
 * Implements an exhaustive model-cycling strategy to bypass 404/Quota errors.
 */
export const getGeminiResponse = async (apiKey, history, message, contextData) => {
    if (!apiKey) throw new Error("API Key Gemini manquante pour le secours.");

    const genAI = new GoogleGenerativeAI(apiKey);

    // Exhaustive list of model identifiers to handle regional/API variation
    const modelList = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-2.0-flash-exp",
        "gemini-1.5-pro",
        "gemini-pro" // Older 1.0 Pro
    ];

    let lastError;
    const systemText = "Tu es l'Expert Agricole Chefchaouen. Réponds aux questions sur les données agricoles (superficies, rendements, communes) avec une précision absolue de 100%. Cite toujours tes sources si présentes.";

    for (const modelId of modelList) {
        try {
            console.log(`Fallback Tier 3: Tentative avec ${modelId}...`);

            // Models >= 1.5 support systemInstruction
            const isLatest = modelId.includes("1.5") || modelId.includes("2.0");

            const modelConfig = isLatest
                ? { model: modelId, systemInstruction: systemText }
                : { model: modelId };

            const model = genAI.getGenerativeModel(modelConfig);

            // Preparation des messages
            const validHistory = history.filter(msg => msg.role === 'user' || msg.role === 'model').slice(-4);

            // Context injection
            const contextStr = (typeof contextData === 'string') ? contextData : JSON.stringify(contextData);
            const fullPrompt = `CONTEXTE DE DONNÉES :\n${contextStr.substring(0, 20000)}\n\nQUESTION : ${message}`;

            let responseText = "";

            if (isLatest) {
                // Use structured Chat for 1.5+
                const chat = model.startChat({
                    history: validHistory.map(msg => ({
                        role: msg.role === 'user' ? 'user' : 'model',
                        parts: [{ text: msg.content }],
                    })),
                    generationConfig: { maxOutputTokens: 1000, temperature: 0.1 },
                });
                const result = await chat.sendMessage(fullPrompt);
                const response = await result.response;
                responseText = response.text();
            } else {
                // Fallback to simple generateContent for 1.0 (gemini-pro)
                // Prepend system prompt to user content
                const promptFor10 = `${systemText}\n\n${fullPrompt}`;
                const result = await model.generateContent(promptFor10);
                const response = await result.response;
                responseText = response.text();
            }

            if (responseText) return responseText;

        } catch (err) {
            console.warn(`Le modèle ${modelId} a échoué :`, err.message);
            lastError = err;
            // Stop if quota is exhausted (global to project)
            if (err.message.includes('429') || err.message.includes('Quota')) break;
            // Continue for 404 or other model-specific errors
            continue;
        }
    }

    // Final failure management
    if (lastError?.message.includes('429') || lastError?.message.includes('Quota')) {
        return "⚠️ Les limites de quotas gratuits de Google sont atteintes. Veuillez patienter une minute.";
    }

    return `⚠️ Échec du secours Gemini : ${lastError?.message || "Erreur inconnue"}.`;
};
