import { GoogleGenerativeAI } from "@google/generative-ai";

export const getGeminiResponse = async (apiKey, history, message, contextData) => {
    if (!apiKey) throw new Error("API Key is missing");

    const genAI = new GoogleGenerativeAI(apiKey);
    // Switch to gemini-1.5-flash (most stable free tier model)
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: "Tu es l'Expert Agricole Chefchaouen. Réponds aux questions sur les données agricoles (superficies, rendements, communes) avec une précision absolue de 100%."
    });

    // Optimize History: Keep only last 5 messages to save tokens
    const validHistory = history.filter(msg => msg.role === 'user' || msg.role === 'model');
    let apiHistory = validHistory.slice(-5); // Keep only last 5

    // Ensure first message is user (Gemini requirement often, though 1.5/2.0 are more flexible, good practice)
    if (apiHistory.length > 0 && apiHistory[0].role === 'model') {
        apiHistory.shift();
    }

    const chat = model.startChat({
        history: apiHistory.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }],
        })),
        generationConfig: {
            maxOutputTokens: 1000,
        },
    });

    // Optimize context: CSV format
    // REDUCED from 60 to 20 rows to save massive amount of tokens
    let contextStr = "";
    if (Array.isArray(contextData) && contextData.length > 0) {
        const keys = Object.keys(contextData[0]);
        contextStr += keys.join(",") + "\n";
        // ONLY 20 rows
        contextData.slice(0, 20).forEach(row => {
            contextStr += keys.map(k => row[k]).join(",") + "\n";
        });
    } else {
        contextStr = JSON.stringify(contextData);
    }

    const contextPrompt = `
  [DATA CONTEXT]
  ${contextStr.substring(0, 8000)} ... 
  [END CONTEXT]
  
  QUESTION: ${message}
  `;

    try {
        const result = await chat.sendMessage(contextPrompt);
        const response = await result.response;
        return response.text();
    } catch (err) {
        // Log full error for debugging
        console.error("Gemini API Error:", err);

        if (err.message.includes('429') || err.message.includes('Quota')) {
            return `🚨 **Limite atteinte**\nGoogle indique : *"${err.message}"*\n\nJ'ai réduit la taille des données envoyées. Réessayez dans 1 minute.`;
        }
        return "Erreur IA: " + err.message;
    }
};
