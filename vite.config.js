import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    root: 'data',
    // publicDir: '../public',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
    },
    plugins: [
        tailwindcss(),
    ],
});
