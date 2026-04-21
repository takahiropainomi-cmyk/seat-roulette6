import { useState, useRef, useMemo } from "react";

const COLORS = [
  '#e53935','#d81b60','#8e24aa','#5e35b1','#1e88e5',
  '#00897b','#43a047','#f4511e','#fb8c00','#b8860b',
  '#6d4c41','#546e7a','#00acc1','#7cb342','#c0ca33',
  '#039be5','#3949ab','#ec407a','#26a69a','#ff8f00',
  '#ef5350','#ab47bc','#42a5f5','#26c6da','#66bb6a',
  '#ff7043','#8d6e63','#78909c','#ffa726','#558b2f',
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SW = 40, SH = 28, TW = 150, TH = 48;

function calcViewBox(seats, tables) {
  const allX = [], allY = [];
  seats.forEach(s => { allX.push(s.x, s.x+SW); allY.push(s.y, s.y+SH); });
  tables.forEach(t => {
    if(t.type==='round') { const r=t.r||40; allX.push(t.x-r,t.x+r); allY.push(t.y-r,t.y+r); }
    else { allX.push(t.x, t.x+(t.w||TW)); allY.push(t.y, t.y+(t.h||TH)); }
  });
  if(allX.length===0) return { minX:0, minY:0, W:400, H:260 };
  const PAD = 28;
  const minX = Math.min(...allX)-PAD, minY = Math.min(...allY)-PAD;
  const W = Math.max(...allX)-minX+PAD*2;
  const H = Math.max(...allY)-minY+PAD*2;
  return { minX, minY, W: Math.max(W,200), H: Math.max(H,120) };
}

function calcSvgSize(seats) {
  if (!seats || seats.length === 0) return { W: 600, H: 300 };
  const maxX = Math.max(...seats.map(s => s.x + SW)) + 60;
  const maxY = Math.max(...seats.map(s => s.y + SH)) + 60;
  return { W: Math.max(600, maxX), H: Math.max(300, maxY) };
}

// ── レイアウト生成（割り切れない場合も自動で席を分配）──
function generateLayout(tableType, tableCount, totalPeople) {
  const tables = [], seats = [];
  let sid = 1;

  if (tableType === 'u') {
    // コの字は1つのU字として全員を配置
    const top = Math.ceil(totalPeople / 3);
    const left = Math.floor((totalPeople - top) / 2);
    const right = totalPeople - top - left;
    const tableW = Math.max(200, top * (SW + 8));
    const tableH = Math.max(160, Math.max(left, right) * (SH + 10));
    const ox = 60, oy = 60;
    tables.push({ id:0, type:'u-h', x:ox, y:oy, w:tableW, h:16 });
    tables.push({ id:1, type:'u-v', x:ox-16, y:oy+16, w:16, h:tableH });
    tables.push({ id:2, type:'u-v', x:ox+tableW, y:oy+16, w:16, h:tableH });
    const sp_t = tableW / Math.max(top,1);
    for(let i=0;i<top;i++) seats.push({id:sid++,x:ox+sp_t*i+sp_t/2-SW/2,y:oy-SH-10});
    const sp_l = tableH / Math.max(left,1);
    for(let i=0;i<left;i++) seats.push({id:sid++,x:ox-16-SW-10,y:oy+16+sp_l*i+sp_l/2-SH/2});
    const sp_r = tableH / Math.max(right,1);
    for(let i=0;i<right;i++) seats.push({id:sid++,x:ox+tableW+16+10,y:oy+16+sp_r*i+sp_r/2-SH/2});
    return { tables, seats };
  }

  // 各テーブルへの席数を分配（余りは前のテーブルに+1ずつ）
  const base = Math.floor(totalPeople / tableCount);
  const remainder = totalPeople % tableCount;
  const seatCounts = Array.from({length: tableCount}, (_, i) => base + (i < remainder ? 1 : 0));

  if (tableType === 'long') {
    const COLS = tableCount <= 2 ? tableCount : Math.min(tableCount, 3);
    for (let t = 0; t < tableCount; t++) {
      const n = seatCounts[t];
      const side1 = Math.ceil(n / 2), side2 = Math.floor(n / 2);
      const tableW = Math.max(TW, side1 * (SW + 8));
      const col = t % COLS, row = Math.floor(t / COLS);
      const GAP_X = tableW + 80, GAP_Y = SH*2 + TH + 70;
      const tx = 30 + col * GAP_X, ty = 50 + row * GAP_Y;
      tables.push({ id:t, type:'long', x:tx, y:ty+SH+10, w:tableW, h:TH });
      const sp1 = tableW / Math.max(side1,1);
      for(let i=0;i<side1;i++) seats.push({id:sid++, x:tx+sp1*i+sp1/2-SW/2, y:ty});
      const sp2 = tableW / Math.max(side2,1);
      for(let i=0;i<side2;i++) seats.push({id:sid++, x:tx+sp2*i+sp2/2-SW/2, y:ty+SH+10+TH+10});
    }
  }

  else if (tableType === 'round') {
    const maxN = Math.max(...seatCounts);
    const R = Math.max(38, maxN * 13);
    const SEAT_R = R + SW + 8;
    const COLS = tableCount <= 3 ? tableCount : Math.ceil(Math.sqrt(tableCount * 1.3));
    const GAP = SEAT_R * 2 + 60;
    for (let t = 0; t < tableCount; t++) {
      const n = seatCounts[t];
      const col = t % COLS, row = Math.floor(t / COLS);
      const cx = SEAT_R + 20 + col * GAP, cy = SEAT_R + 20 + row * GAP;
      tables.push({ id:t, type:'round', x:cx, y:cy, r:R });
      for(let i=0;i<n;i++) {
        const angle = (i/n)*Math.PI*2 - Math.PI/2;
        seats.push({id:sid++, x:cx+Math.cos(angle)*SEAT_R-SW/2, y:cy+Math.sin(angle)*SEAT_R-SH/2});
      }
    }
  }

  else if (tableType === 'island') {
    const maxN = Math.max(...seatCounts);
    const perSide = Math.ceil(maxN / 4);
    const tableW = Math.max(TW, perSide*(SW+8));
    const tableH = Math.max(TH, Math.ceil(maxN/4)*(SH+8));
    const COLS = tableCount <= 3 ? tableCount : Math.ceil(Math.sqrt(tableCount*1.3));
    const GAP_X = tableW+SW*2+70, GAP_Y = tableH+SH*2+70;
    for (let t = 0; t < tableCount; t++) {
      const n = seatCounts[t];
      const col = t % COLS, row = Math.floor(t / COLS);
      const tx = 30+col*GAP_X, ty = 40+row*GAP_Y;
      tables.push({id:t, type:'island', x:tx, y:ty+SH+8, w:tableW, h:tableH});
      // 均等に4辺へ分配
      const sides = [0,0,0,0];
      for(let i=0;i<n;i++) sides[i%4]++;
      let localSid = 0;
      // 上
      const sp_t=tableW/Math.max(sides[0],1);
      for(let i=0;i<sides[0];i++){seats.push({id:sid++,x:tx+sp_t*i+sp_t/2-SW/2,y:ty});localSid++;}
      // 下
      const sp_b=tableW/Math.max(sides[1],1);
      for(let i=0;i<sides[1];i++){seats.push({id:sid++,x:tx+sp_b*i+sp_b/2-SW/2,y:ty+SH+8+tableH+8});localSid++;}
      // 左
      const sp_l=tableH/Math.max(sides[2],1);
      for(let i=0;i<sides[2];i++){seats.push({id:sid++,x:tx-SW-10,y:ty+SH+8+sp_l*i+sp_l/2-SH/2});localSid++;}
      // 右
      const sp_r=tableH/Math.max(sides[3],1);
      for(let i=0;i<sides[3];i++){seats.push({id:sid++,x:tx+tableW+10,y:ty+SH+8+sp_r*i+sp_r/2-SH/2});localSid++;}
    }
  }

  return { tables, seats };
}

// ── SVGコンポーネント ──
function SeatSVG({ seat, assignment, highlight, selected, onPointerDown }) {
  const a = assignment;
  const hi = highlight === seat.id;
  const col = a ? COLORS[(a.person-1)%COLORS.length] : '#fff';
  return (
    <g onPointerDown={e=>{e.stopPropagation();onPointerDown&&onPointerDown(e,seat.id)}}
       style={{cursor:onPointerDown?'grab':'default',touchAction:'none'}}>
      {(hi||selected)&&<rect x={seat.x-5} y={seat.y-5} width={SW+10} height={SH+10} rx={7}
        fill={selected?"#5c6bc022":"none"} stroke={hi?'#f44336':'#5c6bc0'} strokeWidth={selected?3:2.5}>
        {hi&&<animate attributeName="opacity" values="1;0.2;1" dur="0.6s" repeatCount="indefinite"/>}
      </rect>}
      <rect x={seat.x} y={seat.y} width={SW} height={SH} rx={5}
        fill={col} stroke={a?col:selected?'#5c6bc0':'#c5cae9'} strokeWidth={selected?2.5:1.5}
        style={{transition:'fill 0.3s'}}/>
      <text x={seat.x+SW/2} y={seat.y+SH/2+4.5} textAnchor="middle"
        fill={a?'#fff':'#9fa8da'} fontSize={10} fontWeight={700} fontFamily="monospace">
        {a?`P${a.person}`:seat.id}
      </text>
    </g>
  );
}

function TableBodySVG({ table, selected, onPointerDown }) {
  const props = { onPointerDown, style:{cursor:onPointerDown?'grab':'default',touchAction:'none'} };
  const fill=selected?'#dde3fa':'#eef0fb', stroke=selected?'#5c6bc0':'#9fa8da', sw=selected?3:1.5;
  const w=table.w||TW, h=table.h||TH;
  if(table.type==='long') return <g {...props}><rect x={table.x} y={table.y} width={w} height={h} rx={8} fill={fill} stroke={stroke} strokeWidth={sw}/><text x={table.x+w/2} y={table.y+h/2+5} textAnchor="middle" fill="#7986cb" fontSize={13} fontFamily="monospace" fontWeight={700}>LONG</text></g>;
  if(table.type==='round') return <g {...props}><circle cx={table.x} cy={table.y} r={table.r||40} fill={fill} stroke={stroke} strokeWidth={sw}/><text x={table.x} y={table.y+5} textAnchor="middle" fill="#7986cb" fontSize={13} fontFamily="monospace" fontWeight={700}>RND</text></g>;
  if(table.type==='island') return <g {...props}><rect x={table.x} y={table.y} width={w} height={h} rx={8} fill={fill} stroke={stroke} strokeWidth={sw}/><text x={table.x+w/2} y={table.y+h/2+5} textAnchor="middle" fill="#7986cb" fontSize={12} fontFamily="monospace" fontWeight={700}>ISL</text></g>;
  if(table.type==='u-h') return <rect x={table.x} y={table.y} width={table.w} height={table.h} rx={5} fill="#eef0fb" stroke="#9fa8da" strokeWidth={1.5}/>;
  if(table.type==='u-v') return <rect x={table.x} y={table.y} width={table.w} height={table.h} rx={5} fill="#eef0fb" stroke="#9fa8da" strokeWidth={1.5}/>;
  return null;
}

function RouletteMap({ tables, seats, assignments, highlight }) {
  const { minX, minY, W, H } = useMemo(() => calcViewBox(seats, tables), [seats, tables]);
  if(!seats||seats.length===0) return null;
  return (
    <div style={{background:'#f8f9ff',borderRadius:10,overflow:'hidden'}}>
      <svg viewBox={`${minX} ${minY} ${W} ${H}`} style={{width:'100%',display:'block'}}>
        <defs><pattern id="rgrid" width={20} height={20} patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e8eaf6" strokeWidth={0.5}/>
        </pattern></defs>
        <rect x={minX} y={minY} width={W} height={H} fill="url(#rgrid)"/>
        {tables.map(t=><TableBodySVG key={t.id} table={t} selected={false}/>)}
        {seats.map(s=><SeatSVG key={s.id} seat={s} assignment={assignments.find(a=>a.seat===s.id)||null} highlight={highlight} selected={false}/>)}
      </svg>
    </div>
  );
}

// ── カスタム配置エディタ（テーブル数・人数設定付き）──
function LayoutEditor({ tables, seats, setTables, setSeats, people }) {
  const [selSeats, setSelSeats] = useState(new Set());
  const [selTables, setSelTables] = useState(new Set());
  const [multiMode, setMultiMode] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  // カスタム用テーブル設定
  const [customType, setCustomType] = useState('long');
  const [customTableCount, setCustomTableCount] = useState(1);
  const svgRef = useRef();
  const totalSeats = seats.length;
  const { W: SVG_W, H: SVG_H } = useMemo(() => calcSvgSize(seats), [seats]);

  function svgCoords(e) {
    const rect = svgRef.current.getBoundingClientRect();
    return { x:(e.clientX-rect.left)*(SVG_W/rect.width), y:(e.clientY-rect.top)*(SVG_H/rect.height) };
  }

  // プリセット読み込み（people人を customTableCount テーブルに分配）
  function loadPreset(type, tCount) {
    const tc = tCount || customTableCount;
    if(totalSeats>0 && !window.confirm('現在の配置をリセットしますか？')) return;
    const { tables: pt, seats: ps } = generateLayout(type, tc, people);
    setTables(pt); setSeats(ps);
    setSelSeats(new Set()); setSelTables(new Set());
    setCustomType(type);
    setCustomTableCount(tc);
  }

  function deleteSelected(){
    const ns=seats.filter(s=>!selSeats.has(s.id));
    const nt=tables.filter(t=>!selTables.has(t.id));
    let s=1; setSeats(ns.map(x=>({...x,id:s++}))); setTables(nt);
    setSelSeats(new Set()); setSelTables(new Set());
  }
  function selectAll(){setSelSeats(new Set(seats.map(s=>s.id)));setSelTables(new Set(tables.map(t=>t.id)));}
  function clearSel(){setSelSeats(new Set());setSelTables(new Set());}
  function moveSelected(dx,dy){
    if(selSeats.size>0) setSeats(p=>p.map(s=>selSeats.has(s.id)?{...s,x:Math.max(0,s.x+dx),y:Math.max(0,s.y+dy)}:s));
    if(selTables.size>0) setTables(p=>p.map(t=>selTables.has(t.id)?{...t,x:Math.max(0,t.x+dx),y:Math.max(0,t.y+dy)}:t));
  }

  function onDown(e){
    const{x,y}=svgCoords(e); const multi=multiMode||e.shiftKey;
    for(let i=seats.length-1;i>=0;i--){const s=seats[i];if(x>=s.x-6&&x<=s.x+SW+6&&y>=s.y-6&&y<=s.y+SH+6){if(multi){const n=new Set(selSeats);n.has(s.id)?n.delete(s.id):n.add(s.id);setSelSeats(n);}else if(!selSeats.has(s.id)){setSelSeats(new Set([s.id]));setSelTables(new Set());}setDragging({startX:x,startY:y});setDragStart({seats:seats.map(s=>({...s})),tables:tables.map(t=>({...t}))});e.currentTarget.setPointerCapture(e.pointerId);return;}}
    for(let i=tables.length-1;i>=0;i--){const t=tables[i];const hit=t.type==='round'?Math.hypot(x-t.x,y-t.y)<=(t.r||40)+14:x>=t.x-8&&x<=t.x+(t.w||TW)+8&&y>=t.y-8&&y<=t.y+(t.h||TH)+8;if(hit){if(multi){const n=new Set(selTables);n.has(t.id)?n.delete(t.id):n.add(t.id);setSelTables(n);}else if(!selTables.has(t.id)){setSelTables(new Set([t.id]));setSelSeats(new Set());}setDragging({startX:x,startY:y});setDragStart({seats:seats.map(s=>({...s})),tables:tables.map(t=>({...t}))});e.currentTarget.setPointerCapture(e.pointerId);return;}}
    if(!multi){setSelSeats(new Set());setSelTables(new Set());}
  }
  function onMove(e){
    if(!dragging||!dragStart)return; const{x,y}=svgCoords(e); const dx=x-dragging.startX,dy=y-dragging.startY;
    setSeats(p=>p.map(s=>{const o=dragStart.seats.find(o=>o.id===s.id);return o&&selSeats.has(s.id)?{...s,x:Math.max(0,o.x+dx),y:Math.max(0,o.y+dy)}:s;}));
    setTables(p=>p.map(t=>{const o=dragStart.tables.find(o=>o.id===t.id);return o&&selTables.has(t.id)?{...t,x:Math.max(0,o.x+dx),y:Math.max(0,o.y+dy)}:t;}));
  }
  function onUp(){setDragging(null);setDragStart(null);}

  const hasSel=selSeats.size>0||selTables.size>0;
  const STEP=16;
  const aBtn={width:32,height:32,borderRadius:7,background:'#5c6bc0',color:'#fff',fontSize:13,fontWeight:700,border:'none',cursor:'pointer',userSelect:'none'};
  const sBtn={padding:'5px 10px',borderRadius:8,fontSize:12,fontWeight:700,border:'1px solid #c5cae9',cursor:'pointer'};

  return (
    <div>
      {/* テーブル設定 */}
      <div style={{marginBottom:10,padding:'12px',background:'#f0f4ff',borderRadius:12,border:'1.5px solid #e8eaf6'}}>
        <div style={{fontSize:12,color:'#7986cb',fontWeight:700,marginBottom:10}}>📐 テーブル設定から自動配置</div>

        {/* 形状選択 */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:10}}>
          {[{id:'long',icon:'⬛',name:'長テーブル'},{id:'round',icon:'⭕',name:'丸テーブル'},{id:'u',icon:'🔲',name:'コの字'},{id:'island',icon:'🟦',name:'島テーブル'}].map(p=>(
            <button key={p.id} onClick={()=>setCustomType(p.id)}
              style={{display:'flex',alignItems:'center',gap:6,padding:'8px 10px',borderRadius:10,fontFamily:'inherit',
                background:customType===p.id?'#dde3fa':'#fff',border:`2px solid ${customType===p.id?'#5c6bc0':'#e8eaf6'}`}}>
              <span style={{fontSize:16}}>{p.icon}</span>
              <span style={{fontSize:11,fontWeight:700,color:customType===p.id?'#5c6bc0':'#455a64'}}>{p.name}</span>
            </button>
          ))}
        </div>

        {/* テーブル数（コの字以外） */}
        {customType !== 'u' && (
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
            <span style={{fontSize:12,color:'#90a4ae',minWidth:70}}>テーブル数</span>
            <button onClick={()=>setCustomTableCount(c=>Math.max(1,c-1))} style={{width:32,height:32,borderRadius:8,background:'#e8eaf6',color:'#5c6bc0',fontSize:18,fontWeight:700,border:'none',cursor:'pointer'}}>−</button>
            <span style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:24,color:'#3949ab',minWidth:28,textAlign:'center'}}>{customTableCount}</span>
            <button onClick={()=>setCustomTableCount(c=>Math.min(10,c+1))} style={{width:32,height:32,borderRadius:8,background:'#e8eaf6',color:'#5c6bc0',fontSize:18,fontWeight:700,border:'none',cursor:'pointer'}}>＋</button>
            <span style={{fontSize:11,color:'#b0bec5'}}>（最大10）</span>
          </div>
        )}

        {/* 配置プレビュー情報 */}
        <div style={{fontSize:12,color:'#90a4ae',marginBottom:8}}>
          {customType==='u'
            ? `コの字：${people}人を3辺に自動分配`
            : (() => {
                const base=Math.floor(people/customTableCount);
                const rem=people%customTableCount;
                if(rem===0) return `${customTableCount}テーブル × ${base}席 ＝ ${people}席`;
                return `${customTableCount}テーブル：${rem}テーブルは${base+1}席、${customTableCount-rem}テーブルは${base}席 ＝ ${people}席`;
              })()
          }
        </div>

        <button onClick={()=>loadPreset(customType, customTableCount)}
          style={{width:'100%',padding:'10px 0',borderRadius:10,fontWeight:700,fontSize:14,background:'#5c6bc0',color:'#fff',border:'none',cursor:'pointer'}}>
          🔄 この設定で自動配置
        </button>
      </div>

      {/* 席数表示 */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <span style={{fontSize:11,color:'#90a4ae'}}>配置済み席数</span>
        <span style={{fontSize:13,fontWeight:700,color:totalSeats===people?'#43a047':'#f57c00'}}>{totalSeats}/{people}席</span>
      </div>

      {/* 複数選択モード */}
      <div style={{marginBottom:8,display:'flex',alignItems:'center',gap:8}}>
        <button onClick={()=>{setMultiMode(m=>!m);if(multiMode){setSelSeats(new Set());setSelTables(new Set());}}}
          style={{padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:700,background:multiMode?'#3949ab':'#f0f4ff',color:multiMode?'#fff':'#7986cb',border:`2px solid ${multiMode?'#3949ab':'#c5cae9'}`}}>
          {multiMode?'✅ 複数選択ON':'☑️ 複数選択'}
        </button>
        <span style={{fontSize:11,color:multiMode?'#5c6bc0':'#b0bec5'}}>{multiMode?'タップで追加選択':'タップで1つ選択'}</span>
      </div>

      {/* SVGキャンバス */}
      <div style={{borderRadius:12,border:'2px solid #c5cae9',background:'#f8f9ff',overflow:'scroll',maxHeight:420,WebkitOverflowScrolling:'touch'}}>
        <svg ref={svgRef} width={SVG_W} height={SVG_H}
          style={{display:'block',cursor:dragging?'grabbing':'default',touchAction:dragging?'none':'auto'}}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
          <defs><pattern id="egrid" width={20} height={20} patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e8eaf6" strokeWidth={0.5}/></pattern></defs>
          <rect width={SVG_W} height={SVG_H} fill="url(#egrid)"/>
          {tables.length===0&&seats.length===0&&<text x={SVG_W/2} y={SVG_H/2} textAnchor="middle" fill="#c5cae9" fontSize={14}>上の「自動配置」ボタンで配置を生成できます</text>}
          {tables.map(t=><TableBodySVG key={t.id} table={t} selected={selTables.has(t.id)}
            onPointerDown={e=>{e.stopPropagation();const{x,y}=svgCoords(e);const multi=multiMode||e.shiftKey;if(multi){const n=new Set(selTables);n.has(t.id)?n.delete(t.id):n.add(t.id);setSelTables(n);}else if(!selTables.has(t.id)){setSelTables(new Set([t.id]));setSelSeats(new Set());}setDragging({startX:x,startY:y});setDragStart({seats:seats.map(s=>({...s})),tables:tables.map(tb=>({...tb}))});e.currentTarget.closest('svg').setPointerCapture(e.pointerId);}}/>)}
          {seats.map(s=><SeatSVG key={s.id} seat={s} assignment={null} highlight={null} selected={selSeats.has(s.id)}
            onPointerDown={(e,id)=>{const{x,y}=svgCoords(e);const multi=multiMode||e.shiftKey;if(multi){const n=new Set(selSeats);n.has(id)?n.delete(id):n.add(id);setSelSeats(n);}else if(!selSeats.has(id)){setSelSeats(new Set([id]));setSelTables(new Set());}setDragging({startX:x,startY:y});setDragStart({seats:seats.map(s=>({...s})),tables:tables.map(t=>({...t}))});}}/>)}
        </svg>
      </div>

      {/* 操作パネル */}
      <div style={{marginTop:8,background:'#f0f4ff',borderRadius:12,padding:'8px 12px',border:'1.5px solid #e8eaf6',minHeight:50}}>
        {!hasSel&&<div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{color:'#b0bec5',fontSize:12}}>タップで選択・ドラッグで移動</span>
          {(seats.length>0||tables.length>0)&&<button onClick={selectAll} style={{...sBtn,background:'#e8eaf6',color:'#5c6bc0'}}>全選択</button>}
        </div>}
        {hasSel&&<div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <span style={{fontSize:12,fontWeight:700,color:'#5c6bc0'}}>{selSeats.size+selTables.size}個選択中</span>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,32px)',gridTemplateRows:'repeat(3,32px)',gap:2}}>
            <div/><button onPointerDown={()=>moveSelected(0,-STEP)} style={aBtn}>▲</button><div/>
            <button onPointerDown={()=>moveSelected(-STEP,0)} style={aBtn}>◀</button>
            <div style={{background:'#e8eaf6',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#9fa8da'}}>移動</div>
            <button onPointerDown={()=>moveSelected(STEP,0)} style={aBtn}>▶</button>
            <div/><button onPointerDown={()=>moveSelected(0,STEP)} style={aBtn}>▼</button><div/>
          </div>
          <button onClick={clearSel} style={{...sBtn,background:'#e8eaf6',color:'#5c6bc0'}}>解除</button>
          <button onClick={deleteSelected} style={{...sBtn,background:'#ffebee',color:'#e53935',border:'1px solid #ffcdd2'}}>🗑 削除</button>
        </div>}
      </div>
    </div>
  );
}

// ── メインアプリ ──
export default function App() {
  const [screen, setScreen] = useState('setup');
  const [people, setPeople] = useState(8);
  const [layoutMode, setLayoutMode] = useState('preset');
  const [tableType, setTableType] = useState('long');
  const [tableCount, setTableCount] = useState(1);
  const [customTables, setCustomTables] = useState([]);
  const [customSeats, setCustomSeats] = useState([]);
  const [currentPerson, setCurrentPerson] = useState(1);
  const [assignments, setAssignments] = useState([]);
  const [remainingSeats, setRemainingSeats] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [displaySeat, setDisplaySeat] = useState(null);
  const [finalSeat, setFinalSeat] = useState(null);
  const [rouletteTables, setRouletteTables] = useState([]);
  const [rouletteSeats, setRouletteSeats] = useState([]);
  const iRef = useRef(null);

  const presetData = useMemo(() => generateLayout(tableType, tableCount, people), [tableType, tableCount, people]);
  const previewTables = layoutMode==='preset' ? presetData.tables : customTables;
  const previewSeats  = layoutMode==='preset' ? presetData.seats  : customSeats;
  const totalCustomSeats = customSeats.length;
  const canStart = layoutMode==='preset' ? true : totalCustomSeats===people;

  function startRoulette() {
    const t=layoutMode==='preset'?presetData.tables:customTables;
    const s=layoutMode==='preset'?presetData.seats:customSeats;
    setRouletteTables(t); setRouletteSeats(s);
    setRemainingSeats(shuffle(s.map(x=>x.id)));
    setAssignments([]); setCurrentPerson(1);
    setDisplaySeat(null); setFinalSeat(null);
    setScreen('roulette');
  }

  function backToSetup(){clearInterval(iRef.current);setSpinning(false);setScreen('setup');}

  function spin(){
    if(spinning||finalSeat)return;
    setSpinning(true);
    let count=0; const total=10+Math.floor(Math.random()*6); let interval=80;
    function tick(){
      setDisplaySeat(remainingSeats[count%remainingSeats.length]);
      count++;
      if(count>=total){const p=remainingSeats[(count-1)%remainingSeats.length];setDisplaySeat(p);setFinalSeat(p);setSpinning(false);}
      else{const prog=count/total;interval=prog>0.6?80+(prog-0.6)*600:80;setTimeout(tick,interval);}
    }
    setTimeout(tick,interval);
  }

  function next(){
    const newA=[...assignments,{person:currentPerson,seat:finalSeat}];
    const newR=remainingSeats.filter(s=>s!==finalSeat);
    setAssignments(newA);setRemainingSeats(newR);
    if(currentPerson>=people){setScreen('result');}
    else{setCurrentPerson(p=>p+1);setDisplaySeat(null);setFinalSeat(null);}
  }

  const pColor=COLORS[(currentPerson-1)%COLORS.length];

  // 席数分配の説明
  const seatDesc = useMemo(() => {
    if(tableType==='u') return `コの字：${people}人を3辺に自動分配`;
    const base=Math.floor(people/tableCount), rem=people%tableCount;
    if(rem===0) return `${tableCount}テーブル × ${base}席`;
    return `${tableCount}テーブル：${rem}つは${base+1}席、${tableCount-rem}つは${base}席`;
  }, [tableType, tableCount, people]);

  const C={
    root:{minHeight:'100vh',background:'#f0f4ff',display:'flex',justifyContent:'center',padding:'16px',fontFamily:"'Noto Sans JP',sans-serif"},
    page:{width:'100%',maxWidth:540,display:'flex',flexDirection:'column',gap:12},
    card:{background:'#fff',borderRadius:16,padding:'14px 16px',boxShadow:'0 2px 12px #3949ab0d',border:'1px solid #e8eaf6'},
    lbl:{fontWeight:700,fontSize:13,color:'#7986cb',marginBottom:6},
  };

  const pmBtn = (onClick) => ({
    width:36,height:36,borderRadius:10,background:'#e8eaf6',color:'#5c6bc0',
    fontSize:20,fontWeight:700,border:'none',cursor:'pointer',display:'flex',
    alignItems:'center',justifyContent:'center',flexShrink:0,
  });

  return (
    <div style={C.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;900&family=Noto+Sans+JP:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}html,body{background:#f0f4ff;}
        button{cursor:pointer;border:none;font-family:inherit;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes popIn{0%{transform:scale(0.4);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
        .fade-up{animation:fadeUp 0.35s ease forwards;}
        input[type=range]{-webkit-appearance:none;height:4px;border-radius:2px;outline:none;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#5c6bc0;cursor:pointer;}
      `}</style>

      {/* ── SETUP ── */}
      {screen==='setup'&&(
        <div style={C.page}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:34}}>🍺</span>
            <div>
              <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:22,color:'#3949ab'}}>SEAT ROULETTE</div>
              <div style={{fontSize:11,color:'#90a4ae'}}>飲み会の座席をランダム決定</div>
            </div>
          </div>

          {/* 人数 */}
          <div style={C.card}>
            <div style={C.lbl}>👥 参加人数</div>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
              <button style={pmBtn()} onClick={()=>setPeople(p=>Math.max(2,p-1))}>−</button>
              <div style={{flex:1,textAlign:'center',fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:52,color:'#3949ab',lineHeight:1}}>
                {people}<span style={{fontSize:16,color:'#90a4ae',marginLeft:4}}>人</span>
              </div>
              <button style={pmBtn()} onClick={()=>setPeople(p=>Math.min(30,p+1))}>＋</button>
            </div>
            <input type="range" min={2} max={30} value={people}
              style={{width:'100%',background:`linear-gradient(90deg,#5c6bc0 ${(people-2)/28*100}%,#e8eaf6 ${(people-2)/28*100}%)`}}
              onChange={e=>{setPeople(Number(e.target.value));setCustomTables([]);setCustomSeats([]);}}/>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#b0bec5',marginTop:3}}><span>2人</span><span>30人</span></div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:10}}>
              {[4,6,8,10,12,16,20,24,30].map(n=>(
                <button key={n} onClick={()=>{setPeople(n);setCustomTables([]);setCustomSeats([]);}}
                  style={{padding:'5px 12px',borderRadius:20,fontSize:13,fontWeight:700,background:people===n?'#5c6bc0':'#f0f4ff',color:people===n?'#fff':'#7986cb',border:`1.5px solid ${people===n?'#5c6bc0':'#e8eaf6'}`}}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* テーブル配置 */}
          <div style={C.card}>
            <div style={C.lbl}>🪑 テーブル配置</div>
            <div style={{display:'flex',gap:8,marginBottom:14}}>
              {[['preset','🗂️ プリセット'],['custom','✏️ カスタム']].map(([m,label])=>(
                <button key={m} onClick={()=>setLayoutMode(m)}
                  style={{flex:1,padding:'8px 0',borderRadius:10,fontWeight:700,fontSize:13,background:layoutMode===m?'#5c6bc0':'#f0f4ff',color:layoutMode===m?'#fff':'#90a4ae',border:`1.5px solid ${layoutMode===m?'#5c6bc0':'#e8eaf6'}`}}>
                  {label}
                </button>
              ))}
            </div>

            {layoutMode==='preset'&&(
              <div>
                <div style={{fontSize:12,color:'#7986cb',fontWeight:700,marginBottom:8}}>テーブルの形</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
                  {[{id:'long',icon:'⬛',name:'長テーブル'},{id:'round',icon:'⭕',name:'丸テーブル'},{id:'u',icon:'🔲',name:'コの字'},{id:'island',icon:'🟦',name:'島テーブル'}].map(p=>(
                    <button key={p.id} onClick={()=>setTableType(p.id)}
                      style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',borderRadius:12,fontFamily:'inherit',background:tableType===p.id?'#dde3fa':'#f8f9ff',border:`2px solid ${tableType===p.id?'#5c6bc0':'#e8eaf6'}`}}>
                      <span style={{fontSize:20}}>{p.icon}</span>
                      <span style={{fontSize:12,fontWeight:700,color:tableType===p.id?'#5c6bc0':'#455a64'}}>{p.name}</span>
                    </button>
                  ))}
                </div>

                {tableType!=='u'&&(
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:12,color:'#7986cb',fontWeight:700,marginBottom:8}}>テーブル数</div>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <button onClick={()=>setTableCount(c=>Math.max(1,c-1))} style={{width:36,height:36,borderRadius:10,background:'#e8eaf6',color:'#5c6bc0',fontSize:20,fontWeight:700,border:'none',cursor:'pointer'}}>−</button>
                      <span style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:36,color:'#3949ab',minWidth:40,textAlign:'center'}}>{tableCount}</span>
                      <button onClick={()=>setTableCount(c=>Math.min(10,c+1))} style={{width:36,height:36,borderRadius:10,background:'#e8eaf6',color:'#5c6bc0',fontSize:20,fontWeight:700,border:'none',cursor:'pointer'}}>＋</button>
                      <span style={{fontSize:12,color:'#90a4ae',flex:1}}>{seatDesc}</span>
                    </div>
                  </div>
                )}

                <div style={{padding:'10px 14px',borderRadius:10,background:'#e8f5e9',border:'1.5px solid #a5d6a7'}}>
                  <span style={{fontSize:13,color:'#2e7d32',fontWeight:700}}>✅ {people}席を自動配置します</span>
                </div>
              </div>
            )}

            {layoutMode==='custom'&&(
              <LayoutEditor tables={customTables} seats={customSeats}
                setTables={setCustomTables} setSeats={setCustomSeats} people={people}/>
            )}
          </div>

          {/* プレビュー */}
          {previewSeats.length>0&&(
            <div style={C.card}>
              <div style={C.lbl}>📐 配置プレビュー</div>
              <div style={{marginTop:8}}>
                <RouletteMap tables={previewTables} seats={previewSeats} assignments={[]} highlight={null}/>
              </div>
            </div>
          )}

          <button onClick={startRoulette} disabled={!canStart}
            style={{background:'linear-gradient(135deg,#5c6bc0,#7986cb)',color:'#fff',fontWeight:900,fontSize:18,padding:'16px 0',borderRadius:14,boxShadow:'0 4px 20px #5c6bc044',fontFamily:"'Nunito',sans-serif",opacity:canStart?1:0.5,cursor:canStart?'pointer':'not-allowed'}}>
            {!canStart?`⚠️ あと ${people-totalCustomSeats} 席追加`:'🎲 スタート！'}
          </button>
        </div>
      )}

      {/* ── ROULETTE ── */}
      {screen==='roulette'&&(
        <div style={C.page}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <button onClick={backToSetup} style={{padding:'7px 14px',borderRadius:10,fontSize:13,fontWeight:700,background:'#f0f4ff',color:'#7986cb',border:'1.5px solid #c5cae9'}}>← 最初に戻る</button>
            <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:22,color:'#455a64'}}>{currentPerson}<span style={{color:'#b0bec5',fontSize:13}}>/{people}人</span></div>
          </div>
          <div style={{fontSize:11,color:'#90a4ae',fontWeight:700,letterSpacing:'0.1em'}}>NOW DECIDING</div>
          <div style={{fontFamily:"'Nunito',sans-serif",fontSize:36,fontWeight:900,color:pColor,lineHeight:1,marginTop:-4}}>Person {currentPerson}</div>
          <div style={{height:5,background:'#e8eaf6',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',borderRadius:3,transition:'width 0.5s',width:`${(currentPerson-1)/people*100}%`,background:pColor}}/></div>
          <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
            {Array.from({length:people},(_,i)=>(
              <div key={i} style={{width:10,height:10,borderRadius:'50%',flexShrink:0,transition:'all 0.2s',background:i<currentPerson-1?COLORS[i%COLORS.length]:i===currentPerson-1?pColor:'#e8eaf6',transform:i===currentPerson-1?'scale(1.5)':'scale(1)',boxShadow:i===currentPerson-1?`0 0 8px ${pColor}88`:'none'}}/>
            ))}
          </div>
          <div style={{height:150,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:20,border:`2px solid ${finalSeat?pColor:'#e8eaf6'}`,background:finalSeat?pColor+'0d':'#fff',boxShadow:finalSeat?`0 4px 24px ${pColor}22`:'0 2px 12px #0001',transition:'all 0.3s'}}>
            {!displaySeat&&<div style={{color:'#c5cae9',fontWeight:700,fontSize:15}}>▼ スピン！</div>}
            {displaySeat&&<div key={`${displaySeat}-${!spinning}`} style={{fontFamily:"'Nunito',sans-serif",fontSize:84,fontWeight:900,color:finalSeat?pColor:'#455a64',lineHeight:1,animation:finalSeat?'popIn 0.4s cubic-bezier(.34,1.4,.64,1) forwards':undefined,filter:spinning?'blur(1px)':'none',transition:'color 0.15s'}}>
              {displaySeat}<span style={{fontSize:16,color:finalSeat?pColor+'99':'#b0bec5',marginLeft:2}}>番</span>
            </div>}
          </div>
          {!finalSeat
            ?<button onClick={spin} disabled={spinning} style={{fontWeight:900,fontSize:18,padding:'15px 0',borderRadius:14,fontFamily:"'Nunito',sans-serif",color:'#fff',background:spinning?'#e0e0e0':pColor,boxShadow:spinning?'none':`0 4px 16px ${pColor}55`,transition:'all 0.2s'}}>{spinning?'スピン中...':'🎲 スピン！'}</button>
            :<button onClick={next} style={{fontWeight:900,fontSize:18,padding:'15px 0',borderRadius:14,fontFamily:"'Nunito',sans-serif",background:'#fff',border:`2px solid ${pColor}`,color:pColor,boxShadow:`0 4px 16px ${pColor}22`}}>{currentPerson>=people?'✅ 結果を見る':'次の人へ →'}</button>
          }
          <div style={C.card}>
            <div style={C.lbl}>📐 テーブル配置</div>
            <RouletteMap tables={rouletteTables} seats={rouletteSeats} assignments={assignments} highlight={finalSeat}/>
          </div>
        </div>
      )}

      {/* ── RESULT ── */}
      {screen==='result'&&(
        <div style={C.page}>
          <div style={{textAlign:'center',paddingTop:4}}>
            <div style={{fontSize:40}}>🎉</div>
            <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:30,color:'#3949ab'}}>座席決定！</div>
          </div>
          <div style={C.card}>
            <div style={C.lbl}>📐 テーブル配置図</div>
            <RouletteMap tables={rouletteTables} seats={rouletteSeats} assignments={assignments} highlight={null}/>
          </div>
          <div style={C.card}>
            <div style={C.lbl}>📋 割り当て一覧</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginTop:8,maxHeight:280,overflowY:'auto'}}>
              {assignments.map((a,i)=>(
                <div key={i} className="fade-up" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',borderRadius:10,opacity:0,background:COLORS[(a.person-1)%COLORS.length]+'18',border:`1.5px solid ${COLORS[(a.person-1)%COLORS.length]}44`,animationDelay:`${i*25}ms`}}>
                  <span style={{fontWeight:900,fontSize:13,color:COLORS[(a.person-1)%COLORS.length]}}>P{a.person}</span>
                  <span style={{fontSize:10,color:'#90a4ae'}}>→</span>
                  <span style={{fontWeight:900,fontSize:16,color:'#37474f',fontFamily:"'Nunito',sans-serif"}}>{a.seat}番</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>{setScreen('setup');setCustomTables([]);setCustomSeats([]);}} style={{flex:1,fontWeight:900,fontSize:14,padding:'13px 0',borderRadius:14,fontFamily:"'Nunito',sans-serif",background:'#f0f4ff',color:'#5c6bc0',border:'1.5px solid #c5cae9'}}>🔄 最初から</button>
            <button onClick={()=>{setCurrentPerson(1);setAssignments([]);setDisplaySeat(null);setFinalSeat(null);setRemainingSeats(shuffle(rouletteSeats.map(s=>s.id)));setScreen('roulette');}} style={{flex:1,fontWeight:900,fontSize:14,padding:'13px 0',borderRadius:14,fontFamily:"'Nunito',sans-serif",background:'#5c6bc0',color:'#fff'}}>🎲 もう一度</button>
          </div>
        </div>
      )}
    </div>
  );
}
