const $=id=>document.getElementById(id);
const triggers=[...document.querySelectorAll('.menu-trigger')];
function closeMenus(focus=false){for(const trigger of triggers){if(focus&&trigger.getAttribute('aria-expanded')==='true')trigger.focus();trigger.setAttribute('aria-expanded','false');$(trigger.getAttribute('aria-controls')).hidden=true;}}
function items(trigger){return [...$(trigger.getAttribute('aria-controls')).querySelectorAll('button:not(:disabled),a[href],select')];}
for(const trigger of triggers){
 trigger.addEventListener('click',()=>{const open=trigger.getAttribute('aria-expanded')==='true';closeMenus();if(!open){trigger.setAttribute('aria-expanded','true');$(trigger.getAttribute('aria-controls')).hidden=false;}});
 trigger.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();closeMenus();trigger.setAttribute('aria-expanded','true');$(trigger.getAttribute('aria-controls')).hidden=false;items(trigger)[0]?.focus();}});
 const popup=$(trigger.getAttribute('aria-controls'));
 popup.addEventListener('click',e=>{if(e.target.closest('button,a'))closeMenus();});
 popup.addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key)||e.target.matches('select'))return;e.preventDefault();const all=items(trigger),i=all.indexOf(document.activeElement);all[e.key==='Home'?0:e.key==='End'?all.length-1:(i+(e.key==='ArrowDown'?1:-1)+all.length)%all.length]?.focus();});
}
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.menubar'))closeMenus();});
document.addEventListener('focusin',e=>{if(!e.target.closest('.menubar'))closeMenus();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenus(true);if(!$('panel').hidden)$('close-panel').click();}});
$('github-connect').onclick=()=>openBitbucket('github');
$('connect').addEventListener('click',()=>{$('connection-error').textContent='';});
function panelState(){const open=!$('panel').hidden;$('edit').setAttribute('aria-expanded',String(open));$('edit').classList.toggle('editing',open);}
new MutationObserver(panelState).observe($('panel'),{attributes:true,attributeFilter:['hidden']});
function badge(){const count=Number($('count').textContent)||0;$('menu-count').hidden=count===0;$('menu-count').textContent=String(count);}
new MutationObserver(badge).observe($('count'),{childList:true,subtree:true,characterData:true});badge();panelState();
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});

function openBitbucket(provider='bitbucket'){const dialog=$('bitbucket-dialog');dialog.showModal();dialog.dispatchEvent(new CustomEvent('dragger:open',{detail:{provider}}));}
$('bitbucket-connect').onclick=()=>openBitbucket('bitbucket');
document.addEventListener('click',e=>{const link=e.target.closest('a[href]');if(link&&new URL(link.href,location.href).origin===location.origin&&['/bitbucket.html','/github.html'].includes(new URL(link.href,location.href).pathname)){e.preventDefault();openBitbucket(new URL(link.href,location.href).pathname==='/github.html'?'github':'bitbucket');}},true);
