import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { XR, createXRStore } from '@react-three/xr'
import * as THREE from 'three'
import { MonitorRenderer } from './monitor.js'

const store = createXRStore()

/**
 * The spike's whole thesis in one component:
 * ONE MonitorRenderer instance drives BOTH clients.
 *  - its canvas is shown directly as the 2D client (bottom-left inspector), and
 *  - the same canvas is a CanvasTexture on a 3D plane inside the XR scene.
 * Nothing about the monitor code changes between them.
 */
function useMonitor() {
  const monitor = useMemo(() => {
    const canvas = document.createElement('canvas')
    return new MonitorRenderer(canvas)
  }, [])
  useEffect(() => { monitor.start(); return () => monitor.stop() }, [monitor])
  return monitor
}

function MonitorScreen({ monitor, position, rotation }) {
  const texRef = useRef()
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(monitor.canvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.minFilter = THREE.LinearFilter
    t.generateMipmaps = false
    return t
  }, [monitor])
  texRef.current = texture

  // The monitor draws on its own rAF; we just tell three the texture changed.
  useFrame(() => { texture.needsUpdate = true })

  const w = 1.05
  const h = w * (768 / 1024)

  return (
    <group position={position} rotation={rotation}>
      {/* device bezel — proves diegetic UI: the screen is a surface in the world.
          Sits BEHIND the screen plane; a front-of-plane bezel would occlude it. */}
      <mesh position={[0, 0, -0.032]}>
        <boxGeometry args={[w + 0.09, h + 0.14, 0.05]} />
        <meshStandardMaterial color="#151a1f" roughness={0.85} metalness={0.15} />
      </mesh>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {/* rotary knob, bottom-right of the bezel */}
      <mesh position={[w / 2 + 0.005, -h / 2 - 0.035, 0.012]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.026, 0.026, 0.018, 24]} />
        <meshStandardMaterial color="#2b3238" roughness={0.6} metalness={0.4} />
      </mesh>
    </group>
  )
}

function Patient() {
  // Deliberately crude. The spike tests whether a patient can occupy space
  // next to the monitor in VR — not whether we can model a dog.
  return (
    <group position={[0, 0.86, -1.15]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.11, 0.34, 8, 20]} />
        <meshStandardMaterial color="#8d7f73" roughness={0.9} />
      </mesh>
      <mesh position={[0.28, 0.04, 0]}>
        <sphereGeometry args={[0.085, 20, 16]} />
        <meshStandardMaterial color="#8d7f73" roughness={0.9} />
      </mesh>
      {/* treatment table */}
      <mesh position={[0, -0.16, 0]}>
        <boxGeometry args={[1.2, 0.05, 0.6]} />
        <meshStandardMaterial color="#20272d" roughness={0.7} metalness={0.3} />
      </mesh>
    </group>
  )
}

function Scene({ monitor }) {
  return (
    <>
      <color attach="background" args={['#05080d']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 4, 2]} intensity={0.7} />
      <pointLight position={[0, 2, 0]} intensity={12} distance={7} color="#6f8fa8" />

      {/* Monitor on an arm above/right of the table — where it sits in a real ICU */}
      <MonitorScreen monitor={monitor} position={[0.85, 1.55, -0.9]} rotation={[0, -0.42, 0]} />
      {/* Second screen, angled — proves multi-device diegetic layout works */}
      <MonitorScreen monitor={monitor} position={[-0.95, 1.5, -0.85]} rotation={[0, 0.45, 0]} />

      <Patient />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#0a1016" roughness={1} />
      </mesh>
    </>
  )
}

/** Desktop-only: let Dan look around. Harmless in XR (headset pose wins). */
function DesktopControls() {
  return <OrbitControls target={[0, 1.32, -0.85]} enablePan={false} minDistance={0.6} maxDistance={5} />
}

export default function App() {
  const monitor = useMonitor()
  const inspectorRef = useRef(null)
  const [xrSupported, setXrSupported] = useState(null)
  const [alarm, setAlarm] = useState('normal')

  useEffect(() => {
    if (!navigator.xr) { setXrSupported(false); return }
    navigator.xr.isSessionSupported('immersive-vr').then(setXrSupported).catch(() => setXrSupported(false))
  }, [])

  // 2D client: mount the SAME canvas the texture reads from.
  useEffect(() => {
    const host = inspectorRef.current
    if (!host) return
    monitor.canvas.style.width = '100%'
    monitor.canvas.style.display = 'block'
    host.appendChild(monitor.canvas)
    return () => { if (monitor.canvas.parentNode === host) host.removeChild(monitor.canvas) }
  }, [monitor])

  const crash = () => {
    monitor.setVitals({ hr: 208, spo2: 79, rr: 38, etco2: 21, sys: 62, dia: 38, map: 46 })
    monitor.setAlarm('critical'); setAlarm('critical')
  }
  const settle = () => {
    monitor.setVitals({ hr: 128, spo2: 94, rr: 22, etco2: 34, sys: 96, dia: 58, map: 71 })
    monitor.setAlarm('normal'); setAlarm('normal')
  }

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas
        camera={{ position: [0, 1.55, 0.75], fov: 65 }}
        onCreated={({ camera }) => camera.lookAt(0, 1.32, -0.85)}
      >
        <XR store={store}>
          <Scene monitor={monitor} />
          <DesktopControls />
        </XR>
      </Canvas>

      <div style={panel}>
        <div style={{ fontSize: 13, letterSpacing: '.08em', color: '#7d94a4', marginBottom: 8 }}>
          VETCREW · ADR-001 WEBXR SPIKE
        </div>
        <button style={btn(true)} onClick={() => store.enterVR()}>Enter VR</button>
        <button style={btn(false)} onClick={alarm === 'normal' ? crash : settle}>
          {alarm === 'normal' ? 'Trigger crash' : 'Stabilise'}
        </button>
        <div style={{ fontSize: 12, marginTop: 10, color: xrSupported ? '#4ad991' : '#e0a13a', maxWidth: 260 }}>
          {xrSupported === null && 'Checking WebXR support…'}
          {xrSupported === true && '✓ immersive-vr supported — Enter VR is live.'}
          {xrSupported === false && 'No immersive-vr here (expected on desktop). Open this URL on the Quest 3 browser over https.'}
        </div>
        <div style={{ fontSize: 12, marginTop: 10, color: '#5f7382', maxWidth: 260, lineHeight: 1.45 }}>
          The panel below is the <b>same canvas</b> painted onto both 3D screens.
          One renderer, two clients — that is the thing being proven.
        </div>
        <div ref={inspectorRef} style={{ marginTop: 8, width: 260, border: '1px solid #1d2933', borderRadius: 4, overflow: 'hidden' }} />
      </div>
    </div>
  )
}

const panel = {
  position: 'absolute', top: 16, left: 16, padding: 14,
  background: 'rgba(7,11,16,.82)', border: '1px solid #1d2933', borderRadius: 8,
  backdropFilter: 'blur(6px)',
}
const btn = (primary) => ({
  display: 'inline-block', marginRight: 8, marginBottom: 4, padding: '9px 14px',
  background: primary ? '#0f6d7a' : 'transparent',
  color: primary ? '#eaf6f8' : '#9fb3c2',
  border: `1px solid ${primary ? '#12808f' : '#28353f'}`,
  borderRadius: 6, cursor: 'pointer', fontSize: 14,
})
