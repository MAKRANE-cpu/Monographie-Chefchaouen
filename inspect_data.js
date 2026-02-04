const fetch = require('node-fetch');

const DOC_ID = '1PRhFClGBrLE0agIqIwS8JKIHDAC3Afvp';
const GIDS = {
    'Maraîchage': '1112163282',
    'Arbres Fruitiers': '763953801',
    'Céréales': '1841187586'
};

async function inspect(label, gid) {
    console.log(`\n--- Inspecting ${label} (${gid}) ---`);
    const url = `https://docs.google.com/spreadsheets/d/${DOC_ID}/export?format=csv&gid=${gid}`;
    const resp = await fetch(url);
    const text = await resp.text();
    const rows = text.split('\n');
    console.log('Headers:', rows[0]);
    console.log('First 5 rows:');
    rows.slice(1, 6).forEach(r => console.log(r));
}

async function run() {
    for (const [label, gid] of Object.entries(GIDS)) {
        await inspect(label, gid);
    }
}

run();
