import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

// ─── Types ───────────────────────────────────────────────────────────────────

type Zone = 'design' | 'ai' | 'astrion' | null;

interface Pulse {
  from: number;
  to: number;
  t: number;
  speed: number;
  zone: 0 | 1 | 2;
}

// ─── Zone config ─────────────────────────────────────────────────────────────

const ZONE_ROUTES: Record<NonNullable<Zone>, string> = {
  design: '/work',
  ai: '/ai',
  astrion: '/astrion',
};

const ZONE_ACTIVE_COLOR: Record<0 | 1 | 2, [number, number, number]> = {
  0: [1.0, 0.38, 0.18],  // design — warm orange
  1: [0.0, 0.9,  1.0],  // ai — electric cyan
  2: [0.26, 0.53, 1.0], // astrion — deep blue
};

const BASE_RGB: [number, number, number] = [0.08, 0.24, 0.55];

const LABEL_COLORS: Record<NonNullable<Zone>, string> = {
  design:  '#ff6030',
  ai:      '#00e5ff',
  astrion: '#4488ff',
};

// ─── Data generation ─────────────────────────────────────────────────────────

function generateBrain(count: number) {
  const positions = new Float32Array(count * 3);
  const zoneIds   = new Uint8Array(count);

  for (let i = 0; i < count; i++) {
    const side  = Math.random() > 0.5 ? 1 : -1;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = 0.82 + Math.random() * 0.18;

    let x = r * Math.sin(phi) * Math.cos(theta) * 0.88 + side * 0.28;
    let y = r * Math.sin(phi) * Math.sin(theta) * 0.62;
    let z = r * Math.cos(phi) * 0.68;

    // Organic gyri noise
    const n = Math.sin(x * 8) * Math.cos(y * 8) * Math.sin(z * 8) * 0.04;
    const d = Math.sqrt(x * x + y * y + z * z) || 1;
    x += (x / d) * n;
    y += (y / d) * n;

    positions[i * 3]     = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    zoneIds[i] = x < -0.22 ? 0 : x > 0.22 ? 2 : 1;
  }

  return { positions, zoneIds };
}

function generateConnections(positions: Float32Array, max: number): [number, number][] {
  const n    = positions.length / 3;
  const out: [number, number][] = [];
  const sq   = 0.21 * 0.21;

  outer:
  for (let i = 0; i < n; i++) {
    const xi = positions[i * 3], yi = positions[i * 3 + 1], zi = positions[i * 3 + 2];
    for (let j = i + 1; j < n; j++) {
      const dx = xi - positions[j * 3];
      const dy = yi - positions[j * 3 + 1];
      const dz = zi - positions[j * 3 + 2];
      if (dx*dx + dy*dy + dz*dz < sq) {
        out.push([i, j]);
        if (out.length >= max) break outer;
      }
    }
  }
  return out;
}

function buildLineBuffer(pos: Float32Array, conns: [number, number][]): Float32Array {
  const buf = new Float32Array(conns.length * 6);
  conns.forEach(([a, b], i) => {
    buf[i*6]   = pos[a*3];   buf[i*6+1] = pos[a*3+1]; buf[i*6+2] = pos[a*3+2];
    buf[i*6+3] = pos[b*3];   buf[i*6+4] = pos[b*3+1]; buf[i*6+5] = pos[b*3+2];
  });
  return buf;
}

// ─── Orbital rings (Astrion zone) ─────────────────────────────────────────

function OrbitalRings({ visible }: { visible: boolean }) {
  const group = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.4;
    group.current.rotation.x += delta * 0.15;
    group.current.children.forEach((child, i) => {
      child.rotation.z += delta * (0.3 + i * 0.12);
    });
  });

  const opacity = visible ? 0.55 : 0;

  return (
    <group ref={group} position={[0.85, 0, 0]}>
      {[0.55, 0.75, 0.95].map((r, i) => (
        <mesh key={i} rotation={[Math.PI / 2 + i * 0.6, 0, i * 0.4]}>
          <ringGeometry args={[r, r + 0.012, 64]} />
          <meshBasicMaterial
            color="#4488ff"
            transparent
            opacity={opacity}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── Scene ───────────────────────────────────────────────────────────────────

const MAX_PULSES = 30;

function BrainScene({
  activeZone,
  scanProgress,
}: {
  activeZone: Zone;
  scanProgress: number;
}) {
  const { positions, zoneIds } = useMemo(() => generateBrain(2200), []);
  const connections = useMemo(() => generateConnections(positions, 420), [positions]);
  const lineBuffer  = useMemo(() => buildLineBuffer(positions, connections), [positions, connections]);

  const groupRef    = useRef<THREE.Group>(null);
  const pointsRef   = useRef<THREE.Points>(null);
  const pulseMeshRef = useRef<THREE.Points>(null);
  const pulses      = useRef<Pulse[]>([]);
  const pulsePosRef = useRef(new Float32Array(MAX_PULSES * 3));

  // Per-particle color buffer (mutated each frame)
  const colorBuf = useMemo(() => {
    const buf = new Float32Array(positions.length);
    for (let i = 0; i < positions.length / 3; i++) {
      buf[i*3] = BASE_RGB[0]; buf[i*3+1] = BASE_RGB[1]; buf[i*3+2] = BASE_RGB[2];
    }
    return buf;
  }, [positions]);

  // Active zone index
  const zoneIndex = activeZone === 'design' ? 0 : activeZone === 'astrion' ? 2 : activeZone === 'ai' ? 1 : null;

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);

    // Gentle auto-rotation
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.getElapsedTime() * 0.12) * 0.28;
    }

    // Update particle colors
    const scanY = (1 - scanProgress) * 1.8 - 0.9; // top-to-bottom scan line in world Y

    for (let i = 0; i < positions.length / 3; i++) {
      const py = positions[i * 3 + 1];
      if (py > scanY) {
        // Not yet revealed — black out
        colorBuf[i*3] = 0; colorBuf[i*3+1] = 0; colorBuf[i*3+2] = 0;
        continue;
      }
      const pZone = zoneIds[i] as 0 | 1 | 2;
      const isActive = zoneIndex !== null && pZone === zoneIndex;
      const target = isActive ? ZONE_ACTIVE_COLOR[pZone] : BASE_RGB;
      const speed = isActive ? 5 : 2.5;
      colorBuf[i*3]   += (target[0] - colorBuf[i*3])   * dt * speed;
      colorBuf[i*3+1] += (target[1] - colorBuf[i*3+1]) * dt * speed;
      colorBuf[i*3+2] += (target[2] - colorBuf[i*3+2]) * dt * speed;
    }

    if (pointsRef.current) {
      (pointsRef.current.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    }

    // Pulse spawning — higher rate for AI zone
    const targetCount = activeZone === 'ai' ? MAX_PULSES : 18;
    while (pulses.current.length < targetCount && connections.length > 0) {
      const ci = Math.floor(Math.random() * connections.length);
      const [a, b] = connections[ci];
      pulses.current.push({
        from: a, to: b, t: 0,
        speed: activeZone === 'ai' ? 1.4 + Math.random() * 1.8 : 0.7 + Math.random() * 1.0,
        zone: zoneIds[a] as 0 | 1 | 2,
      });
    }

    // Advance pulses
    pulses.current = pulses.current.filter(p => {
      p.t += dt * p.speed;
      return p.t < 1;
    });

    // Write pulse positions
    const pp = pulsePosRef.current;
    pp.fill(0);
    pulses.current.slice(0, MAX_PULSES).forEach((p, i) => {
      const ax = positions[p.from*3], ay = positions[p.from*3+1], az = positions[p.from*3+2];
      const bx = positions[p.to*3],   by = positions[p.to*3+1],   bz = positions[p.to*3+2];
      pp[i*3]   = ax + (bx - ax) * p.t;
      pp[i*3+1] = ay + (by - ay) * p.t;
      pp[i*3+2] = az + (bz - az) * p.t;
    });
    if (pulseMeshRef.current) {
      (pulseMeshRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  const pulseColor = activeZone === 'design' ? '#ff6030' : activeZone === 'astrion' ? '#4488ff' : '#00e5ff';

  return (
    <group ref={groupRef}>
      {/* Neural connection lines */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={lineBuffer.length / 3} array={lineBuffer} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color="#1a3a6e" transparent opacity={0.18} />
      </lineSegments>

      {/* Brain particle cloud */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-color"    count={colorBuf.length / 3}   array={colorBuf}   itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.011} vertexColors transparent opacity={0.88} sizeAttenuation depthWrite={false} />
      </points>

      {/* Electrical pulses */}
      <points ref={pulseMeshRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={MAX_PULSES} array={pulsePosRef.current} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.028} color={pulseColor} transparent opacity={0.95} sizeAttenuation depthWrite={false} />
      </points>

      {/* Orbital rings — Astrion zone */}
      <OrbitalRings visible={activeZone === 'astrion'} />
    </group>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

export default function BrainHero() {
  const [activeZone, setActiveZone] = useState<Zone>(null);
  const [labelOpacity, setLabelOpacity] = useState({ design: 0, ai: 0, astrion: 0 });
  const [scanProgress, setScanProgress] = useState(0);
  const scanStart = useRef<number | null>(null);
  const rafId = useRef<number>();

  // Prefer no motion
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // Intro scan animation
  useEffect(() => {
    if (reduced) { setScanProgress(1); return; }
    const duration = 2600; // ms
    const step = (ts: number) => {
      if (scanStart.current === null) scanStart.current = ts;
      const progress = Math.min((ts - scanStart.current) / duration, 1);
      // Ease: slow start, fast middle, slow end
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      setScanProgress(eased);
      if (progress < 1) rafId.current = requestAnimationFrame(step);
    };
    rafId.current = requestAnimationFrame(step);
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
  }, [reduced]);

  // Mouse zone detection
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1; // -1..1
    const zone: Zone = nx < -0.22 ? 'design' : nx > 0.22 ? 'astrion' : 'ai';
    if (zone !== activeZone) {
      setActiveZone(zone);
      setLabelOpacity({ design: 0, ai: 0, astrion: 0, [zone]: 1 });
    }
  }, [activeZone]);

  const handleMouseLeave = useCallback(() => {
    setActiveZone(null);
    setLabelOpacity({ design: 0, ai: 0, astrion: 0 });
  }, []);

  const handleClick = useCallback(() => {
    if (activeZone) window.location.href = ZONE_ROUTES[activeZone];
  }, [activeZone]);

  // Touch support
  const handleTouch = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.touches[0].clientX - rect.left) / rect.width) * 2 - 1;
    const zone: Zone = nx < -0.22 ? 'design' : nx > 0.22 ? 'astrion' : 'ai';
    setActiveZone(zone);
    setLabelOpacity({ design: 0, ai: 0, astrion: 0, [zone]: 1 });
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (activeZone) window.location.href = ZONE_ROUTES[activeZone];
  }, [activeZone]);

  const cursor = activeZone ? 'pointer' : 'crosshair';

  return (
    <div
      style={{ width: '100vw', height: '100dvh', background: '#000', position: 'relative', overflow: 'hidden', cursor }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onTouchMove={handleTouch}
      onTouchEnd={handleTouchEnd}
    >
      <Canvas
        camera={{ position: [0, 0, 3.2], fov: 46 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false }}
        style={{ display: 'block' }}
      >
        <color attach="background" args={['#000']} />
        <BrainScene activeZone={activeZone} scanProgress={scanProgress} />
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.15}
            intensity={activeZone ? 2.0 : 1.2}
            mipmapBlur
            radius={0.4}
          />
        </EffectComposer>
      </Canvas>

      {/* Zone labels — fade in on hover */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          alignItems: 'flex-end',
          padding: '0 6% 7%',
        }}
      >
        {(['design', 'ai', 'astrion'] as const).map((z) => (
          <span
            key={z}
            style={{
              display: 'block',
              textAlign: z === 'design' ? 'left' : z === 'astrion' ? 'right' : 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 'clamp(0.65rem, 1.2vw, 0.9rem)',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: LABEL_COLORS[z],
              opacity: labelOpacity[z],
              transition: 'opacity 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
              userSelect: 'none',
            }}
          >
            {z}
          </span>
        ))}
      </div>

      {/* Scan line — visible only during intro */}
      {scanProgress < 1 && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${(1 - scanProgress) * 100}%`,
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(100,180,255,0.6) 20%, rgba(100,180,255,0.9) 50%, rgba(100,180,255,0.6) 80%, transparent)',
            pointerEvents: 'none',
            boxShadow: '0 0 12px 2px rgba(100,180,255,0.4)',
          }}
        />
      )}

      {/* Screen-reader nav (hidden visually) */}
      <nav aria-label="Portfolio sections" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        <a href="/work">Design Work</a>
        <a href="/ai">AI Work</a>
        <a href="/astrion">Astrion</a>
      </nav>
    </div>
  );
}
