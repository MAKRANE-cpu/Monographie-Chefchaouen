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

    // 2. Build Messages (OpenAI Format)
    const messages = [
        {
            role: "system",
            content: `Tu es un expert agricole pour la province de Chefchaouen (Maroc). 
            
            ### LOGIQUE DE NAVIGATION :
            1. Avant de répondre, analyse les mots-clés de la question.
            2. Si la donnée n'est pas dans le volet actuel, suggère le volet le plus probable.
            
            ### CONSIGNES DE RÉPONSE :
            1. **CONCISION ABSOLUE** : Ne liste JAMAIS toutes les communes une par une sauf si l'utilisateur le demande. Fais des synthèses provinciales (SOMME TOTALE).
            2. **DÉFINITION "CULTURES"** : Le terme "cultures" englobe les volets : Céréales, Légumineuses, Maraîchage, Arbres Fruitiers, et Fourrages.
            3. **MULTI-VOLETS** : Si tu vois l'indicateur **_volet**, cela signifie que tu as des données provenant de plusieurs feuilles. Utilise-les pour faire une réponse complète.
            4. Utilise UNIQUEMENT les données fournies.
            5. Les en-têtes incluent l'unité : **(%)** ou **(ha)**.
            6. FORMAT : Commence TOUJOURS par "Action : [Analyse globale des volets X, Y]...".
            7. **RÈGLE D'OR** : Si l'utilisateur donne un chiffre (ex: "l'olivier fait 39 000 ha"), vérifie tes calculs et confirme ou rectifie en citant tes sources.

            DONNÉES LOCALES (Province de Chefchaouen) :
            \`\`\`
            ${contextStr}
            \`\`\`
            `
        }
    ];

    // Add history
    const validHistory = history.filter(msg => msg.role === 'user' || msg.role === 'model').slice(-4);
    validHistory.forEach(msg => {
        messages.push({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.content
        });
    });

    // Add current message
    messages.push({
        role: "user",
        content: message
    });

    try {
        console.log("Sending request to HF Router (OpenAI style)...");
        const response = await fetch(API_URL, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({
                model: MODEL_ID,
                messages: messages,
                max_tokens: 1000,
                temperature: 0.7,
                stream: false
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("HF Error Details:", response.status, errorText);
            throw new Error(`Erreur HF (${response.status}): ${errorText.substring(0, 100)}...`);
        }

        const result = await response.json();

        if (result.choices && result.choices.length > 0) {
            return result.choices[0].message.content.trim();
        } else if (result.error) {
            throw new Error(result.error.message || result.error);
        }

        return "Aucune réponse générée.";

    } catch (err) {
        console.error("HF API Error:", err);
        if (err.message && err.message.includes('loading')) {
            return "⏳ Le modèle est en cours de chargement (Cold Start). Réessayez dans 20 secondes.";
        }
        return "Erreur Hugging Face: " + (err.message || err);
    }
};

/**
 * AI Router: Detects which data category corresponds to the user's question.
 */
export const detectCategory = async (apiKey, message, config) => {
    if (!apiKey) return null;

    const API_URL = "https://router.huggingface.co/v1/chat/completions";
    const MODEL_ID = "Qwen/Qwen2.5-7B-Instruct";

    const categoriesStr = config.map(c => `- GID: ${c.gid} | Catégorie: ${c.category} | Label: ${c.label} | Keywords: ${c.keywords || ''}`).join("\n");

    const messages = [
        {
            role: "system",
            content: `Tu es un moteur de recherche ultra-précis pour un tableau de bord agricole.
            Ta mission : Retourner UNIQUEMENT le GID de la base de données qui correspond à la question de l'utilisateur.

            BASES DE DONNÉES DISPONIBLES :
            ${categoriesStr}

            ### RÔLE
            Tu es l'expert en orientation de données. Ton rôle unique est d'identifier quel "volet" (GID) contient l'information nécessaire pour répondre à l'utilisateur.

            ### RÈGLES DE PRIORITÉ (CRITIQUE) :
            1. Analyse en priorité le "Label" du volet. Si l'utilisateur parle de "vaches", le Label "Prod. Animale" est le choix évident.
            2. Si l'utilisateur parle de "culture", "production", "olivier", "blé", "rendement" ou de l'agriculture en général, choisis IMPÉRATIVEMENT "GLOBAL_VEGETAL".
            3. Si l'utilisateur parle d'animaux, cheptel, bétail, lait ou viande en général, choisis "GLOBAL_ANIMAL".
            4. Si l'utilisateur demande "la culture dominante", "GLOBAL_VEGETAL" est le seul choix correct car cela nécessite de comparer Arbres Fruitier, Céréales et Maraîchage.
            5. Pour une question très précise sur un prix ou une unité de climat, reste sur le GID spécifique.

            ### FORMAT DE RÉPONSE ATTENDU
            - Si un seul volet suffit : Retourne uniquement le GID (ex: 763953801).
            - Si la question est globale sur les cultures : Retourne "GLOBAL_VEGETAL".
            - Si la question est globale sur les animaux : Retourne "GLOBAL_ANIMAL".
            Réponse : [GID ou GLOBAL_XXX] uniquement.`
        },
        { role: "user", content: `Question: "${message}"` }
    ];

    try {
        const response = await fetch(API_URL, {
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            method: "POST",
            body: JSON.stringify({ model: MODEL_ID, messages, max_tokens: 50, temperature: 0 }),
        });

        if (!response.ok) return null;

        const result = await response.json();
        const rawResponse = result.choices[0].message.content.trim();
        console.log("Raw Router Response:", rawResponse);

        if (rawResponse.includes("GLOBAL_VEGETAL")) return "GLOBAL_VEGETAL";
        if (rawResponse.includes("GLOBAL_ANIMAL")) return "GLOBAL_ANIMAL";

        // Extract ONLY the numeric GID
        const matches = rawResponse.match(/\d+/);
        const detectedGid = matches ? matches[0] : null;

        if (config.some(c => c.gid === detectedGid)) return detectedGid;
        return null;
    } catch (e) {
        console.error("Routing Error:", e);
        return null;
    }
};
