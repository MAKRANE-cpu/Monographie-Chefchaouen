// Quick test to check if Bab Taza exists in Maraîchage sheet
const SHEET_ID = "1d2FpgQH_VYzh29kJFXyU76_aLOmK2P0DFY7rZ7zDDy8";
const GID = "1112163282"; // Maraîchage

const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${GID}`;

fetch(url)
    .then(res => res.text())
    .then(text => {
        const json = JSON.parse(text.substring(47).slice(0, -2));
        const rows = json.table.rows;
        const cols = json.table.cols;

        console.log(`Total rows: ${rows.length}`);
        console.log(`Columns: ${cols.map(c => c.label).join(', ')}\n`);

        // Search for Bab Taza
        const babTazaRows = rows.filter(row => {
            const commune = row.c[0]?.v;
            return commune && commune.toLowerCase().includes('bab taza');
        });

        if (babTazaRows.length > 0) {
            console.log(`✅ Found ${babTazaRows.length} rows for Bab Taza:`);
            babTazaRows.forEach(row => {
                console.log(`Commune: ${row.c[0]?.v}`);
                console.log(`Data: ${JSON.stringify(row.c.slice(0, 5).map(c => c?.v))}\n`);
            });
        } else {
            console.log('❌ No data found for Bab Taza in Maraîchage sheet');
            console.log('\nAll communes in this sheet:');
            rows.slice(0, 10).forEach(row => {
                console.log(`- ${row.c[0]?.v}`);
            });
        }
    })
    .catch(err => console.error('Error:', err.message));
