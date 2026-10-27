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
 async function updateSubscription(p:Profile,action:'activate'|'block'){
  if(!admin||!user)return;
  try{
   const expiry=action==='activate'?Timestamp.fromMillis(Math.max(Date.now(),p.subscriptionExpiresAt?.toMillis()||0)+30*86400000):p.subscriptionExpiresAt||Timestamp.fromMillis(0);
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
   <p>مرحبًا {profile.name}، لا يمكن فتح التقييمات قبل تفعيل حسابك من مدير المنصة. الحساب محفوظ ويمكن تفعيله لمدة 30 يومًا.</p>
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
    <Pill kind="good">{admin?'حساب إداري':`نشط حتى ${dateFrom(profile.subscriptionExpiresAt)}`}</Pill></div>
   {tab==='home'&&<section>
    <div className="hero"><div><span className="eyebrow light">مساحة عملك التعليمية</span><h1>أهلًا بك، {profile.name.split(' ')[0]}</h1>
     <p>رتّب ملفات الأطفال، وابدأ تقييمًا جديدًا، وحوّل المهارات غير المتقنة إلى خطة عملية.</p>
     <button className="btn white" onClick={()=>changeTab('assessments')}>ابدأ التقييم <ChevronLeft size={18}/></button></div>
     <div className="hero-art"><img className="hero-photo" src="/center-photo.jpeg" alt="صورة الجهة التعليمية"/><span>SPARK</span></div></div>
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
