import { GoogleGenerativeAI } from "@google/generative-ai";

export const getGeminiResponse = async (apiKey, history, message, contextData) => {
    if (!apiKey) throw new Error("API Key is missing");

    const genAI = new GoogleGenerativeAI(apiKey);

    // Tiered model list to handle regional availability and naming conventions
    const modelNames = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro"];
    let lastError;

    for (const modelName of modelNames) {
        try {
            console.log(`Tier 3: Trying Gemini (${modelName})...`);
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: "Tu es l'Expert Agricole Chefchaouen. Réponds aux questions sur les données agricoles (superficies, rendements, communes) avec une précision absolue de 100%."
            });

            const validHistory = history.filter(msg => msg.role === 'user' || msg.role === 'model');
            let apiHistory = validHistory.slice(-5);
            if (apiHistory.length > 0 && apiHistory[0].role === 'model') apiHistory.shift();

            const chat = model.startChat({
                history: apiHistory.map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }],
                })),
                generationConfig: { maxOutputTokens: 1000, temperature: 0.1 },
            });

            // Context preparation
            const contextStr = (typeof contextData === 'string') ? contextData : JSON.stringify(contextData);

            const contextPrompt = `
            [DATA CONTEXT]
            ${contextStr.substring(0, 15000)}
            [END CONTEXT]
            
            QUESTION: ${message}
            `;

            const result = await chat.sendMessage(contextPrompt);
            const response = await result.response;
            return response.text();

        } catch (err) {
            console.warn(`Gemini tier failed with model ${modelName}:`, err.message);
            lastError = err;
            // If it's a quota error, don't try next model as it's project-wide
            if (err.message.includes('429') || err.message.includes('Quota')) break;
            // Otherwise, continue to next model (handle 404s)
            continue;
        }
    }

    // Final Error management
    if (lastError.message.includes('429') || lastError.message.includes('Quota')) {
        return `⚠️ Limite de quota atteinte sur Gemini. Veuillez patienter 1 minute ou reformuler.`;
    }
    return "⚠️ Erreur de secours (Gemini): " + lastError.message;
};
