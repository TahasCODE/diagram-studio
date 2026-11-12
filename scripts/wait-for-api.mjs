const url=process.env.API_URL ? process.env.API_URL+'/health' : 'http://127.0.0.1:8090/api/health';
const deadline=Date.now()+60000;
while(Date.now()<deadline){
  try{const response=await fetch(url,{signal:AbortSignal.timeout(1000)});if(response.ok){console.log('Application is ready.');process.exit(0);}}catch{}
  await new Promise(resolve=>setTimeout(resolve,500));
}
console.error('Application did not become ready within 60 seconds.');process.exit(1);
