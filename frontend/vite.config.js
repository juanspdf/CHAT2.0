import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Detectar si estamos en Docker o desarrollo local
const isDocker = process.env.DOCKER_BUILD === 'true'
const certPath = path.resolve(__dirname, '../backend/certs/key.pem')
const certExists = !isDocker && fs.existsSync(certPath)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    ...(certExists && {
      https: {
        key: fs.readFileSync(path.resolve(__dirname, '../backend/certs/key.pem')),
        cert: fs.readFileSync(path.resolve(__dirname, '../backend/certs/cert.pem'))
      }
    }),
    host: '0.0.0.0', // Permite acceso desde la red local
    port: 5173,
    proxy: {
      '/api': {
        target: certExists ? 'https://localhost:3001' : 'http://localhost:5000',
        changeOrigin: true,
        secure: false // Permitir certificados self-signed
      },
      '/uploads': {
        target: certExists ? 'https://localhost:3001' : 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
