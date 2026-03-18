import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react({
      // Optimización de Fast Refresh
      fastRefresh: true
    }),
    svgr(),
    // Visualizer para analizar bundle size
    visualizer({
      open: false,
      gzipSize: true,
      brotliSize: true,
      filename: 'dist/stats.html'
    })
  ],
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Optimizaciones de minificación
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
        passes: 2
      },
      mangle: {
        safari10: true
      },
      format: {
        comments: false
      }
    },
    // Optimización de chunks
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks para mejor caching
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/database'],
          'charts-vendor': ['recharts'],
          'qr-vendor': ['qrcode.react', 'html5-qrcode'],
          'capacitor-vendor': ['@capacitor/core', '@capacitor/status-bar']
        },
        // Nombres de archivos con hash para cache busting
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },
    // Optimización de tamaño
    chunkSizeWarningLimit: 1000,
    // Compresión
    cssCodeSplit: true,
    // Preload de módulos críticos
    modulePreload: {
      polyfill: true
    }
  },
  // Optimizaciones de desarrollo
  server: {
    port: 5173,
    strictPort: false,
    // Proxy para ESP32
    proxy: {
      '/api/esp32': {
        target: 'http://192.168.100.134',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/esp32/, ''),
        timeout: 30000,
        proxyTimeout: 30000,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('❌ Proxy error:', err.message);
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
            }
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('📤 Proxying:', req.method, req.url, '→', proxyReq.path);
            proxyReq.setHeader('Connection', 'keep-alive');
            proxyReq.setHeader('Keep-Alive', 'timeout=30');
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('📥 Proxy response:', proxyRes.statusCode, req.url);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          });
        }
      }
    }
  },
  // Optimizaciones de resolución
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  // Optimizaciones de dependencias
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/database'
    ],
    exclude: ['@capacitor/core']
  }
})
