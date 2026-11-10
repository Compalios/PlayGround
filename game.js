(() => {
  const canvas = document.getElementById('battlefield');
  const ctx = canvas.getContext('2d');
  const W = 1000, H = 590, COLS = 9, ROWS = 5;
  const board = { x: 65, y: 66, w: 890, h: 470 };
  const cw = board.w / COLS, rh = board.h / ROWS;
  const defs = [
    {id:'pea',name:'Rifle Pea',desc:'FRONTLINE',icon:'🌱',cost:100,hp:100,rate:1.55,damage:24,color:'#74ad4d',kind:'shooter',tip:'Rapid fire'},
    {id:'sun',name:'Supply Bloom',desc:'SUPPORT',icon:'🌻',cost:50,hp:85,rate:8,kind:'sun',tip:'Makes sun'},
    {id:'wall',name:'Bunker Bulb',desc:'BARRICADE',icon:'🥔',cost:75,hp:560,kind:'wall',tip:'Heavy armor'},
    {id:'ice',name:'Frost Scout',desc:'SLOW FIRE',icon:'🫛',cost:175,hp:100,rate:2.1,damage:20,color:'#62b5b1',kind:'ice',tip:'Slows foes'},
    {id:'bomb',name:'Cherry Mortar',desc:'EXPLOSIVE',icon:'🍒',cost:150,hp:1,kind:'bomb',tip:'Area blast'},
    {id:'mine',name:'Tripwire Mine',desc:'AMBUSH',icon:'🪨',cost:50,hp:75,kind:'mine',tip:'Hidden trap'}
  ];
  let sun = 150, selected = 'pea', plants = [], zombies = [], shots = [], drops = [], particles = [];
  let running = true, ended = false, won = false, last = performance.now(), elapsed = 0, spawnTimer = 8, naturalDropTimer = 5;
  let wave = 1, spawned = 0, killed = 0, waveSpawned = 0, waveDefeated = 0, waveGap = 0;
  let mowers = Array.from({length:ROWS}, (_, row) => ({row, ready:true, x:board.x - 24, active:false}));
  let toastTimer = 0, soundOn = false;

  const $ = id => document.getElementById(id);
  function unitMarkup(p, i) { return `<button class="unit-card ${p.id===selected?'selected':''}" data-id="${p.id}" aria-label="${p.name}, costs ${p.cost} sun"><span class="unit-art">${p.icon}</span><span class="unit-name">${p.name}</span><span class="unit-detail">${p.desc}</span><span class="unit-cost">✦ ${p.cost}</span></button>`; }
  function renderUnits() {
    $('unitList').innerHTML = defs.map(unitMarkup).join('');
    document.querySelectorAll('.unit-card').forEach(el => el.addEventListener('click', () => { selected = el.dataset.id; renderUnits(); }));
    updateSupply();
  }
  function updateSupply() {
    $('sunCount').textContent = sun;
    document.querySelectorAll('.unit-card').forEach(el => el.classList.toggle('unaffordable', sun < defs.find(p=>p.id===el.dataset.id).cost));
    $('plantCount').textContent = `${plants.length} ${plants.length===1?'UNIT':'UNITS'}`;
  }
  function announce(msg) { const el=$('toast'); el.textContent=msg; el.classList.add('show'); toastTimer=2.2; }
  function roundedRect(x,y,w,h,r,fill,stroke) { ctx.beginPath(); ctx.roundRect(x,y,w,h,r); if(fill){ctx.fillStyle=fill;ctx.fill()} if(stroke){ctx.strokeStyle=stroke;ctx.stroke()} }
  function ellipse(x,y,rx,ry,fill) { ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill(); }
  function line(x1,y1,x2,y2,color,width=1) { ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke(); }
  function rand(a,b){return a+Math.random()*(b-a)}
  function cellCenter(row,col){return {x:board.x+col*cw+cw/2,y:board.y+row*rh+rh/2};}

  function drawField() {
    const bg=ctx.createLinearGradient(0,0,0,H); bg.addColorStop(0,'#e7e1ca');bg.addColorStop(1,'#c7c4a4');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    // distant hills and a hand-built, quiet homestead skyline
    ellipse(790,83,195,59,'#a4ad7e');ellipse(970,91,165,52,'#929f70');ellipse(580,87,180,49,'#b3b58a');
    ctx.fillStyle='#758464';ctx.fillRect(0,131,W,27);
    for(let i=0;i<10;i++){let x=i*112+rand(-12,10), h=16+(i%3)*7;ctx.fillStyle=i%2?'#64745b':'#596c55';ctx.fillRect(x,130-h,7,h);ellipse(x+3,130-h,13,9,'#667b5d');}
    // little lookout shack
    ctx.fillStyle='#635e48';ctx.fillRect(806,87,38,47);ctx.fillStyle='#494b3c';ctx.beginPath();ctx.moveTo(798,89);ctx.lineTo(825,68);ctx.lineTo(852,89);ctx.fill();ctx.fillStyle='#dbd1ac';ctx.fillRect(819,104,11,15);
    // earth pad and grass rows
    roundedRect(board.x-7,board.y-7,board.w+14,board.h+14,12,'#586747','#e8e4d0');
    for(let r=0;r<ROWS;r++){
      const y=board.y+r*rh; const tone=['#91a968','#9caf72','#8fa765','#a1b477','#91a666'][r];
      ctx.fillStyle=tone;ctx.fillRect(board.x,y,board.w,rh);
      ctx.fillStyle='rgba(233,231,184,.12)';ctx.fillRect(board.x,y,board.w,7);
      // lane track, subtle tire rut and scattered grass strokes
      ctx.fillStyle='rgba(115,105,72,.12)';ctx.fillRect(board.x,y+rh*.73,board.w,rh*.12);
      ctx.fillStyle='rgba(221,218,168,.20)';ctx.fillRect(board.x,y+rh*.75,board.w,rh*.025);
      for(let j=0;j<20;j++){const x=board.x+((j*79+r*31)%board.w), gy=y+18+((j*41+r*17)%(rh-27));line(x,gy,x+rand(-3,4),gy-4,'#586f43',1);}
      if(r%2===0){ellipse(board.x+42,y+rh-18,2,1.3,'#d7c798');ellipse(board.x+board.w-42,y+15,2,1,'#ddcea1');}
    }
    // tile boundaries and selected hover
    ctx.lineWidth=1;
    for(let c=0;c<=COLS;c++){const x=board.x+c*cw;line(x,board.y,x,board.y+board.h,'rgba(49,72,48,.20)',1);}
    for(let r=0;r<=ROWS;r++){const y=board.y+r*rh;line(board.x,y,board.x+board.w,y,'rgba(49,72,48,.23)',1);}
    // yard edge / defensive trench
    ctx.fillStyle='#554f3d';ctx.fillRect(0,board.y,board.x-7,board.h);
    ctx.fillStyle='#786a4e';ctx.fillRect(0,board.y+board.h-15,board.x-7,15);
    for(let r=0;r<ROWS;r++){
      const cy=board.y+r*rh+rh/2;
      // mower housing
      roundedRect(10,cy-16,40,31,7,mowers[r].ready?'#d9d4bd':'#524e3d','#3f4936');
      roundedRect(16,cy-11,24,17,5,mowers[r].ready?'#7d9e58':'#6d6a53');
      ellipse(18,cy+14,5,5,'#303a31');ellipse(41,cy+14,5,5,'#303a31');
      ctx.fillStyle='#eee4c4';ctx.font='800 8px "DM Sans"';ctx.textAlign='center';ctx.fillText('M'+(r+1),28,cy-1);
    }
    ctx.textAlign='left';
    // corner wayfinding
    ctx.fillStyle='rgba(42,57,38,.68)';ctx.font='800 8px "DM Sans"';ctx.fillText('N  ↑',board.x+8,board.y-18);
    ctx.textAlign='right';ctx.fillText('DEFENSE LINE',board.x+board.w,board.y-18);ctx.textAlign='left';
    // live highlight for plant placement
    if(pointer.inside && running && !ended){const {row,col}=pointer;const x=board.x+col*cw,y=board.y+row*rh;ctx.fillStyle='rgba(232,246,188,.22)';ctx.fillRect(x+2,y+2,cw-4,rh-4);ctx.strokeStyle='rgba(244,255,215,.75)';ctx.lineWidth=2;ctx.strokeRect(x+2,y+2,cw-4,rh-4);}
  }

  function drawPlant(p) {
    const {x,y}=p; const sway=Math.sin(elapsed*2.7+p.row*2+p.col)*2;
    // shadow
    ellipse(x,y+21,24,7,'#40553c55');
    if(p.kind==='wall'){
      // bunker-shaped armored potato with sandbag seam
      ellipse(x,y+1,23,29,'#c6a76c');ellipse(x-2,y-2,19,26,'#d7bd82');
      ellipse(x-7,y-9,2,2,'#674d38');ellipse(x+7,y-9,2,2,'#674d38');
      line(x-11,y+2,x+10,y+2,'#9b7952',2);line(x-9,y+11,x+9,y+11,'#9b7952',2);
      roundedRect(x-18,y-25,36,10,3,'#667950','#47583d');ellipse(x,y-30,10,6,'#78945d');
      ctx.fillStyle='#544d38';ctx.fillRect(x+3,y-31,7,2);
      return;
    }
    if(p.kind==='mine'){
      if(!p.armed){ellipse(x,y+9,17,6,'#566342');ellipse(x,y+7,10,4,'#737d53');return;}
      ellipse(x,y+7,17,7,'#60694c');ellipse(x,y+2,11,7,'#89905e');ellipse(x,y-1,5,4,'#bdad70');
      for(let a=0;a<8;a++){let angle=a*Math.PI/4;line(x+Math.cos(angle)*8,y+Math.sin(angle)*4,x+Math.cos(angle)*14,y+Math.sin(angle)*7,'#4e5942',2);}return;
    }
    if(p.kind==='bomb'){
      ellipse(x-9,y,13,15,'#d95348');ellipse(x+9,y,13,15,'#e7644f');ellipse(x-13,y-5,4,4,'#fa9d76');ellipse(x+5,y-6,4,4,'#ffb08a');
      line(x,y-12,x+3,y-23,'#557445',4);ellipse(x+5,y-25,5,3,'#90ad5d');return;
    }
    if(p.kind==='sun'){
      // green body and golden petal halo
      const n=10;for(let i=0;i<n;i++){let a=i*Math.PI*2/n;ellipse(x+Math.cos(a)*17,y-5+Math.sin(a)*17,6,9,'#f3bf4f');}
      ellipse(x,y-5,15,16,'#7a9e49');ellipse(x,y-6,11,12,'#9bba58');
      ellipse(x-4,y-8,1.6,2,'#293c2d');ellipse(x+4,y-8,1.6,2,'#293c2d');
      ctx.beginPath();ctx.arc(x,y-2,4,0.2,Math.PI-.2);ctx.strokeStyle='#354a31';ctx.lineWidth=1.6;ctx.stroke();
      ctx.save();ctx.translate(x-11,y+18);ctx.rotate(-.5);ellipse(0,0,9,4,'#557e42');ctx.restore();
      ctx.save();ctx.translate(x+10,y+19);ctx.rotate(.4);ellipse(0,0,8,4,'#638849');ctx.restore();
    } else {
      const color=p.kind==='ice'?'#65b9b4':'#6eaa4d';
      // stem and leaves
      line(x,y+19,x+sway,y+1,'#527d43',4);ctx.save();ctx.translate(x-3,y+12);ctx.rotate(-.55);ellipse(0,0,11,5,'#578344');ctx.restore();ctx.save();ctx.translate(x+5,y+14);ctx.rotate(.55);ellipse(0,0,10,5,'#5e9145');ctx.restore();
      // helmet / head
      ellipse(x+sway,y-7,17,18,color);ellipse(x+sway-3,y-10,11,11,p.kind==='ice'?'#8dd0c6':'#8fc863');
      // muzzle
      ellipse(x+sway+12,y-4,9,7,p.kind==='ice'?'#4c9796':'#5f9846');
      ellipse(x+sway+14,y-6,3,2,'#26362a');
      // single expressive eye
      ellipse(x+sway+3,y-11,3.8,4.3,'#f5f0cf');ellipse(x+sway+4,y-11,1.5,2,'#29362b');
      // steel helmet
      ctx.fillStyle='#637950';ctx.beginPath();ctx.ellipse(x+sway,y-20,14,7,0,Math.PI,Math.PI*2);ctx.fill();roundedRect(x+sway-15,y-21,30,4,2,'#506542');
      if(p.kind==='ice'){ctx.fillStyle='#dbf4e3';ctx.fillRect(x+sway-7,y-25,8,2);}
      // backpack
      roundedRect(x-18,y-2,7,14,3,p.kind==='ice'?'#507e75':'#566746');
    }
    // little unit health strip
    if(p.hp<p.maxHp){roundedRect(x-16,y+27,32,3,2,'#26392e');roundedRect(x-16,y+27,32*Math.max(0,p.hp/p.maxHp),3,2,'#9bc455');}
  }

  function drawZombie(z) {
    const bob=Math.sin(elapsed*5+z.phase)*2;
    ellipse(z.x,z.y+21,19,6,'#43533d55');
    // legs and tattered fatigues
    line(z.x-5,z.y+8+bob,z.x-8,z.y+21,'#595d43',6);line(z.x+5,z.y+8-bob,z.x+9,z.y+21,'#595d43',6);
    line(z.x-8,z.y+20,z.x-13,z.y+22,'#363d32',5);line(z.x+9,z.y+20,z.x+14,z.y+22,'#363d32',5);
    roundedRect(z.x-13,z.y-3+bob,26,22,6,z.slow>0?'#687c69':'#69704d');
    // webbing and field pack
    roundedRect(z.x-18,z.y-1,7,16,3,'#4d5946');line(z.x-9,z.y-3,z.x+6,z.y+15,'#c1aa75',2);line(z.x+8,z.y-3,z.x-5,z.y+15,'#b09a68',2);
    // arms reaching forward
    line(z.x+8,z.y+1,z.x+19,z.y+8,'#92986c',5);ellipse(z.x+20,z.y+9,5,4,'#9b9e70');
    // head
    ellipse(z.x,z.y-12+bob,14,15,z.slow>0?'#9ebaa0':'#a3a579');ellipse(z.x+9,z.y-11+bob,5,5,'#92976c');
    // helmet
    ctx.fillStyle=z.elite?'#414b38':'#596448';ctx.beginPath();ctx.ellipse(z.x,z.y-21+bob,15,7,0,Math.PI,Math.PI*2);ctx.fill();roundedRect(z.x-16,z.y-22+bob,32,4,2,'#49543e');
    // face & uniform insignia
    ellipse(z.x+5,z.y-14+bob,2.1,2.4,'#342f27');ellipse(z.x-4,z.y-14+bob,1.5,1.8,'#585941');
    ctx.fillStyle='#3e4737';ctx.fillRect(z.x-2,z.y+3+bob,5,6);
    if(z.elite){roundedRect(z.x-12,z.y-35,24,3,2,'#333b30');roundedRect(z.x-12,z.y-35,24*Math.max(0,z.hp/z.maxHp),3,2,'#d0a956');}
    if(z.slow>0){ctx.strokeStyle='#c9f3e8';ctx.lineWidth=2;ctx.beginPath();ctx.arc(z.x,z.y,22,0,Math.PI*2);ctx.stroke();}
  }

  function drawDrop(d) {
    const bob=Math.sin(elapsed*3+d.phase)*4;const x=d.x,y=d.y+bob;
    ctx.save();ctx.translate(x,y);ctx.rotate(.08);
    if(d.box){roundedRect(-13,-12,26,24,4,'#c29351','#655d3e');roundedRect(-9,-9,18,18,2,'#d7ad64');line(-8,0,8,0,'#916c42',2);line(0,-8,0,8,'#916c42',2);}
    else{ellipse(0,0,13,13,'#f3c94f');ellipse(0,0,9,9,'#ffe17b');ctx.fillStyle='#fff0a8';ctx.font='bold 14px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('✦',0,1);}
    ctx.restore();ctx.textBaseline='alphabetic';
    ellipse(x,y+17,13,4,'#453f2a35');
  }

  function draw() {
    ctx.clearRect(0,0,W,H);drawField();
    // artful decorative sandbags outside the lawn
    for(let i=0;i<4;i++){const x=board.x+105+i*205;roundedRect(x,board.y+board.h+13,43,9,4,'#bba982','#90876a');line(x+22,board.y+board.h+14,x+22,board.y+board.h+20,'#918567',1);}
    plants.forEach(drawPlant);drops.forEach(drawDrop);shots.forEach(s=>{ellipse(s.x,s.y,6,5,s.ice?'#c3f1db':'#b4d65d');ellipse(s.x-1,s.y-1,2,1.7,'#f1f3a5');});
    zombies.forEach(drawZombie);
    particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ellipse(p.x,p.y,p.r,p.r);ctx.globalAlpha=1;});
    mowers.forEach(m=>{if(m.active){ctx.save();ctx.translate(m.x,board.y+m.row*rh+rh/2);ctx.rotate(-.1);roundedRect(-14,-14,31,28,5,'#d5d0b6','#343c31');roundedRect(-9,-10,20,19,3,'#89955c');ellipse(11,0,6,6,'#e8e0c3');ctx.restore();}});
  }

  function plantAt(row,col,id) {
    if(!running||ended)return;
    if(plants.some(p=>p.row===row&&p.col===col)){announce('That tile is already occupied.');return;}
    const def=defs.find(p=>p.id===id);
    if(sun<def.cost){announce('Not enough sun supplies. Collect a drop!');return;}
    const {x,y}=cellCenter(row,col);sun-=def.cost;
    const p={...def,row,col,x,y,hp:def.hp,maxHp:def.hp,cool:rand(.2,.8),armed:false,arm:1.5};
    plants.push(p);updateSupply();
    if(p.kind==='bomb'){
      plants=plants.filter(q=>q!==p);let hit=0;
      zombies.forEach(z=>{if(Math.abs(z.x-x)<112&&Math.abs(z.y-y)<rh*.8){z.hp-=230;hit++;burst(z.x,z.y,'#f3a347',17);}});
      burst(x,y,'#f1a04d',26);announce(hit?`Mortar strike! ${hit} hostile${hit>1?'s':''} hit.`:'Mortar deployed — no hostiles in range.');
    } else announce(`${def.name} deployed.`);
  }
  function burst(x,y,color,n=8){for(let i=0;i<n;i++){let a=rand(0,Math.PI*2),v=rand(25,115);particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-20,life:rand(.3,.75),max:.75,r:rand(2,5),color});}}
  function spawnZombie() {
    if(wave>3)return;
    const row=Math.floor(Math.random()*ROWS), elite=wave>=2&&Math.random()<.30;
    const maxHp=elite?170+(wave-1)*25:105+(wave-1)*22;
    zombies.push({x:board.x+board.w+rand(20,65),y:board.y+row*rh+rh/2-2,row,hp:maxHp,maxHp,speed:elite?rand(8,12):rand(12,17),bite:0,slow:0,phase:rand(0,6),elite});
    waveSpawned++;spawned++;updateWaveUI();
  }
  function makeDrop(x,y,box=false){drops.push({x,y,box,phase:rand(0,6),life:box?12:9});}
  function updateWaveUI(){
    const names=['SCOUTING PARTY','REINFORCEMENTS','FINAL ASSAULT'];
    $('waveLabel').innerHTML=`WAVE 0${Math.min(wave,3)} <span>—</span> ${names[Math.min(wave-1,2)]}`;
    $('waveCount').textContent=`${waveDefeated} / ${[8,10,12][Math.min(wave-1,2)]} HOSTILES`;
    $('waveProgress').style.width=`${Math.min(100,waveDefeated/[8,10,12][Math.min(wave-1,2)]*100)}%`;
  }
  function update(dt) {
    if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show');}
    if(!running||ended)return;
    elapsed+=dt;spawnTimer-=dt;naturalDropTimer-=dt;
    if(spawnTimer<=0){
      const target=[8,10,12][wave-1];
      if(waveSpawned<target){spawnZombie();spawnTimer=wave===1?rand(5.3,7.1):rand(3.7,5.3);}
      else if(zombies.length===0){
        if(wave<3){wave++;waveSpawned=0;waveDefeated=0;waveGap=2.5;spawnTimer=waveGap;updateWaveUI();announce(`Wave ${wave} approaching. Reinforce the line!`);}
        else finish(true);
      } else spawnTimer=1.5;
    }
    if(naturalDropTimer<=0){makeDrop(rand(board.x+35,board.x+board.w-35),rand(board.y+25,board.y+board.h-25),Math.random()<.3);naturalDropTimer=rand(7,11);}
    plants.forEach(p=>{
      if(p.kind==='sun'){p.cool-=dt;if(p.cool<=0){makeDrop(p.x+rand(-9,9),p.y-25,false);p.cool=rand(8,10);}}
      if(p.kind==='mine'){if(!p.armed){p.arm-=dt;if(p.arm<=0)p.armed=true;}else{const victim=zombies.find(z=>z.row===p.row&&z.x>p.x-8&&z.x<p.x+48);if(victim){victim.hp-=115;burst(p.x,p.y,'#d0b96f',10);plants=plants.filter(q=>q!==p);}}}
      if(p.kind==='pea'||p.kind==='ice'){
        p.cool-=dt;
        if(p.cool<=0&&zombies.some(z=>z.row===p.row&&z.x>p.x)){
          shots.push({x:p.x+19,y:p.y-5,row:p.row,vx:260,damage:p.damage,ice:p.kind==='ice'});p.cool=p.rate;
        }
      }
    });
    shots.forEach(s=>{
      s.x+=s.vx*dt;
      const target=zombies.find(z=>z.row===s.row&&Math.abs(z.x-s.x)<15);
      if(target){target.hp-=s.damage;if(s.ice)target.slow=2.7;burst(s.x,s.y,s.ice?'#b8e4d7':'#b4d65d',3);s.dead=true;}
      if(s.x>board.x+board.w+40)s.dead=true;
    });shots=shots.filter(s=>!s.dead);
    zombies.forEach(z=>{
      z.slow=Math.max(0,z.slow-dt);
      const blocker=plants.find(p=>p.row===z.row&&p.kind!=='mine'&&p.x<z.x+18&&p.x>z.x-38);
      if(blocker){z.bite-=dt;if(z.bite<=0){blocker.hp-=z.elite?20:14;z.bite=.75;burst(blocker.x+rand(-5,5),blocker.y+8,'#af6849',2);}}
      else z.x-=z.speed*(z.slow>0?.48:1)*dt;
      if(z.x<board.x-30){const mower=mowers[z.row];if(mower.ready){mower.ready=false;mower.active=true;mower.x=board.x-20;announce('TRIPWIRE MOWER! Lane cleared.');}else finish(false);}
    });
    mowers.forEach(m=>{if(m.active){m.x+=310*dt;zombies=zombies.filter(z=>{if(z.row===m.row&&z.x<m.x+34){burst(z.x,z.y,'#a4bc79',5);waveDefeated++;killed++;return false;}return true;});if(m.x>board.x+board.w+35)m.active=false;}});
    const before=zombies.length;zombies=zombies.filter(z=>{if(z.hp<=0){burst(z.x,z.y,'#9b9d70',9);waveDefeated++;killed++;if(Math.random()<.22)makeDrop(z.x,z.y-12,true);return false;}return true;});
    if(before!==zombies.length)updateWaveUI();
    drops.forEach(d=>d.life-=dt);drops=drops.filter(d=>d.life>0);
    particles.forEach(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=130*dt;p.vx*=.98;});particles=particles.filter(p=>p.life>0);
    updateSupply();
  }
  function finish(victory){ended=true;running=false;won=victory;$('battleStatus').textContent=victory?'SECTOR SECURED':'DEFENSES BREACHED';$('overlayTitle').textContent=victory?'SECTOR SECURED':'LINE BREACHED';$('overlayText').textContent=victory?`All three waves repelled. ${killed} hostiles neutralized. The garden holds.`:'The hostiles crossed the defense line. Regroup and try a new strategy.';$('fieldOverlay').hidden=false;}
  function reset(){sun=150;selected='pea';plants=[];zombies=[];shots=[];drops=[];particles=[];running=true;ended=false;won=false;elapsed=0;spawnTimer=8;naturalDropTimer=5;wave=1;spawned=0;killed=0;waveSpawned=0;waveDefeated=0;mowers=Array.from({length:ROWS},(_,row)=>({row,ready:true,x:board.x-24,active:false}));$('fieldOverlay').hidden=true;$('battleStatus').textContent='ENGAGEMENT IN PROGRESS';$('pauseBtn').innerHTML='Ⅱ <span>PAUSE</span>';renderUnits();updateWaveUI();announce('Mission reset. Deploy your defenses.');}
  function togglePause(){if(ended)return;running=!running;$('pauseBtn').innerHTML=running?'Ⅱ <span>PAUSE</span>':'▶ <span>RESUME</span>';$('battleStatus').textContent=running?'ENGAGEMENT IN PROGRESS':'FIELD OPERATIONS PAUSED';if(!running)announce('Operations paused.');}

  const pointer={inside:false,row:0,col:0};
  function getPos(e){const rect=canvas.getBoundingClientRect();return {x:(e.clientX-rect.left)*W/rect.width,y:(e.clientY-rect.top)*H/rect.height};}
  canvas.addEventListener('pointermove',e=>{const p=getPos(e);pointer.col=Math.floor((p.x-board.x)/cw);pointer.row=Math.floor((p.y-board.y)/rh);pointer.inside=p.x>=board.x&&p.x<board.x+board.w&&p.y>=board.y&&p.y<board.y+board.h;});
  canvas.addEventListener('pointerleave',()=>pointer.inside=false);
  canvas.addEventListener('pointerdown',e=>{
    const p=getPos(e);
    for(let i=drops.length-1;i>=0;i--){const d=drops[i];if(Math.hypot(p.x-d.x,p.y-(d.y+Math.sin(elapsed*3+d.phase)*4))<24){sun+=d.box?50:25;drops.splice(i,1);updateSupply();announce(`+${d.box?50:25} sun supplies collected.`);return;}}
    if(p.x>=board.x&&p.x<board.x+board.w&&p.y>=board.y&&p.y<board.y+board.h)plantAt(Math.floor((p.y-board.y)/rh),Math.floor((p.x-board.x)/cw),selected);
  });
  $('pauseBtn').addEventListener('click',togglePause);$('restartBtn').addEventListener('click',reset);$('overlayRestart').addEventListener('click',reset);
  $('soundBtn').addEventListener('click',()=>{$('soundBtn').classList.toggle('muted');soundOn=!soundOn;$('soundBtn').title=soundOn?'Sound on':'Sound off';announce(soundOn?'Sound enabled.':'Sound muted.');});
  document.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();togglePause();}if(e.key>='1'&&e.key<='6'){selected=defs[+e.key-1].id;renderUnits();}if(e.key.toLowerCase()==='r')reset();});
  let frame=0;function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;update(dt);draw();frame=requestAnimationFrame(loop);}
  // A small advance team is already dug in when the operation begins.
  const openingPea=defs.find(p=>p.id==='pea'), openingSun=defs.find(p=>p.id==='sun');
  const peaPos=cellCenter(2,2), sunPos=cellCenter(4,1);
  plants.push({...openingPea,row:2,col:2,x:peaPos.x,y:peaPos.y,hp:openingPea.hp,maxHp:openingPea.hp,cool:.6});
  plants.push({...openingSun,row:4,col:1,x:sunPos.x,y:sunPos.y,hp:openingSun.hp,maxHp:openingSun.hp,cool:4});
  zombies.push({x:board.x+board.w-50,y:board.y+2*rh+rh/2-2,row:2,hp:105,maxHp:105,speed:13,bite:0,slow:0,phase:2,elite:false});
  waveSpawned=1;spawned=1;
  renderUnits();updateWaveUI();requestAnimationFrame(loop);
})();
