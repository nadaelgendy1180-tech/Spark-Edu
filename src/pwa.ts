/** Register a static-shell service worker. It never stores Firebase user data. */
export function registerSparkPWA(){
  if(!('serviceWorker' in navigator))return;
  const register=()=>{
    navigator.serviceWorker.register('/sw.js',{scope:'/'})
      .catch((error:unknown)=>console.info('تعذر تشغيل دعم تثبيت Spark Edu:',error));
  };
  if(document.readyState==='complete')register();
  else window.addEventListener('load',register,{once:true});
}
