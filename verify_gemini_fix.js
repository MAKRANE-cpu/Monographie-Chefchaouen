
const testHistoryLogic = (history) => {
    // Logic from gemini.js
    let validHistory = history.filter(msg => msg.role === 'user' || msg.role === 'model');

    // Find the first 'user' message
    const firstUserIndex = validHistory.findIndex(msg => msg.role === 'user');
    if (firstUserIndex !== -1) {
        validHistory = validHistory.slice(firstUserIndex);
    } else {
        validHistory = []; // No user messages yet
    }

    // Take the last 4 messages to keep context small
    validHistory = validHistory.slice(-4);

    // Re-check: if slice(-4) made it start with 'model', remove it
    if (validHistory.length > 0 && validHistory[0].role === 'model') {
        validHistory = validHistory.slice(1);
    }

    return validHistory;
};

// Test cases
const cases = [
    {
        name: "Starts with model (greeting)",
        history: [{ role: 'model', content: 'Hello' }, { role: 'user', content: 'Hi' }],
        expectedStart: 'user'
    },
    {
        name: "Long history, slice would start with model",
        history: [
            { role: 'user', content: 'U1' }, { role: 'model', content: 'M1' },
            { role: 'user', content: 'U2' }, { role: 'model', content: 'M2' },
            { role: 'user', content: 'U3' }, { role: 'model', content: 'M3' },
            { role: 'user', content: 'U4' }, { role: 'model', content: 'M4' }
        ],
        // slice(-4) would be: [U3, M3, U4, M4] -> Correct (starts with U3)
        // If history was [M1, U2, M2, U3, M3, U4, M4], slice(-4) would be [U3, M3, U4, M4]
        // If history was [U1, M1, U2, M2, U3, M3, U4], slice(-4) would be [M2, U3, M3, U4] -> should become [U3, M3, U4]
        expectedStart: 'user'
    }
];

cases.forEach(c => {
    const result = testHistoryLogic(c.history);
    const startRole = result.length > 0 ? result[0].role : 'empty';
    console.log(`Test: ${c.name} | Starts with: ${startRole} | Success: ${startRole === c.expectedStart || (result.length === 0 && startRole === 'empty')}`);
});
