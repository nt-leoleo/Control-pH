import { BleClient } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';

export const BLE_PROVISION_SERVICE_UUID = '7f36b130-9d9f-4a9d-a2d8-14f6b32a1001';
export const BLE_PROVISION_WRITE_UUID = '7f36b131-9d9f-4a9d-a2d8-14f6b32a1001';
export const BLE_PROVISION_STATUS_UUID = '7f36b132-9d9f-4a9d-a2d8-14f6b32a1001';

const DEVICE_NAME_PREFIX = 'SensorPH_';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const textToDataView = (value) => {
  const bytes = new TextEncoder().encode(value);
  return new DataView(bytes.buffer);
};

const dataViewToText = (value) => {
  const bytes = new Uint8Array(value.buffer);
  return new TextDecoder().decode(bytes);
};

export const bleProvisioning = {
  async ensureReady() {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('BLE solo esta disponible en la app movil.');
    }

    await BleClient.initialize();
    const isEnabled = await BleClient.isEnabled();
    if (!isEnabled) {
      await BleClient.requestEnable();
    }
  },

  async findDevice(timeoutMs = 12000) {
    await this.ensureReady();

    return new Promise(async (resolve, reject) => {
      let timedOut = false;
      const timeout = setTimeout(async () => {
        timedOut = true;
        try {
          await BleClient.stopLEScan();
        } catch {
          // no-op
        }
        reject(new Error('No encontramos el dispositivo cerca. Acerca el telefono e intenta de nuevo.'));
      }, timeoutMs);

      try {
        await BleClient.requestLEScan(
          {
            services: [BLE_PROVISION_SERVICE_UUID]
          },
          async (result) => {
            if (timedOut) {
              return;
            }

            const localName = result.localName || '';
            if (!localName.startsWith(DEVICE_NAME_PREFIX)) {
              return;
            }

            clearTimeout(timeout);
            await BleClient.stopLEScan();
            resolve({
              deviceId: result.device.deviceId,
              name: localName
            });
          }
        );
      } catch (error) {
        clearTimeout(timeout);
        reject(new Error(`No se pudo iniciar Bluetooth: ${error.message}`));
      }
    });
  },

  async scanDevices(timeoutMs = 10000) {
    await this.ensureReady();
    const found = new Map();

    await BleClient.requestLEScan(
      {},
      (result) => {
        const deviceId = result.device.deviceId;
        if (!deviceId) {
          return;
        }

        const localName = (result.localName || '').trim();
        const fallbackName = `Dispositivo ${deviceId.slice(-5)}`;
        const nextName = localName || fallbackName;

        const previous = found.get(deviceId);
        found.set(deviceId, {
          deviceId: result.device.deviceId,
          name: previous?.name && previous.name !== fallbackName ? previous.name : nextName
        });
      }
    );

    await sleep(timeoutMs);
    try {
      await BleClient.stopLEScan();
    } catch {
      // no-op
    }

    return Array.from(found.values());
  },

  async connect(deviceId) {
    await this.ensureReady();
    await BleClient.connect(deviceId);
    await sleep(400);
  },

  async disconnect(deviceId) {
    if (!deviceId) {
      return;
    }
    try {
      await BleClient.disconnect(deviceId);
    } catch {
      // no-op
    }
  },

  async sendCredentials(deviceId, ssid, password) {
    const payload = JSON.stringify({
      ssid: (ssid || '').trim(),
      password: password || ''
    });

    await BleClient.write(
      deviceId,
      BLE_PROVISION_SERVICE_UUID,
      BLE_PROVISION_WRITE_UUID,
      textToDataView(payload)
    );
  },

  async waitForStatus(deviceId, timeoutMs = 15000) {
    return new Promise(async (resolve, reject) => {
      let settled = false;

      const finish = (handler) => async (value) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        try {
          await BleClient.stopNotifications(deviceId, BLE_PROVISION_SERVICE_UUID, BLE_PROVISION_STATUS_UUID);
        } catch {
          // no-op
        }
        handler(value);
      };

      const timeout = setTimeout(
        finish(() => reject(new Error('No hubo respuesta del dispositivo. Intenta nuevamente.'))),
        timeoutMs
      );

      try {
        await BleClient.startNotifications(
          deviceId,
          BLE_PROVISION_SERVICE_UUID,
          BLE_PROVISION_STATUS_UUID,
          finish((value) => {
            try {
              const raw = dataViewToText(value);
              resolve(JSON.parse(raw));
            } catch {
              reject(new Error('Respuesta BLE invalida del dispositivo.'));
            }
          })
        );
      } catch (error) {
        clearTimeout(timeout);
        reject(new Error(`No se pudo escuchar la respuesta BLE: ${error.message}`));
      }
    });
  }
  ,
  async provisionDevice(deviceId, ssid, password) {
    await this.connect(deviceId);
    try {
      await this.sendCredentials(deviceId, ssid, password);
      return await this.waitForStatus(deviceId, 20000);
    } finally {
      await this.disconnect(deviceId);
    }
  }
};

