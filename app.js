'use strict';
/* AppHost — public app listing + admin panel that publishes apps straight into the GitHub repo. */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const root=$('#root');
$('#yr').textContent=new Date().getFullYear();

/* ---------- safe storage ---------- */
const ls={
 get(k){try{return localStorage.getItem(k)}catch(e){return null}},
 set(k,v){try{localStorage.setItem(k,v);return true}catch(e){return false}},
 del(k){try{localStorage.removeItem(k)}catch(e){}}
};

/* ---------- theme ---------- */
const MOON='<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const SUN='<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
function setTheme(t,save){
 document.documentElement.setAttribute('data-theme',t);
 $('#tg').innerHTML=t==='dark'?SUN:MOON;
 $('#tg').title=t==='dark'?'Switch to light theme':'Switch to dark theme';
 if(save)ls.set('ah_theme',t);
}
setTheme(document.documentElement.getAttribute('data-theme')||'light');
$('#tg').onclick=()=>setTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark',true);

/* ---------- helpers ---------- */
const fmtDate=t=>{const d=new Date(t);return isNaN(d)?'':d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})};
const fmtSize=n=>!n&&n!==0?'':n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';
const newId=()=>Math.random().toString(36).slice(2,6)+Date.now().toString(36).slice(-4);
const ico=(a,s)=>a&&a.icon
 ?`<img class="ico" src="${esc(a.icon)}?v=${esc(a.updated||'')}" alt="" width="${s}" height="${s}" loading="lazy" style="width:${s}px;height:${s}px" onerror="this.outerHTML=phIcon(this.dataset.n,${s})" data-n="${esc(a.name)}">`
 :phIcon(a&&a.name,s);
function phIcon(name,s){return `<span class="ico ph" style="width:${s}px;height:${s}px;font-size:${Math.round(s*.44)}px" aria-hidden="true">${esc(((name||'?').trim().charAt(0)||'?').toUpperCase())}</span>`}
window.phIcon=phIcon;

function bytesB64(b){let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));return btoa(s)}
const txtB64=s=>bytesB64(new TextEncoder().encode(s));
const b64u8=s=>Uint8Array.from(atob(s.replace(/\s/g,'')),c=>c.charCodeAt(0));
const b64Txt=s=>new TextDecoder().decode(b64u8(s));

function toIcon(f){return new Promise((res,rej)=>{
 const u=URL.createObjectURL(f),im=new Image();
 im.onload=()=>{try{
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
  const w=im.naturalWidth||im.width||128,h=im.naturalHeight||im.height||128,m=Math.min(w,h),sx=(w-m)/2,sy=(h-m)/2;
  x.drawImage(im,sx,sy,m,m,0,0,128,128);URL.revokeObjectURL(u);res(c.toDataURL('image/png'));
 }catch(e){rej(e)}};
 im.onerror=()=>{URL.revokeObjectURL(u);rej(new Error('Could not read that image.'))};
 im.src=u;
})}

/* ---------- toast + dialogs ---------- */
function toast(msg,kind){
 let w=$('#toasts');if(!w){w=document.createElement('div');w.id='toasts';w.className='toasts';w.setAttribute('aria-live','polite');document.body.appendChild(w)}
 const t=document.createElement('div');t.className='toast '+(kind||'');t.textContent=msg;w.appendChild(t);
 setTimeout(()=>t.remove(),kind==='bad'?6500:3800);
}
function modal(inner,wide){
 const m=document.createElement('div');m.className='modal';
 m.innerHTML=`<div class="dlg glass" role="dialog" aria-modal="true"${wide?' style="max-width:520px"':''}>${inner}</div>`;
 document.body.appendChild(m);
 const kd=e=>{if(e.key==='Escape')m.close()};
 m.close=()=>{m.remove();document.removeEventListener('keydown',kd)};
 document.addEventListener('keydown',kd);
 m.addEventListener('mousedown',e=>{if(e.target===m)m.close()});
 return m;
}
function confirmBox(title,text,ok,danger){return new Promise(res=>{
 const m=modal(`<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="row end"><button class="btn alt" id="cn" type="button">Cancel</button><button class="btn ${danger?'danger solid':''}" id="ck" type="button">${esc(ok||'OK')}</button></div>`);
 const raw=m.close;let fin=false;
 const done=v=>{if(fin)return;fin=true;raw();res(v)};
 m.close=()=>done(false);
 $('#cn',m).onclick=()=>done(false);$('#ck',m).onclick=()=>done(true);$('#ck',m).focus();
})}

/* ---------- public app list ---------- */
let appsCache=null;
async function loadApps(force){
 if(appsCache&&!force)return appsCache;
 const r=await fetch('apps.json?'+Date.now(),{cache:'no-store'});
 if(!r.ok)throw new Error('HTTP '+r.status);
 const j=await r.json();
 appsCache=Array.isArray(j.apps)?j.apps:[];
 return appsCache;
}

/* ---------- admin session (token only ever lives in memory) ---------- */
let token=null;
const getCfg=()=>{try{return JSON.parse(ls.get('ah_cfg')||'null')}catch(e){return null}};
const hasCrypto=()=>!!(window.crypto&&crypto.subtle);
async function deriveKey(pw,salt){
 const m=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},m,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function seal(pw,text){
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},await deriveKey(pw,salt),new TextEncoder().encode(text));
 return {salt:bytesB64(salt),iv:bytesB64(iv),ct:bytesB64(new Uint8Array(ct))};
}
async function unseal(pw,o){
 const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64u8(o.iv)},await deriveKey(pw,b64u8(o.salt)),b64u8(o.ct));
 return new TextDecoder().decode(pt);
}

/* ---------- GitHub API ---------- */
async function ghRaw(method,url,body,tk){
 let r;
 try{
  r=await fetch(url,{method,headers:{Authorization:'Bearer '+(tk||token),Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},body:body?JSON.stringify(body):undefined});
 }catch(e){const er=new Error('Network error — check your connection and try again.');er.status=0;throw er}
 if(r.ok)return r.status===204?null:r.json();
 let m='';try{m=(await r.json()).message||''}catch(e){}
 const er=new Error(
  r.status===401?'The GitHub token is invalid or expired. Disconnect this device and set it up again.':
  r.status===403&&/rate limit/i.test(m)?'GitHub rate limit reached. Please wait a few minutes.':
  r.status===403||r.status===404?'GitHub refused the request. Check the repository name and that the token has “Contents: Read and write” access to it.':
  'GitHub error ('+r.status+')'+(m?': '+m:''));
 er.status=r.status;throw er;
}
const encPath=p=>p.split('/').map(encodeURIComponent).join('/');
async function getMeta(path){
 const c=getCfg();
 try{return await ghRaw('GET',`https://api.github.com/repos/${c.repo}/contents/${encPath(path)}?ref=${encodeURIComponent(c.branch)}&t=${Date.now()}`)}
 catch(e){if(e.status===404)return null;throw e}
}
async function putFile(path,b64,message,sha){
 const c=getCfg();
 return ghRaw('PUT',`https://api.github.com/repos/${c.repo}/contents/${encPath(path)}`,{message,content:b64,branch:c.branch,...(sha?{sha}:{})});
}
async function delFile(path,message){
 const c=getCfg(),m=await getMeta(path);if(!m)return;
 return ghRaw('DELETE',`https://api.github.com/repos/${c.repo}/contents/${encPath(path)}`,{message,sha:m.sha,branch:c.branch});
}
async function readIndex(){
 const m=await getMeta('apps.json');
 if(!m)return [];
 try{const j=JSON.parse(b64Txt(m.content||''));return Array.isArray(j.apps)?j.apps:[]}catch(e){return []}
}
async function saveIndex(mut){
 for(let i=0;i<3;i++){
  const m=await getMeta('apps.json');let data={apps:[]};
  if(m){try{data=JSON.parse(b64Txt(m.content||''))}catch(e){data={apps:[]}}}
  if(!data||!Array.isArray(data.apps))data={apps:[]};
  mut(data.apps);
  try{await putFile('apps.json',txtB64(JSON.stringify(data,null,1)+'\n'),'Update app list',m&&m.sha);appsCache=null;return data.apps}
  catch(e){if(e.status===409||e.status===422)continue;throw e}
 }
 throw new Error('The app list was changed elsewhere. Please try again.');
}
function guessRepo(){
 const h=location.hostname;if(!/\.github\.io$/i.test(h))return '';
 const owner=h.split('.')[0],seg=location.pathname.split('/').filter(Boolean)[0];
 return owner+'/'+(seg&&!seg.includes('.')?seg:owner+'.github.io');
}

/* ---------- views: home ---------- */
async function home(my){
 root.innerHTML=`<section class="hero"><div><span class="eyebrow">Web apps</span><h1>Run web apps online</h1><p>Browse published apps and launch them instantly on desktop or mobile.</p></div>
 <div class="search"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input type="search" id="q" placeholder="Search apps…" aria-label="Search apps" autocomplete="off"></div></section>
 <div class="sec-h"><h2>Applications</h2><span class="meta" id="cnt"></span></div><div id="gl"><div class="spin" role="status" aria-label="Loading"></div></div>`;
 let apps;
 try{apps=(await loadApps(true)).filter(a=>a.published!==false)}
 catch(e){
  if(my!==nav)return;
  $('#gl').innerHTML=`<div class="empty">Could not load the app list.<br>${location.protocol==='file:'?'Open this site through its web address (GitHub Pages) instead of as a local file.':'Please try again in a moment.'}</div>`;return;
 }
 if(my!==nav)return;
 const draw=()=>{
  const q=$('#q').value.trim().toLowerCase();
  const list=q?apps.filter(a=>(a.name+' '+(a.desc||'')).toLowerCase().includes(q)):apps;
  $('#cnt').textContent=apps.length?list.length+' of '+apps.length:'';
  $('#gl').innerHTML=list.length?`<div class="grid">${list.map(a=>`<article class="card app"><div class="ah">${ico(a,52)}<h3>${esc(a.name)}</h3></div><p>${esc(a.desc||'No description.')}</p><div class="meta">Updated ${esc(fmtDate(a.updated))}${a.size?' · '+esc(fmtSize(a.size)):''}</div><a class="btn" href="#/app/${encodeURIComponent(a.id)}">Launch app</a></article>`).join('')}</div>`
  :`<div class="empty">${apps.length?'No apps match your search.':'No apps have been published yet.'}</div>`;
 };
 $('#q').oninput=draw;draw();
}

/* ---------- views: app viewer ---------- */
async function viewer(id,my){
 let apps;try{apps=await loadApps(true)}catch(e){apps=[]}
 if(my!==nav)return;
 const a=apps.find(x=>x.id===id);
 if(!a||(a.published===false&&!token)){root.innerHTML=`<div class="empty">App not found.<br><a href="#/">Back to all apps</a></div>`;return}
 document.body.insertAdjacentHTML('beforeend',`<div class="viewer" id="vw"><div class="vbar glass"><a class="btn alt sm" href="#/" aria-label="Back to apps">← Back</a>
  <div class="nm">${ico(a,28)}<b>${esc(a.name)}</b></div>
  <div class="seg" role="group" aria-label="Preview size"><button type="button" id="bd" class="on">Desktop</button><button type="button" id="bm">Mobile</button></div>
  <button class="btn alt sm hide-m" type="button" id="cl">Copy link</button>
  <button class="btn alt sm" type="button" id="fs">Fullscreen</button></div>
  <div class="stage" id="st"><div class="vload" id="vl"><div class="spin"></div></div><iframe id="fr" title="${esc(a.name)}" allow="fullscreen" sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads"></iframe></div></div>`);
 const fr=$('#fr'),st=$('#st');
 fr.addEventListener('load',()=>{const v=$('#vl');if(v)v.remove()});
 fr.src=a.file+'?v='+encodeURIComponent(a.updated||'');
 $('#bd').onclick=()=>{st.classList.remove('mob');$('#bd').classList.add('on');$('#bm').classList.remove('on')};
 $('#bm').onclick=()=>{st.classList.add('mob');$('#bm').classList.add('on');$('#bd').classList.remove('on')};
 $('#fs').onclick=()=>{const f=$('#fr');const fn=f.requestFullscreen||f.webkitRequestFullscreen;if(fn)fn.call(f)};
 $('#cl').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);toast('Link copied','ok')}catch(e){toast('Copy this page address from your browser bar.')}};
}

/* ---------- views: admin ---------- */
function setupView(){
 if(!hasCrypto()){root.innerHTML=`<div class="empty">The admin panel needs a secure (https) connection.<br>Open the site through its GitHub Pages address.</div>`;return}
 root.innerHTML=`<div class="card login" style="max-width:540px"><h1>Set up admin access</h1>
 <p class="meta">One-time setup on this device. Your GitHub token is encrypted with your admin password and is only used to talk to GitHub.</p>
 <div class="grid2"><div><label for="su">Admin username</label><input type="text" id="su" autocomplete="username" autocapitalize="none" spellcheck="false"></div>
 <div><label for="sp">Admin password</label><input type="password" id="sp" autocomplete="new-password" placeholder="Min. 8 characters"></div></div>
 <div class="grid2"><div><label for="sr">GitHub repository</label><input type="text" id="sr" placeholder="owner/repo" autocapitalize="none" spellcheck="false" value="${esc(guessRepo())}"></div>
 <div><label for="sb">Branch</label><input type="text" id="sb" value="main" autocapitalize="none" spellcheck="false"></div></div>
 <label for="st">GitHub access token</label><input type="password" id="st" autocomplete="off" placeholder="github_pat_…">
 <details><summary>How do I get a token?</summary><ol>
  <li>On GitHub open <b>Settings → Developer settings → Personal access tokens → Fine-grained tokens</b>.</li>
  <li>Click <b>Generate new token</b>. Under <b>Repository access</b> choose <b>Only select repositories</b> and pick this site’s repository.</li>
  <li>Under <b>Permissions → Repository permissions</b> set <b>Contents</b> to <b>Read and write</b>.</li>
  <li>Generate it and paste the token above. You won’t be able to see it again on GitHub.</li></ol></details>
 <div class="msg bad" id="m" role="alert"></div>
 <div style="margin-top:16px"><button class="btn block" id="go" type="button">Connect &amp; continue</button></div></div>`;
 const go=async()=>{
  const m=$('#m'),u=$('#su').value.trim(),p=$('#sp').value,repo=$('#sr').value.trim().replace(/^https?:\/\/github\.com\//i,'').replace(/\.git$/i,'').replace(/\/+$/,''),br=$('#sb').value.trim()||'main',tk=$('#st').value.trim();
  m.textContent='';
  if(!u)return m.textContent='Enter an admin username.';
  if(p.length<8)return m.textContent='Password must be at least 8 characters.';
  if(!/^[\w.-]+\/[\w.-]+$/.test(repo))return m.textContent='Enter the repository as owner/repo.';
  if(!tk)return m.textContent='Paste your GitHub access token.';
  const b=$('#go');b.disabled=true;b.textContent='Checking…';
  try{
   await ghRaw('GET',`https://api.github.com/repos/${repo}`,null,tk);
   try{await ghRaw('GET',`https://api.github.com/repos/${repo}/branches/${encodeURIComponent(br)}`,null,tk)}catch(e){if(e.status===404)throw new Error('Branch “'+br+'” was not found in that repository.');throw e}
   const sealed=await seal(p,tk);
   if(!ls.set('ah_cfg',JSON.stringify({v:1,u,repo,branch:br,...sealed})))throw new Error('Your browser is blocking storage, so the setup can’t be saved on this device.');
   token=tk;admin(nav);
  }catch(e){m.textContent=e.status===404?'Repository not found, or the token has no access to it.':e.message;b.disabled=false;b.textContent='Connect & continue'}
 };
 $('#go').onclick=go;$$('input',root).forEach(i=>i.onkeydown=e=>{if(e.key==='Enter')go()});$('#su').focus();
}

function loginView(){
 if(!hasCrypto()){root.innerHTML=`<div class="empty">The admin panel needs a secure (https) connection.</div>`;return}
 const c=getCfg();
 root.innerHTML=`<div class="card login"><h1>Administrator sign in</h1><p class="meta">Restricted area. Enter your admin credentials.</p>
 <label for="u">Username</label><input type="text" id="u" autocomplete="username" autocapitalize="none" spellcheck="false">
 <label for="p">Password</label><input type="password" id="p" autocomplete="current-password">
 <div class="msg bad" id="m" role="alert"></div>
 <div style="margin-top:16px"><button class="btn block" id="go" type="button">Sign in</button></div>
 <p class="meta" style="margin:16px 0 0;text-align:center"><a href="#/admin" id="fg">Forgot the password? Reset this device</a></p></div>`;
 const go=async()=>{
  const m=$('#m'),b=$('#go');m.textContent='';b.disabled=true;b.textContent='Signing in…';
  try{
   if($('#u').value.trim()!==c.u)throw 0;
   token=await unseal($('#p').value,c);admin(nav);
  }catch(e){m.textContent='Invalid username or password.';b.disabled=false;b.textContent='Sign in'}
 };
 $('#go').onclick=go;$('#p').onkeydown=e=>{if(e.key==='Enter')go()};$('#u').onkeydown=e=>{if(e.key==='Enter')$('#p').focus()};$('#u').focus();
 $('#fg').onclick=async e=>{e.preventDefault();
  if(await confirmBox('Reset this device?','This removes the saved admin login and token from this browser. You can set it up again with a GitHub token. Published apps are not affected.','Reset',true)){ls.del('ah_cfg');token=null;setupView()}};
}

async function admin(my){
 if(!getCfg())return setupView();
 if(!token)return loginView();
 const c=getCfg();
 root.innerHTML=`<div class="spin" role="status" aria-label="Loading"></div>`;
 let apps;
 try{apps=await readIndex()}
 catch(e){
  if(my!==nav)return;
  root.innerHTML=`<div class="empty">${esc(e.message)}<div class="row" style="justify-content:center;margin-top:14px"><button class="btn sm" id="rt" type="button">Try again</button><button class="btn alt sm" id="so" type="button">Sign out</button></div></div>`;
  $('#rt').onclick=()=>admin(nav);$('#so').onclick=()=>{token=null;loginView()};return;
 }
 if(my!==nav)return;
 const render=()=>{
  root.innerHTML=`<div class="row between"><div><h1 class="h1">Admin panel</h1><div class="meta">Publishing to <b>${esc(c.repo)}</b> · branch ${esc(c.branch)}</div></div><button class="btn alt sm" id="lo" type="button">Sign out</button></div>
  <div class="note" style="margin-top:14px">Changes go live on the public site about 1–2 minutes after publishing, while GitHub rebuilds the site.</div>
  <div class="two"><div class="col">
   <section class="card"><h2>Publish a new app</h2>
    <div class="drop" id="dz" tabindex="0" role="button" aria-label="Choose an HTML file">Drop an <b>.html</b> file here, or tap to choose<input type="file" id="fi" accept=".html,.htm,text/html" hidden></div>
    <div class="meta" id="fn" style="margin-top:8px">No file selected.</div>
    <label for="an">App name</label><input type="text" id="an" maxlength="60" autocomplete="off">
    <label for="ad">Short description</label><textarea id="ad" rows="2" maxlength="160" placeholder="One short sentence"></textarea>
    <label>Icon (optional)</label><div class="row"><span id="ip"></span><button class="btn alt sm" type="button" id="ib">Choose image</button><button class="btn alt sm" type="button" id="ir" hidden>Remove</button><input type="file" id="ii" accept="image/*" hidden></div>
    <label class="chk"><input type="checkbox" id="pb" checked> Show this app on the public site</label>
    <div style="margin-top:16px"><button class="btn" id="up" type="button">Upload &amp; publish</button></div><div class="msg" id="um" role="status"></div>
    <p class="meta" style="margin-bottom:0">Use one self-contained HTML file (CSS and JS inline, or loaded from a CDN). Max 20 MB.</p></section>
   <section class="card"><h2>Apps (${apps.length})</h2>
    <div class="list">${apps.length?apps.map(a=>`<div class="item"><div class="who">${ico(a,44)}<div style="min-width:0"><b>${esc(a.name)}</b> <span class="pill ${a.published===false?'warn':'ok'}">${a.published===false?'Hidden':'Published'}</span><div class="meta">${esc(fmtSize(a.size))} · ${esc(fmtDate(a.updated))}</div></div></div>
     <div class="acts"><a class="btn alt sm" href="#/app/${encodeURIComponent(a.id)}">Open</a><button class="btn alt sm" type="button" data-e="${esc(a.id)}">Edit</button><button class="btn alt sm" type="button" data-t="${esc(a.id)}">${a.published===false?'Show':'Hide'}</button><button class="btn danger sm" type="button" data-d="${esc(a.id)}">Delete</button></div></div>`).join(''):'<div class="empty">Nothing published yet.</div>'}</div>
    ${apps.length?'<p class="meta" style="margin:12px 0 0">Hidden apps are not listed publicly, but their files stay in the repository.</p>':''}</section>
  </div><div class="col">
   <section class="card"><h2>Account</h2>
    <label for="nu">Username</label><input type="text" id="nu" autocomplete="username" autocapitalize="none" spellcheck="false">
    <label for="np">New password <span class="meta">(leave blank to keep)</span></label><input type="password" id="np" autocomplete="new-password" placeholder="Min. 8 characters">
    <div style="margin-top:16px"><button class="btn" id="sc" type="button">Save changes</button></div><div class="msg" id="cm" role="status"></div>
    <hr style="border:0;border-top:1px solid var(--br);margin:18px 0">
    <button class="btn danger sm" id="dc" type="button">Disconnect this device</button>
    <p class="meta" style="margin:8px 0 0">Removes the saved login and token from this browser only.</p></section>
  </div></div>`;
  wire();
 };

 function wire(){
  $('#nu').value=c.u;
  $('#lo').onclick=()=>{token=null;loginView()};
  let file=null,icon='';
  const pv=()=>{$('#ip').innerHTML=icon?`<img class="ico" src="${icon}" alt="" width="44" height="44" style="width:44px;height:44px">`:phIcon($('#an').value||'?',44);$('#ir').hidden=!icon};
  $('#an').oninput=pv;pv();
  $('#ib').onclick=()=>$('#ii').click();
  $('#ii').onchange=async()=>{const f=$('#ii').files[0];if(!f)return;try{icon=await toIcon(f);pv()}catch(e){toast(e.message,'bad')}};
  $('#ir').onclick=()=>{icon='';$('#ii').value='';pv()};
  const pick=f=>{
   if(!f)return;const m=$('#um');
   if(!/\.html?$/i.test(f.name)){m.className='msg bad';m.textContent='Only .html files are supported.';return}
   if(f.size>20*1048576){m.className='msg bad';m.textContent='File is too large (20 MB max).';return}
   file=f;$('#fn').textContent=f.name+' · '+fmtSize(f.size);
   if(!$('#an').value)$('#an').value=f.name.replace(/\.html?$/i,'');pv();m.textContent='';
  };
  const dz=$('#dz'),fi=$('#fi');
  dz.onclick=()=>fi.click();dz.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fi.click()}};
  fi.onchange=()=>pick(fi.files[0]);
  dz.ondragover=e=>{e.preventDefault();dz.classList.add('on')};dz.ondragleave=()=>dz.classList.remove('on');
  dz.ondrop=e=>{e.preventDefault();dz.classList.remove('on');pick(e.dataTransfer.files[0])};
  $('#up').onclick=async()=>{
   const m=$('#um'),b=$('#up');m.className='msg bad';
   if(!file)return m.textContent='Please choose an HTML file first.';
   const name=$('#an').value.trim();if(!name)return m.textContent='Please enter an app name.';
   const desc=$('#ad').value.trim(),published=$('#pb').checked;
   b.disabled=true;m.className='msg';m.textContent='Uploading…';
   try{
    const id=newId(),bytes=new Uint8Array(await file.arrayBuffer());
    await putFile(`apps/${id}.html`,bytesB64(bytes),`Add app: ${name}`);
    if(icon)await putFile(`apps/${id}.png`,icon.split(',')[1],`Add icon: ${name}`);
    await saveIndex(l=>{l.unshift({id,name,desc,file:`apps/${id}.html`,icon:icon?`apps/${id}.png`:null,size:file.size,updated:Date.now(),published})});
    toast('Published. It will appear on the public site in 1–2 minutes.','ok');admin(nav);
   }catch(e){m.className='msg bad';m.textContent=e.message;b.disabled=false}
  };
  $$('[data-t]').forEach(b=>b.onclick=async()=>{
   b.disabled=true;
   try{await saveIndex(l=>{const a=l.find(x=>x.id===b.dataset.t);if(a){a.published=a.published===false;a.updated=Date.now()}});toast('Updated.','ok');admin(nav)}
   catch(e){toast(e.message,'bad');b.disabled=false}
  });
  $$('[data-d]').forEach(b=>b.onclick=async()=>{
   const a=apps.find(x=>x.id===b.dataset.d);if(!a)return;
   if(!await confirmBox('Delete this app?',`“${a.name}” will be permanently removed from the site and the repository.`,'Delete',true))return;
   b.disabled=true;
   try{
    await saveIndex(l=>{const i=l.findIndex(x=>x.id===a.id);if(i>=0)l.splice(i,1)});
    try{await delFile(a.file,`Delete app: ${a.name}`);if(a.icon)await delFile(a.icon,`Delete icon: ${a.name}`)}catch(e){toast('Removed from the list, but some files could not be deleted: '+e.message,'bad')}
    toast('Deleted.','ok');admin(nav);
   }catch(e){toast(e.message,'bad');b.disabled=false}
  });
  $$('[data-e]').forEach(b=>b.onclick=()=>editApp(apps.find(x=>x.id===b.dataset.e)));
  $('#sc').onclick=async()=>{
   const m=$('#cm'),u=$('#nu').value.trim(),p=$('#np').value;m.className='msg bad';
   if(!u)return m.textContent='Enter a username.';
   if(p&&p.length<8)return m.textContent='Password must be at least 8 characters.';
   if(u===c.u&&!p)return m.className='msg',m.textContent='Nothing to change.';
   try{
    const next={...c,u};if(p)Object.assign(next,await seal(p,token));
    if(!ls.set('ah_cfg',JSON.stringify(next)))throw new Error('Browser storage is blocked.');
    c.u=u;if(p)Object.assign(c,next);$('#np').value='';m.className='msg ok';m.textContent='Saved.';
   }catch(e){m.textContent=e.message}
  };
  $('#dc').onclick=async()=>{
   if(await confirmBox('Disconnect this device?','The saved login and GitHub token will be removed from this browser. Published apps are not affected.','Disconnect',true)){ls.del('ah_cfg');token=null;setupView()}
  };
 }

 function editApp(a){
  if(!a)return;
  let state='keep',icon='',newFile=null;
  const m=modal(`<h3>Edit app</h3>
   <label for="en">App name</label><input type="text" id="en" maxlength="60" value="${esc(a.name)}">
   <label for="ed">Short description</label><textarea id="ed" rows="2" maxlength="160">${esc(a.desc||'')}</textarea>
   <label>Icon</label><div class="row"><span id="eip"></span><button class="btn alt sm" type="button" id="eib">Choose image</button><button class="btn alt sm" type="button" id="eir">Remove</button><input type="file" id="eii" accept="image/*" hidden></div>
   <label for="ef">Replace app file <span class="meta">(optional)</span></label><input type="file" id="ef" accept=".html,.htm,text/html" style="font-size:.9rem;max-width:100%">
   <div class="msg bad" id="em" role="alert"></div>
   <div class="row end" style="margin-top:16px"><button class="btn alt" type="button" id="ec">Cancel</button><button class="btn" type="button" id="es">Save</button></div>`,true);
  const pv=()=>{
   const shown=state==='new'?{icon,name:$('#en',m).value}:state==='remove'?{name:$('#en',m).value}:a;
   $('#eip',m).innerHTML=state==='new'?`<img class="ico" src="${icon}" alt="" width="44" height="44" style="width:44px;height:44px">`:ico({...shown,name:$('#en',m).value||a.name,updated:a.updated},44);
   $('#eir',m).hidden=state==='remove'||(state==='keep'&&!a.icon);
  };
  $('#en',m).oninput=pv;pv();
  $('#eib',m).onclick=()=>$('#eii',m).click();
  $('#eii',m).onchange=async()=>{const f=$('#eii',m).files[0];if(!f)return;try{icon=await toIcon(f);state='new';pv()}catch(e){$('#em',m).textContent=e.message}};
  $('#eir',m).onclick=()=>{state='remove';icon='';pv()};
  $('#ef',m).onchange=()=>{const f=$('#ef',m).files[0];$('#em',m).textContent='';newFile=null;if(!f)return;
   if(!/\.html?$/i.test(f.name)){$('#em',m).textContent='Only .html files are supported.';$('#ef',m).value='';return}
   if(f.size>20*1048576){$('#em',m).textContent='File is too large (20 MB max).';$('#ef',m).value='';return}
   newFile=f};
  $('#ec',m).onclick=()=>m.close();
  $('#es',m).onclick=async()=>{
   const name=$('#en',m).value.trim(),desc=$('#ed',m).value.trim(),em=$('#em',m),sb=$('#es',m);
   if(!name){em.textContent='Please enter an app name.';return}
   sb.disabled=true;sb.textContent='Saving…';em.textContent='';
   try{
    let size=a.size,iconPath=a.icon||null;
    if(newFile){
     const meta=await getMeta(a.file),bytes=new Uint8Array(await newFile.arrayBuffer());
     await putFile(a.file,bytesB64(bytes),`Update app: ${name}`,meta&&meta.sha);size=newFile.size;
    }
    if(state==='new'){
     const p=`apps/${a.id}.png`,meta=await getMeta(p);
     await putFile(p,icon.split(',')[1],`Update icon: ${name}`,meta&&meta.sha);iconPath=p;
    }else if(state==='remove'&&a.icon){
     await delFile(a.icon,`Remove icon: ${name}`);iconPath=null;
    }
    await saveIndex(l=>{const x=l.find(y=>y.id===a.id);if(x){x.name=name;x.desc=desc;x.size=size;x.icon=iconPath;x.updated=Date.now()}});
    m.close();toast('Saved. Changes appear on the public site in 1–2 minutes.','ok');admin(nav);
   }catch(e){em.textContent=e.message;sb.disabled=false;sb.textContent='Save'}
  };
 }
 render();
}

/* ---------- router ---------- */
let nav=0;
async function route(){
 const my=++nav;
 const v=$('#vw');if(v)v.remove();
 $$('.modal').forEach(x=>x.close?x.close():x.remove());
 const h=location.hash.replace(/^#/,'')||'/';
 window.scrollTo(0,0);
 $$('nav a').forEach(a=>a.removeAttribute('aria-current'));
 const cur=$(h==='/admin'?'nav a[data-nav="admin"]':h.startsWith('/app/')?'nav a[data-nav="none"]':'nav a[data-nav="home"]');
 if(cur)cur.setAttribute('aria-current','page');
 if(h.startsWith('/app/'))return viewer(decodeURIComponent(h.slice(5)),my);
 if(h==='/admin')return admin(my);
 return home(my);
}
addEventListener('hashchange',route);
route();
