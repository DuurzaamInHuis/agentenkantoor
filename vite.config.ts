import { defineConfig } from 'vite';

// Relatieve base zodat de build werkt onder https://<gebruiker>.github.io/agentenkantoor/
export default defineConfig({
  base: './',
  build: { target: 'es2020' },
});
