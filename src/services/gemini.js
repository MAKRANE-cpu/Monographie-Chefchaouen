import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Gemini Tertiary Fallback Service - Production Grade 2025/2026
 * Implements an exhaustive model-cycling strategy to bypass 404/Quota/Naming errors.
 */
export const getGeminiResponse = async (apiKey, history, message, contextData) => {
    if (!apiKey) throw new Error("API Key Gemini manquante pour le secours.");

    const genAI = new GoogleGenerativeAI(apiKey);

    // Priority list for 2025/2026: 2.0 Flash is currently the best free tier option
    const modelList = [
        "gemini-2.0-flash-exp",
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-pro",
        "gemini-1.5-pro-latest"
    ];

    let lastError;
    const systemText = "Tu es l'Expert Agricole Chefchaouen. Réponds aux questions sur les données agricoles (superficies, rendements, communes) avec une précision absolue de 100%. Reste très concis pour économiser les ressources.";

    for (const modelId of modelList) {
        try {
            console.log(`Fallback Tier 3: Tentative avec Gemini Model [${modelId}]...`);

            // All recommended models for 2025 support the structured systemInstruction
            const model = genAI.getGenerativeModel({
                model: modelId,
                systemInstruction: systemText
            });

            // Clean history to stay within context limits
            const validHistory = history.filter(msg => msg.role === 'user' || msg.role === 'model').slice(-4);

            // Context injection - Truncated to avoid token overflow on free tier
            const contextStr = (typeof contextData === 'string') ? contextData : JSON.stringify(contextData);
            const truncatedContext = contextStr.substring(0, 15000); // 15k chars is safe for Flash

            const fullPrompt = `--- CONTEXTE DE DONNÉES AGRI ---\n${truncatedContext}\n\n--- QUESTION UTILISATEUR ---\n${message}`;

            const chat = model.startChat({
                history: validHistory.map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }],
                })),
                generationConfig: {
                    maxOutputTokens: 800,
                    temperature: 0.1
                },
            });

            const result = await chat.sendMessage(fullPrompt);
            const response = await result.response;
            const text = response.text();

            if (text) {
                console.log(`Gemini Tier 3 success with model: ${modelId}`);
                return text;
            }

        } catch (err) {
            const errMsg = err.message || "";
            console.warn(`Modèle Gemini [${modelId}] échoué :`, errMsg);
            lastError = err;

            // If it's a structural 404 (Not Found), continue to next model
            if (errMsg.includes('404') || errMsg.includes('not found')) {
                continue;
            }

            // If it's a quota error (429), the project is likely rate-limited across all models
            if (errMsg.includes('429') || errMsg.toLowerCase().includes('quota')) {
                // Break early to avoid redundant failures
                break;
            }

            // For other errors, try the next model just in case
            continue;
        }
    }

    // Comprehensive Fallback Error Message
    if (lastError?.message.includes('429') || lastError?.message.toLowerCase().includes('quota')) {
        return "⚠️ Service de secours saturé (Google Quota). Veuillez patienter 60 secondes ou simplifier votre demande.";
    }

    return `⚠️ Le secours Gemini a échoué après plusieurs tentatives : ${lastError?.message || "Erreur de connexion"}.`;
};
