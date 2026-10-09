const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('#yr').textContent=new Date().getFullYear();

/* ---------- storage (IndexedDB) ---------- */
const mem=[];let useMem=false;
function idb(){return new Promise((res,rej)=>{try{const r=indexedDB.open('apphost',1);r.onupgradeneeded=()=>r.result.createObjectStore('apps',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}})}
async function tx(mode,fn){if(useMem)return null;try{const d=await idb();return await new Promise((res,rej)=>{const t=d.transaction('apps',mode);const q=fn(t.objectStore('apps'));t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error)})}catch(e){useMem=true;return null}}
async function allApps(){const r=await tx('readonly',s=>s.getAll());const a=useMem?mem:(r||[]);return a.sort((x,y)=>y.created-x.created)}
async function putApp(a){await tx('readwrite',s=>s.put(a));if(useMem){const i=mem.findIndex(x=>x.id===a.id);i<0?mem.push(a):mem[i]=a}}
async function delApp(id){await tx('readwrite',s=>s.delete(id));if(useMem){const i=mem.findIndex(x=>x.id===id);if(i>=0)mem.splice(i,1)}}
async function getApp(id){return (await allApps()).find(a=>a.id===id)}

/* ---------- admin credentials ---------- */
const SALT='apphost::v1::';
async function hash(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(SALT+s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function creds(){try{const c=JSON.parse(localStorage.getItem('ah_cred')||'null');if(c)return c}catch(e){}return {u:'admin',h:await hash('admin123')}}
async function saveCreds(u,p){const c={u,h:await hash(p)};try{localStorage.setItem('ah_cred',JSON.stringify(c))}catch(e){}}
const authed=()=>{try{return sessionStorage.getItem('ah_auth')==='1'}catch(e){return window._a===1}};
const setAuth=v=>{try{v?sessionStorage.setItem('ah_auth','1'):sessionStorage.removeItem('ah_auth')}catch(e){}window._a=v?1:0};

/* ---------- views ---------- */
const root=$('#root');
const fmt=t=>new Date(t).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});

async function home(){
 const apps=(await allApps()).filter(a=>a.published);
 root.innerHTML=`<section class="hero"><h1>Run web applications online</h1><p>Browse the applications published on this platform and launch them instantly in your browser — on desktop or mobile, no installation required.</p></section>
 <h2>Published Applications</h2>`+(apps.length?`<div class="grid">${apps.map(a=>`<article class="card app"><h3>${esc(a.name)}</h3><p>${esc(a.desc||'No description provided.')}</p><div class="meta">Updated ${fmt(a.created)} · ${(a.size/1024).toFixed(1)} KB</div><a class="btn" href="#/app/${a.id}">Launch application</a></article>`).join('')}</div>`:`<div class="empty">No applications have been published yet.<br>Administrators can upload one from the <a href="#/admin">Admin panel</a>.</div>`);
}

async function viewer(id){
 const a=await getApp(id);
 if(!a||(!a.published&&!authed())){root.innerHTML=`<div class="empty">Application not found.<br><a href="#/">Back to applications</a></div>`;return}
 document.body.insertAdjacentHTML('beforeend',`<div class="viewer" id="vw"><div class="vbar"><a class="btn alt sm" href="#/">← Back</a><b>${esc(a.name)}</b>
 <div class="seg"><button id="bd" class="on">Desktop</button><button id="bm">Mobile</button></div>
 <button class="btn alt sm" id="fs">Fullscreen</button></div><div class="stage" id="st"><iframe id="fr" title="${esc(a.name)}" sandbox="allow-scripts allow-forms allow-modals allow-popups"></iframe></div></div>`);
 $('#fr').srcdoc=a.html;
 const st=$('#st');
 $('#bd').onclick=()=>{st.classList.remove('mob');$('#bd').classList.add('on');$('#bm').classList.remove('on')};
 $('#bm').onclick=()=>{st.classList.add('mob');$('#bm').classList.add('on');$('#bd').classList.remove('on')};
 $('#fs').onclick=()=>{const f=$('#fr');(f.requestFullscreen||f.webkitRequestFullscreen||(()=>{})).call(f)};
}

function loginView(){
 root.innerHTML=`<div class="card login"><h2>Administrator Sign In</h2><p class="meta">Restricted area. Please enter your credentials.</p>
 <label for="u">Username</label><input type="text" id="u" autocomplete="username">
 <label for="p">Password</label><input type="password" id="p" autocomplete="current-password">
 <div class="msg bad" id="m"></div><div style="margin-top:16px"><button class="btn" id="go" style="width:100%">Sign in</button></div></div>`;
 const go=async()=>{const c=await creds();if($('#u').value.trim()===c.u&&await hash($('#p').value)===c.h){setAuth(true);admin()}else{$('#m').textContent='Invalid username or password.'}};
 $('#go').onclick=go;$('#p').onkeydown=e=>{if(e.key==='Enter')go()};$('#u').focus();
}

async function admin(){
 if(!authed())return loginView();
 const apps=await allApps();
 root.innerHTML=`<div class="row" style="justify-content:space-between;margin-bottom:20px"><h2 style="margin:0">Admin Panel</h2><button class="btn alt sm" id="lo">Sign out</button></div>
 <div class="two">
  <section class="card"><h2>Upload application</h2>
   <div class="drop" id="dz">Drop an <b>.html</b> file here or click to choose<input type="file" id="fi" accept=".html,.htm,text/html" hidden></div>
   <div class="meta" id="fn" style="margin-top:8px">No file selected.</div>
   <label for="an">Application name</label><input type="text" id="an" maxlength="60">
   <label for="ad">Description</label><textarea id="ad" rows="3" maxlength="240"></textarea>
   <div style="margin-top:16px"><button class="btn" id="up">Upload &amp; publish</button></div><div class="msg" id="um"></div>
   <p class="meta">Use a single self-contained HTML file (CSS and JS inline or from a CDN).</p></section>
  <section class="card"><h2>Account</h2>
   <label for="nu">Username</label><input type="text" id="nu" autocomplete="username">
   <label for="np">New password (min. 8 characters)</label><input type="password" id="np" autocomplete="new-password">
   <div style="margin-top:16px"><button class="btn" id="sc">Update credentials</button></div><div class="msg" id="cm"></div></section>
 </div>
 <section class="card"><h2>Applications (${apps.length})</h2><div class="list">${apps.length?apps.map(a=>`<div class="item"><div><b>${esc(a.name)}</b> <span class="pill ${a.published?'ok':''}">${a.published?'Published':'Hidden'}</span><div class="meta">${esc(a.file)} · ${(a.size/1024).toFixed(1)} KB · ${fmt(a.created)}</div></div>
  <div class="row"><a class="btn alt sm" href="#/app/${a.id}">Open</a><button class="btn alt sm" data-t="${a.id}">${a.published?'Hide':'Publish'}</button><button class="btn danger sm" data-d="${a.id}">Delete</button></div></div>`).join(''):'<div class="empty">Nothing uploaded yet.</div>'}</div></section>`;
 $('#nu').value=(await creds()).u;
 $('#lo').onclick=()=>{setAuth(false);loginView()};
 let file=null,text='';
 const pick=async f=>{if(!f)return;if(!/\.html?$/i.test(f.name)){$('#um').className='msg bad';$('#um').textContent='Only .html files are supported.';return}
  file=f;text=await f.text();$('#fn').textContent=f.name+' · '+(f.size/1024).toFixed(1)+' KB';if(!$('#an').value)$('#an').value=f.name.replace(/\.html?$/i,'');$('#um').textContent=''};
 const dz=$('#dz'),fi=$('#fi');
 dz.onclick=()=>fi.click();fi.onchange=()=>pick(fi.files[0]);
 dz.ondragover=e=>{e.preventDefault();dz.classList.add('on')};dz.ondragleave=()=>dz.classList.remove('on');
 dz.ondrop=e=>{e.preventDefault();dz.classList.remove('on');pick(e.dataTransfer.files[0])};
 $('#up').onclick=async()=>{const m=$('#um');m.className='msg bad';
  if(!file)return m.textContent='Please choose an HTML file first.';
  const name=$('#an').value.trim();if(!name)return m.textContent='Please enter an application name.';
  if(file.size>8*1024*1024)return m.textContent='File is too large (8 MB max).';
  await putApp({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),name,desc:$('#ad').value.trim(),html:text,file:file.name,size:file.size,created:Date.now(),published:true});
  admin()};
 $('#sc').onclick=async()=>{const m=$('#cm'),u=$('#nu').value.trim(),p=$('#np').value;
  if(!u||p.length<8){m.className='msg bad';m.textContent='Enter a username and a password of at least 8 characters.';return}
  await saveCreds(u,p);$('#np').value='';m.className='msg ok';m.textContent='Credentials updated.'};
 root.querySelectorAll('[data-t]').forEach(b=>b.onclick=async()=>{const a=await getApp(b.dataset.t);a.published=!a.published;await putApp(a);admin()});
 root.querySelectorAll('[data-d]').forEach(b=>b.onclick=async()=>{if(confirm('Delete this application permanently?')){await delApp(b.dataset.d);admin()}});
}

/* ---------- router ---------- */
async function route(){
 const v=$('#vw');if(v)v.remove();
 const h=location.hash.replace(/^#/,'')||'/';
 window.scrollTo(0,0);
 if(h.startsWith('/app/'))return viewer(h.slice(5));
 if(h==='/admin')return admin();
 return home();
}
addEventListener('hashchange',route);route();
