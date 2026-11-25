#!/usr/bin/env node
const prompt=process.argv[2]||'',host=process.env.DRAGGER_GIT_HOST||'bitbucket.org';
if(!['github.com','bitbucket.org'].includes(host))process.exit(1);
const username=host==='github.com'?'x-access-token':'x-bitbucket-api-token-auth';
const match=prompt.match(/https:\/\/[^'"\s]+/);let url;try{url=new URL(match?.[0]);}catch{process.exit(1);}
if(url.protocol!=='https:'||url.hostname!==host||url.port||url.password||(url.username&&url.username!==username))process.exit(1);
if(/^Username/i.test(prompt))process.stdout.write(username+'\n');
else if(/^Password/i.test(prompt)&&process.env.DRAGGER_GIT_TOKEN)process.stdout.write(process.env.DRAGGER_GIT_TOKEN+'\n');
else process.exit(1);
