import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';
export default defineConfig({root:resolve('github-pages'),base:'/LIGHT/',publicDir:resolve('public'),plugins:[react()],build:{target:'es2022',outDir:resolve('dist/pages'),emptyOutDir:true},server:{host:'0.0.0.0',allowedHosts:['terminal.local']}});
