import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Production guards: Never expose test-only flags in production builds
  if (mode === 'production') {
    // List of forbidden environment variables in production
    const forbiddenVars = ['VITE_TEST_MODE', 'VITE_MOCK_API', 'VITE_DEBUG_MODE', 'VITE_SKIP_AUTH'];
    const detectedForbidden = forbiddenVars.filter(v => env[v] && env[v] !== 'false');

    if (detectedForbidden.length > 0) {
      const errorMsg = `❌ FATAL: Forbidden environment variables detected in production build:\n` +
        detectedForbidden.map(v => `  - ${v}=${env[v]}`).join('\n') + '\n' +
        'Remove these variables or set them to "false" before building for production.';
      console.error(errorMsg);
      throw new Error('Build failed: Forbidden environment variables detected in production');
    }

    // Allowlist of environment variables for production
    const allowedVars = ['VITE_API_URL', 'VITE_APP_NAME', 'VITE_APP_VERSION'];
    const allViteVars = Object.keys(env).filter(k => k.startsWith('VITE_'));
    const unauthorizedVars = allViteVars.filter(v => !allowedVars.includes(v));

    if (unauthorizedVars.length > 0) {
      console.warn(
        '⚠️  WARNING: Unauthorized VITE_ variables detected (will be ignored):\n' +
        unauthorizedVars.map(v => `  - ${v}`).join('\n')
      );
    }
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    define: {
      // Only expose safe environment variables
      // Never expose test/mock flags in production
      'import.meta.env.VITE_API_URL': JSON.stringify(
        env.VITE_API_URL || 'http://localhost:3001'
      ),
      'import.meta.env.MODE': JSON.stringify(mode),
      'import.meta.env.PROD': mode === 'production',
      'import.meta.env.DEV': mode === 'development',
      // Explicitly prevent test flags in production
      'import.meta.env.VITE_TEST_MODE': mode === 'production' ? 'false' : JSON.stringify(env.VITE_TEST_MODE),
      'import.meta.env.VITE_MOCK_API': mode === 'production' ? 'false' : JSON.stringify(env.VITE_MOCK_API),
      'import.meta.env.VITE_DEBUG_MODE': mode === 'production' ? 'false' : JSON.stringify(env.VITE_DEBUG_MODE),
    },
    build: {
      // Production optimizations
      minify: mode === 'production' ? 'esbuild' : false,
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            ui: ['@tanstack/react-query', 'axios', 'zustand'],
          },
        },
      },
    },
  };
});