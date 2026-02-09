// Quick test to check if Amtar exists in Pédologie sheet
const SHEET_ID = "1d2FpgQH_VYzh29kJFXyU76_aLOmK2P0DFY7rZ7zDDy8";
const GID = "36624045"; // Pédologie

const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${GID}`;

fetch(url)
    .then(res => res.text())
    .then(text => {
        const json = JSON.parse(text.substring(47).slice(0, -2));
        const rows = json.table.rows;
        const cols = json.table.cols;

        console.log(`Total rows: ${rows.length}`);
        console.log(`Columns: ${cols.map(c => c.label).join(', ')}\n`);

        // Search for Amtar
        const amtarRows = rows.filter(row => {
            const commune = row.c[0]?.v;
            return commune && commune.toLowerCase().includes('amtar');
        });

        if (amtarRows.length > 0) {
            console.log(`✅ Found ${amtarRows.length} rows for Amtar in Pédologie:`);
            amtarRows.forEach(row => {
                console.log(`Commune: ${row.c[0]?.v}`);
                console.log(`Data: ${JSON.stringify(row.c.slice(0, 5).map(c => c?.v))}\n`);
            });
        } else {
            console.log('❌ No data found for Amtar in Pédologie sheet');
            console.log('\nSample communes in this sheet:');
            rows.slice(0, 5).forEach(row => {
                console.log(`- ${row.c[0]?.v}`);
            });
        }
    })
    .catch(err => console.error('Error:', err.message));
