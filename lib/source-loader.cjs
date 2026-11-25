const path=require('node:path');
module.exports=function(code){const root=this.rootContext;const ts=require(require.resolve('typescript',{paths:[root]}));const file=path.relative(root,this.resourcePath).split(path.sep).join('/');return require('./source.cjs').instrument(ts,code,file);};
