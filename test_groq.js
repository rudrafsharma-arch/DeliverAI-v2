require('dotenv').config({path:'C:/Users/vikram.f.sharma/DeliverAI-v2/.env'});
fetch('https://api.groq.com/openai/v1/chat/completions',{
  method:'POST',
  headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.GROQ_API_KEY},
  body:JSON.stringify({model:'openai/gpt-oss-20b',max_tokens:100,messages:[{role:'user',content:'say hi'}]})
}).then(r=>r.json()).then(d=>{
  const msg = d.choices[0].message;
  console.log('content:', JSON.stringify(msg.content));
  console.log('reasoning:', JSON.stringify(msg.reasoning));
  console.log('full msg keys:', Object.keys(msg));
}).catch(e=>console.log('ERROR:',e.message));