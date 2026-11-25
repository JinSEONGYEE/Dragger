const panel=document.getElementById('panel'),handle=document.getElementById('panel-handle');
let drag=null,moved=false;
function move(left,top){
 const rect=panel.getBoundingClientRect();
 panel.style.left=`${Math.max(8,Math.min(left,innerWidth-rect.width-8))}px`;
 const y=Math.max(8,Math.min(top,innerHeight-88));
 panel.style.top=`${y}px`;
 panel.style.maxHeight=`${Math.max(80,innerHeight-y-8)}px`;
 panel.style.right='auto';
}
function clamp(){if(panel.hidden)return;if(!moved){const anchor=document.getElementById('edit').getBoundingClientRect();move(anchor.right-panel.getBoundingClientRect().width,anchor.bottom+8);}else{const rect=panel.getBoundingClientRect();move(rect.left,rect.top);}}
new MutationObserver(clamp).observe(panel,{attributes:true,attributeFilter:['hidden']});
handle.addEventListener('pointerdown',e=>{
 if(e.button!==0||e.target.closest('button'))return;
 const rect=panel.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX-rect.left,y:e.clientY-rect.top};
 handle.setPointerCapture(e.pointerId);document.body.classList.add('panel-dragging');e.preventDefault();
});
handle.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId){moved=true;move(e.clientX-drag.x,e.clientY-drag.y);}});
function stop(){drag=null;document.body.classList.remove('panel-dragging');}
for(const event of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(event,stop);
window.addEventListener('blur',stop);
handle.addEventListener('keydown',e=>{
 if(e.target!==handle)return;
 const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!d)return;
 e.preventDefault();moved=true;const r=panel.getBoundingClientRect(),step=e.shiftKey?40:10;move(r.left+d[0]*step,r.top+d[1]*step);
});
window.addEventListener('resize',clamp);
new ResizeObserver(clamp).observe(panel);
