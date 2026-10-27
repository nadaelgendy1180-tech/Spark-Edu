# Spark Edu — دليل رفع النسخة المراجعة (27 أكتوبر 2026)

## ماذا تعني «تمت المراجعة»؟
مراجعة ساكنة لملفات النسخة السابقة، واختبارات المصدر `node --test`، وفحص TypeScript/TSX نحويًا باستخدام TypeScript.
**لم ينجح تثبيت مكتبات npm داخل بيئة الإعداد المعزولة، لذلك لم يتوفر اختبار `npm run build` كاملاً هنا.**
لا يوجد تصريح بالدخول إلى مستودع GitHub أو قاعدة Firebase الحية، فلا ندّعي أنه تم نشر المشروع.

## ملاحظات أساسية
- ملفات المشروع قابلة للاستبدال بمساراتها داخل مجلد المستودع مباشرة، **لا ترفع مجلد Spark_Edu كطبقة إضافية**.
- صورة `public/center-logo.jpeg` وصورة `public/center-photo.jpeg` من أصول المشروع.
- لا ترفع محتوى `spark-programs-PRIVATE.json` أو service-account.json إلى GitHub إطلاقًا.
- الإعداد الافتراضي للمشروع Firebase Web App: `speak-d6e7f` (القيم العامة المدرجة في `src/firebase.ts`). يمكن الاستبدال عبر إعدادات Vercel `VITE_*`.
- لا توجد كلمة مرور صالحة ومدير منشأ تلقائيًا داخل المصدر. كلمة المرور لا يمكن استرجاعها من Firebase.

## ترتيب الملفات داخل GitHub
### المجموعة 1: الجذر
1. `.gitignore`
2. `package.json`
3. `tsconfig.json`
4. `vite.config.ts`
5. `vercel.json`
6. `index.html`
7. `.env.example` (قيم عامة فقط؛ لا ترفع ملف `.env` الحقيقي)
8. `firebase.json`

### المجموعة 2: كود الواجهة
9. `src/types.ts`
10. `src/firebase.ts`
11. `src/export.ts`
12. `src/styles.css`
13. `src/App.tsx`
14. `src/main.tsx`

### المجموعة 3: الأصول المرئية
15. `public/favicon.svg`
16. `public/center-logo.jpeg`
17. `public/center-photo.jpeg`

### المجموعة 4: السكربتات والاختبارات
18. `scripts/bootstrap-admin.mjs`
19. `scripts/verify-data.mjs`
20. `scripts/import-programs.mjs`
21. `tests/structure.test.mjs`
22. `private-import/README.md`
23. `README_AR.md`

### المجموعة 5: الأمان (نشره إلى Firebase إلزامي)
24. `firestore.rules`

## ضبط Vercel
- Framework: Vite.
- Root Directory: جذر المستودع (بعد فك ضغط الحزمة لا تضف مجلد Spark_Edu أعلى الملفات).
- Build command: `npm run build`; Output Directory: `dist`.
- إذا أضفت قيم البيئة على Vercel فانتبه إلى `VITE_FIREBASE_*` واختلاف مشاريع Firebase.
- أضف رابط `*.vercel.app` المخصص لك إلى Firebase Console > Authentication > Settings > Authorized domains.
- Warning متعلق بـ npm `cache-dir` أو `uuid` ليس خطأ TypeScript الذي أوقف البناء السابق.

## تأمين Firebase وتجهيز حساب المدير
1. في https://console.firebase.google.com افتح مشروع `speak-d6e7f`.
2. فعّل Authentication > Sign-in method > Email/Password وCloud Firestore.
3. انشر `firestore.rules` باستخدام Firebase CLI أو تبويب Rules في Firebase Console (راجع النسخ الاحتياطية قبل التحديث).
4. أنشئ مستخدمًا من Firebase Authentication > Users > Add user، مستخدمًا **بريدًا تملكه** وكلمة مرور قوية **لا تضعها في GitHub**.
5. نزّل مفتاح Service Account إلى جهازك فقط من Firebase Console > Project settings > Service accounts > Generate private key.
6. في Terminal (Mac / Linux) داخل مجلد المشروع:

```bash
npm install
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/Downloads/service-account.json"
export FIREBASE_PROJECT_ID="speak-d6e7f"
npm run bootstrap:admin -- your-real-email@example.com
npm run bootstrap:admin -- your-real-email@example.com --execute
```
استبدل `your-real-email@example.com` بالبريد الذي أنشأته؛ **لا تنسخ بريد المثال باعتباره بريد مدير موجودًا**.
إذا استخدمت Firebase Console لإنشاء مستخدم جديد فسيقوم سكربت bootstrap بإضافة وثيقة `users/{uid}` بصلاحية مدير.

7. اختبر `npm run test && npm run build` محليًا، ثم تأكد من نجاح Vercel Deployment.
8. سجل دخول المدير على الموقع بالبريد وكلمة المرور اللذين اخترتهما أنت.

## استيراد البرامج (من الكمبيوتر فقط)
فك حزمة PRIVATE في مسار **خارج مستودع GitHub**، ثم:

```bash
npm run verify:data -- /absolute/path/spark-programs-PRIVATE.json
npm run import:programs -- /absolute/path/spark-programs-PRIVATE.json
npm run import:programs -- /absolute/path/spark-programs-PRIVATE.json --execute
```
ثم راجع نصوص البنود وحقوق إعادة استخدامها واعتمد البنود المطلوبة من لوحة المدير. البنود المستوردة `approved:false` إلى حين المراجعة.
**البيانات الحساسة للأطفال:** لا تستخدمها على الإنتاج قبل إجراء اختبارات صلاحيات Firestore Emulator ومراجعة متطلبات حماية البيانات.
