/**
 * Lazy Loading de Componentes para Optimización de Performance
 * Code Splitting automático para reducir bundle inicial
 */

import { lazy } from 'react';

// Componentes principales (carga inmediata)
// App.jsx, Header.jsx, ShowpH.jsx se cargan normalmente

// Componentes secundarios (lazy loading)
export const AdminPanel = lazy(() => import('../AdminPanel.jsx'));
export const AutomaticDosing = lazy(() => import('../AutomaticDosing.jsx'));
export const ManualDosing = lazy(() => import('../ManualDosing.jsx'));
export const PHChart = lazy(() => import('../PHChart.jsx'));
export const ScheduledDosing = lazy(() => import('../ScheduledDosing.jsx'));
export const SettingsPage = lazy(() => import('../SettingsPage.jsx'));
export const PoolManager = lazy(() => import('../PoolManager.jsx'));
export const DeviceRegistration = lazy(() => import('../DeviceRegistration.jsx'));
export const AppTutorial = lazy(() => import('../AppTutorial.jsx'));
export const WiFiConfig = lazy(() => import('../WiFiConfig.jsx'));
export const WiFiQRGenerator = lazy(() => import('../WiFiQRGenerator.jsx'));
export const WiFiQRSetup = lazy(() => import('../WiFiQRSetup.jsx'));

// Preload de componentes críticos
export const preloadCriticalComponents = () => {
  // Precargar componentes que probablemente se usarán pronto
  import('../PHChart.jsx');
  import('../AutomaticDosing.jsx');
  import('../ManualDosing.jsx');
};

// Preload de componentes de configuración
export const preloadSettingsComponents = () => {
  import('../SettingsPage.jsx');
  import('../DeviceRegistration.jsx');
  import('../WiFiConfig.jsx');
};

// Preload de componentes de administración
export const preloadAdminComponents = () => {
  import('../AdminPanel.jsx');
  import('../PoolManager.jsx');
};
