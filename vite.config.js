import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    outDir: mode === 'singlefile' ? 'dist-singlefile' : 'dist',
    target: 'es2020',
  },
  plugins: mode === 'singlefile' ? [viteSingleFile()] : [],
}));
