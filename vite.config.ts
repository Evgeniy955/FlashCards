import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Cast process to any to avoid TS error if Node types are missing/conflicted
  const env = loadEnv(mode, (process as any).cwd(), '');

  // Check both the loaded env file AND the system process.env (for Vercel/CI)
  const apiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || env.API_KEY || 
                 process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.API_KEY || '';

  return {
    plugins: [react()],
    define: {
      // Inject the key into the code
      'process.env.API_KEY': JSON.stringify(apiKey),
      // Prevent "process is not defined" error in browser
      'process.env': {} 
    }
  }
})