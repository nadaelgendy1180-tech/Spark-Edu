# أولاً: تعديلات Firebase قبل رفع ملفات GitHub

المشروع: `speak-d6e7f` — منصة Spark Edu.

1. افتحي https://console.firebase.google.com/project/speak-d6e7f/firestore/rules
2. انسخي محتوى `firestore.rules` كاملاً من هذا التحديث مكان قواعد Firestore القديمة.
3. اضغطي **Publish**. القواعد متوافقة مع الحقول الفعلية في `src/App.tsx`: `renewalRequests/{uid}` + الحقول `uid,name,email,status,requestedAt`.
4. افتحي https://console.firebase.google.com/project/speak-d6e7f/firestore/data وتحققي أن حساب المدير في `users/{UID}` يحتوي `role` (string) = `admin` و`state` = `active`.
5. تأكدي أن Firebase Authentication > Sign-in method > Email/Password مفعّل: https://console.firebase.google.com/project/speak-d6e7f/authentication/providers
6. لا تمسحي أي حساب أو بيانات سابقة ولا تفعّلي قاعدة `allow read,write: if true`.

## اختبار بعد النشر

- سجّلي دخول بحساب المدير وادخلي إدارة المنصة؛ يجب ألا تظهر `Missing or insufficient permissions` في طلبات التجديد.
- بحساب أخصائي غير مفعّل، اضغطي «إرسال طلب تجديد»، ثم ارجعي لحساب المدير وراجعي ظهوره في القائمة.
- يظل تغيير قواعد Firestore عمليّة منفصلة؛ رفع `firestore.rules` إلى GitHub فقط لا يطبّق القواعد على Firebase تلقائيًا.

## حدود المراجعة

الملفات البرمجية مبنية على نسخة Spark Edu المتوفرة من الحزمة السابقة؛ تعذّر الوصول المباشر إلى أحدث محتويات GitHub. خذي نسخة احتياطية قبل استبدال الملفات إذا أجريتِ تعديلات جديدة على المستودع مؤخرًا.
