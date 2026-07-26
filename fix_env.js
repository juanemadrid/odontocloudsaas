const fs = require('fs');
const content = `VITE_API_KEY=AIzaSyC70mGCRrjE8iOap8iTHuid8HEuyadue8Y
VITE_AUTH_DOMAIN=odontocloud-d92ac.firebaseapp.com
VITE_PROJECT_ID=odontocloud-d92ac
VITE_STORAGE_BUCKET=odontocloud-d92ac.firebasestorage.app
VITE_MESSAGING_SENDER_ID=267020714981
VITE_APP_ID=1:267020714981:web:a44416ea83aa1d1172650c
VITE_MEASUREMENT_ID=G-ZMCC5CFY0C`;
fs.writeFileSync('.env', content, 'utf8');
console.log('Env file fixed!');
