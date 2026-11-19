export const directions = {left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]};
const orth = Object.values(directions);
const diagonal = [[1,1],[1,-1],[-1,1],[-1,-1]];
const king = [...orth,...diagonal];
const knight = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
const offsets = {K:king,Q:king,R:orth,B:diagonal,N:knight};
export const side = piece => piece === piece.toUpperCase() ? 'white' : 'black';
const enemy = color => color === 'white' ? 'black' : 'white';
const inside = (x,y) => x>=0 && x<5 && y>=0 && y<5;

function destinations(board, from) {
  const type = board[from].toUpperCase();
  const x = from % 5, y = Math.floor(from / 5);
  const result = [];
  for (const [dx,dy] of offsets[type]) {
    const range = type === 'K' || type === 'N' ? 1 : 4;
    for (let step=1; step<=range; step++) {
      const nx=x+dx*step, ny=y+dy*step;
      if (!inside(nx,ny)) break;
      const index=ny*5+nx;
      result.push(index);
      if (board[index]) break;
    }
  }
  return result;
}
export function check(board,color) {
  const target=board.indexOf(color==='white'?'K':'k');
  return board.some((piece,index)=>piece && side(piece)!==color && destinations(board,index).includes(target));
}
export function moves(board,color) {
  const result=[];
  board.forEach((piece,from)=>{
    if (!piece || side(piece)!==color) return;
    for (const to of destinations(board,from)) {
      if (board[to] && (side(board[to])===color || board[to].toUpperCase()==='K')) continue;
      const next=board.slice();
      next[to]=piece;
      next[from]=null;
      if (!check(next,color)) result.push({from,to,board:next});
    }
  });
  return result;
}
export function tiltPlan(board,direction) {
  if (!direction) return {board,motions:[]};
  const motions=[];
  const [dx,dy]=directions[direction];
  const next=board.slice();
  // Process the leading edge first, so a square vacated by a sliding piece can be entered.
  const order=Array.from({length:25},(_,i)=>i).sort((a,b)=>
    ((b%5)-(a%5))*dx + (Math.floor(b/5)-Math.floor(a/5))*dy);
  for (const index of order) {
    const piece=board[index];
    if (!piece) continue;
    const x=index%5+dx, y=Math.floor(index/5)+dy;
    if (!inside(x,y)) {
      if (piece.toUpperCase()==='K') return null;
      next[index]=null;
      motions.push({from:index,to:null,dx,dy,piece});
    }
    else if (!next[y*5+x]) {
      next[y*5+x]=piece;
      next[index]=null;
      motions.push({from:index,to:y*5+x,dx,dy,piece});
    }
  }
  return {board:next,motions};
}
export const tilt=(board,direction)=>tiltPlan(board,direction)?.board??null;
export const mate = (board,color) => check(board,color) && !moves(board,color).length;
export function turns(board, withTilt=true) {
  return moves(board,'white').flatMap(move=>
    (withTilt ? [null,...Object.keys(directions)] : [null]).flatMap(direction=>{
      const next=tilt(move.board,direction);
      return !next || check(next,'white') ? [] : [{...move,direction,board:next}];
    }));
}
export const finishers = (board,withTilt=true) => turns(board,withTilt).filter(turn=>mate(turn.board,'black'));
export function solutions(board,withTilt=true) {
  return turns(board,withTilt).filter(turn=>{
    const replies=moves(turn.board,'black');
    return replies.length && replies.every(reply=>finishers(reply.board,withTilt).length);
  });
}
