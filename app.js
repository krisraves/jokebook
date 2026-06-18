let DATA, JOKES = [], filtered = [], pos = 0, setlist = [], deferredInstall;
const $ = id => document.getElementById(id);
const store = {
  get(k, fallback){ try { return JSON.parse(localStorage.getItem(k)) ?? fallback } catch { return fallback } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)) }
};
const esc = s => String(s ?? '').replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
const uniq = arr => [...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));

async function loadData() {
  const paths = [
    '/data/jokes.json',
    './data/jokes.json',
    'data/jokes.json'
  ];

  for (const path of paths) {
    try {
      const r = await fetch(path, { cache: 'no-store' });

      if (!r.ok) {
        throw new Error(`HTTP ${r.status}`);
      }

      const d = await r.json();

      DATA = d;
      JOKES = d.jokes || [];
      filtered = [...JOKES];

      $('stats').textContent =
        `${d.summary.grouped_jokes} consolidated joke cards • ` +
        `${d.summary.candidate_occurrences} note occurrences • ` +
        `${d.summary.detected_setlists} detected setlists`;

      populateFilters();
      loadSet();
      applyFilters();
      renderDrafts();
      renderSavedSets();

      console.log('Loaded jokes from', path);
      return;
    } catch (err) {
      console.warn('Failed:', path, err);
    }
  }

  $('stats').textContent =
    'Could not load joke database. Check /data/jokes.json';
}

loadData();
function addOptions(id, values){ const el=$(id); const first=el.firstElementChild; el.innerHTML=''; el.appendChild(first); values.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; el.appendChild(o); }); }
function populateFilters(){
  addOptions('maturity', uniq(JOKES.map(j=>j.maturity_rating)));
  addOptions('lengthFilter', uniq(JOKES.map(j=>j.length_tag)));
  addOptions('styleFilter', uniq(JOKES.flatMap(j=>j.style_tags||[])));
  addOptions('subjectFilter', uniq(JOKES.flatMap(j=>j.subject_tags||[])));
  addOptions('comedianFilter', uniq(JOKES.map(j=>j.sounds_like).concat(JOKES.flatMap(j=>(j.comedian_style_matches||[]).map(c=>c.comedian)))));
}
function current(){ return filtered[pos] || filtered[0] || JOKES[0]; }
function render(){
  const j = current(); if (!j) return;
  $('jokeId').textContent = `${j.id} • ${j.rating}/100 • ${pos+1}/${filtered.length}`;
  $('jokeText').textContent = j.best_version;
  $('analysis').innerHTML = `
    <div class="metric">
      <div class="box"><b>Times written</b><br>${j.times_written}</div>
      <div class="box"><b>Variations</b><br>${j.variation_count}</div>
      <div class="box"><b>Sounds like</b><br>${esc(j.sounds_like)}</div>
      <div class="box"><b>Maturity</b><br>${esc(j.maturity_rating)}</div>
    </div>
    <div>${[...(j.subject_tags||[]), ...(j.style_tags||[]), j.length_tag].filter(Boolean).map(x => `<span class="pill">${esc(x)}</span>`).join('')}</div>
    <div class="box"><b>Average comedy lover</b><p>${esc(j.average_comedy_lover_analysis)}</p></div>
    <div class="box"><b>30-year joke writer</b><p>${esc(j.veteran_joke_writer_analysis)}</p></div>
    <div class="box"><b>Three comedian-style lenses</b>${(j.comedian_style_matches||[]).map(c => `<p><b>${esc(c.comedian)}</b>: ${esc(c.reason)}</p>`).join('') || '<p>No clear match.</p>'}</div>
    <div class="box"><b>Demographic reads</b>${Object.entries(j.demographic_comments||{}).map(([k,v]) => `<p><b>${esc(k)}</b>: ${esc(v)}</p>`).join('')}</div>
    <div class="box"><b>Used in sets</b><p>${j.set_usage?.length ? j.set_usage.map(esc).join('<br>') : 'No setlist match detected.'}</p></div>`;
  $('vars').innerHTML = (j.all_variations||[]).map((v,i) => `<div class="variation"><b>${i===0?'Best version':'Variation '+i}</b><p>${esc(v)}</p></div>`).join('');
  $('noteBox').value = localStorage.getItem('note_' + j.id) || '';
}
function toast(msg){ const t = document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),1700); }

$('prev').onclick = () => { if(!filtered.length)return; pos = (pos - 1 + filtered.length) % filtered.length; render(); };
$('next').onclick = () => { if(!filtered.length)return; pos = (pos + 1) % filtered.length; render(); };
['search','sort','sortDir','maturity','lengthFilter','styleFilter','subjectFilter','comedianFilter'].forEach(id => $(id).addEventListener('input', applyFilters));
function textBlob(j){ return [j.best_version, ...(j.all_variations||[]), j.sounds_like, j.maturity_rating, j.length_tag, ...(j.subject_tags||[]), ...(j.style_tags||[]), ...(j.set_usage||[])].join(' ').toLowerCase(); }
function applyFilters(){
  const q = $('search').value.toLowerCase().trim();
  const m = $('maturity').value, len=$('lengthFilter').value, st=$('styleFilter').value, sub=$('subjectFilter').value, com=$('comedianFilter').value;
  filtered = JOKES.filter(j =>
    (!m || j.maturity_rating === m) &&
    (!len || j.length_tag === len) &&
    (!st || (j.style_tags||[]).includes(st)) &&
    (!sub || (j.subject_tags||[]).includes(sub)) &&
    (!com || j.sounds_like === com || (j.comedian_style_matches||[]).some(c=>c.comedian===com)) &&
    (!q || textBlob(j).includes(q))
  );
  const s = $('sort').value, dir = $('sortDir').value === 'asc' ? 1 : -1;
  filtered.sort((a,b) => {
    if(s === 'best_version') return dir * String(a.best_version).localeCompare(String(b.best_version));
    return dir * ((a[s] || 0) - (b[s] || 0));
  });
  pos = 0;
  $('filterCount').textContent = `${filtered.length} cards shown out of ${JOKES.length}`;
  render(); renderIndex();
}
function renderIndex(){
  $('jokeIndex').innerHTML = filtered.slice(0,900).map((j,i) => `<div class="idx" data-i="${i}"><b>${esc(j.id)}</b> ${esc(j.best_version)}<div class="small">${j.rating}/100 • ${j.times_written}x • ${j.variation_count} variations • ${esc(j.sounds_like)}</div></div>`).join('') || '<p class="small">No cards match those filters.</p>';
  document.querySelectorAll('.idx').forEach(el => el.onclick = () => { pos = Number(el.dataset.i); showTab('analysis'); render(); scrollTo({top:0,behavior:'smooth'}); });
}
$('speakBtn').onclick = () => { const u = new SpeechSynthesisUtterance(current().best_version); speechSynthesis.cancel(); speechSynthesis.speak(u); };
$('noteBox').oninput = () => localStorage.setItem('note_' + current().id, $('noteBox').value);

$('addSet').onclick = () => { const j = current(); if (!setlist.find(x => x.id === j.id)) setlist.push({id:j.id, text:j.best_version}); saveSetLocal(); renderSet(); toast('Added to setlist'); };
function loadSet(){ setlist = store.get('activeSetlist', []); renderSet(); }
function saveSetLocal(){ store.set('activeSetlist', setlist); }
function renderSet(){
  $('setItems').innerHTML = setlist.length ? setlist.map((j,i) => `<div class="setrow"><span>${i+1}</span><span>${esc(j.text)}</span><button data-move="${i}">↑</button><button data-remove="${i}">×</button></div>`).join('') : '<p class="small">Add jokes from the book to build a set.</p>';
  $('cards').innerHTML = setlist.map((j,i) => `<div class="card">${i+1}. ${esc(j.text)}</div>`).join('');
  document.querySelectorAll('[data-move]').forEach(b => b.onclick = () => move(Number(b.dataset.move), -1));
  document.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => removeSet(Number(b.dataset.remove)));
}
function move(i,d){ const n=i+d; if(n<0||n>=setlist.length)return; [setlist[i],setlist[n]]=[setlist[n],setlist[i]]; saveSetLocal(); renderSet(); }
function removeSet(i){ setlist.splice(i,1); saveSetLocal(); renderSet(); }
$('saveSet').onclick = () => { const name = $('setName').value.trim() || 'Untitled set'; const saved = store.get('savedSets', {}); saved[name] = setlist; store.set('savedSets', saved); renderSavedSets(); toast('Saved setlist'); };
function renderSavedSets(){ const saved = store.get('savedSets', {}); $('savedSets').innerHTML = Object.keys(saved).length ? Object.entries(saved).map(([name,items]) => `<div class="saved"><b>${esc(name)}</b><div class="small">${items.length} jokes</div><button data-loadset="${esc(name)}">Load</button></div>`).join('') : '<p class="small">No saved setlists yet.</p>'; document.querySelectorAll('[data-loadset]').forEach(b => b.onclick = () => { setlist = saved[b.dataset.loadset] || []; saveSetLocal(); renderSet(); toast('Loaded setlist'); }); }

$('saveNew').onclick = () => { const text = $('newJoke').value.trim(); if(!text) return; const drafts = store.get('draftJokes', []); drafts.unshift({text, tags:$('newTags').value.trim(), created:new Date().toISOString()}); store.set('draftJokes', drafts); $('newJoke').value=''; $('newTags').value=''; renderDrafts(); toast('Draft saved'); };
function renderDrafts(){ const drafts = store.get('draftJokes', []); $('drafts').innerHTML = drafts.map(d => `<div class="variation">${esc(d.text)}<div class="small">${esc(d.tags)} • ${new Date(d.created).toLocaleString()}</div></div>`).join(''); }

function showTab(name){ document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name)); document.querySelectorAll('.panel').forEach(p => p.classList.remove('active')); $(`${name}Panel`).classList.add('active'); }
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
let sx = 0; $('book').addEventListener('touchstart', e => sx = e.changedTouches[0].clientX, {passive:true}); $('book').addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - sx; if(Math.abs(dx)>55){ dx<0 ? $('next').click() : $('prev').click(); } }, {passive:true});
$('exportState').onclick = () => { const data = {activeSetlist:setlist, savedSets:store.get('savedSets',{}), draftJokes:store.get('draftJokes',{}), exported:new Date().toISOString()}; const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'}); const a = Object.assign(document.createElement('a'), {href:URL.createObjectURL(blob), download:'joke-grimoire-app-data.json'}); a.click(); URL.revokeObjectURL(a.href); };
$('clearState').onclick = () => { if(confirm('Clear saved setlists, draft jokes, and notes from this browser?')){ Object.keys(localStorage).filter(k=>k.startsWith('note_') || ['activeSetlist','savedSets','draftJokes'].includes(k)).forEach(k=>localStorage.removeItem(k)); setlist=[]; loadSet(); renderSavedSets(); renderDrafts(); render(); } };
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; $('installBtn').classList.remove('hidden'); });
$('installBtn').onclick = async () => { if(!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; $('installBtn').classList.add('hidden'); };
if('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
