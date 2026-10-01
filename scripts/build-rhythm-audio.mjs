// Original instrumental: Pocket Day, 108 BPM, 24 bars + count-in/outro.
// Rebuild the MP3 with ffmpeg after running this script. No external samples.
import { writeFileSync, mkdirSync } from 'node:fs';
const rate = 22050, beat = 60 / 108, duration = 102 * beat;
const left = new Float32Array(Math.ceil(duration * rate)), right = new Float32Array(left.length);
let noiseSeed = 1884;
const noise = () => { noiseSeed = (Math.imul(noiseSeed,1664525)+1013904223)>>>0; return noiseSeed/2147483648-1; };
const freq = midi => 440 * 2 ** ((midi-69)/12);
function add(at, length, volume, voice, pan=0) {
  const start=Math.round(at*rate), count=Math.ceil(length*rate);
  for(let i=0;i<count&&start+i<left.length;i++) {
    const t=i/rate, envelope=Math.min(1,t/.006)*Math.exp(-t/(length*.35))*Math.min(1,(length-t)/.03);
    const value=voice(t)*envelope*volume;
    left[start+i]+=value*(.8-pan*.3);right[start+i]+=value*(.8+pan*.3);
  }
}
const tone=(midi,kind='bell')=>t=>{
  const p=2*Math.PI*freq(midi)*t;
  if(kind==='bass')return Math.sin(p)+.22*Math.sin(2*p);
  if(kind==='keys')return Math.sin(p)+.25*Math.sin(p*2)*Math.exp(-t*8)+.12*Math.sin(p*3);
  return Math.sin(p)+.35*Math.sin(p*2.005)*Math.exp(-t*6)+.1*Math.sin(p*4.01)*Math.exp(-t*12);
};
const chords=[[53,57,60,64],[50,53,57,60],[46,50,53,57],[48,52,55,57]];
const melodies=[[76,72,69,72,74,72,69,67],[72,69,65,69,72,74,72,69],[69,65,62,65,69,72,69,65],[67,69,72,76,74,72,69,67]];
for(let b=0;b<102;b++) {
  const at=b*beat;
  if(b<4){add(at,.12,.16,t=>Math.sin(2*Math.PI*(b===3?1320:880)*t));continue;}
  if(b>=100)continue;
  const musical=b-4, bar=Math.floor(musical/4), step=musical%4, scene=Math.floor(bar/8);
  if(step===0||step===2||scene===2&&step===3) add(at,.35,.5,t=>Math.sin(2*Math.PI*(48*t+45*.022*(1-Math.exp(-t/.022)))));
  if(step===1||step===3){add(at,.16,.18,t=>noise()*.85+Math.sin(2*Math.PI*180*t)*.25);add(at+.012,.045,.06,()=>noise());}
  for(let half=0;half<2;half++)add(at+half*beat/2,.065,.05,()=>noise(),half? .6:-.4);
  const chord=chords[bar%4];
  if(step===0){for(const [index,midi]of chord.entries())add(at+index*.008,beat*3.7,.065,tone(midi+12,'keys'),(index-1.5)*.25);}
  add(at,beat*.65,.18,tone(chord[0]-(step===2?0:12),'bass'));
  if(musical>=8){const melody=melodies[bar%4];add(at,beat*.6,.12,tone(melody[(bar%2)*4+step]),scene===1?.35:-.2);if(scene===2&&step%2===0)add(at+beat/2,beat*.4,.065,tone(melody[(step+2)%8]),-.45);}
}
for(const [i,midi]of [53,57,60,65,69].entries())add(100*beat+i*.05,1,.08,tone(midi,'keys'),(i-2)*.2);
// Short stereo echoes lend depth while preserving the rhythmic attack.
for(let i=left.length-1;i>Math.round(beat*.75*rate);i--){const delay=Math.round(beat*.75*rate);left[i]+=right[i-delay]*.14;right[i]+=left[i-delay]*.14;}
const wav=Buffer.alloc(44+left.length*4);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(left.length*4,40);
for(let i=0;i<left.length;i++){wav.writeInt16LE(Math.round(Math.tanh(left[i]*1.05)*27000),44+i*4);wav.writeInt16LE(Math.round(Math.tanh(right[i]*1.05)*27000),46+i*4);}
mkdirSync('backups/rhythm-game',{recursive:true});writeFileSync('backups/rhythm-game/pocket-day.wav',wav);
console.log(`Pocket Day: ${duration.toFixed(3)}s, ${rate}Hz stereo`);
