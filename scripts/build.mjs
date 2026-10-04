import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const [engine,llm,html,css,client,pack]=await Promise.all(['worker/engine.js','worker/llm.js','web/index.html','web/style.css','web/client.js','data/prompts.json'].map(p=>readFile(new URL(p,root),'utf8')));
const page=html.replace('/*APP_STYLE*/',css).replace('/*APP_CLIENT*/',client);
const source='const PACK='+pack+';\nconst PAGE='+JSON.stringify(page)+';\n'+llm+'\n'+engine;
await mkdir(new URL('dist/server/',root),{recursive:true});
await mkdir(new URL('dist/.openai/',root),{recursive:true});
await writeFile(new URL('worker/index.js',root),source,'utf8');
await writeFile(new URL('dist/server/index.js',root),source,'utf8');
let manifest;try{manifest=await readFile(new URL('.openai/hosting.json',root),'utf8');}catch(e){if(e.code!=='ENOENT')throw e;manifest=await readFile(new URL('.openai/hosting.example.json',root),'utf8');}
await writeFile(new URL('dist/.openai/hosting.json',root),manifest,'utf8');
await cp(new URL('drizzle/',root),new URL('dist/.openai/drizzle/',root),{recursive:true});
console.log('Built multiplayer Worker with D1 migrations and MCP.');
