import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // host: true serve per raggiungere il dev server dal telefono sulla stessa rete.
  server: { host: true, port: 5173 },
});
