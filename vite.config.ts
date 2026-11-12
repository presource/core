import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'presource-core',
            formats: ['es'],
            fileName: () => 'presource-core.mjs',
        },
        rollupOptions: {
            external: [/^node:/],
            output: {
                globals: {},
            },
        },
        sourcemap: true,
        emptyOutDir: true,
    },
});
