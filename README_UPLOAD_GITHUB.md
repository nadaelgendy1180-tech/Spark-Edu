# ثانيًا: رفع تحديث Spark Edu على GitHub

المستودع: https://github.com/nadaelgendy1180-tech/Spark-Edu

1. نفّذي `README_FIREBASE_FIRST.md` وانشري `firestore.rules` في Firebase أولاً.
2. احفظي نسخة احتياطية من المشروع قبل الاستبدال. **هذه الحزمة تحتوي ملفات معدّلة كاملة**؛ هي ليست مستودعًا جديدًا.
3. فكّي ضغط ZIP، وارفعي **محتوى** الملفات والمجلدات إلى جذر مستودع GitHub في نفس المسارات (لا ترفعي ZIP نفسه).
4. الملفات البرمجية: `src/App.tsx` و`src/styles.css` و`src/main.tsx` و`src/InstallAppButton.tsx` و`src/pwa.ts`.
5. ملفات الموقع: `index.html` و`vercel.json`.
6. ملفات الصور والتثبيت: `public/center-logo.jpeg` و`public/center-photo.jpeg` و`public/app-icon-192.png` و`public/app-icon-512.png` و`public/apple-touch-icon.png` و`public/manifest.webmanifest` و`public/sw.js`.
7. ملف الصلاحيات `firestore.rules` + ملفات التعليمات.
8. بعد الـ Commit راجعي Vercel > Project > Deployments. يجب أن يظهر Ready. افتحي https://spark-edu.vercel.app، جرّبي تسجيل الدخول وطلبات التجديد وزر تثبيت التطبيق.

## ملاحظات

- **لا تغيّري** متغيرات Firebase الستة في Vercel التي أضفتِها سابقًا.
- زر التثبيت قد يقدّم إرشادات فقط إذا لم يطلق المتصفح حدث beforeinstallprompt. على iPhone استخدمي مشاركة > إضافة إلى الشاشة الرئيسية من Safari.
- الـ Service Worker يحفظ أصول واجهة ثابتة فقط. بيانات Firebase والتقييمات تحتاج الاتصال بالشبكة، ولا تعد الحزمة بتشغيلها أوفلاين.
- الصور الأصلية للمركز محفوظة كما هي.
- يفضّل اختبار قواعد Firestore بمحاكي القواعد وعلى حساب تجريبي قبل استخدام بيانات أطفال حقيقية.
