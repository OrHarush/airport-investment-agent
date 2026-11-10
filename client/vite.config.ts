import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// The API proxy follows PORT from the repo-root .env (or the shell), default 3001.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, "..", ""), ...process.env };
  return {
    plugins: [react()],
    server: { port: 5173, proxy: { "/api": `http://localhost:${env.PORT ?? 3001}` } },
  };
});
