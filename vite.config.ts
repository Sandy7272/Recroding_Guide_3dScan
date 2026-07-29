import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import mkcert from "vite-plugin-mkcert";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // Local HTTPS only — getUserMedia needs a secure context when testing on a
    // phone over the LAN. Netlify already serves HTTPS, and running this in CI
    // would just try to mint certs on the build box.
    mode === "development" && mkcert(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));