import { useState, useEffect } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  deleteUser,
  reauthenticateWithPopup
} from 'firebase/auth';
import {
  arrayRemove,
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
      } else {
        setUserConfig(null);
      }
    } catch (error) {
      console.error('Error cargando configuracion:', error);
      setUserConfig(null);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);
      setUserConfig(null);

      if (currentUser) {
        await loadUserConfig(currentUser.uid);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
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
      await reauthenticateWithPopup(currentUser, googleProvider);

      const batch = writeBatch(db);
      const userRef = doc(db, 'users', uid);
      batch.delete(userRef);

      const [legacyDevicesSnapshot, linkedDevicesSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'devices'), where('userId', '==', uid))),
        getDocs(query(collection(db, 'devices'), where('userIds', 'array-contains', uid)))
      ]);

      const devicesMap = new Map();
      legacyDevicesSnapshot.forEach((deviceDoc) => devicesMap.set(deviceDoc.id, deviceDoc));
      linkedDevicesSnapshot.forEach((deviceDoc) => devicesMap.set(deviceDoc.id, deviceDoc));

      devicesMap.forEach((deviceDoc) => {
        const deviceData = deviceDoc.data();
        const linkedUserIds = Array.isArray(deviceData.userIds) ? deviceData.userIds : [];

        if (linkedUserIds.length > 1) {
          const remaining = linkedUserIds.filter((id) => id !== uid);
          const updateData = {
            userIds: arrayRemove(uid),
            updatedAt: new Date()
          };

          if (deviceData.userId === uid && remaining.length > 0) {
            updateData.userId = remaining[0];
          }

          batch.update(deviceDoc.ref, updateData);
        } else {
          batch.delete(deviceDoc.ref);
        }
      });

      await batch.commit();

      const userRealtimeRef = ref(database, `users/${uid}`);
      await remove(userRealtimeRef);

      await deleteUser(currentUser);

      localStorage.removeItem('poolConfig');
      localStorage.removeItem('esp32_device_id');
      window.location.hash = '';

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
          tutorialCompleted: false,
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
