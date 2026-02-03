import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'

export default defineConfig({
  plugins: [
    react(),
    svgr(),
  ],
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          recharts: ['recharts'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    // Proxy para ESP32 - solución alternativa CORS
    proxy: {
      '/api/esp32': {
        target: 'http://192.168.100.134',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/esp32/, ''),
        timeout: 30000, // 30 segundos timeout
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
            // Agregar headers para evitar timeout
            proxyReq.setHeader('Connection', 'keep-alive');
            proxyReq.setHeader('Keep-Alive', 'timeout=30');
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('📥 Proxy response:', proxyRes.statusCode, req.url);
            // Agregar headers CORS al proxy
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          });
        }
      }
    }
  },
})


