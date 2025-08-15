/* ===== DOM refs ===== */
const $ = s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const elText = $('#text'), elCaret = $('#caret'), elWpm=$('#wpm'), elRaw=$('#raw'), elAcc=$('#acc'), elErr=$('#errors'), elCons=$('#cons');
const elMode=$('#mode'), elSource=$('#source'), elBlind=$('#blind'), elSounds=$('#sounds'), elTheme=$('#theme');
const elStart=$('#startBtn'), elReset=$('#resetBtn'), elPractice=$('#practiceBtn'), elDiff=$('#difficultyFlag');
const elBoard=$('#board tbody'), elExport=$('#exportBtn'), elClear=$('#clearBtn'), elCustom=$('#customText');
const STORAGE_KEY='typingLab.results.v1';

/* ===== Words & punctuation ===== */
const WORDS = `time people way day man thing woman life child world school state family student group country problem hand part place case week company system program question work night point home water room mother area money story fact month lot right study book eye job word business issue side kind head house service friend father power hour game line end member law car city community name president team minute idea kid body information back parent face others level office door health person art war history party result change morning reason research girl guy moment air teacher force education foot boy age policy everything process music market sense service`.split(' ');
const PUNCT = [',','.',';','!',':','?','—','-','"',"'",'(',')'];

/* ===== State ===== */
const state = {
  started:false, finished:false, startTime:0, pointer:0, typed:[], correct:0, wrong:0,
  errorsByKey:new Map(), errorsByBigram:new Map(), limitType:'time', limitValue:60
};

/* ===== Helpers ===== */
function randomWords(n,punct=false){
  const words=[];
  for(let i=0;i<n;i++){
    let w=WORDS[Math.floor(Math.random()*WORDS.length)];
    if(punct && Math.random()<0.18) w += PUNCT[Math.floor(Math.random()*PUNCT.length)];
    words.push(w);
  }
  return words.join(' ');
}
function prepareTextFromString(str){
  return str.trim().replace(/\s+/g,' ').split(' ')
    .map(w=>`<span class="word">${[...w].map(c=>`<span class="char future" data-ch="${c}">${c}</span>`).join('')}<span class="char future" data-ch=" "> </span></span>`).join('');
}
function wpm(chars,ms){ const m=ms/60000; return m>0?Math.round((chars/5)/m):0; }
function placeCaret(){ const chars=[...elText.querySelectorAll('.char')]; if(state.pointer>=chars.length) return; const rect=chars[state.pointer].getBoundingClientRect(); const parent=elText.getBoundingClientRect(); elCaret.style.top=(rect.top-parent.top)+'px'; elCaret.style.left=(rect.left-parent.left)+'px'; elCaret.style.height=rect.height+'px';}

/* ===== Keyboard ===== */
const KEY_LAYOUT=[['`','1','2','3','4','5','6','7','8','9','0','-','=','Back'],['Tab','q','w','e','r','t','y','u','i','o','p','[',']','\\'],['Caps','a','s','d','f','g','h','j','k','l',';',"'",'Enter'],['Shift','z','x','c','v','b','n','m',',','.','/','Shift'],['Space']];
function renderKeyboard(){
  const kbd=$('#kbd'); kbd.innerHTML=''; kbd.style.gridTemplateColumns='repeat(30,1fr)';
  KEY_LAYOUT.forEach(row=>{const total=row.reduce((s,k)=>s+keyWidth(k),0); row.forEach(k=>{const div=document.createElement('div'); div.className='key'; div.textContent=k==='Space'?'⎵ Space':k; div.style.gridColumn=`span ${Math.round(30*keyWidth(k)/total)}`; div.dataset.key=k.toLowerCase(); div.title='Errors: 0'; kbd.appendChild(div);});});
}
function keyWidth(k){if(k==='Back') return 5;if(k==='Tab'||k==='Caps') return 4;if(k==='Enter') return 5;if(k==='Shift') return 6;if(k==='Space') return 18;if(k.length===1) return 2; return 3;}
function updateHeatmap(){let max=0; state.errorsByKey.forEach(v=>{if(v>max)max=v;}); $$('.key').forEach(k=>{const label=k.dataset.key; const count=state.errorsByKey.get(label)||0; k.dataset.hit=count===0?'':String(Math.min(5,1+Math.floor(4*count/Math.max(1,max)))); k.classList.remove('worst');}); let worst=''; state.errorsByKey.forEach((v,k)=>{if(v===max) worst=k;}); if(worst){const el=$(`.key[data-key="${worst}"]`); if(el) el.classList.add('worst');}}

/* ===== Text generation ===== */
function freshText(){
  let base='';
  if(elSource.value==='random') base=randomWords(80,false);
  else if(elSource.value==='punct') base=randomWords(80,true);
  else if(elSource.value==='custom'){ const val=elCustom.value.trim(); if(!val){alert("Enter custom text!"); return;} base=val; }
  elText.innerHTML=prepareTextFromString(base);
  state.pointer=0; state.typed=[]; state.correct=0; state.wrong=0;
  state.started=false; state.finished=false;
  elWpm.textContent='0'; elRaw.textContent='0'; elAcc.textContent='100%'; elErr.textContent='0'; elCons.textContent='—';
  placeCaret();
}

/* ===== Typing logic ===== */
function handleKey(e){
  if(!state.started||state.finished) return; e.preventDefault();
  const chars=[...elText.querySelectorAll('.char.future,.char.correct,.char.wrong,.char.extra')];
  if(state.pointer>=chars.length){state.finished=true; return;}
  const ch=e.key==='Enter'?'\n':e.key;
  const current=chars[state.pointer];
  if(ch===current.dataset.ch){current.classList.remove('future'); current.classList.add('correct'); state.correct++;} 
  else{current.classList.remove('future'); current.classList.add('wrong'); state.wrong++;
    state.errorsByKey.set(ch.toLowerCase(),(state.errorsByKey.get(ch.toLowerCase())||0)+1);
    const prevChar=state.pointer>0?chars[state.pointer-1].dataset.ch:''; 
    const bigram=prevChar+ch;
    state.errorsByBigram.set(bigram,(state.errorsByBigram.get(bigram)||0)+1);
  }
  state.typed.push(ch); state.pointer++; placeCaret();
  if(elSounds.checked){ const ctx=new (window.AudioContext||window.webkitAudioContext)(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='square'; o.frequency.value=200; o.start(); o.stop(ctx.currentTime+0.05);}
  const elapsed=performance.now()-state.startTime;
  elWpm.textContent=wpm(state.correct,elapsed); elRaw.textContent=wpm(state.pointer,elapsed);
  elAcc.textContent=Math.round(100*state.correct/state.pointer)+'%'; elErr.textContent=state.wrong; updateHeatmap();
}

/* ===== Events ===== */
elTheme.addEventListener('change', ()=>{document.body.dataset.theme=elTheme.checked?'light':'dark';});
elSource.addEventListener('change', ()=>{elCustom.style.display=elSource.value==='custom'?'block':'none'; freshText();});
elStart.addEventListener('click', ()=>{state.started=true; state.startTime=performance.now(); elText.focus();});
elReset.addEventListener('click', freshText);
window.addEventListener('keydown', handleKey);
window.addEventListener('load', ()=>{renderKeyboard(); freshText();});
