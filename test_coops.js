// Test pour vérifier les données des coopératives à Bab Taza
const SHEET_ID = "1d2FpgQH_VYzh29kJFXyU76_aLOmK2P0DFY7rZ7zDDy8";
const GID = "1244386954"; // Coopératives

const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${GID}`;

fetch(url)
    .then(res => res.text())
    .then(text => {
        const json = JSON.parse(text.substring(47).slice(0, -2));
        const rows = json.table.rows;
        const cols = json.table.cols;

        console.log(`Total coop rows: ${rows.length}`);

        // Recherche de Bab Taza
        const babTazaRows = rows.filter(row => {
            const commune = row.c[0]?.v;
            return commune && commune.toLowerCase().includes('bab taza');
        });

        if (babTazaRows.length > 0) {
            console.log(`✅ Found ${babTazaRows.length} coops for Bab Taza:`);
            babTazaRows.forEach(row => {
                console.log(`Nom: ${row.c[1]?.v} | Activité: ${row.c[2]?.v}`);
            });
        } else {
            console.log('❌ No coops found for Bab Taza specifically.');
            console.log('Sample communes in this sheet:', rows.slice(0, 5).map(r => r.c[0]?.v).join(', '));
        }
    })
    .catch(err => console.error('Error:', err.message));
