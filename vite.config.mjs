import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'auto-redirect-base',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const cleanUrl = req.url.split('?')[0].split('#')[0];
          
          if (cleanUrl === '/odontocloud-react') {
            const query = req.url.slice(cleanUrl.length);
            res.writeHead(301, { Location: `/odontocloud-react/${query}` });
            res.end();
            return;
          }

          if (cleanUrl === '/odontocloud-react/api/proxy-logo') {
            try {
              const queryParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
              const targetUrl = queryParams.get('url');
              if (!targetUrl) {
                res.writeHead(400);
                res.end('Missing url parameter');
                return;
              }

              const targetRes = await fetch(targetUrl);
              const contentType = targetRes.headers.get('content-type') || 'image/png';
              const buffer = await targetRes.arrayBuffer();

              res.writeHead(200, {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=86400'
              });
              res.end(Buffer.from(buffer));
            } catch (err) {
              console.error('Error in proxy-logo middleware:', err);
              res.writeHead(500);
              res.end('Error fetching image');
            }
            return;
          }

          next();
        });
      }
    }
  ],
  base: '/odontocloud-react/',
  server: {
    port: 3000,
    strictPort: true,
    open: '/odontocloud-react/',
  },
  optimizeDeps: {
    entries: ['./index.html'],
  },
})
