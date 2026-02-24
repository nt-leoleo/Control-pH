import {
  arrayRemove,
  arrayUnion,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteField
} from 'firebase/firestore';
import { db } from './firebase';

export const DEVICE_ID_REGEX = /^[A-Z0-9_-]{6,64}$/;
const DEFAULT_DEVICE_NAME = 'Piscina principal';

export const normalizeDeviceId = (rawValue) => {
  const upper = String(rawValue || '').toUpperCase();
  const candidates = upper.match(/[A-Z0-9_-]{6,64}/g) || [];
  if (candidates.length === 0) {
    return '';
  }

  return candidates.sort((a, b) => b.length - a.length)[0];
};

const isPermissionDeniedError = (error) =>
  error?.code === 'permission-denied' ||
  /missing or insufficient permissions/i.test(String(error?.message || ''));

export const persistUserDeviceLink = async ({ uid, deviceId, deviceName }) => {
  if (!uid || !deviceId) {
    return;
  }

  const userRef = doc(db, 'users', uid);
  const now = new Date();
  const resolvedName = (deviceName || '').trim() || DEFAULT_DEVICE_NAME;

  await setDoc(
    userRef,
    {
      linkedDeviceIds: arrayUnion(deviceId),
      updatedAt: now
    },
    { merge: true }
  );

  try {
    await updateDoc(userRef, {
      [`linkedDeviceNames.${deviceId}`]: resolvedName,
      updatedAt: now
    });
  } catch (error) {
    if (error?.code !== 'not-found') {
      throw error;
    }

    await setDoc(
      userRef,
      {
        linkedDeviceNames: {
          [deviceId]: resolvedName
        },
        updatedAt: now
      },
      { merge: true }
    );
  }
};

export const removeUserDeviceLink = async ({ uid, deviceId }) => {
  if (!uid || !deviceId) {
    return;
  }

  const userRef = doc(db, 'users', uid);
  const now = new Date();

  try {
    await updateDoc(userRef, {
      linkedDeviceIds: arrayRemove(deviceId),
      [`linkedDeviceNames.${deviceId}`]: deleteField(),
      updatedAt: now
    });
  } catch (error) {
    if (error?.code === 'not-found') {
      return;
    }
    throw error;
  }
};

export const syncSharedDeviceLink = async ({ uid, userEmail, deviceId, deviceName, source }) => {
  if (!uid || !deviceId) {
    return { synced: false };
  }

  const deviceRef = doc(db, 'devices', deviceId);
  const now = new Date();
  const resolvedName = (deviceName || '').trim() || DEFAULT_DEVICE_NAME;

  try {
    const deviceDoc = await getDoc(deviceRef);
    if (deviceDoc.exists()) {
      await updateDoc(deviceRef, {
        userIds: arrayUnion(uid),
        updatedAt: now,
        lastSeen: now
      });
    } else {
      await setDoc(deviceRef, {
        userId: uid,
        userIds: [uid],
        name: resolvedName,
        createdAt: now,
        lastSeen: now,
        metadata: {
          registeredFrom: source || 'web-app',
          userEmail: userEmail || ''
        }
      });
    }

    return { synced: true };
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      return {
        synced: false,
        warning:
          'No se pudo actualizar el registro compartido del dispositivo. El enlace en tu cuenta ya quedo guardado.'
      };
    }

    throw error;
  }
};

export const syncSharedDeviceUnlink = async ({ uid, deviceId }) => {
  if (!uid || !deviceId) {
    return { synced: false };
  }

  const deviceRef = doc(db, 'devices', deviceId);
  try {
    const deviceSnap = await getDoc(deviceRef);

    if (!deviceSnap.exists()) {
      return { synced: false };
    }

    const deviceData = deviceSnap.data();
    const linkedUserIds = Array.isArray(deviceData.userIds) ? deviceData.userIds : [];
    const hasLinkedArray = linkedUserIds.length > 0;

    if (hasLinkedArray && linkedUserIds.length > 1) {
      await updateDoc(deviceRef, {
        userIds: arrayRemove(uid),
        updatedAt: new Date()
      });
    } else if (hasLinkedArray && linkedUserIds.length === 1) {
      await deleteDoc(deviceRef);
    } else if (deviceData.userId === uid) {
      await deleteDoc(deviceRef);
    }

    return { synced: true };
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      return {
        synced: false,
        warning:
          'Se desvinculo de tu cuenta, pero no se pudo limpiar el registro compartido por permisos de Firestore.'
      };
    }

    throw error;
  }
};
