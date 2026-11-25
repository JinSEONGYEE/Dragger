import http from 'node:http';
import {connectionAPI} from './lib/connection-api.mjs';
const connection=connectionAPI(process.env.DRAGGER_WORKSPACE||fileURLToPath(new URL('../work/repositories/',import.meta.url)));
import {draftAPI} from './lib/draft-api.mjs';
import {setupAPI} from './lib/setup-api.mjs';
const dataDirectory=process.env.DRAGGER_DATA_DIR||fileURLToPath(new URL('./.local/',import.meta.url));
const setup=setupAPI(path.join(dataDirectory,'project.json'),{publicationRepository:async()=>{const state=await connection('status',{});return state.connected?state.directory:null;}});
const drafts=draftAPI(path.join(dataDirectory,'drafts'),setup);
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const mime = { '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if(pathname==='/api/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({application:'dragger',mcp:1}));}
    if(pathname.startsWith('/api/source/')||pathname.startsWith('/api/connection/')||pathname.startsWith('/api/setup/')||pathname.startsWith('/api/draft/')){
      const origin=`http://127.0.0.1:${server.address().port}`;
      if(req.headers.host!==new URL(origin).host||req.method!=='POST'||req.headers.origin!==origin||!req.headers['content-type']?.startsWith('application/json')){res.writeHead(403);return res.end('Forbidden');}
      try{const handler=pathname.startsWith('/api/connection/')?connection:pathname.startsWith('/api/draft/')?drafts:pathname.startsWith('/api/setup/')?setup.call:await setup.source();if(!handler)throw Error('원본 프로젝트가 연결되지 않았습니다.');let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1000000)throw Error('요청이 너무 큽니다.');}const result=await handler(pathname.split('/').pop(),JSON.parse(raw));res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify(result));}catch(error){res.writeHead(400,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:error.message}));}
    }
    const file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!file.startsWith(root+path.sep)) { res.writeHead(403); return res.end(); }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(Number(process.env.HARNESS_PORT || 4317), '127.0.0.1', () => console.log('Local: http://127.0.0.1:' + server.address().port));
