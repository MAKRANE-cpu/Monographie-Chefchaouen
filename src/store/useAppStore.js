import { create } from 'zustand';
import { fetchSheetData } from '../services/googleSheets';

export const useAppStore = create((set, get) => ({
    // Dictionary of sheets: { "0": [...data], "123": [...data] }
    sheets: {},
    // Main data (for backward compat with components using 'data')
    data: [],
    currentSheetId: '0',

    isLoading: false,
    error: null,
    // Priority: Environment Variable (Vercel) > Local Storage (User override)
    apiKey: import.meta.env.VITE_HF_TOKEN || localStorage.getItem('hf_api_key') || '',
    geminiApiKey: import.meta.env.VITE_GEMINI_TOKEN || localStorage.getItem('gemini_api_key') || '',

    setApiKey: (key) => {
        localStorage.setItem('hf_api_key', key);
        set({ apiKey: key });
    },

    setGeminiApiKey: (key) => {
        localStorage.setItem('gemini_api_key', key);
        set({ geminiApiKey: key });
    },

    setSheetId: (gid) => {
        set({ currentSheetId: gid });
        // Update 'data' to reflect current sheet for legacy components
        const currentSheets = get().sheets;
        if (currentSheets[gid]) {
            set({ data: currentSheets[gid] });
        } else {
            // Trigger load if not present
            get().loadData(gid);
        }
    },

    loadData: async (gid = '0') => {
        set({ isLoading: true, error: null });
        try {
            const newData = await fetchSheetData(gid);

            set(state => ({
                sheets: { ...state.sheets, [gid]: newData },
                data: newData, // Update main data view
                currentSheetId: gid,
                isLoading: false
            }));
        } catch (err) {
            set({ error: err.message, isLoading: false });
        }
    },

    loadAllSheets: async (configs) => {
        set({ isLoading: true, error: null });
        try {
            const promises = configs.map(c => fetchSheetData(c.gid));
            const results = await Promise.all(promises);

            const newSheets = { ...get().sheets };
            configs.forEach((c, idx) => {
                newSheets[c.gid] = results[idx];
            });

            set({ sheets: newSheets, isLoading: false });
            return newSheets;
        } catch (err) {
            set({ error: "Échec du chargement global : " + err.message, isLoading: false });
            throw err;
        }
    }
}));
