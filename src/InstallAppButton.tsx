import {useEffect,useState} from 'react';
import {Download} from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome:'accepted'|'dismissed';platform:string}>;
};

export default function InstallAppButton({compact=false}:{compact?:boolean}) {
  const [promptEvent,setPromptEvent]=useState<InstallPromptEvent|null>(null);
  const [installed,setInstalled]=useState(false);
  useEffect(()=>{
    const checkDisplay=()=>window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && Boolean((navigator as Navigator & {standalone?:boolean}).standalone));
    setInstalled(checkDisplay());
    const onPrompt=(event:Event)=>{event.preventDefault();setPromptEvent(event as InstallPromptEvent);};
    const onInstalled=()=>{setInstalled(true);setPromptEvent(null);};
    window.addEventListener('beforeinstallprompt',onPrompt);
    window.addEventListener('appinstalled',onInstalled);
    return()=>{window.removeEventListener('beforeinstallprompt',onPrompt);window.removeEventListener('appinstalled',onInstalled);};
  },[]);
  if(installed)return null;
  const install=async()=>{
    if(promptEvent){
      try{await promptEvent.prompt();await promptEvent.userChoice;setPromptEvent(null);}
      catch{window.alert('افتح قائمة المتصفح واختر تثبيت التطبيق أو إضافته إلى الشاشة الرئيسية.');}
      return;
    }
    const ios=/iPad|iPhone|iPod/.test(navigator.userAgent);
    window.alert(ios
      ? 'من Safari: اضغط مشاركة، ثم «إضافة إلى الشاشة الرئيسية». قد تحتاج فتح الموقع في Safari أولًا.'
      : 'من قائمة المتصفح (⋮) اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». قد لا يدعم متصفحك التثبيت المباشر.');
  };
  return <button className={'install-app-button'+(compact?' compact':'')} type="button" onClick={install}
    title="تثبيت SPEAK على الجهاز"><Download size={16} aria-hidden="true"/>{compact?'تثبيت التطبيق':'تثبيت SPEAK كتطبيق ويب'}</button>;
}
