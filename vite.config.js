import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Lisensi semua pustaka yang ikut dibundel (React, Leaflet, …) → dist/lisensi-pihak-ketiga.md.
    // Minifier membuang komentar hak cipta dari kode, padahal mis. lisensi BSD Leaflet mewajibkan
    // pemberitahuannya ikut disebarkan bersama hasil build.
    license: { fileName: 'lisensi-pihak-ketiga.md' },
    rollupOptions: {
      output: {
        // React jarang berubah → chunk sendiri agar tetap ter-cache walau kode app di-deploy ulang.
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
        },
      },
    },
  },
})
