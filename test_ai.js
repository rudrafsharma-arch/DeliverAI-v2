require('dotenv').config({path:'C:/Users/vikram.f.sharma/DeliverAI-v2/.env'});
console.log('Model:', process.env.GROQ_MODEL);
console.log('Key set:', !!process.env.GROQ_API_KEY);
const {callAI} = require('./server/core/ai-engine');
callAI('say hi', 'You are a helpful assistant.', {maxTokens:100})
  .then(r => console.log('RESPONSE:', r))
  .catch(e => console.log('ERROR:', e.message));