import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    build: {
        rollupOptions: {
            external: ['@google/genai']
        }
    },
    define: {
        // This replaces process.env.API_KEY in the code with the actual value string.
        // IMPORTANT: This must match the access pattern in src/lib/gemini.ts exactly.
        'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '')
    }
})
