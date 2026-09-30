const {test}=require('node:test'),assert=require('node:assert/strict'),R=require('../../App/lib/regions');
const close=(a,b)=>a.forEach((n,i)=>assert.ok(Math.abs(n-b[i])<1e-8,`${a} != ${b}`));
test('Source-to-display mapping excludes object-fit letterboxing',()=>{const f=R.fit(1200,600,600,400);assert.deepEqual(f,{x:0,y:50,w:600,h:300});close(R.point(300,200,f),[.5,.5]);});
test('Saved manual offsets follow translated and resized auto alignment',()=>{const base=[.2,.3,.1,.2],adjust=[.21,.28,.12,.24],delta=R.relative(base,adjust);close(R.apply({player4:base},{player4:delta}).player4,adjust);close(R.applyOne([.4,.1,.05,.1],delta),[.405,.09,.06,.12]);});
test('Dragging and resizing never moves boxes off the captured source',()=>{assert.deepEqual(R.move([.2,.2,.1,.1],-2,3),[0,.9,.1,.1]);const r=R.resize([.2,.2,.1,.1],'nw',1,1);assert.ok(r[2]>=.0039&&r[3]>=.0039);close(R.resize([.2,.2,.1,.1],'se',2,2),[.2,.2,.8,.8]);});
test('Adaptive search stops at adjacent seat midpoints',()=>{const regions={player1:[.4,.3,.05,.1],player2:[.48,.3,.05,.1],player3:[.32,.3,.05,.1]},r=R.envelope('player1',regions,.04,.06);assert.ok(r[0]>=.385);assert.ok(r[0]+r[2]<=.465);assert.ok(r[1]+r[3]>.4);});
test('Overlap detects shared card areas but not touching edges',()=>{assert.equal(R.overlap([0,0,.5,.5],[.5,0,.2,.2]),false);assert.equal(R.overlap([0,0,.5,.5],[.49,0,.2,.2]),true);});
