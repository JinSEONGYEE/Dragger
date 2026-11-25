#!/usr/bin/env node
import {StdioServerTransport} from '@modelcontextprotocol/server/stdio';
import {createMcp,localRuntime} from '../lib/mcp.mjs';
const runtime=localRuntime(),server=createMcp(runtime);
let closing=false;async function shutdown(){if(closing)return;closing=true;runtime.stop();await server.close();}
for(const signal of ['SIGINT','SIGTERM','SIGHUP'])process.on(signal,()=>{void shutdown().finally(()=>process.exit(0));});
process.stdin.on('end',()=>void shutdown());
try{await server.connect(new StdioServerTransport());}catch(error){console.error(error.message);await shutdown();process.exitCode=1;}
