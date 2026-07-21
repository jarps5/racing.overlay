// firebase-config.js
//
// This is the ONLY file you need to edit to get live overlays working.
//
// 1. Go to https://console.firebase.google.com -> Add project (free "Spark" plan).
// 2. In the project, go to Build -> Realtime Database -> Create Database
//    -> start in TEST MODE (fine for a hobby/private telemetry link).
// 3. Go to Project settings (gear icon) -> General -> Your apps -> Web app (</> icon).
// 4. Copy the firebaseConfig object it gives you and paste the values below.

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  databaseURL: 'https://YOUR_PROJECT-default-rtdb.firebaseio.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};
