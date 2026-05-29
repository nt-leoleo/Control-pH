const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Cargar credenciales
const credentialsPath = path.join(__dirname, 'scripts', 'firebase-admin-key.json');
const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://control-ph-82951.firebaseio.com'
});

const db = admin.firestore();

async function checkFirestoreUrls() {
  try {
    console.log('🔍 Verificando URLs en Firestore...\n');
    
    const latestDoc = await db.collection('app-versions').doc('latest').get();
    
    if (!latestDoc.exists) {
      console.error('❌ No existe app-versions/latest');
      return;
    }
    
    const data = latestDoc.data();
    console.log('📋 Contenido de app-versions/latest:');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n🌐 URLs encontradas:');
    console.log(`apkUrl: ${data.apkUrl}`);
    console.log(`zipUrl: ${data.zipUrl}`);
    
    if (data.apkUrl) {
      console.log('\n🔗 Verificando APK URL...');
      try {
        const response = await fetch(data.apkUrl, { method: 'HEAD' });
        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log(`Content-Type: ${response.headers.get('content-type')}`);
        console.log(`Content-Length: ${response.headers.get('content-length')}`);
        console.log(`Content-Disposition: ${response.headers.get('content-disposition') || 'No disponible'}`);
      } catch (e) {
        console.error(`Error verificando: ${e.message}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkFirestoreUrls();
