/**
 * Script para configurar el primer usuario administrador
 * 
 * Uso:
 * node set-admin.js <email-del-usuario>
 * 
 * Ejemplo:
 * node set-admin.js admin@example.com
 */

const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: 'https://control-ph-82951-default-rtdb.firebaseio.com'
});

const db = admin.firestore();

async function setAdmin(email) {
  try {
    console.log(`🔍 Buscando usuario con email: ${email}`);
    
    // Buscar usuario por email en Firebase Auth
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`✅ Usuario encontrado: ${userRecord.uid}`);
    
    // Actualizar rol en Firestore
    await db.collection('users').doc(userRecord.uid).set({
      role: 'admin',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log(`✅ Usuario ${email} configurado como administrador`);
    console.log(`   UID: ${userRecord.uid}`);
    console.log(`   Nombre: ${userRecord.displayName || 'Sin nombre'}`);
    console.log(`\n🎉 ¡Listo! El usuario ahora puede acceder al panel de administración completo.`);
    
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    
    if (error.code === 'auth/user-not-found') {
      console.error(`\n💡 El usuario con email ${email} no existe en Firebase Auth.`);
      console.error(`   Asegúrate de que el usuario se haya registrado primero.`);
    }
    
    process.exit(1);
  }
}

// Obtener email de argumentos de línea de comandos
const email = process.argv[2];

if (!email) {
  console.error('❌ Error: Debes proporcionar un email');
  console.error('\nUso: node set-admin.js <email-del-usuario>');
  console.error('Ejemplo: node set-admin.js admin@example.com');
  process.exit(1);
}

// Validar formato de email
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  console.error(`❌ Error: "${email}" no es un email válido`);
  process.exit(1);
}

// Ejecutar
setAdmin(email);
