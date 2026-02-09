import { useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc 
} from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userConfig, setUserConfig] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        await loadUserConfig(user.uid);
      } else {
        setUserConfig(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log('✅ Login exitoso:', result.user.displayName);
      
      // Crear documento de usuario si no existe
      await createUserDocument(result.user);
      
      return result.user;
    } catch (error) {
      console.error('❌ Error login completo:', error);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error message:', error.message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      console.log('✅ Logout exitoso');
    } catch (error) {
      console.error('❌ Error logout:', error.message);
      throw error;
    }
  };

  const createUserDocument = async (user) => {
    try {
      console.log('👤 [Auth] Creando/verificando documento de usuario:', user.uid);
      
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        console.log('📝 [Auth] Usuario no existe, creando documento...');
        
        const defaultConfig = {
          // Configuración por defecto de la piscina
          phTolerance: 7.4,
          phToleranceRange: 0.5,
          autoDosingEnabled: true,
          notifications: true,
          esp32IP: '192.168.100.134',
          thingSpeakChannel: '3249157',
          isConfigured: false, // Importante: false para mostrar onboarding
          
          // Metadatos
          createdAt: new Date(),
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL
        };

        await setDoc(userRef, defaultConfig);
        setUserConfig(defaultConfig);
        console.log('✅ [Auth] Usuario creado con configuración por defecto');
      } else {
        console.log('✅ [Auth] Usuario existente encontrado');
        const userData = userSnap.data();
        setUserConfig(userData);
        console.log('📊 [Auth] Configuración cargada:', userData);
      }
    } catch (error) {
      console.error('❌ [Auth] Error creando documento de usuario:', error);
      console.error('❌ [Auth] Error code:', error.code);
      console.error('❌ [Auth] Error message:', error.message);
      
      // Si es un error de permisos, mostrar mensaje específico
      if (error.code === 'permission-denied') {
        throw new Error('Error de permisos: Verifica las reglas de Firestore');
      }
      throw error;
    }
  };

  const loadUserConfig = async (uid) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        setUserConfig(userSnap.data());
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
    }
  };

  const updateUserConfig = async (newConfig) => {
    if (!user) return;

    try {
      console.log('💾 [Auth] Actualizando configuración:', newConfig);
      
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        ...newConfig,
        updatedAt: new Date()
      });
      
      setUserConfig(prev => ({ ...prev, ...newConfig }));
      console.log('✅ [Auth] Configuración actualizada exitosamente');
    } catch (error) {
      console.error('❌ [Auth] Error actualizando configuración:', error);
      console.error('❌ [Auth] Error code:', error.code);
      console.error('❌ [Auth] User ID:', user?.uid);
      
      if (error.code === 'permission-denied') {
        throw new Error('Error de permisos: No se puede guardar la configuración');
      }
      throw error;
    }
  };

  return {
    user,
    userConfig,
    loading,
    loginWithGoogle,
    logout,
    updateUserConfig
  };
};