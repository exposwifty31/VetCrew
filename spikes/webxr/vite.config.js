import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `--host` + basicSsl-free config: WebXR requires https on-device.
// For Quest 3 testing use `pnpm dev --host` and reach it over the LAN via a
// trusted tunnel, or `adb reverse tcp:5173 tcp:5173` which counts as a secure
// origin on localhost. See README.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
})
