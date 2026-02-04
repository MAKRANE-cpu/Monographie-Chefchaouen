import Papa from 'papaparse';

// Base ID of the document
// Base ID of the document (from .env or default)
const DOC_ID = import.meta.env.VITE_GS_ID || '2PACX-1vSWWVTXdCJPajKKheU3te60ZfgVu8fiAa4JvAUQkwpCH23DhKUAbMlB71m9oX_YDA';
// We reconstruct the URL to allow changing the 'gid'.
// standard pubhtml export link: https://docs.google.com/spreadsheets/d/e/[ID]/pub?gid=[GID]&single=true&output=csv
const BASE_URL = `https://docs.google.com/spreadsheets/d/e/${DOC_ID}/pub?single=true&output=csv`;

export const fetchSheetData = async (gid = '0') => {
    try {
        const url = `${BASE_URL}&gid=${gid}`;
        console.log("Fetching Sheet GID:", gid, url);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const csvText = await response.text();

        return new Promise((resolve, reject) => {
            Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: (results) => {
                    // Basic validation
                    if (results.data.length === 0) {
                        console.warn("Empty sheet received for GID:", gid);
                    }
                    resolve(results.data);
                },
                error: (error) => reject(error),
            });
        });
    } catch (error) {
        console.error("Fetch error:", error);
        throw new Error(`Failed to load Sheet (GID: ${gid}). Ensure it is published.`);
    }
};
