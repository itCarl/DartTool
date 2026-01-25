import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    root: 'data',
    // publicDir: '../public',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                index: 'data/index.html',
                settings: 'data/settings.html',
                debug: 'data/debug.html',
                captivePortal: 'data/captivePortal.html',
                components: 'data/components.html',
            }
        }
    },
    plugins: [
        tailwindcss(),
    ],
});
