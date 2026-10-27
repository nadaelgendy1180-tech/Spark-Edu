const email=process.argv[2]?.toLowerCase();
if(!email||!email.includes('@')){console.error('Usage: npm run bootstrap:admin -- admin@example.com');process.exit(1);}
if(process.argv[3]!=='--execute'){console.log('This action grants superadmin access to:',email);console.log('Pass --execute to confirm.');process.exit(0);}
const {initializeApp,applicationDefault}=await import('firebase-admin/app');
const {getAuth}=await import('firebase-admin/auth');
const {getFirestore,Timestamp,FieldValue}=await import('firebase-admin/firestore');
initializeApp({credential:applicationDefault(),projectId:process.env.FIREBASE_PROJECT_ID||'speak-d6e7f'});
const user=await getAuth().getUserByEmail(email);
await getFirestore().doc(`users/${user.uid}`).set({name:user.displayName||email.split('@')[0],email,
 role:'admin',state:'active',subscriptionExpiresAt:Timestamp.fromDate(new Date('2100-01-01T00:00:00Z')),
 updatedAt:FieldValue.serverTimestamp()}, {merge:true});
console.log('Admin assigned:',email,user.uid);
