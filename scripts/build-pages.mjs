import {build} from 'vite';
import {copyFile,writeFile} from 'node:fs/promises';
await build({configFile:'vite.pages.config.ts'});
await copyFile('github-pages/ekklo-config.json','dist/pages/ekklo-config.json');
await copyFile('github-pages/sw.js','dist/pages/sw.js');
await copyFile('dist/pages/index.html','dist/pages/404.html');
await writeFile('dist/pages/.nojekyll','');
