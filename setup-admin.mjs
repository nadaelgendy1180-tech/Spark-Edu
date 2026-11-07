/**
 * SPARK Edu — Promote an existing Firebase Authentication user to admin.
 * Local administrative script. NEVER deploy this file or a service account key
 * to the public web app or a public GitHub repository.
 *
 * Run: node setup-admin.mjs "real-admin@example.com" --execute
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PROJECT_ID = 'speak-d6e7f';
const ADMIN_NAME = 'ندي الجندي';
const adminEmail = (process.argv[2] ?? '').trim().toLowerCase();
const execute = process.argv.includes('--execute');

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
  console.error('Please supply the real admin email:\nnode setup-admin.mjs "admin@example.com" --execute');
  process.exit(1);
}

if (!execute) {
  console.log('PREVIEW ONLY — no changes made.');
  console.log(`Firebase project: ${PROJECT_ID}`);
  console.log(`Admin name: ${ADMIN_NAME}`);
  console.log(`Admin email: ${adminEmail}`);
  console.log('Add --execute to grant admin permission.');
  process.exit(0);
}

const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credentialsPath) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to a local Firebase service-account JSON file first.');
  process.exit(1);
}
let credentialFile;
try {
  credentialFile = JSON.parse(readFileSync(resolve(credentialsPath), 'utf8'));
} catch {
  console.error('Cannot read the Firebase service-account JSON specified by GOOGLE_APPLICATION_CREDENTIALS.');
  process.exit(1);
}
if (credentialFile.project_id !== PROJECT_ID) {
  console.error(`Wrong Firebase project: ${credentialFile.project_id || 'unknown'}. Expected ${PROJECT_ID}. Nothing changed.`);
  process.exit(1);
}

const { initializeApp, applicationDefault } = await import('firebase-admin/app');
const { getAuth } = await import('firebase-admin/auth');
const { getFirestore, Timestamp, FieldValue } = await import('firebase-admin/firestore');
initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore();

try {
  // We promote only an account that already exists in Firebase Authentication.
  const user = await auth.getUserByEmail(adminEmail);
  if (user.disabled) throw new Error('This Authentication user is disabled. Enable it in Firebase first.');

  // Update the Auth display name before assigning elevated Firestore privileges.
  await auth.updateUser(user.uid, { displayName: ADMIN_NAME });

  const ref = db.doc(`users/${user.uid}`);
  await ref.set({
    name: ADMIN_NAME,
    email: user.email ?? adminEmail,
    role: 'admin',
    state: 'active',
    subscriptionExpiresAt: Timestamp.fromDate(new Date('2100-01-01T00:00:00.000Z')),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.get('role') !== 'admin') {
    throw new Error('Permission could not be verified after write.');
  }
  console.log('SUCCESS: Admin role applied and verified.');
  console.log(`Name: ${ADMIN_NAME}`);
  console.log(`Email: ${user.email}`);
  console.log(`Firebase UID: ${user.uid}`);
  console.log(`Document: users/${user.uid}`);
  console.log('Sign out and back in to Spark Edu to load the admin dashboard.');
} catch (error) {
  console.error('FAILED:', error?.message || String(error));
  process.exitCode = 1;
}
