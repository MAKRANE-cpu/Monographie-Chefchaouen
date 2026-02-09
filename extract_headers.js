const Papa = require('papaparse');
const fs = require('fs');
const https = require('https');

const DOC_ID = '2PACX-1vSWWVTXdCJPajKKheU3te60ZfgVu8fiAa4JvAUQkwpCH23DhKUAbMlB71m9oX_YDA';
const BASE_URL = `https://docs.google.com/spreadsheets/d/e/${DOC_ID}/pub?single=true&output=csv`;

const SHEET_CONFIG = [
    { gid: '1482909862', label: 'Occupation du Sol' },
    { gid: '1093980512', label: 'Statut Juridique' },
    { gid: '1969268389', label: 'Taille Explo.' },
    { gid: '1863414135', label: 'Pentes/Relief' },
    { gid: '36624045', label: 'Pédologie' },
    { gid: '1841187586', label: 'Céréales' },
    { gid: '804566860', label: 'Légumineuses' },
    { gid: '1112163282', label: 'Maraîchage' },
    { gid: '763953801', label: 'Arbres Fruitiers' },
    { gid: '1816499777', label: 'Fourrages' },
    { gid: '89780069', label: 'Irrigation' },
    { gid: '1626847998', label: 'Pluviométrie' },
    { gid: '415424306', label: 'Climat Général' },
    { gid: '1098465258', label: 'Prod. Animale' },
    { gid: '782982223', label: 'Aviculture' },
    { gid: '859706911', label: 'Apiculture' },
    { gid: '1403136050', label: 'Lait' },
    { gid: '144848058', label: 'Abattoirs' },
    { gid: '1060919262', label: 'Population' },
    { gid: '1979562049', label: 'Habitants (Détail)' },
    { gid: '1244386954', label: 'Coopératives' },
    { gid: '523486635', label: 'Agro-Industrie' }
];

function getUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function extractHeaders() {
    console.log("Starting header extraction...");
    const results = {};

    for (const config of SHEET_CONFIG) {
        process.stdout.write(`Fetching ${config.label}... `);
        try {
            const url = `${BASE_URL}&gid=${config.gid}`;
            const csvText = await getUrl(url);

            const firstLine = csvText.split('\n')[0];
            const headers = Papa.parse(firstLine).data[0];

            if (!headers) {
                console.log("Empty or invalid CSV");
                continue;
            }

            // Filter out empty headers and 'Commune'
            const filteredHeaders = headers
                .filter(h => h && h.trim() && !h.toLowerCase().includes('commune') && !h.toLowerCase().includes('cercle'))
                .map(h => h.trim());

            results[config.gid] = filteredHeaders.join(', ');
            console.log("Done.");
        } catch (e) {
            console.log(`Failed: ${e.message}`);
        }
    }

    fs.writeFileSync('extracted_headers.json', JSON.stringify(results, null, 2));
    console.log("\nHeaders saved to extracted_headers.json");
}

extractHeaders();
