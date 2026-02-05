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
        // Cargar configuración del usuario
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
      console.error('❌ Error login:', error.message);
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
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const defaultConfig = {
        // Configuración por defecto de la piscina
        phMin: 7.0,
        phMax: 7.8,
        autoDosingEnabled: true,
        notifications: true,
        esp32IP: '192.168.100.134',
        thingSpeakChannel: '3249157',
        
        // Metadatos
        createdAt: new Date(),
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL
      };

      await setDoc(userRef, defaultConfig);
      setUserConfig(defaultConfig);
      console.log('✅ Usuario creado con configuración por defecto');
    }
  };

  const loadUserConfig = async (uid) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        setUserConfig(userSnap.data());
        console.log('✅ Configuración cargada:', userSnap.data());
      }
    } catch (error) {
      console.error('❌ Error cargando configuración:', error);
    }
  };

  const updateUserConfig = async (newConfig) => {
    if (!user) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        ...newConfig,
        updatedAt: new Date()
      });
      
      setUserConfig(prev => ({ ...prev, ...newConfig }));
      console.log('✅ Configuración actualizada:', newConfig);
    } catch (error) {
      console.error('❌ Error actualizando configuración:', error);
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