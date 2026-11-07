/** Register a static shell service worker. No user records are cached. */
export function registerSpeakPWA(){
  if(!('serviceWorker' in navigator))return;
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('/sw.js',{scope:'/'})
      .catch((error:unknown)=>console.info('تعذر تشغيل دعم تثبيت SPEAK:',error));
  },{once:true});
}
