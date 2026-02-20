import { useState, useEffect } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  deleteUser,
  reauthenticateWithPopup
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  writeBatch
} from 'firebase/firestore';
import { ref, remove } from 'firebase/database';
import { auth, googleProvider, db, database } from './firebase';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userConfig, setUserConfig] = useState(null);

  async function loadUserConfig(uid) {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        setUserConfig(userSnap.data());
      }
    } catch (error) {
      console.error('Error cargando configuracion:', error);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        await loadUserConfig(currentUser.uid);
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
      console.log('Login exitoso:', result.user.displayName);

      await createUserDocument(result.user);

      return result.user;
    } catch (error) {
      console.error('Error login completo:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      console.log('Logout exitoso');
    } catch (error) {
      console.error('Error logout:', error.message);
      throw error;
    }
  };

  const deleteAccount = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error('No hay una sesion activa');
    }

    const uid = currentUser.uid;

    try {
      // Firebase exige reautenticacion para eliminar la cuenta
      await reauthenticateWithPopup(currentUser, googleProvider);

      // Firestore: eliminar perfil y dispositivos vinculados
      const batch = writeBatch(db);
      const userRef = doc(db, 'users', uid);
      batch.delete(userRef);

      const devicesQuery = query(
        collection(db, 'devices'),
        where('userId', '==', uid)
      );
      const devicesSnapshot = await getDocs(devicesQuery);
      devicesSnapshot.forEach((deviceDoc) => {
        batch.delete(deviceDoc.ref);
      });

      await batch.commit();

      // Realtime Database: eliminar todo el arbol del usuario
      const userRealtimeRef = ref(database, `users/${uid}`);
      await remove(userRealtimeRef);

      // Auth: eliminar credenciales del usuario
      await deleteUser(currentUser);

      setUser(null);
      setUserConfig(null);
    } catch (error) {
      console.error('Error eliminando cuenta:', error);

      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Operacion cancelada');
      }

      if (error.code === 'auth/requires-recent-login') {
        throw new Error('Por seguridad, vuelve a iniciar sesion y reintenta');
      }

      throw new Error(error.message || 'No se pudo eliminar la cuenta');
    }
  };

  const createUserDocument = async (userData) => {
    try {
      const userRef = doc(db, 'users', userData.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const defaultConfig = {
          phTolerance: 7.4,
          phToleranceRange: 0.5,
          autoDosingEnabled: true,
          notifications: true,
          esp32IP: '192.168.100.134',
          thingSpeakChannel: '3249157',
          isConfigured: false,
          createdAt: new Date(),
          displayName: userData.displayName,
          email: userData.email,
          photoURL: userData.photoURL
        };

        await setDoc(userRef, defaultConfig);
        setUserConfig(defaultConfig);
      } else {
        setUserConfig(userSnap.data());
      }
    } catch (error) {
      console.error('Error creando documento de usuario:', error);

      if (error.code === 'permission-denied') {
        throw new Error('Error de permisos: Verifica las reglas de Firestore');
      }
      throw error;
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

      setUserConfig((prev) => ({ ...prev, ...newConfig }));
    } catch (error) {
      console.error('Error actualizando configuracion:', error);

      if (error.code === 'permission-denied') {
        throw new Error('Error de permisos: No se puede guardar la configuracion');
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
    updateUserConfig,
    deleteAccount
  };
};
