import React,{useEffect,useState} from 'react';
import {
  BookOpen, ClipboardCheck, FileText, GraduationCap, LayoutDashboard, LogOut, Plus,
  ShieldCheck, UserRound, Users, ChevronLeft, CheckCircle2, CircleX,
  Printer, Download, Pencil, Save, LockKeyhole, RefreshCw, ListChecks, CalendarClock
} from 'lucide-react';
import {app,auth,db} from './firebase';
import {initializeApp,getApps} from 'firebase/app';
import {getAuth,inMemoryPersistence,setPersistence,deleteUser} from 'firebase/auth';
import {importProgramBundle,readProgramBundle,type ImportProgress} from './programImport';
import InstallAppButton from './InstallAppButton';
import type {Assessment,Answer,AnswerMap,Child,Domain,Goal,PlanItem,Profile,Program} from './types';
import {saveWord,type ExportPlan} from './export';
import {
  createUserWithEmailAndPassword,onAuthStateChanged,sendPasswordResetEmail,signInWithEmailAndPassword,signOut,
  type User
} from 'firebase/auth';
import {
  addDoc,collection,doc,getDoc,getDocs,onSnapshot,query,serverTimestamp,setDoc,
  Timestamp,where,writeBatch
} from 'firebase/firestore';

type Tab='home'|'children'|'assessments'|'plans'|'admin';
const ADMIN_EMAIL = 'nadaelgendy1180@gmail.com';
const MONTH_MILLIS = 30 * 86400000;
const remainingText = (expiry?:Timestamp, now=Date.now()):string => {
  if(!expiry)return 'لم يُحدد';
  const remain=expiry.toMillis()-now;
  if(remain<=0)return 'منتهي';
  return remain<86400000 ? `${Math.max(1,Math.ceil(remain/3600000))} ساعة` : `${Math.ceil(remain/86400000)} يوم`;
};
function subscriberStatus(p:Profile,now=Date.now()){
  if(p.role==='admin')return 'admin';
  if(p.state==='blocked')return 'blocked';
  if(p.state==='pending')return 'pending';
  return p.state==='active' && (p.subscriptionExpiresAt?.toMillis()||0)>now ? 'active' : 'expired';
}

type AuditLog={id:string;at?:Timestamp;action?:string;actorUid?:string;actorName?:string;goalId?:string};
type RenewalRequest={id:string;uid:string;email:string;name:string;status:'pending'|'resolved';requestedAt?:Timestamp;resolvedAt?:Timestamp};
const nowDate=()=>new Date().toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric'});
const dateFrom=(t?:Timestamp)=>t?.toDate().toLocaleDateString('ar-EG')||'—';
const message=(e:unknown)=>e instanceof Error ?e.message:'حدث خطأ غير متوقع';
function Logo(){return <span className="brand-logo"><img src="/app-icon-192.png" alt="شعار منصة Spark Edu" width={46} height={46}/></span>;}
function Pill({children,kind='muted'}:{children:React.ReactNode;kind?:'muted'|'good'|'bad'|'gold'}){return <span className={'pill '+kind}>{children}</span>;}
function Empty({title,desc}:{title:string;desc:string}){return <div className="empty"><div className="empty-symbol"><BookOpen size={30}/></div><h3>{title}</h3><p>{desc}</p></div>;}

function AuthScreen(){
 const [mode,setMode]=useState<'login'|'signup'>('login');
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{
   if(mode==='signup'){
    if(name.trim().length<3)throw new Error('الاسم يجب أن يتكون من 3 أحرف على الأقل.');
    const res=await createUserWithEmailAndPassword(auth,email.trim(),password);
    await setDoc(doc(db,'users',res.user.uid),{name:name.trim(),email:res.user.email,
      role:'specialist',state:'pending',subscriptionExpiresAt:Timestamp.fromMillis(0),
      createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
   }else await signInWithEmailAndPassword(auth,email.trim(),password);
  }catch(e){setError(message(e));}finally{setBusy(false);}
 }
 async function reset(){if(!email){setError('اكتب بريدك الإلكتروني أولًا');return;}
  try{await sendPasswordResetEmail(auth,email.trim());setError('أُرسل رابط استعادة كلمة المرور إلى بريدك.');}
  catch(e){setError(message(e));}}
 return <div className="auth-layout">
  <section className="auth-visual"><div className="glow glow-one"/><div className="glow glow-two"/>
   <div className="auth-logo"><Logo/><strong>Spark <em>Edu</em></strong></div>
   <div className="auth-pitch"><span className="eyebrow light">منصة تعليمية احترافية</span>
    <h1>تقييم أدقّ.<br/><span>تقدّم أوضح.</span></h1>
    <p>برامج متخصصة في التقييم والتدخل المبكر، وخطط تربوية فردية منظمة في مساحة عمل واحدة.</p>
    <div className="features"><span><ShieldCheck size={17}/> بيانات محمية</span><span><ClipboardCheck size={17}/> تقييم حسب المجالات</span><span><FileText size={17}/> خطط قابلة للتصدير</span></div>
    <div className="auth-images"><img src="/center-logo.jpeg" alt="شعار مركز حكاية طفل"/><img src="/center-photo.jpeg" alt="صورة الجهة التعليمية"/></div>
   </div><span className="auth-foot">SPARK EDU • 2026</span>
  </section>
  <section className="auth-form"><div className="auth-card">
   <div className="mobile-brand-showcase">
    <img className="mobile-center-photo" src="/center-photo.jpeg" alt="صورة مركز حكاية طفل"/>
    <div className="mobile-brand-copy"><img src="/center-logo.jpeg" alt="شعار مركز حكاية طفل"/><span>منصة Spark Edu<br/>للتقييم والتأهيل</span></div>
   </div>
   <div className="mobile-mark"><Logo/><strong>Spark Edu</strong></div>
   <span className="eyebrow">مرحبًا بك</span><h2>{mode==='login'?'سجّل دخولك':'أنشئ حسابك'}</h2>
   <p className="subtle">{mode==='login'?'ابدأ التقييم وأكمل خطط الأطفال من آخر نقطة.':'بعد التسجيل، فعّل اشتراكك من إدارة المنصة.'}</p>
   <form onSubmit={submit}>
    {mode==='signup'&&<label>الاسم الكامل<input required value={name} onChange={e=>setName(e.target.value)} placeholder="الاسم كما يظهر في التقارير"/></label>}
    <label>البريد الإلكتروني<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="example@email.com" dir="ltr"/></label>
    <label>كلمة المرور<input required minLength={6} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="6 أحرف على الأقل" dir="ltr"/></label>
    {error&&<p className="error">{error}</p>}
    <button className="btn primary wide" disabled={busy}>{busy?'جارٍ التنفيذ...':mode==='login'?'تسجيل الدخول':'إنشاء الحساب'}<ChevronLeft size={18}/></button>
   </form>
   <div className="auth-bottom">
    <button className="link" type="button" onClick={()=>{setMode(mode==='login'?'signup':'login');setError('');}}>{mode==='login'?'ليس لديك حساب؟ أنشئ حسابًا':'لديك حساب؟ سجّل دخولك'}</button>
    {mode==='login'&&<button className="link" type="button" onClick={reset}>نسيت كلمة المرور؟</button>}
   </div>
   <div className="auth-install"><InstallAppButton/></div>
  </div></section>
 </div>;
}

export default function App(){
 const [user,setUser]=useState<User|null>(null);
 const [loading,setLoading]=useState(true),[profile,setProfile]=useState<Profile|null>(null);
 const [profileMissing,setProfileMissing]=useState(false);
 const [tab,setTab]=useState<Tab>('home'),[toast,setToast]=useState('');
 const [children,setChildren]=useState<Child[]>([]),[programs,setPrograms]=useState<Program[]>([]);
 const [assessments,setAssessments]=useState<Assessment[]>([]);
 const [users,setUsers]=useState<Profile[]>([]),[audits,setAudits]=useState<AuditLog[]>([]);
 const [renewals,setRenewals]=useState<RenewalRequest[]>([]),[renewalRequested,setRenewalRequested]=useState(false);
 const [renewalBusy,setRenewalBusy]=useState(false);
 const [childName,setChildName]=useState(''),[birthDate,setBirthDate]=useState(''),[childNotes,setChildNotes]=useState('');
 const [busy,setBusy]=useState(false);
 const [now,setNow]=useState(Date.now());
 const [newSubscriberName,setNewSubscriberName]=useState(''),[newSubscriberEmail,setNewSubscriberEmail]=useState('');
 const [newSubscriberPassword,setNewSubscriberPassword]=useState('');
 const [subscriberBusy,setSubscriberBusy]=useState(false),[subscriberSearch,setSubscriberSearch]=useState('');
 const [subscriberFilter,setSubscriberFilter]=useState<'all'|'active'|'pending'|'expired'|'blocked'>('all');
 const [importFile,setImportFile]=useState<File|null>(null);
 const [importBusy,setImportBusy]=useState(false),[importProgress,setImportProgress]=useState<ImportProgress|null>(null);
 const [reviewedImport,setReviewedImport]=useState(false);

 const [chosenChild,setChosenChild]=useState(''),[chosenProgram,setChosenProgram]=useState('');
 const [active,setActive]=useState<Assessment|null>(null),[domains,setDomains]=useState<Domain[]>([]);
 const [selectedDomain,setSelectedDomain]=useState(''),[goals,setGoals]=useState<Goal[]>([]);
 const [answers,setAnswers]=useState<AnswerMap>({}),[saving,setSaving]=useState('');
 const [pendingWrites,setPendingWrites]=useState<number>(0);
 const [plan,setPlan]=useState<ExportPlan|null>(null);
 const [planAssessmentId,setPlanAssessmentId]=useState('');
 const [allPlanItems,setAllPlanItems]=useState<PlanItem[]>([]);
 const [adminProgram,setAdminProgram]=useState(''),[newProgramName,setNewProgramName]=useState('');
 const [newDomainName,setNewDomainName]=useState(''),[newGoalText,setNewGoalText]=useState('');
 const admin=profile?.role==='admin';
 const enabled=!!(admin||(profile?.state==='active' && (profile.subscriptionExpiresAt?.toMillis() ?? 0) > now));
 const subscriptions=users.filter(u=>u.role!=='admin');
 const filteredSubscriptions=subscriptions.filter(u=>(subscriberFilter==='all'||subscriberStatus(u,now)===subscriberFilter)
   && `${u.name} ${u.email}`.toLowerCase().includes(subscriberSearch.toLowerCase()));
 const expiringSoon=subscriptions.filter(u=>subscriberStatus(u,now)==='active' &&
   (u.subscriptionExpiresAt?.toMillis()||0)-now <= 7*86400000).length;
 const nearExpiry=!admin&&enabled&&(profile?.subscriptionExpiresAt?.toMillis()||0)-now <= 7*86400000;

 const banner=(txt:string)=>{setToast(txt);setTimeout(()=>setToast(''),4300);};
 useEffect(()=>onAuthStateChanged(auth,u=>{setUser(u);setLoading(false);}),[]);
 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),30000);return()=>window.clearInterval(timer);},[]);

 useEffect(()=>{
  if(!user){setProfile(null);setProfileMissing(false);return;}
  return onSnapshot(doc(db,'users',user.uid),snap=>{
   if(!snap.exists()){
    // Do not create a second profile here: the sign-up flow creates it.
    // It would race with sign-up and could overwrite the submitted name.
    setProfile(null);
    setProfileMissing(true);
   }else {setProfileMissing(false);setProfile({id:snap.id,...snap.data()} as Profile);}
  },e=>banner(message(e)));
 },[user?.uid]);
 useEffect(()=>{
  if(!user||!enabled)return;
  const un1=onSnapshot(query(collection(db,'children'),where('ownerUid','==',user.uid)),snap=>
   setChildren(snap.docs.map(d=>({id:d.id,...d.data()} as Child))),e=>banner(message(e)));
  const un2=onSnapshot(query(collection(db,'assessments'),where('ownerUid','==',user.uid)),snap=>
   setAssessments(snap.docs.map(d=>({id:d.id,...d.data()} as Assessment)).sort((a,b)=>(b.createdAt?.toMillis()||0)-(a.createdAt?.toMillis()||0))),e=>banner(message(e)));
  const un3=onSnapshot(collection(db,'programs'),snap=>setPrograms(snap.docs.map(d=>({id:d.id,...d.data()} as Program))),e=>banner(message(e)));
  return ()=>{un1();un2();un3();};
 },[user?.uid,enabled]);
 useEffect(()=>{
  if(!user){setRenewalRequested(false);return;}
  return onSnapshot(doc(db,'renewalRequests',user.uid),snap=>setRenewalRequested(snap.exists()&&snap.data().status==='pending'),()=>{});
 },[user?.uid]);
 useEffect(()=>{
  if(!admin)return;
  const a=onSnapshot(collection(db,'users'),snap=>setUsers(snap.docs.map(d=>({id:d.id,...d.data()} as Profile))),e=>banner(message(e)));
  const b=onSnapshot(collection(db,'auditLogs'),snap=>setAudits(snap.docs.map(d=>({id:d.id,...d.data()} as AuditLog)).sort((x,y)=>(y.at?.toMillis()||0)-(x.at?.toMillis()||0)).slice(0,25)),e=>banner(message(e)));
  const c=onSnapshot(collection(db,'renewalRequests'),snap=>setRenewals(snap.docs.map(d=>({id:d.id,...d.data()} as RenewalRequest)).filter(r=>r.status==='pending')),
   e=>{setRenewals([]);banner(e.code==='permission-denied'?'تعذر قراءة طلبات التجديد: راجعي قواعد Firestore المنشورة وصلاحية المدير (role: admin).':'تعذر تحميل طلبات التجديد: '+message(e));});
  return ()=>{a();b();c();};
 },[admin]);
 useEffect(()=>{
  if(!active){setDomains([]);setSelectedDomain('');setGoals([]);return;}
  getDocs(collection(db,'programs',active.programId,'domains')).then(snap=>{
   const list=snap.docs.map(d=>({id:d.id,...d.data()} as Domain)).sort((a,b)=>a.order-b.order);
   setDomains(list);setSelectedDomain(list[0]?.id||'');
  }).catch(e=>banner(message(e)));
 },[active?.id]);
 useEffect(()=>{
  if(!active||!selectedDomain)return;
  let valid=true;
  Promise.all([
   getDocs(collection(db,'programs',active.programId,'domains',selectedDomain,'goals')),
   getDoc(doc(db,'assessments',active.id,'responses',selectedDomain))
  ]).then(([g,r])=>{if(!valid)return;
   setGoals(g.docs.map(d=>({id:d.id,...d.data()} as Goal)).sort((a,b)=>a.order-b.order));
   setAnswers((r.data()?.values||{}) as AnswerMap);
  }).catch(e=>banner(message(e)));
  return()=>{valid=false;};
 },[active?.id,selectedDomain]);
 const visibleGoals=admin?goals:goals.filter(g=>g.approved);
 const selectedProgramName=programs.find(p=>p.id===chosenProgram)?.name||'';
 const totalAnswer=Object.values(answers).filter(Boolean).length;
 function changeTab(next:Tab){setTab(next);setActive(null);setPlan(null);}
 async function addChild(e:React.FormEvent){
  e.preventDefault();if(!user||!enabled||!childName.trim())return;setBusy(true);
  try{await addDoc(collection(db,'children'),{name:childName.trim(),dateOfBirth:birthDate,notes:childNotes,
   ownerUid:user.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
   setChildName('');setBirthDate('');setChildNotes('');banner('تم حفظ ملف الطفل بنجاح');}
  catch(e){banner(message(e));}finally{setBusy(false);}
 }
 async function startAssessment(){
  if(!user||!chosenChild||!chosenProgram){banner('اختر الطفل والبرنامج أولًا');return;}
  const child=children.find(c=>c.id===chosenChild);
  setBusy(true);
  try{
   const record=await addDoc(collection(db,'assessments'),{ownerUid:user.uid,childId:chosenChild,childName:child?.name||'',
    programId:chosenProgram,programName:selectedProgramName,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
   setActive({id:record.id,ownerUid:user.uid,childId:chosenChild,childName:child?.name||'',
    programId:chosenProgram,programName:selectedProgramName});setTab('assessments');
  }catch(e){banner(message(e));}finally{setBusy(false);}
 }
 async function chooseAnswer(goal:Goal,status:Answer){
  if(!active||!selectedDomain)return;
  const ref=doc(db,'assessments',active.id,'responses',selectedDomain);
  setAnswers(previous=>({...previous,[goal.id]:status}));
  setSaving(goal.id);setPendingWrites(count=>count+1);
  try{
   // Merge only this field, never a stale copy of the entire response map.
   await setDoc(ref,{values:{[goal.id]:status},updatedAt:serverTimestamp()},{merge:true});
  }catch(e){banner('تعذر حفظ الإجابة: '+message(e));
   // Reload authoritative answers instead of leaving a false saved state.
   try{const saved=await getDoc(ref);setAnswers((saved.data()?.values||{}) as AnswerMap);}catch{}
  }finally{setPendingWrites(count=>Math.max(0,count-1));setSaving(v=>v===goal.id?'':v);}
 }
 async function saveGoal(goal:Goal,updatedText:string,approved:boolean){
  if(!admin||!active||!selectedDomain||!user)return;
  try{
   const ref=doc(db,'programs',active.programId,'domains',selectedDomain,'goals',goal.id);
   const batch=writeBatch(db);batch.update(ref,{text:updatedText,approved,needsReview:!approved,updatedAt:serverTimestamp(),updatedBy:user.uid});
   batch.set(doc(collection(db,'auditLogs')),{action:'goal_updated',actorUid:user.uid,actorName:profile?.name,
    programId:active.programId,domainId:selectedDomain,goalId:goal.id,before:goal.text,after:updatedText,approved,at:serverTimestamp()});
   await batch.commit();setGoals(old=>old.map(x=>x.id===goal.id?{...x,text:updatedText,approved,needsReview:!approved}:x));banner('تم تحديث الهدف وتسجيل التعديل');
  }catch(e){banner(message(e));}
 }
 async function approveDomain(){
  if(!admin||!active||!selectedDomain||!user)return;
  const unapproved=goals.filter(g=>!g.approved);
  if(!unapproved.length){banner('كل البنود معتمدة بالفعل');return;}
  if(!window.confirm(`تأكد أنك راجعت نصوص وحقوق استخدام ${unapproved.length} هدفًا. هل تعتمد هذا المجال؟`))return;
  try{
   const batch=writeBatch(db);
   for(const goal of unapproved)batch.update(doc(db,'programs',active.programId,'domains',selectedDomain,'goals',goal.id),{approved:true,needsReview:false,updatedAt:serverTimestamp(),updatedBy:user.uid});
   batch.set(doc(collection(db,'auditLogs')),{action:'domain_approved_after_review',actorUid:user.uid,actorName:profile?.name||'',programId:active.programId,domainId:selectedDomain,count:unapproved.length,at:serverTimestamp()});
   await batch.commit();setGoals(old=>old.map(g=>({...g,approved:true,needsReview:false})));banner('تم اعتماد أهداف المجال بعد المراجعة');
  }catch(e){banner(message(e));}
 }
 async function createPlan(a:Assessment){
  if(pendingWrites>0){banner('جارٍ حفظ الإجابات، أكمل بعد ظهور الحفظ');return;}
  setBusy(true);setPlan(null);
  try{
   const domainsSnap=await getDocs(collection(db,'programs',a.programId,'domains'));
   const results=await Promise.all(domainsSnap.docs.map(async ds=>{
    const [gs,rs]=await Promise.all([getDocs(collection(db,'programs',a.programId,'domains',ds.id,'goals')),
     getDoc(doc(db,'assessments',a.id,'responses',ds.id))]);
    const values=(rs.data()?.values||{}) as AnswerMap;
    return gs.docs.filter(g=>g.data().approved&&values[g.id]==='not_mastered')
     .map(g=>({domain:ds.data().name||'',code:g.data().code||'',text:g.data().text||''} as PlanItem));
   }));
   const items=results.flat();
   const saved=await getDoc(doc(db,'plans',a.id));
   const notes=Object.fromEntries(((saved.data()?.items||[]) as PlanItem[]).map((p:PlanItem)=>[p.domain+'|'+p.code+'|'+p.text,p.note||'']));
   const result=items.map(g=>({...g,note:notes[g.domain+'|'+g.code+'|'+g.text]||''}));
   setAllPlanItems(result);setPlanAssessmentId(a.id);setPlan({child:a.childName,program:a.programName,date:nowDate(),assessor:profile?.name||'',items:result});setTab('plans');
  }catch(e){banner(message(e));}finally{setBusy(false);}
 }
 async function savePlan(){
  if(!user||!plan)return;
  try{await setDoc(doc(db,'plans',planAssessmentId),
   {ownerUid:user.uid,childName:plan.child,programName:plan.program,assessor:plan.assessor,
    items:allPlanItems,updatedAt:serverTimestamp()},{merge:true});
   banner('تم حفظ مسودة الخطة على حسابك');}
  catch(e){banner(message(e));}
 }
 function finalPlan():ExportPlan|null{return plan?{...plan,items:allPlanItems}:null;}
 async function requestRenewal(){
  if(!user||!profile||renewalRequested||renewalBusy)return;
  setRenewalBusy(true);
  try{
   await setDoc(doc(db,'renewalRequests',user.uid),{
    uid:user.uid,name:profile.name,email:profile.email,
    status:'pending',requestedAt:serverTimestamp(),
   });
   setRenewalRequested(true);
   banner('تم إرسال طلب التجديد إلى لوحة الإدارة');
  }catch(e){banner('تعذر إرسال الطلب: '+message(e));}
  finally{setRenewalBusy(false);}
 }
 async function fulfillRenewal(request:RenewalRequest){
  if(!admin||!user)return;
  const target=users.find(u=>u.id===request.uid);
  if(!target){banner('تعذر إيجاد حساب صاحب الطلب');return;}
  if(!window.confirm(`تجديد اشتراك ${target.name} لمدة 30 يومًا؟`))return;
  setBusy(true);
  try{
   const expiry=Timestamp.fromMillis(Math.max(Date.now(),target.subscriptionExpiresAt?.toMillis()||0)+MONTH_MILLIS);
   const batch=writeBatch(db);
   batch.update(doc(db,'users',target.id),{state:'active',subscriptionExpiresAt:expiry,updatedAt:serverTimestamp()});
   batch.update(doc(db,'renewalRequests',request.id),{status:'resolved',resolvedAt:serverTimestamp()});
   batch.set(doc(collection(db,'auditLogs')),{action:'renewal_request_approved',actorUid:user.uid,
    actorName:profile?.name||'',targetUid:request.uid,until:expiry,at:serverTimestamp()});
   await batch.commit();banner('تم تجديد الاشتراك وإغلاق طلب التجديد');
  }catch(e){banner(message(e));}
  finally{setBusy(false);}
 }
 async function createSubscriber(e:React.FormEvent){
  e.preventDefault();
  if(!admin||!user||subscriberBusy)return;
  const name=newSubscriberName.trim();
  const email=newSubscriberEmail.trim().toLowerCase();
  if(name.length<3||!email.includes('@')||newSubscriberPassword.length<10){
   banner('اكتبي اسمًا كاملًا وبريدًا صحيحًا وكلمة مرور من 10 أحرف على الأقل');return;
  }
  if(!window.confirm(`إنشاء حساب ${name} وتفعيله لمدة 30 يومًا؟`))return;
  setSubscriberBusy(true);
  // A separate, in-memory Auth instance prevents signing the administrator out.
  const secondaryApp=getApps().find(a=>a.name==='spark-edu-provisioning')
   ||initializeApp(app.options,'spark-edu-provisioning');
  const secondaryAuth=getAuth(secondaryApp);
  try{
   await setPersistence(secondaryAuth,inMemoryPersistence);
   const result=await createUserWithEmailAndPassword(secondaryAuth,email,newSubscriberPassword);
   try{
    await setDoc(doc(db,'users',result.user.uid),{
     name,email,role:'specialist',state:'active',
     subscriptionExpiresAt:Timestamp.fromMillis(Date.now()+MONTH_MILLIS),
     createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
    });
   }catch(e){
    // Prevent an orphaned sign-in if the Firestore profile cannot be written.
    try{await deleteUser(result.user);}catch{}
    throw e;
   }
   setNewSubscriberName('');setNewSubscriberEmail('');setNewSubscriberPassword('');
   banner('تم إنشاء المشترك وبدء اشتراكه لمدة 30 يومًا');
  }catch(e){banner('تعذر إنشاء المشترك: '+message(e));}
  finally{
   try{await signOut(secondaryAuth);}catch{}
   setNewSubscriberPassword('');setSubscriberBusy(false);
  }
 }
 async function uploadPrograms(){
  if(!admin||!importFile||importBusy)return;
  setImportBusy(true);setImportProgress(null);
  try{
   const data=await readProgramBundle(importFile);
   const count=data.programs.reduce((n,p)=>n+p.domains.reduce((m,d)=>m+d.goals.length,0),0);
   if(!window.confirm(`سيتم استيراد ${data.programs.length} برامج و${count} هدفًا. ${reviewedImport?'سيتم اعتماد الأهداف الجديدة بناءً على إقرارك بالمراجعة.':'الأهداف غير المراجعة ستبقى غير معتمدة.'} استكمال؟`))return;
   const result=await importProgramBundle(db,data,setImportProgress,reviewedImport);
   banner(`اكتمل الاستيراد: ${result.goalsAdded} هدفًا جديدًا، و${result.goalsExisting} هدفًا موجودًا لم يُعدّل`);
  }catch(e){banner('فشل الاستيراد: '+message(e));}
  finally{setImportBusy(false);}
 }
 async function updateSubscription(p:Profile,action:'activate'|'block'){
  if(!admin||!user)return;
  try{
   const expiry=action==='activate'?Timestamp.fromMillis(Math.max(Date.now(),p.subscriptionExpiresAt?.toMillis()||0)+MONTH_MILLIS):p.subscriptionExpiresAt||Timestamp.fromMillis(0);
   const batch=writeBatch(db);
   batch.update(doc(db,'users',p.id),{state:action==='activate'?'active':'blocked',subscriptionExpiresAt:expiry,updatedAt:serverTimestamp()});
   batch.set(doc(collection(db,'auditLogs')),{action:action==='activate'?'subscription_extended':'user_blocked',actorUid:user.uid,
    actorName:profile?.name||'',targetUid:p.id,at:serverTimestamp(),until:expiry});
   await batch.commit();banner('تم تحديث الاشتراك');
  }catch(e){banner(message(e));}
 }
 async function addProgram(){
  if(!admin||!newProgramName.trim())return;
  const id='program-'+Math.random().toString(36).slice(2,9);
  try{await setDoc(doc(db,'programs',id),{name:newProgramName.trim(),createdAt:serverTimestamp()});
   setNewProgramName('');banner('تم إنشاء البرنامج');}catch(e){banner(message(e));}
 }
 async function addDomain(){
  if(!admin||!adminProgram||!newDomainName.trim())return;
  try{const domainId='domain-'+Math.random().toString(36).slice(2,9);
   await setDoc(doc(db,'programs',adminProgram,'domains',domainId),{name:newDomainName.trim(),order:Date.now(),createdAt:serverTimestamp()});
   setNewDomainName('');setAdminDomains(old=>[...old,{id:domainId,name:newDomainName.trim(),order:Date.now()}]);banner('تمت إضافة المجال');}catch(e){banner(message(e));}
 }
 const [adminDomains,setAdminDomains]=useState<Domain[]>([]),[adminDomain,setAdminDomain]=useState('');
 useEffect(()=>{if(!adminProgram){setAdminDomains([]);return;}
  getDocs(collection(db,'programs',adminProgram,'domains')).then(s=>setAdminDomains(s.docs.map(d=>({id:d.id,...d.data()} as Domain)).sort((a,b)=>a.order-b.order))).catch(e=>banner(message(e)));
 },[adminProgram]);
 async function addGoal(){
  if(!admin||!adminProgram||!adminDomain||!newGoalText.trim())return;
  try{const g=doc(collection(db,'programs',adminProgram,'domains',adminDomain,'goals'));
   await setDoc(g,{text:newGoalText.trim(),code:'',order:Date.now(),approved:true,needsReview:false,updatedAt:serverTimestamp()});
   setNewGoalText('');banner('تمت إضافة الهدف');}catch(e){banner(message(e));}
 }
 if(loading)return <div className="loading"><Logo/><p>جارٍ فتح Spark Edu…</p></div>;
 if(!user)return <AuthScreen/>;
 if(!profile)return <div className="loading"><Logo/><p>{profileMissing?'حسابك لا يحتوي على ملف صلاحيات؛ إن أنشأت الحساب للتو انتظر اكتمال التسجيل، وإلا راجع مدير المنصة.':'جارٍ إعداد الحساب…'}</p><button className="btn" onClick={()=>signOut(auth)}>تسجيل الخروج</button></div>;
 if(!enabled)return <div className="activation">
  <div className="activation-card"><Logo/><span className="eyebrow">Spark Edu</span>
   <div className="lock"><LockKeyhole size={38}/></div>
   <h1>{profile.state==='blocked'?'الحساب موقوف':profile.state==='active'?'انتهت مدة الاشتراك':'حسابك في انتظار التفعيل'}</h1>
   <p>مرحبًا {profile.name}، {profile.state==='active'?'انتهى اشتراكك الشهري. بياناتك محفوظة، ويمكنك استعادة استخدام جميع أقسام المنصة فور تجديد الاشتراك من الإدارة.':profile.state==='blocked'?'الحساب موقوف حاليًا، تواصلي مع الإدارة لمعرفة سبب الإيقاف.':'حسابك مسجل وبانتظار تفعيل اشتراكه من الإدارة.'}</p>
   <Pill kind="gold">{profile.state==='active'?`تاريخ الانتهاء: ${dateFrom(profile.subscriptionExpiresAt)}`:'التفعيل من إدارة المنصة'}</Pill>
   <button className="btn primary wide" style={{marginTop:14}} onClick={requestRenewal} disabled={renewalRequested||renewalBusy}>
    {renewalRequested?'طلب التجديد وصل للإدارة':renewalBusy?'جارٍ إرسال الطلب':'إرسال طلب تجديد للإدارة'}</button>
   <p className="hint">للتواصل المباشر: <a href={`mailto:${ADMIN_EMAIL}`}>{ADMIN_EMAIL}</a></p>
   <Pill kind="gold">البريد: {profile.email}</Pill>
   <button className="btn primary wide" style={{marginTop:26}} onClick={()=>signOut(auth)}>العودة لتسجيل الدخول</button>
  </div>
 </div>;
 return <div className="shell">
  <aside className="sidebar">
   <div className="side-head"><Logo/><div><strong>Spark Edu</strong><small>منصة التقييم والتأهيل</small></div></div>
   <div className="side-group">القائمة الرئيسية</div>
   {([
    ['home','الرئيسية',LayoutDashboard],['children','ملفات الأطفال',Users],
    ['assessments','التقييمات',ClipboardCheck],['plans','الخطط التربوية',FileText],
    ...(admin?[['admin','إدارة المنصة',ShieldCheck]]:[])
   ] as [Tab,string,typeof LayoutDashboard][]).map(([key,label,Icon])=><button key={key}
    className={'nav-btn '+(tab===key?'on':'')} onClick={()=>changeTab(key)}><Icon size={19}/><span>{label}</span></button>)}
   <div className="side-grow"/><div className="account">
    <div className="avatar">{profile.name.slice(0,1)}</div><div className="account-info"><strong>{profile.name}</strong><small>{admin?'مدير المنصة':'أخصائي • اشتراك نشط'}</small></div>
    <button title="خروج" className="icon-btn" onClick={()=>signOut(auth)}><LogOut size={18}/></button>
   </div>
  </aside>
  <main className="main">
   <div className="topbar"><div className="breadcrumbs">منصة Spark Edu <ChevronLeft size={15}/> {({home:'الرئيسية',children:'ملفات الأطفال',assessments:'التقييمات',plans:'الخطط التربوية',admin:'إدارة المنصة'} as Record<Tab,string>)[tab]}</div>
    <div className="topbar-actions"><InstallAppButton compact/><Pill kind={nearExpiry?'gold':'good'}>{admin?'حساب إداري':`الاشتراك: ${remainingText(profile.subscriptionExpiresAt,now)} متبقية`}</Pill></div></div>
   {nearExpiry&&<div className="renewal-notice"><CalendarClock size={19}/>
    <span>اشتراكك ينتهي خلال {remainingText(profile.subscriptionExpiresAt,now)}. تواصلي مع الإدارة لتجديده دون فقدان بياناتك.</span>
    <button className="link" disabled={renewalRequested||renewalBusy} onClick={requestRenewal}>{renewalRequested?'طلبك قيد المتابعة':'طلب التجديد'}</button>
   </div>}
   {tab==='home'&&<section>
    <div className="hero"><div><span className="eyebrow light">مساحة عملك التعليمية</span><h1>أهلًا بك، {profile.name.split(' ')[0]}</h1>
     <p>رتّب ملفات الأطفال، وابدأ تقييمًا جديدًا، وحوّل المهارات غير المتقنة إلى خطة عملية.</p>
     <button className="btn white" onClick={()=>changeTab('assessments')}>ابدأ التقييم <ChevronLeft size={18}/></button></div>
     <div className="hero-art"><div className="hero-brand-images"><img className="hero-photo" src="/center-photo.jpeg" alt="صورة مركز حكاية طفل"/><img className="hero-center-logo" src="/center-logo.jpeg" alt="شعار مركز حكاية طفل"/></div><span>SPARK EDU</span></div></div>
    <div className="stat-grid">
     <div className="stat"><div className="stat-icon mint"><Users size={22}/></div><div><small>ملفات الأطفال</small><strong>{children.length}</strong></div></div>
     <div className="stat"><div className="stat-icon cream"><BookOpen size={22}/></div><div><small>البرامج المتاحة</small><strong>{programs.length}</strong></div></div>
     <div className="stat"><div className="stat-icon blue"><ListChecks size={22}/></div><div><small>التقييمات المسجلة</small><strong>{assessments.length}</strong></div></div>
    </div>
    <div className="section-head"><h2>آخر التقييمات</h2><button className="link" onClick={()=>changeTab('assessments')}>عرض جميع التقييمات</button></div>
    <div className="panel">{assessments.length?assessments.slice(0,5).map(a=><div className="list-row" key={a.id}>
     <span className="list-icon"><ClipboardCheck size={19}/></span><div className="grow"><strong>{a.childName}</strong><small>{a.programName} • {dateFrom(a.createdAt)}</small></div>
     <button className="btn small ghost" onClick={()=>{setTab('assessments');setActive(a);}}>متابعة</button>
    </div>):<Empty title="مافيش تقييمات لسه" desc="أضف ملف طفل ثم ابدأ أول تقييم من البرامج المتاحة."/>}</div>
   </section>}
   {tab==='children'&&<section>
    <div className="page-title"><span className="eyebrow">تنظيم البيانات</span><h1>ملفات الأطفال</h1><p>ملف مستقل لكل طفل لربط التقييمات والخطط به.</p></div>
    <div className="two-col"><div className="panel pad"><h3><Plus size={20}/> إضافة طفل جديد</h3>
     <form className="stack" onSubmit={addChild}>
      <label>اسم الطفل<input required value={childName} onChange={e=>setChildName(e.target.value)} placeholder="الاسم الكامل"/></label>
      <label>تاريخ الميلاد<input type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)}/></label>
      <label>ملاحظات أولية<textarea rows={4} value={childNotes} onChange={e=>setChildNotes(e.target.value)} placeholder="ملاحظات اختيارية..."/></label>
      <button className="btn primary" disabled={busy}>حفظ ملف الطفل <Plus size={17}/></button>
     </form>
    </div><div className="panel pad"><div className="section-head"><h3>الأطفال المسجلون</h3><Pill>{children.length} ملف</Pill></div>
     {children.length?children.map(c=><div key={c.id} className="list-row">
      <div className="person">{c.name.slice(0,1)}</div><div className="grow"><strong>{c.name}</strong><small>{c.dateOfBirth||'تاريخ الميلاد غير محدد'}</small></div>
      <button className="btn small ghost" onClick={()=>{setChosenChild(c.id);changeTab('assessments');}}>تقييم الطفل</button>
     </div>):<Empty title="لم تُضف أطفالًا" desc="استخدم النموذج لإضافة أول ملف."/>}
    </div></div>
   </section>}
   {tab==='assessments'&&<section>
    {active?<><button className="link back" onClick={()=>setActive(null)}>→ كل التقييمات</button>
      <div className="page-title"><span className="eyebrow">التقييم الحالي</span><h1>{active.childName}</h1>
       <p>{active.programName} — اختر المجال ثم أجب عن كل هدف بإجابة واحدة فقط.</p></div>
      <div className="assessment-layout"><div className="domain-list">
       <div className="domain-title">مجالات البرنامج</div>
       {domains.map((d,i)=><button key={d.id} className={'domain-item '+(selectedDomain===d.id?'current':'')}
         onClick={()=>{setSelectedDomain(d.id);setGoals([]);setAnswers({});}}>
        <span className="domain-no">{i+1}</span><span>{d.name}</span><ChevronLeft size={15}/></button>)}
      </div>
      <div className="panel pad assessment-content">
       <div className="section-head"><div><span className="eyebrow">مجال التقييم</span>
        <h2>{domains.find(d=>d.id===selectedDomain)?.name||'اختر مجالًا'}</h2></div>
        <div className="goal-heading-actions"><Pill kind="gold">{totalAnswer} إجابة محفوظة / {visibleGoals.length} هدف</Pill>
         {admin&&goals.some(g=>!g.approved)&&<button className="btn small ghost" onClick={approveDomain}>اعتماد المجال بعد المراجعة</button>}</div></div>
       {visibleGoals.length?visibleGoals.map((goal,i)=><GoalRow key={goal.id} goal={goal} index={i}
        selected={answers[goal.id]} saving={saving===goal.id} isAdmin={!!admin}
        onSelect={s=>chooseAnswer(goal,s)} onSave={(t,approved)=>saveGoal(goal,t,approved)}/>):
        <Empty title={goals.length?'الأهداف لم تعتمد بعد':'لا توجد أهداف في المجال'} desc="مدير المنصة يراجع البنود المستوردة ويعتمدها، ويمكنه إضافة أهداف جديدة."/>}
       <div className="assessment-footer">
        <span>يُحفظ اختيارك تلقائيًا في حسابك عند الضغط على الإجابة.</span>
        <button className="btn primary" disabled={busy||pendingWrites>0} onClick={()=>createPlan(active)}>إنشاء خطة من القصور <FileText size={18}/></button>
       </div>
      </div></div></>:<>
      <div className="page-title"><span className="eyebrow">برامج وأهداف</span><h1>التقييمات</h1><p>أنشئ تقييمًا للطفل ثم انتقل بين مجالات البرنامج بسهولة.</p></div>
      <div className="panel pad"><h3><Plus size={19}/> إنشاء تقييم جديد</h3>
       <div className="inline-form"><label>الطفل<select value={chosenChild} onChange={e=>setChosenChild(e.target.value)}>
        <option value="">اختر الطفل</option>{children.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
        <label>البرنامج<select value={chosenProgram} onChange={e=>setChosenProgram(e.target.value)}>
         <option value="">اختر البرنامج</option>{programs.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <button className="btn primary" disabled={busy||!children.length||!programs.length} onClick={startAssessment}>ابدأ التقييم <ChevronLeft size={16}/></button>
       </div>
       {(!children.length||!programs.length)&&<p className="hint">يلزم وجود ملف طفل وبرنامج معتمد قبل بدء التقييم. {admin?'يمكن إضافة البرامج من الإدارة.':''}</p>}
      </div>
      <div className="section-head space-top"><h2>التقييمات السابقة</h2><Pill>{assessments.length} تقييم</Pill></div>
      <div className="panel">{assessments.length?assessments.map(a=><div key={a.id} className="list-row">
       <span className="list-icon"><ClipboardCheck size={20}/></span><div className="grow"><strong>{a.childName}</strong><small>{a.programName} • {dateFrom(a.createdAt)}</small></div>
       <button className="btn small ghost" onClick={()=>setActive(a)}>متابعة التقييم</button>
       <button className="btn small ghost" disabled={busy||pendingWrites>0} onClick={()=>createPlan(a)}>الخطة</button>
      </div>):<Empty title="لا توجد تقييمات مسجلة" desc="يمكنك إنشاء تقييم جديد من الأعلى."/>}</div>
     </>}
   </section>}
   {tab==='plans'&&<section>
    <div className="page-title"><span className="eyebrow">متابعة المهارات</span><h1>الخطة التربوية الفردية</h1><p>الأهداف غير المتقنة تُجمع هنا لتكوين مسودة قابلة للتعديل والتصدير.</p></div>
    {plan?<><div className="panel pad print-page"><div className="plan-header"><div><span className="eyebrow">Spark Edu</span><h2>الخطة التربوية الفردية</h2>
      <p>الطفل: <strong>{plan.child}</strong> — البرنامج: <strong>{plan.program}</strong></p></div>
      <Pill kind="gold">{allPlanItems.length} هدف يحتاج تدريبًا</Pill></div>
      <div className="plan-metadata"><span>تاريخ الإعداد: {plan.date}</span><span>اسم المقيم: {plan.assessor}</span></div>
      {allPlanItems.length?allPlanItems.map((goal,i)=><div className="plan-entry" key={i}>
       <span className="plan-count">{i+1}</span><div className="grow"><small>{goal.domain} {goal.code&&'• '+goal.code}</small><strong>{goal.text}</strong>
        <label className="plan-note">ملاحظات / معيار الإتقان / خط الأساس
         <textarea rows={2} value={goal.note||''} placeholder="اكتب معيار الإتقان والخط الأساس وخطوات التدريب..."
          onChange={e=>setAllPlanItems(arr=>arr.map((x,j)=>j===i?{...x,note:e.target.value}:x))}/></label>
       </div></div>):<Empty title="لا توجد مهارات غير متقنة" desc="ارجع إلى التقييم، واختر «لم يتقن» للأهداف المطلوبة ثم حدّث الخطة."/>}
      <p className="hint">هذه مسودة أولية، ولا تُعد تشخيصًا أو خطة معتمدة قبل مراجعة المختص.</p>
     </div><div className="toolbar no-print">
      <button className="btn primary" onClick={savePlan}><Save size={17}/> حفظ مسودة الخطة</button>
      <button className="btn ghost" onClick={()=>finalPlan()&&saveWord(finalPlan()!).catch(e=>banner(message(e)))}><Download size={17}/> تنزيل Word</button>
      <button className="btn ghost" onClick={()=>window.print()}><Printer size={17}/> حفظ PDF / طباعة</button>
     </div></>:<div className="panel pad"><Empty title="اختر تقييمًا لإنشاء الخطة" desc="تظهر الخطط المبنية على إجابات «لم يتقن» بعد فتح أحد التقييمات."/>
      <div className="list-of-plans">{assessments.map(a=><div className="list-row" key={a.id}>
       <span className="list-icon"><FileText size={20}/></span><div className="grow"><strong>{a.childName}</strong><small>{a.programName}</small></div>
       <button className="btn small ghost" disabled={busy||pendingWrites>0} onClick={()=>createPlan(a)}>إنشاء / عرض الخطة</button>
      </div>)}</div></div>}
   </section>}
   {tab==='admin'&&admin&&<section>
    <div className="page-title"><span className="eyebrow">الصلاحيات والاشتراكات</span><h1>إدارة المنصة</h1><p>التحكم في تفعيل الحسابات والمحتوى وسجل تعديلات البرامج.</p></div>
    <div className="stat-grid"><div className="stat"><div className="stat-icon mint"><Users size={21}/></div><div><small>جميع المستخدمين</small><strong>{users.length}</strong></div></div>
     <div className="stat"><div className="stat-icon cream"><CalendarClock size={21}/></div><div><small>بانتظار التفعيل</small><strong>{subscriptions.filter(u=>subscriberStatus(u,now)==='pending').length}</strong></div></div>
     <div className="stat"><div className="stat-icon blue"><CheckCircle2 size={21}/></div><div><small>اشتراكات سارية</small><strong>{subscriptions.filter(u=>subscriberStatus(u,now)==='active').length}</strong></div></div>
     <div className="stat"><div className="stat-icon cream"><CalendarClock size={21}/></div><div><small>تنتهي خلال 7 أيام</small><strong>{expiringSoon}</strong></div></div>
     <div className="stat"><div className="stat-icon cream"><LockKeyhole size={21}/></div><div><small>منتهية / موقوفة</small><strong>{subscriptions.filter(u=>['expired','blocked'].includes(subscriberStatus(u,now))).length}</strong></div></div></div>
    <div className="panel pad space-top"><div className="section-head"><h3><CalendarClock size={19}/> طلبات تجديد الاشتراكات</h3>
     <Pill kind={renewals.length?'gold':'good'}>{renewals.length} طلب معلق</Pill></div>
     {renewals.length?renewals.map(r=><div className="list-row" key={r.id}>
      <span className="list-icon"><CalendarClock size={19}/></span><div className="grow"><strong>{r.name}</strong><small>{r.email} — {dateFrom(r.requestedAt)}</small></div>
      <button className="btn small primary" disabled={busy} onClick={()=>fulfillRenewal(r)}>تجديد 30 يومًا</button>
     </div>):<p className="hint">لا توجد طلبات تجديد معلقة حاليًا.</p>}
    </div>
    <div className="panel pad space-top"><div className="section-head"><h3><UserRound size={19}/> إنشاء مشترك جديد</h3><Pill kind="gold">اشتراك 30 يومًا من تاريخ الإنشاء</Pill></div>
     <form className="subscriber-form" onSubmit={createSubscriber}>
      <label>الاسم الكامل<input required minLength={3} value={newSubscriberName} onChange={e=>setNewSubscriberName(e.target.value)} placeholder="اسم الأخصائي"/></label>
      <label>البريد الإلكتروني<input required type="email" value={newSubscriberEmail} onChange={e=>setNewSubscriberEmail(e.target.value)} placeholder="email@example.com" dir="ltr"/></label>
      <label>كلمة مرور مؤقتة<input required minLength={10} type="password" value={newSubscriberPassword} onChange={e=>setNewSubscriberPassword(e.target.value)} autoComplete="new-password" placeholder="10 أحرف على الأقل" dir="ltr"/></label>
      <button className="btn primary" disabled={subscriberBusy}>{subscriberBusy?'جارٍ إنشاء الحساب':'إنشاء مشترك وتفعيله'}</button>
     </form>
     <p className="hint">تُحفظ كلمة المرور في Firebase Authentication ولا تُخزَّن في Firestore. شاركيها مع صاحب الحساب بطريقة آمنة واطلبي منه تغييرها بعد الدخول.</p>
    </div>
    <div className="panel pad space-top"><div className="section-head"><h3>المشتركون والاشتراكات</h3><Pill kind="gold">التجديد اليدوي لمدة 30 يومًا</Pill></div>
     <div className="subscriber-controls"><input value={subscriberSearch} onChange={e=>setSubscriberSearch(e.target.value)} placeholder="بحث بالاسم أو البريد" aria-label="بحث المستخدمين"/>
      <select value={subscriberFilter} onChange={e=>setSubscriberFilter(e.target.value as typeof subscriberFilter)} aria-label="تصفية حالة الاشتراك">
       <option value="all">كل المشتركين</option><option value="active">مفعّلون</option><option value="pending">بانتظار التفعيل</option>
       <option value="expired">انتهى الاشتراك</option><option value="blocked">موقوفون</option>
      </select></div>
     <div className="responsive-table"><table><thead><tr><th>الاسم والبريد</th><th>حالة الاشتراك</th><th>تاريخ الانتهاء</th><th>الوقت المتبقي</th><th>الإجراءات</th></tr></thead>
      <tbody>{filteredSubscriptions.map(u=>{const status=subscriberStatus(u,now);return <tr key={u.id}>
       <td><strong>{u.name}</strong><small>{u.email}</small></td>
       <td><Pill kind={status==='active'?'good':status==='pending'?'gold':'bad'}>{status==='active'?'مفعّل':status==='blocked'?'موقوف':status==='pending'?'غير مفعّل':'انتهى الاشتراك'}</Pill></td>
       <td>{dateFrom(u.subscriptionExpiresAt)}</td>
       <td><strong>{status==='active'?remainingText(u.subscriptionExpiresAt,now):status==='expired'?'منتهي':'—'}</strong></td>
       <td><div className="table-actions"><button type="button" className="btn small ghost" onClick={()=>updateSubscription(u,'activate')}>تفعيل / تجديد 30 يومًا</button>
       {status!=='blocked'&&<button type="button" className="btn small danger" onClick={()=>updateSubscription(u,'block')}>إيقاف</button>}</div></td></tr>;})}</tbody></table></div>
     {!filteredSubscriptions.length&&<p className="hint">لا يوجد مشتركون مطابقون للبحث الحالي.</p>}
    </div>
    <div className="panel pad space-top"><h3><BookOpen size={19}/> استيراد البرامج والأهداف دفعة واحدة</h3>
     <p className="hint">اختاري ملف <code>spark-programs-PRIVATE.json</code> بعد فك ضغطه على جهازك. لا ترفعي ملف الأهداف الخاص إلى GitHub العام. سيتم استيراد البرامج والمجالات والأهداف في دفعات، دون حذف أو استبدال أهداف سبق تعديلها.</p>
     <div className="import-form"><input type="file" accept=".json,application/json" aria-label="ملف البرامج" disabled={importBusy}
      onChange={e=>{setImportFile(e.target.files?.[0]||null);setImportProgress(null);}}/>
      <button type="button" className="btn primary" onClick={uploadPrograms} disabled={!importFile||importBusy}>{importBusy?'جارٍ استيراد البرامج…':'استيراد كل البرامج مرة واحدة'}</button></div>
     <label className="import-approval"><input type="checkbox" checked={reviewedImport} disabled={importBusy} onChange={e=>setReviewedImport(e.target.checked)}/>
      أُقر أنني راجعت بنود البرامج وحقوق استخدامها، وأريد اعتماد الأهداف الجديدة فور الاستيراد لتظهر للمشتركين.</label>
     {importProgress&&<div className="import-progress" role="status">{importProgress.stage} — {importProgress.programsDone} / {importProgress.programsTotal} برامج،
      {importProgress.goalsAdded} هدف جديد، {importProgress.goalsExisting} هدف موجود، {importProgress.documentsWritten} مستند محفوظ.
      <progress max={importProgress.programsTotal} value={importProgress.programsDone}/></div>}
     <p className="hint">افتراضيًا الأهداف المستوردة تكون قيد المراجعة، ولا تظهر للتقييم قبل اعتمادها. يمكن إظهارها فورًا فقط بعد إقرار المدير بالمراجعة وحقوق الاستخدام. يُفضّل إبقاء الصفحة مفتوحة حتى اكتمال العملية.</p>
    </div>
    <div className="panel pad space-top"><h3><BookOpen size={19}/> إدارة مكتبة البرامج</h3>
      <div className="admin-editor"><label>اسم برنامج جديد<input value={newProgramName} onChange={e=>setNewProgramName(e.target.value)} placeholder="اسم البرنامج"/></label><button className="btn primary" onClick={addProgram}>إضافة برنامج</button></div>
      <div className="admin-editor"><label>اختيار برنامج<select value={adminProgram} onChange={e=>{setAdminProgram(e.target.value);setAdminDomain('');}}>
       <option value="">اختر البرنامج</option>{programs.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
       <label>مجال جديد<input value={newDomainName} onChange={e=>setNewDomainName(e.target.value)} placeholder="اسم المجال"/></label><button disabled={!adminProgram} className="btn ghost" onClick={addDomain}>إضافة مجال</button></div>
      <div className="admin-editor"><label>المجال<select value={adminDomain} onChange={e=>setAdminDomain(e.target.value)}><option value="">اختر المجال</option>
       {adminDomains.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
       <label>هدف جديد<input value={newGoalText} onChange={e=>setNewGoalText(e.target.value)} placeholder="نص الهدف السلوكي"/></label>
       <button className="btn ghost" disabled={!adminDomain} onClick={addGoal}>إضافة هدف</button></div>
      <p className="hint">لتعديل نص هدف موجود أو اعتماده: افتح أي تقييم، واختر المجال ثم اضغط «تعديل الهدف». يمكن الآن استيراد ملف الأهداف JSON مباشرة من لوحة المدير في الأعلى؛ ثم مراجعة كل مجال واعتماد أهدافه.</p>
    </div>
    <div className="panel pad space-top"><h3><RefreshCw size={19}/> سجل آخر التعديلات</h3>
     {audits.length?audits.slice(0,15).map(a=><div key={a.id} className="list-row"><span className="list-icon"><ShieldCheck size={17}/></span><div className="grow"><strong>{String(a.action||'تعديل')}</strong>
      <small>{String(a.actorName||a.actorUid||'مدير')} • {dateFrom(a.at as Timestamp)}</small></div>
      {a.goalId ? <Pill>هدف {a.goalId}</Pill> : null}</div>):<Empty title="لا توجد تعديلات مسجلة" desc="ستظهر هنا التفعيلات وتغييرات الأهداف."/>}
    </div>
   </section>}
  </main>
  <nav className="mobile-nav no-print">
   <button className={tab==='home'?'selected':''} onClick={()=>changeTab('home')}><LayoutDashboard size={20}/><span>الرئيسية</span></button>
   <button className={tab==='children'?'selected':''} onClick={()=>changeTab('children')}><Users size={20}/><span>الأطفال</span></button>
   <button className={tab==='assessments'?'selected':''} onClick={()=>changeTab('assessments')}><ClipboardCheck size={20}/><span>التقييم</span></button>
   <button className={tab==='plans'?'selected':''} onClick={()=>changeTab('plans')}><FileText size={20}/><span>الخطط</span></button>
   {admin&&<button className={tab==='admin'?'selected':''} onClick={()=>changeTab('admin')}><ShieldCheck size={20}/><span>الإدارة</span></button>}
  </nav>
  {toast&&<div role="status" className="toast">{toast}</div>}
 </div>;
}

function GoalRow({goal,index,selected,saving,isAdmin,onSelect,onSave}:{
 goal:Goal;index:number;selected?:Answer;saving:boolean;isAdmin:boolean;
 onSelect:(s:Answer)=>void;onSave:(text:string,approved:boolean)=>void;
}){
 const [editing,setEditing]=useState(false),[text,setText]=useState(goal.text);
 const [approved,setApproved]=useState(!!goal.approved);
 useEffect(()=>{setText(goal.text);setApproved(!!goal.approved);},[goal.text,goal.approved]);
 return <div className="goal-row"><div className="goal-main">
  <span className="goal-index">{goal.code||index+1}</span><div className="grow">
   {editing?<textarea rows={3} value={text} onChange={e=>setText(e.target.value)} aria-label="تحرير نص الهدف"/>:<p>{goal.text}</p>}
   <div className="goal-meta">{!goal.approved&&isAdmin&&<Pill kind="gold">قيد المراجعة</Pill>}
    {saving&&<small>جارٍ الحفظ…</small>}</div>
  </div></div>
  <div className="goal-actions"><div className="choice-group" role="radiogroup" aria-label={'تقييم: '+goal.text}>
   <label className={'choice yes '+(selected==='mastered'?'marked':'')}><input type="radio" name={'goal-'+goal.id}
    checked={selected==='mastered'} onChange={()=>onSelect('mastered')}/> <CheckCircle2 size={17}/> أتقن</label>
   <label className={'choice no '+(selected==='not_mastered'?'marked':'')}><input type="radio" name={'goal-'+goal.id}
    checked={selected==='not_mastered'} onChange={()=>onSelect('not_mastered')}/> <CircleX size={17}/> لم يتقن</label>
  </div>
  {isAdmin&&<div className="goal-edit">
   {editing?<><label><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/> اعتماد البند</label>
    <button className="btn tiny primary" onClick={()=>{onSave(text,approved);setEditing(false);}}><Save size={14}/> حفظ</button></>:
    <button className="link" onClick={()=>setEditing(true)}><Pencil size={14}/> تعديل / اعتماد</button>}
  </div>}</div>
 </div>;
}
