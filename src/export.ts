import {AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun} from 'docx';
import type {PlanItem} from './types';
export type ExportPlan={child:string;program:string;date:string;assessor:string;items:PlanItem[]};
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function saveWord(plan:ExportPlan){
 const paragraphs=[
  new Paragraph({text:'Spark Edu | الخطة التربوية الفردية',heading:HeadingLevel.TITLE,bidirectional:true,alignment:AlignmentType.RIGHT}),
  ...[`الطفل: ${plan.child}`,`البرنامج: ${plan.program}`,`تاريخ إعداد الخطة: ${plan.date}`,`المُقيم: ${plan.assessor}`,`أهداف بحاجة إلى تدريب: ${plan.items.length}`].map(t=>new Paragraph({text:t,bidirectional:true,alignment:AlignmentType.RIGHT,spacing:{after:150}})),
  ...plan.items.flatMap((goal,i)=>[
   new Paragraph({children:[new TextRun({text:`${i+1}. [${goal.domain}] ${goal.code?goal.code+' — ':''}${goal.text}`,bold:true})],bidirectional:true,alignment:AlignmentType.RIGHT,spacing:{before:160,after:80}}),
   new Paragraph({text:goal.note?.trim()?`التفاصيل المهنية: ${goal.note.trim()}`:`خط الأساس: __________   معيار الإتقان: __________   تاريخ المراجعة: __________`,bidirectional:true,alignment:AlignmentType.RIGHT,spacing:{after:90}}),
  ]),
  new Paragraph({text:'ملاحظة: هذه مسودة أهداف أولية، ويجب أن يراجعها المختص ويحدد إجراءات القياس وخط الأساس قبل اعتمادها.',bidirectional:true,alignment:AlignmentType.RIGHT,spacing:{before:280}})
 ];
 const document=new Document({sections:[{children:paragraphs}]});
 const blob=await Packer.toBlob(document);
 download(blob,`SparkEdu-Plan-${plan.child.replace(/[^\p{L}\p{N}-]+/gu,'-')}.docx`);
}
