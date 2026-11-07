import {
  collection, doc, getDocs, serverTimestamp, writeBatch,
  type Firestore,
} from 'firebase/firestore';

export interface SourceGoal { id: string; code?: string; text: string; needsReview?: boolean }
export interface SourceDomain { id: string; name: string; goals: SourceGoal[] }
export interface SourceProgram { id: string; name: string; source?: string; domains: SourceDomain[] }
export interface ProgramBundle { version?: string; note?: string; programs: SourceProgram[] }
export interface ImportProgress {
  programsDone: number;
  programsTotal: number;
  goalsTotal: number;
  goalsAdded: number;
  goalsExisting: number;
  documentsWritten: number;
  stage: string;
}

function assertValid(value: unknown): asserts value is ProgramBundle {
  if (!value || typeof value !== 'object') throw new Error('الملف ليس بصيغة JSON صحيحة.');
  const bundle = value as Partial<ProgramBundle>;
  if (!Array.isArray(bundle.programs) || !bundle.programs.length || bundle.programs.length > 30) {
    throw new Error('الملف لا يحتوي على قائمة البرامج المطلوبة.');
  }
  const safeId = /^[a-z0-9][a-z0-9_-]{0,100}$/i;
  let total = 0;
  const programIds = new Set<string>();
  for (const program of bundle.programs) {
    if (!program || !safeId.test(program.id) || !program.name?.trim() || !Array.isArray(program.domains)) {
      throw new Error('يوجد برنامج أو اسم برنامج غير صالح في الملف.');
    }
    if (programIds.has(program.id)) throw new Error('يوجد رقم برنامج مكرر في الملف.');
    programIds.add(program.id);
    const domainIds = new Set<string>();
    for (const domain of program.domains) {
      if (!domain || !safeId.test(domain.id) || !domain.name?.trim() || !Array.isArray(domain.goals)) {
        throw new Error('يوجد مجال غير صالح في الملف.');
      }
      if (domainIds.has(domain.id)) throw new Error('يوجد رقم مجال مكرر.');
      domainIds.add(domain.id);
      const goalIds = new Set<string>();
      for (const goal of domain.goals) {
        if (!goal || !safeId.test(goal.id) || typeof goal.text !== 'string' || !goal.text.trim() || goal.text.length > 10000) {
          throw new Error('يوجد هدف غير صالح في الملف.');
        }
        if (goalIds.has(goal.id)) throw new Error('يوجد رقم هدف مكرر.');
        goalIds.add(goal.id);
        total++;
      }
    }
  }
  if (total > 10000) throw new Error('عدد الأهداف أكبر من الحد المسموح.');
}

export async function readProgramBundle(file: File): Promise<ProgramBundle> {
  if (file.size > 8 * 1024 * 1024) throw new Error('حجم الملف كبير؛ الحد الأقصى 8 ميجابايت.');
  let parsed: unknown;
  try { parsed = JSON.parse(await file.text()); }
  catch { throw new Error('لم يمكن قراءة الملف. اختاري ملف spark-programs-PRIVATE.json نفسه بعد فك الضغط.'); }
  assertValid(parsed);
  return parsed;
}

// The original draft includes an administrator-created Portage entry with a random ID.
// Reuse that program instead of creating another Portage program.
const aliases: Record<string, string[]> = {
  portage: ['بورتاج', 'portage'],
  teacch: ['تيتش', 'teacch'],
  help: ['هيلب', 'help'],
  ablls: ['ايبلز', 'إيبلز', 'ablls'],
  denver: ['دنفر', 'denver'],
  lovaas: ['لوفاس', 'lovaas'],
  vbmapp: ['في بي ماب', 'vb-mapp', 'vbmapp'],
};
function sameProgramName(id: string, displayName: string): boolean {
  const text = displayName.normalize('NFKC').toLowerCase().trim();
  return (aliases[id] || []).some(alias => text.includes(alias.toLowerCase()));
}
function comparableName(name: string): string {
  return name.normalize('NFKC').replace(/[\s\-—–_.،()]/g, '').toLowerCase();
}

/**
 * Browser-side, administrator-only upload. Firestore rules are authoritative.
 * Uses stable identifiers and skips existing documents; edited content survives re-import.
 * A previously created Portage program is reused by name.
 * Imported goals stay pending unless the admin explicitly confirms review and publishing rights.
 */
export async function importProgramBundle(
  db: Firestore,
  bundle: ProgramBundle,
  onProgress: (value: ImportProgress) => void,
  approveReviewedGoals = false,
): Promise<ImportProgress> {
  assertValid(bundle);
  const progress: ImportProgress = {
    programsDone: 0,
    programsTotal: bundle.programs.length,
    goalsTotal: bundle.programs.reduce((sum, p) => sum + p.domains.reduce((n, d) => n + d.goals.length, 0), 0),
    goalsAdded: 0,
    goalsExisting: 0,
    documentsWritten: 0,
    stage: 'قراءة البرامج الحالية',
  };
  onProgress({...progress});
  const existingPrograms = await getDocs(collection(db, 'programs'));
  const oldPrograms = existingPrograms.docs.map(item => ({id: item.id, name: String(item.data().name || '')}));
  let batch = writeBatch(db);
  let queued = 0;
  async function flush() {
    if (!queued) return;
    const committed = queued;
    await batch.commit();
    progress.documentsWritten += committed;
    batch = writeBatch(db);
    queued = 0;
    onProgress({...progress});
  }
  async function queueSet(path: [string, ...string[]], data: Record<string, unknown>) {
    batch.set(doc(db, path[0], ...path.slice(1)), data);
    queued++;
    if (queued >= 300) await flush();
  }
  async function queueUpdate(path: [string, ...string[]], data: Record<string, unknown>) {
    batch.update(doc(db, path[0], ...path.slice(1)), data);
    queued++;
    if (queued >= 300) await flush();
  }
  for (const program of bundle.programs) {
    progress.stage = 'استيراد '+program.name;
    onProgress({...progress});
    const old = oldPrograms.find(p => p.id === program.id) ||
      oldPrograms.find(p => sameProgramName(program.id, p.name));
    const programId = old?.id || program.id;
    if (!old) {
      await queueSet(['programs', programId], {
        name: program.name, source: program.source || '', importedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      oldPrograms.push({id: programId, name: program.name});
    }
    const domainsRef = collection(db, 'programs', programId, 'domains');
    const oldDomainsSnap = await getDocs(domainsRef);
    const oldDomains = oldDomainsSnap.docs.map(item => ({id: item.id, name: String(item.data().name || '')}));
    for (const [domainOrder, domain] of program.domains.entries()) {
      const match = oldDomains.find(d => d.id === domain.id) ||
        oldDomains.find(d => comparableName(d.name) === comparableName(domain.name));
      const domainId = match?.id || domain.id;
      if (!match) {
        await queueSet(['programs', programId, 'domains', domainId], {
          name: domain.name, order: domainOrder, updatedAt: serverTimestamp(),
        });
        oldDomains.push({id: domainId, name: domain.name});
      }
      const previousGoals = match
        ? await getDocs(collection(db, 'programs', programId, 'domains', domainId, 'goals'))
        : null;
      const goalData = new Map(previousGoals?.docs.map(item => [item.id, item.data()]) || []);
      for (const [goalOrder, goal] of domain.goals.entries()) {
        if (goalData.has(goal.id)) {
          progress.goalsExisting++;
          // Explicit approval never overwrites an existing editor's goal text.
          if (approveReviewedGoals && goalData.get(goal.id)?.approved !== true) {
            await queueUpdate(['programs', programId, 'domains', domainId, 'goals', goal.id], {
              approved: true, needsReview: false, updatedAt: serverTimestamp(),
            });
          }
          continue;
        }
        await queueSet(['programs', programId, 'domains', domainId, 'goals', goal.id], {
          text: goal.text.trim(), code: goal.code || '', order: goalOrder,
          approved: approveReviewedGoals, needsReview: !approveReviewedGoals,
          source: program.source || '', updatedAt: serverTimestamp(),
        });
        progress.goalsAdded++;
      }
    }
    progress.programsDone++;
    onProgress({...progress});
  }
  progress.stage = 'حفظ آخر دفعة';
  await flush();
  progress.stage = 'اكتمل الاستيراد';
  onProgress({...progress});
  return progress;
}
