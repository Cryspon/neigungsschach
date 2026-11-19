import {pieceImages} from './pieces.mjs';
import {check,finishers,mate,moves,side,solutions,tilt,tiltPlan} from './rules.mjs';

import {puzzles} from './puzzles.mjs';
const names={K:'König',Q:'Dame',R:'Turm',B:'Läufer',N:'Springer'};
const directionNames={left:'links',right:'rechts',up:'oben',down:'unten'};
const coord=index=>'abcde'[index%5]+(5-Math.floor(index/5));
const el=id=>document.getElementById(id);
const squares=[];
const boardElement=el('board');
let drag=null, suppressClick=false;
const tasks=[];
const tiltButtons=[...document.querySelectorAll('[data-direction]')];
let puzzle, board, phase, selected, legal, whiteTurns, lastMove, dropped, replyTimer;
let history=[], previewDirection=null, generation=0;
let orientationActive=false, neutral=null, armed=false, sensorTimer;

for(let i=0;i<25;i++){
  const square=document.createElement('button');
  square.type='button';
  square.dataset.index=i;
  square.style.setProperty('--left', (i%5)*20+'%');
  square.style.setProperty('--top', Math.floor(i/5)*20+'%');
  square.addEventListener('click',event=>{
    if(!suppressClick || event.detail===0) select(i);
  });
  boardElement.append(square);
  squares.push(square);
}
puzzles.forEach(({name},index)=>{
  const button=document.createElement('button');
  button.textContent=name;
  button.addEventListener('click',()=>reset(index));
  tasks.push(button);
  document.querySelector('nav').append(button);
});

function render(message){
  clearPreview();
  el('undo').disabled=!history.length;
  el('confirm').disabled=true;
  squares.forEach((square,index)=>{
    const piece=board[index];
    square.className=(index%5+Math.floor(index/5))%2 ? 'dark' : '';
    square.classList.toggle('selected',selected===index);
    square.classList.toggle('movable',phase==='move' && legal.some(move=>move.from===index));
    square.classList.toggle('legal',phase==='move' && legal.some(move=>move.from===selected && move.to===index));
    square.classList.toggle('last',lastMove?.to===index);
    const label=coord(index);
    square.setAttribute('aria-label',label+(piece?', '+(side(piece)==='white'?'Weiß: ':'Schwarz: ')+names[piece.toUpperCase()]:', leer'));
    square.replaceChildren();
    if(piece){
      const icon=document.createElement('img');
      icon.className='piece';
      icon.src=pieceImages[side(piece)+'-'+piece.toUpperCase()];
      icon.alt='';
      icon.draggable=false;
      square.append(icon);
    }
    const coordinates=[
      [index%5===0,'rank',label[1]],
      [index>=20,'file',label[0]],
    ];
    for(const [visible,kind,value] of coordinates){
      if(!visible) continue;
      const marker=document.createElement('span');
      marker.className='coordinate '+kind;
      marker.textContent=value;
      marker.setAttribute('aria-hidden','true');
      square.append(marker);
    }
  });
  for(const button of tiltButtons) button.disabled=phase!=='tilt';
  el('skip').disabled=phase!=='tilt';
  el('hint').disabled=phase!=='move' && phase!=='tilt';
  el('stage').textContent={move:'Weiß · Zug '+(whiteTurns+1)+' von 2',tilt:'Kipprichtung wählen',animating:'Figuren rutschen',reply:'Schwarz antwortet',win:'Schachmatt!',lose:'Rätsel offen'}[phase];
  el('status').textContent=message;
  el('fallen').textContent=dropped.length?'Vom Brett gefallen: '+dropped.join(', '):'';
  el('next').hidden=phase!=='win'||puzzle===puzzles.length-1;
  tasks.forEach((button,index)=>button.setAttribute('aria-pressed',String(index===puzzle)));
}
function reset(index){
  generation++;
  history=[];
  cancelAnimations();
  clearTimeout(replyTimer);
  clearDrag();
  puzzle=index;
  board=[...puzzles[index].position].map(piece=>piece==='.'?null:piece);
  selected=lastMove=null;
  whiteTurns=0;
  phase='move';
  dropped=[];
  legal=moves(board,'white');
  el('hint-text').textContent='';
  render('Ziehe eine weiße Figur aufs Zielfeld oder tippe beide Felder nacheinander an.');
}
function select(index){
  if(phase!=='move') return;
  const move=legal.find(candidate=>candidate.from===selected && candidate.to===index);
  if(!move){
    selected=legal.some(candidate=>candidate.from===index)?index:null;
    render(selected===null?'Wähle eine weiße Figur.':'Die Punkte zeigen deine legalen Zielfelder.');
    return;
  }
  play(move);
}
function play(move){
  history.push({board:board.slice(),whiteTurns,lastMove,dropped:dropped.slice()});
  const before=board;
  board=move.board;
  lastMove={...move,before};
  selected=null;
  phase='tilt';
  armed=false;
  dropped=[];
  el('hint-text').textContent='';
  render('Kippe einmal oder spiele ohne Kippen weiter.');
}
function clearDrag(){
  if(!drag) return;
  const {id,from,ghost}=drag;
  drag=null;
  ghost?.remove();
  squares[from].classList.remove('drag-origin');
  if(boardElement.hasPointerCapture(id)) boardElement.releasePointerCapture(id);
}
boardElement.addEventListener('pointerdown',event=>{
  if(!event.isPrimary || event.button!==0) return;
  suppressClick=false;
  const square=event.target.closest('button[data-index]');
  if(!square || phase!=='move') return;
  const from=Number(square.dataset.index);
  if(!legal.some(move=>move.from===from)) return;
  drag={id:event.pointerId,from,x:event.clientX,y:event.clientY,ghost:null};
});
boardElement.addEventListener('pointermove',event=>{
  if(drag?.id!==event.pointerId) return;
  if(!drag.ghost){
    if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<6) return;
    const square=squares[drag.from];
    const ghost=square.querySelector('.piece').cloneNode();
    ghost.className='drag-piece';
    ghost.style.width=square.clientWidth*.86+'px';
    ghost.alt='';
    document.body.append(ghost);
    drag.ghost=ghost;
    boardElement.setPointerCapture(event.pointerId);
    suppressClick=true;
    selected=drag.from;
    render('Lass die Figur auf einem markierten Feld los.');
    square.classList.add('drag-origin');
  }
  drag.ghost.style.left=event.clientX+'px';
  drag.ghost.style.top=event.clientY+'px';
});
window.addEventListener('pointerup',event=>{
  if(drag?.id!==event.pointerId) return;
  const {from,ghost}=drag;
  clearDrag();
  if(!ghost || phase!=='move') return;
  const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('#board button[data-index]');
  const move=target && legal.find(candidate=>candidate.from===from && candidate.to===Number(target.dataset.index));
  if(move) play(move);
  else render('Die Figur bleibt stehen. Wähle ein markiertes Zielfeld.');
});
window.addEventListener('pointercancel',event=>{
  if(drag?.id===event.pointerId) clearDrag();
});
boardElement.addEventListener('lostpointercapture',event=>{
  if(drag?.id===event.pointerId && drag.ghost) clearDrag();
});


function clearPreview(){
  previewDirection=null;
  boardElement.querySelectorAll('.preview-piece').forEach(node=>node.remove());
  squares.forEach(square=>square.classList.remove('preview-origin'));
  tiltButtons.forEach(button=>button.setAttribute('aria-pressed','false'));
  el('preview-text').textContent='';
}
function showPreview(direction){
  if(phase!=='tilt')return;
  clearPreview();
  const plan=tiltPlan(board,direction);
  const valid=plan&&!check(plan.board,'white');
  el('confirm').disabled=!valid;
  previewDirection=direction;
  tiltButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.direction===direction)));
  el('preview-text').textContent=!plan?'Ungültig: Ein König würde herausfallen.':!valid?'Ungültig: Dein König wäre im Schach (auch benachbarte Könige sind verboten).':'Vorschau nach '+directionNames[direction]+'. Bestätige die Kippbewegung.';
  if(!valid)return;
  for(const motion of plan.motions){
    squares[motion.from].classList.add('preview-origin');
    const ghost=squares[motion.from].querySelector('.piece').cloneNode();
    ghost.className='preview-piece';
    ghost.style.left=((motion.to??motion.from)%5*20+1.4)+'%';
    ghost.style.top=(Math.floor((motion.to??motion.from)/5)*20+1.4)+'%';
    if(motion.to===null)ghost.classList.add('falling-preview');
    boardElement.append(ghost);
  }
}
function cancelAnimations(){
  boardElement.getAnimations({subtree:true}).forEach(animation=>animation.cancel());
}
async function animateTilt(plan){
  const distance=squares[0].getBoundingClientRect().width;
  const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:420;
  const animations=plan.motions.map(({from,to,dx,dy})=>squares[from].querySelector('.piece').animate([
    {transform:'translate(0,0)',opacity:1},
    {transform:`translate(${dx*distance}px,${dy*distance}px) scale(${to===null?.65:1})`,opacity:to===null?0:1}
  ],{duration,easing:'cubic-bezier(.3,.05,.3,1)',fill:'forwards'}));
  await Promise.allSettled(animations.map(animation=>animation.finished));
  animations.forEach(animation=>animation.cancel());
}

async function commit(direction){
  if(phase!=='tilt') return;
  const after=tilt(board,direction);
  if(!after){
    render('Dabei würde ein König vom Brett fallen. Wähle eine andere Richtung.');
    return;
  }
  if(check(after,'white')){
    render('Dabei gerät dein König ins Schach. Wähle eine andere Richtung.');
    return;
  }
  const token=generation;
  clearPreview();
  if(direction){
    phase='animating';
    render('Alle Figuren rutschen ein Feld.');
    await animateTilt(tiltPlan(board,direction));
    if(token!==generation)return;
  }
  const remaining=after.filter(Boolean);
  dropped=[];
  for(const piece of board.filter(Boolean)){
    const index=remaining.indexOf(piece);
    if(index>=0)remaining.splice(index,1);
    else dropped.push((side(piece)==='white'?'Weiß ':'Schwarz ')+names[piece.toUpperCase()]);
  }
  board=after;
  if(direction) lastMove=null;
  whiteTurns++;
  el('hint-text').textContent='';
  if(mate(board,'black')){
    phase='win';
    render('Gelöst in '+whiteTurns+' weißen Zügen.');
    return;
  }
  const replies=moves(board,'black');
  if(!replies.length||whiteTurns===2){
    phase='lose';
    render(replies.length?'Zwei Züge gespielt. Schwarz ist noch nicht matt.':'Patt. Schwarz kann nicht ziehen und steht nicht im Schach.');
    return;
  }
  phase='reply';
  render('Schwarz sucht die beste Verteidigung.');
  replyTimer=setTimeout(()=>{
    const reply=replies.map(move=>({move,options:finishers(move.board).length})).sort((a,b)=>a.options-b.options)[0].move;
    board=reply.board;
    lastMove=reply;
    legal=moves(board,'white');
    phase=legal.length?'move':'lose';
    render(legal.length?'Schwarz zieht '+coord(reply.from)+' → '+coord(reply.to)+'. Finde das Matt.':'Weiß hat keinen legalen Zug.');
  },380);
}
for(const button of tiltButtons)button.addEventListener('click',()=>showPreview(button.dataset.direction));
el('confirm').addEventListener('click',()=>commit(previewDirection));
el('undo').addEventListener('click',()=>{
  if(!history.length)return;
  generation++; clearTimeout(replyTimer); cancelAnimations(); clearDrag();
  const previous=history.pop();
  ({board,whiteTurns,lastMove,dropped}=previous);
  phase='move'; selected=null; legal=moves(board,'white'); armed=false;
  el('hint-text').textContent='';
  render('Dein letzter Zug samt Kippen und schwarzer Antwort wurde zurückgenommen.');
});
el('skip').addEventListener('click',()=>commit(null));
el('retry').addEventListener('click',()=>reset(puzzle));
el('next').addEventListener('click',()=>reset(puzzle+1));
el('hint').addEventListener('click',()=>{
  const options=whiteTurns===0?solutions:finishers;
  const previous=phase==='tilt'?lastMove:null;
  const initial=previous?previous.before:board;
  const line=options(initial).find(turn=>!previous||(turn.from===previous.from&&turn.to===previous.to));
  el('hint-text').textContent=line
    ? (previous?'':coord(line.from)+' → '+coord(line.to)+'. ')+(line.direction?'Danach nach '+directionNames[line.direction]+' kippen.':'Danach ohne Kippen bestätigen.')
    : 'Von hier aus gibt es kein erzwungenes Matt im Zuglimit.';
});

function orientation({beta,gamma}){
  if(!Number.isFinite(beta)||!Number.isFinite(gamma))return;
  if(!neutral){
    neutral={beta,gamma};
    clearTimeout(sensorTimer);
    el('sensor-status').textContent='Kalibriert. Halte das Handy vor jedem Kippen kurz in der Ausgangslage.';
  }
  const rotation=(screen.orientation?.angle??window.orientation??0)*Math.PI/180;
  const dx=gamma-neutral.gamma,dy=beta-neutral.beta;
  const x=dx*Math.cos(rotation)+dy*Math.sin(rotation);
  const y=dy*Math.cos(rotation)-dx*Math.sin(rotation);
  const strength=Math.max(Math.abs(x),Math.abs(y));
  if(strength<9)armed=true;
  if(phase!=='tilt'||!armed||strength<22)return;
  armed=false;
  commit(Math.abs(x)>Math.abs(y)?(x>0?'right':'left'):(y>0?'down':'up'));
}
function stopSensor(message){
  window.removeEventListener('deviceorientation',orientation);
  clearTimeout(sensorTimer);
  neutral=null;
  orientationActive=false;
  el('sensor').setAttribute('aria-pressed','false');
  el('sensor').textContent='Handy-Neigung aktivieren';
  el('sensor-status').textContent=message;
}
el('sensor').addEventListener('click',async()=>{
  if(orientationActive){stopSensor('Handy-Neigung aus.');return;}
  const sensor=window.DeviceOrientationEvent;
  if(!sensor||!window.isSecureContext){stopSensor('Hier sind keine Neigungsdaten verfügbar. Nutze die Pfeile.');return;}
  el('sensor').disabled=true;
  try{
    if(typeof sensor.requestPermission==='function'&&await sensor.requestPermission()!=='granted'){
      stopSensor('Bewegungszugriff abgelehnt. Nutze die Pfeile.');
      return;
    }
    neutral=null;
    armed=false;
    orientationActive=true;
    el('sensor').textContent='Handy-Neigung ausschalten';
    el('sensor').setAttribute('aria-pressed','true');
    el('sensor-status').textContent='Halte das Handy ruhig für die Kalibrierung.';
    window.addEventListener('deviceorientation',orientation);
    sensorTimer=setTimeout(()=>stopSensor('Keine Neigungsdaten empfangen. Nutze die Pfeile.'),2500);
  }catch{stopSensor('Neigungszugriff fehlgeschlagen. Nutze die Pfeile.');}
  finally{el('sensor').disabled=false;}
});
reset(0);
