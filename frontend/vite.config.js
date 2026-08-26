import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: ['spectacular-wisdom-production-91f4.up.railway.app'],
  },
})
