/* Local challenges, practice courses, training, medals, and replay samples. */
(function(root){
'use strict';
const G=root.GravityRun,RULES=2,DAY=86400000;
const TIMES=[[74,95,125],[92,118,150],[84,110,145],[103,132,170],[114,148,185],[136,174,220],[50,64,85],[60,76,100],[48,62,82],[43,56,76],[56,72,94],[80,102,135]];
const BADGES=[{id:'none',name:'Original',goal:''},{id:'sprout',name:'Sprout',goal:'clean campaign run'},{id:'star',name:'Star',goal:'Silver campaign medals'},{id:'gear',name:'Gear',goal:'clean Clockwork run'}];
const QUICK_RUNS=[{track:7,section:3,name:'Gate Dance',description:'Two readable beats. Find the rhythm.'},{track:9,section:1,name:'Perfect Landing',description:'Launch, land, and settle.'},{track:8,section:1,name:'Ribbon Run',description:'Smooth steering through the foundry.'},{track:10,section:1,name:'Dock Hop',description:'Watch the moving landing.'}];
const MEDALS=['Unranked','Bronze','Silver','Gold'];
const APPEARANCES=[
 {id:'ivory',name:'Ivory',color:[1,1,1],need:0,description:'Your original courier'},
 {id:'coral',name:'Coral',color:[1,.77,.65],need:1,description:'Earn your first mastery mark'},
 {id:'mint',name:'Mint',color:[.68,1,.86],need:4,description:'Earn 4 mastery marks'},
 {id:'sky',name:'Sky',color:[.68,.85,1],need:8,description:'Earn 8 mastery marks'},
 {id:'gold',name:'Gold',color:[1,.88,.53],need:14,description:'Earn 14 mastery marks'}
];
function medal(time,targets){return time<=targets[0]?3:time<=targets[1]?2:time<=targets[2]?1:0;}
function targets(course){return course.targets||TIMES[course.index];}
function nextGoal(run,record){
 const t=targets(run.course),rank=medal(run.elapsed,t);
 if(rank<3){const goal=rank===0?2:rank===1?1:0;return {label:'Retry for '+MEDALS[rank+1],detail:Math.max(.01,run.elapsed-t[goal]).toFixed(2)+'s to '+MEDALS[rank+1]};}
 if(!record||!record.clean)return {label:'Try a clean run',detail:'Finish without a recovery'};
 if(!record||!record.allCells)return {label:'Collect every cell',detail:'Take the detours and finish with a full set'};
 return {label:'Race your ghost',detail:'Find a faster line and improve your best'};
}
function clonePoint(q,s){return {p:q.p.slice(),width:q.width,bank:q.bank||0,section:q.section,gap:q.gap,s};}
function sliceCourse(index,section=0,options={}){
 const full=new G.Course(index),part=G.clamp(section,0,full.sections.length-1);
 let start=Math.max(0,full.sections[part].s-5),end=Math.min(full.total,options.single?(full.sections[part+1]?.s??full.total)+5:start+125);
 for(const gap of full.gaps){if(start>gap.start-10&&start<gap.end+5)start=Math.max(0,gap.start-12);if(end>gap.start-5&&end<gap.end+7)end=Math.min(full.total,gap.end+10);}
 const course=Object.create(G.Course.prototype);
 Object.assign(course,{index,expert:false,kind:'sprint',sourceStart:start,sourceSection:part,track:{...full.track,name:full.track.name+' / '+full.sections[part].name},points:[],sections:[],gates:[],gaps:[],checkpoints:[],cells:[],routes:[],platforms:[]});
 const sourceSections=full.sections.filter((s,i)=>s.s<end&&(i===full.sections.length-1||full.sections[i+1].s>start));
 for(const s of sourceSections)course.sections.push({...s,s:Math.max(0,s.s-start)});
 for(const s of [start,...full.points.filter(p=>p.s>start&&p.s<end).map(p=>p.s)]){const q=full.at(s),p=clonePoint(q,s-start);p.section=Math.max(0,sourceSections.indexOf(full.sections[q.section]));course.points.push(p);}
 const last=clonePoint(full.at(end),end-start);last.section=course.sections.length-1;course.points.push(last);course.total=end-start;
 course.gaps=full.gaps.filter(g=>g.start>=start&&g.end<=end).map(g=>({start:g.start-start,end:g.end-start}));
 course.gapStart=course.gaps[0]?.start??Infinity;course.gapEnd=course.gaps[0]?.end??Infinity;
 course.gates=full.gates.filter(g=>g.s>start+4&&g.s<end-5).map(g=>({...g,s:g.s-start}));
 course.cells=full.cells.filter(c=>c.s>start+4&&c.s<end-5).map(c=>({...c,s:c.s-start,route:undefined,taken:false}));
 if(index>=6){
  course.platforms=full.platforms.filter(p=>full.gaps[p.gap].start>=start&&full.gaps[p.gap].end<=end).map(p=>({...p,gap:course.gaps.findIndex(g=>Math.abs(g.start-(full.gaps[p.gap].start-start))<.001)}));
  course.routes=full.routes.filter(r=>r.start>=start&&r.end<=end).map(r=>({...r,start:r.start-start,end:r.end-start,first:course.at(r.start-start).index,last:course.at(r.end-start).index,points:r.points.map(p=>({...p,p:p.p.slice(),s:p.s-start,section:Math.max(0,sourceSections.indexOf(full.sections[p.section]))}))}));
  for(const cell of course.cells){const original=full.cells.find(c=>Math.abs(c.s-cell.s-start)<.001);if(course.routes.some(r=>r.id===original?.route))cell.route=original.route;}
 }
 course.checkpoints=[{s:2,label:'Start'},...course.sections.slice(1).filter(s=>s.s>18&&s.s<course.total-15&&!course.at(s.s+1).gap).map(s=>({s:s.s+1,label:s.name}))];
 course.expertCheckpoints=course.checkpoints.map(cp=>({...cp}));
 // Initial targets are generous estimates, to be tuned using real phone playtests.
 const base=course.total/4.7+course.gates.length*1.5+course.gaps.length*1.3;
 course.targets=[Math.ceil(base*1.2),Math.ceil(base*1.6),Math.ceil(base*2.2)];
 return course;
}
function trainingCourse(){
 const c=Object.create(G.Course.prototype);Object.assign(c,{index:0,expert:false,kind:'training',track:{...G.TRACKS[0],name:'Flight school',description:'Find your balance in four small steps.'},points:[],sections:[{s:0,name:'Training deck',hint:'Small movements are enough.'},{s:34,name:'Your first hop',hint:'Roll up the ramp and lift the phone gently.'}],gates:[],gaps:[{start:43,end:46}],gapStart:43,gapEnd:46,checkpoints:[{s:2,label:'Training deck'},{s:33,label:'Hop practice'}],cells:[],routes:[],platforms:[],total:62});
 for(let s=0;s<=62;s++){const y=s<34?6:s<=43?6+(s-34)*.2:s<=46?7.8-(s-43)*.1:7.5; c.points.push({p:[0,y,s],s,width:s<34?5.5:3.2,section:s<34?0:1,gap:s>=43&&s<46,bank:0});}
 c.expertCheckpoints=c.checkpoints.map(cp=>({...cp}));return c;
}
class Training{
 constructor(){this.stage=0;this.left=false;this.right=false;this.complete=false;this.stopped=0;this.hopped=false;}
 update(run,dt){
  if(this.stage===0&&run.progress>=8){this.stage=1;run.announce('checkpoint','Good. Now tilt back to stop.',1.4);}
  else if(this.stage===1){
   this.stopped=Math.hypot(run.velocity[0],run.velocity[2])<.6?this.stopped+dt:0;
   if(this.stopped>.25){this.stage=2;run.place(16);run.emit('recover');}
  }else if(this.stage===2){
   const offset=G.dot(G.sub(run.position,run.surface.p),run.surface.right);
   if(offset<-.7)this.left=true;if(offset>.7)this.right=true;
   if(this.left&&this.right){this.stage=3;run.checkpoint=1;run.place(33);run.emit('recover');}
  }else if(this.stage===3){
   if(run.events.some(e=>e.type==='jump'))this.hopped=true;
   if(this.hopped&&run.progress>48&&run.grounded){this.complete=true;run.finished=true;run.announce('finish','Ready for your first course',2);}
   else if(run.progress>56){run.place(33);run.emit('recover');}
  }
  if(this.stage<3&&run.progress>30){run.place(this.stage===0?2:16);run.emit('recover');}
 }
 get instruction(){return ['Tilt the top edge away to roll to the first marker.','Tip the top edge toward you. Bring the robot to a stop.','Lean left and right to reach both side markers.','Build speed on the ramp. Lift the phone briefly to hop.'][this.stage];}
 get title(){return ['01 / Roll forward','02 / Find the brakes','03 / Find your line','04 / Make your first hop'][this.stage];}
}
function dayKey(date=new Date()){return date.toISOString().slice(0,10);}
function validDay(day){return typeof day==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&dayKey(new Date(day))===day;}
function daily(day=dayKey()){
 if(!validDay(day))throw Error('Invalid challenge date.');
 const serial=Math.floor(Date.parse(day)/DAY);return {track:serial%6,section:1+Math.floor(serial/6)%4,expert:false,day,target:0};
}
function recentDays(date=new Date()){return Array.from({length:7},(_,i)=>dayKey(new Date(Date.parse(dayKey(date))-i*DAY)));}
function key(spec){return spec.day?'daily-'+spec.day:spec.section===null?'challenge-'+spec.track+'-'+(spec.expert?'e':'n'):'sprint-'+spec.track+'-'+spec.section;}
function encode(spec){return '#c='+[RULES,spec.track,spec.section===null?'full':spec.section,spec.expert?'e':'n',Math.round((spec.target||0)*1000),spec.day||''].join('~');}
function decode(hash){
 if(!hash||hash==='#')return null;
 if(hash.length>150||!hash.startsWith('#c='))throw Error('This challenge link is not valid.');
 const a=hash.slice(3).split('~');if(a.length!==6||a[0]!==String(RULES))throw Error('This challenge uses different rules. Ask your friend for a new link.');
 if(!/^(?:[0-9]|1[01])$/.test(a[1])||!(a[2]==='full'||/^[0-5]$/.test(a[2]))||!['n','e'].includes(a[3])||!/^\d{1,8}$/.test(a[4]))throw Error('This challenge link is not valid.');
 const spec={track:Number(a[1]),section:a[2]==='full'?null:Number(a[2]),expert:a[3]==='e',target:Number(a[4])/1000,day:a[5]||undefined};
 if(spec.target>7200||spec.section!==null&&spec.expert)throw Error('This challenge link is not valid.');
 if(spec.day){if(!validDay(spec.day))throw Error('This daily challenge date is not valid.');const expected=daily(spec.day);if(expected.track!==spec.track||expected.section!==spec.section||spec.expert)throw Error('This daily challenge does not match its date.');}
 return spec;
}
function resultAdvice(run,baseline){
 let best=null,prev=0,prior=0;
 for(let i=1;i<run.course.checkpoints.length;i++){const t=run.splits[i],b=baseline?.splits?.[i];if(Number.isFinite(t)&&Number.isFinite(b)){const loss=(t-prev)-(b-prior);if(loss>.15&&(!best||loss>best.loss)){const s=run.course.checkpoints[i-1].s;best={section:run.course.at(s).section,loss};}prev=t;prior=b;}else{prev=Number.isFinite(t)?t:0;prior=Number.isFinite(b)?b:0;}}
 if(best)return {section:best.section,detail:best.loss.toFixed(2)+'s lost versus your best in '+run.course.sections[best.section].name+'.'};
 const falls=Object.entries(run.sectionFalls||{}).sort((a,b)=>b[1]-a[1])[0];return falls?{section:Number(falls[0]),detail:falls[1]+' recoveries in '+run.course.sections[Number(falls[0])].name+'.'}:null;
}
function makeCourse(spec){const c=spec.section===null?new G.Course(spec.track,{expert:spec.expert}):sliceCourse(spec.track,spec.section);const quick=QUICK_RUNS.find(q=>q.track===spec.track&&q.section===spec.section);if(quick)c.track={...c.track,name:quick.name,description:quick.description};c.challenge=spec;return c;}
class Recorder{
 constructor(){this.samples=[];this.last=-1;this.full=false;}
 add(run){if(this.full||run.elapsed-this.last<.12)return;if(this.samples.length>=3000){this.full=true;return;}this.last=run.elapsed;this.samples.push([run.elapsed,...run.position,run.yaw].map(v=>Math.round(v*100)/100));}
 finish(){return this.full?null:this.samples;}
}
function ghostAt(samples,time){
 if(!samples||samples.length<2||time>samples[samples.length-1][0])return null;
 let lo=0,hi=samples.length-1;while(lo+1<hi){const mid=(lo+hi)>>1;if(samples[mid][0]<=time)lo=mid;else hi=mid;}
 const a=samples[lo],b=samples[hi],t=G.clamp((time-a[0])/(b[0]-a[0]||1),0,1),jump=Math.hypot(b[1]-a[1],b[2]-a[2],b[3]-a[3])>5;
 return {position:[1,2,3].map(i=>jump?a[i]:G.mix(a[i],b[i],t)),yaw:a[4]+Math.atan2(Math.sin(b[4]-a[4]),Math.cos(b[4]-a[4]))*t};
}
class Quality{
 constructor(){this.scale=1.65;this.slow=0;this.fast=0;}
 update(dt,setting='auto',active=true){
  if(setting!=='auto')return setting==='eco'?1:setting==='high'?2:1.5;
  if(active&&dt>0&&dt<.25){this.slow=dt>.027?this.slow+dt:Math.max(0,this.slow-dt);this.fast=dt<.019?this.fast+dt:0;if(this.slow>1.5){this.scale=Math.max(1,this.scale-.2);this.slow=0;}if(this.fast>8){this.scale=Math.min(1.75,this.scale+.1);this.fast=0;}}
  return this.scale;
 }
}
const api={RULES,TIMES,MEDALS,APPEARANCES,BADGES,QUICK_RUNS,resultAdvice,medal,targets,nextGoal,sliceCourse,trainingCourse,Training,dayKey,validDay,daily,recentDays,key,encode,decode,makeCourse,Recorder,ghostAt,Quality};
root.GravityJourney=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
