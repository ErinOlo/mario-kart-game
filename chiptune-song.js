/* Chiptune melody - exported 2026-06-30
   D minor, 4/4. Self-contained NES-style player, no dependencies.

   Browser:
     <script src="chiptune-song.js"></script>
     <script>Chiptune.play();</script>        // Chiptune.stop() to halt

   Bundler / module:
     import Chiptune from "./chiptune-song.js"; Chiptune.play();

   Edit the melody in SONG.lead below - each entry is [note, beats]
   (.5 = eighth, 1 = quarter, 2 = half). Chiptune.data exposes it at runtime.
*/
(function(global){
"use strict";
var SONG={tempo:156,duty:0.5,lead:[["D5",0.5],["A4",0.5],["F4",0.5],["A4",0.5],["D5",0.5],["A4",0.5],["F4",0.5],["A4",0.5],["C5",0.5],["A4",0.5],["E4",0.5],["A4",0.5],["C5",0.5],["A4",0.5],["E4",0.5],["A4",0.5],["D5",0.5],["A4",0.5],["F4",0.5],["A4",0.5],["C#5",0.5],["A4",0.5],["E4",0.5],["A4",0.5],["D5",0.5],["A4",0.5],["F4",0.5],["A4",0.5],["A4",0.5],["B4",0.5],["C#5",0.5],["D5",0.5],["D5",1],["F5",0.5],["E5",0.5],["D5",1],["C5",1],["A4",1],["D5",1],["C5",0.5],["A4",0.5],["G4",0.5],["F4",0.5],["E4",1],["G4",0.5],["F4",0.5],["E4",1],["D4",1],["A4",2],["A4",1],["G4",0.5],["F4",0.5]],bassRoot:["D2","A2","D2","A2","D2","A#2","F2","A2"],arp:[["D3","F3","A3"],["A3","C4","E4"],["D3","F3","A3"],["A3","C#4","E4"],["D3","F3","A3"],["A#3","D4","F4"],["F3","A3","C4"],["A3","C#4","E4"]]};
var UPB=4,BARS=SONG.bassRoot.length,TOTAL=BARS*16;
function noteToFreq(n){var m=/^([A-G])(#|b)?(-?\d)$/.exec(n);var s={C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]]+(m[2]==="#"?1:m[2]==="b"?-1:0);return 440*Math.pow(2,((s+(parseInt(m[3])+1)*12)-69)/12);}
function buildGrid(){var grid=Array.from({length:TOTAL},function(){return{};});var u=0;SONG.lead.forEach(function(p){var du=Math.round(p[1]*UPB);if(grid[u])grid[u].lead={f:noteToFreq(p[0]),du:du};u+=du;});for(var bar=0;bar<BARS;bar++){var base=bar*16,root=noteToFreq(SONG.bassRoot[bar]);for(var k=0;k<8;k++)grid[base+k*2].bass={f:k%2?root*2:root,du:2};var tones=SONG.arp[bar].map(noteToFreq);for(var i=0;i<16;i++)grid[base+i].arp={f:tones[i%3]};grid[base].kick=grid[base+8].kick=true;grid[base+4].snare=grid[base+12].snare=true;for(var j=0;j<16;j+=2)grid[base+j].hat=true;}return grid;}
function makePulse(c,d){var N=40,re=new Float32Array(N),im=new Float32Array(N);for(var n=1;n<N;n++)im[n]=(2/(n*Math.PI))*Math.sin(n*Math.PI*d);return c.createPeriodicWave(re,im,{disableNormalization:false});}
function buildRig(c,vol){var master=c.createGain();master.gain.value=vol;master.connect(c.destination);var bus={};["lead","arp","bass","drum"].forEach(function(k){bus[k]=c.createGain();bus[k].connect(master);});bus.arp.gain.value=.45;bus.bass.gain.value=.9;bus.drum.gain.value=.8;var nb=c.createBuffer(1,c.sampleRate,c.sampleRate),d=nb.getChannelData(0);for(var i=0;i<d.length;i++)d[i]=Math.random()*2-1;return{c:c,bus:bus,lead:makePulse(c,SONG.duty),arpw:makePulse(c,.125),noise:nb};}
function pulse(r,key,w,f,t,dur,pk){var o=r.c.createOscillator(),g=r.c.createGain();o.setPeriodicWave(w);o.frequency.value=f;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(pk,t+.006);g.gain.setValueAtTime(pk,t+Math.max(.02,dur*.55));g.gain.exponentialRampToValueAtTime(.0008,t+dur);o.connect(g).connect(r.bus[key]);o.start(t);o.stop(t+dur+.03);}
function tri(r,f,t,dur){var o=r.c.createOscillator(),g=r.c.createGain();o.type="triangle";o.frequency.value=f;g.gain.setValueAtTime(.0008,t);g.gain.exponentialRampToValueAtTime(.9,t+.006);g.gain.exponentialRampToValueAtTime(.0008,t+dur);o.connect(g).connect(r.bus.bass);o.start(t);o.stop(t+dur+.03);}
function kick(r,t){var o=r.c.createOscillator(),g=r.c.createGain();o.type="sine";o.frequency.setValueAtTime(165,t);o.frequency.exponentialRampToValueAtTime(52,t+.11);g.gain.setValueAtTime(.9,t);g.gain.exponentialRampToValueAtTime(.001,t+.13);o.connect(g).connect(r.bus.drum);o.start(t);o.stop(t+.15);}
function nz(r,t,dur,fq,Q,pk,ty){var s=r.c.createBufferSource();s.buffer=r.noise;var f=r.c.createBiquadFilter();f.type=ty;f.frequency.value=fq;f.Q.value=Q;var g=r.c.createGain();g.gain.setValueAtTime(pk,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(f).connect(g).connect(r.bus.drum);s.start(t);s.stop(t+dur+.02);}
function step(r,grid,i,t,spu){var s=grid[i];if(!s)return;if(s.lead)pulse(r,"lead",r.lead,s.lead.f,t,s.lead.du*spu,.32);if(s.arp)pulse(r,"arp",r.arpw,s.arp.f,t,spu*.9,.5);if(s.bass)tri(r,s.bass.f,t,s.bass.du*spu);if(s.kick)kick(r,t);if(s.snare)nz(r,t,.13,1800,1.1,.5,"bandpass");if(s.hat)nz(r,t,.03,8000,.7,.13,"highpass");}
var ctx=null,rig=null,timer=null,unit=0,nextT=0,loop=true;
function play(opts){opts=opts||{};loop=opts.loop!==false;if(!ctx){ctx=new (global.AudioContext||global.webkitAudioContext)();rig=buildRig(ctx,(opts.volume!=null?opts.volume:.7)*.8);}if(ctx.state==="suspended")ctx.resume();var grid=buildGrid(),spu=(60/SONG.tempo)/UPB;unit=0;nextT=ctx.currentTime+.08;clearInterval(timer);timer=setInterval(function(){while(nextT<ctx.currentTime+.12){step(rig,grid,unit%TOTAL,nextT,spu);nextT+=spu;unit++;if(!loop&&unit>=TOTAL){stop();return;}}},25);}
function stop(){clearInterval(timer);timer=null;}
var api={data:SONG,play:play,stop:stop,noteToFreq:noteToFreq};
global.Chiptune=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:this);
