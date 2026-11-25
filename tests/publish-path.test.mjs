import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,realpath,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';
test('canonical temporary repository allows internal files and rejects escaping symlinks',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'dragger-path-test-'));try{
  const repo=path.join(temp,'repo');await mkdir(repo);await writeFile(path.join(repo,'file.tsx'),'source');await writeFile(path.join(temp,'outside.tsx'),'outside');await symlink(repo,path.join(temp,'alias'),'junction');await symlink(path.join(temp,'outside.tsx'),path.join(repo,'escape.tsx'));
  const root=await realpath(path.join(temp,'alias'));
  assert.equal((await realpath(path.join(root,'file.tsx'))).startsWith(root+path.sep),true);
  assert.equal((await realpath(path.join(root,'escape.tsx'))).startsWith(root+path.sep),false);
 }finally{await rm(temp,{recursive:true,force:true});}
});
