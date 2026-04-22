import { Suspense, useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

// ─── Types ───────────────────────────────────────────────────────────────────

type Zone = 'design' | 'ai' | 'astrion' | null;

const ROUTES  = { design: '/work', ai: '/ai', astrion: '/astrion' } as const;
const COLORS  = { design: '#ff6030', ai: '#00e5ff', astrion: '#4488ff' } as const;

// ─── GLSL ────────────────────────────────────────────────────────────────────

const vert = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const frag = /* glsl */`
  uniform sampler2D uTex0;   // design
  uniform sampler2D uTex1;   // ai
  uniform sampler2D uTex2;   // astrion
  uniform float uMouse;      // 0..1 smoothed cursor X
  uniform float uScan;       // 0..1 intro reveal progress
  uniform float uTime;
  uniform float uAspect;     // screen width / height

  varying vec2 vUv;

  // Value noise — drives organic dissolve edges
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    // Cover UV — maintains image aspect ratio while filling the viewport
    vec2 uv = vUv;
    float imgAspect = 1.878; // weighted avg of the three images (~8000/4200)
    if (uAspect > imgAspect) {
      float s = imgAspect / uAspect;
      uv.y = (uv.y - 0.5) * s + 0.5;
    } else {
      float s = uAspect / imgAspect;
      uv.x = (uv.x - 0.5) * s + 0.5;
    }

    vec4 c0 = texture2D(uTex0, uv);  // design (warm, colorful)
    vec4 c1 = texture2D(uTex1, uv);  // ai     (monochrome voxel)
    vec4 c2 = texture2D(uTex2, uv);  // astrion (smoke explosion)

    // Organic noise offset for dissolve-style blend boundaries
    float n = vnoise(uv * 5.0 + uTime * 0.12) * 0.08 - 0.04;
    float mx = clamp(uMouse + n, 0.0, 1.0);

    // Three-way blend: design ← left | AI | right → astrion
    // Transition zones overlap slightly at the thirds boundaries
    float b01 = smoothstep(0.20, 0.42, mx);  // design → AI
    float b12 = smoothstep(0.58, 0.80, mx);  // AI → astrion

    vec4 da  = mix(c0, c1, b01);
    vec4 ab  = mix(c1, c2, b12);
    vec4 col = mix(da, ab, b12);

    // ── Scan reveal ──────────────────────────────────────────────────────────
    // Sweeps top-to-bottom. vUv.y=1 is top, vUv.y=0 is bottom in Three.js.
    float scanEdge  = 1.0 - uScan;
    float scanNoise = vnoise(vec2(vUv.x * 20.0, uTime * 1.5)) * 0.04;
    float reveal    = smoothstep(scanEdge - 0.03, scanEdge + 0.03, vUv.y + scanNoise);

    // Glow on the scan line (fades out as scan completes)
    float scanDist = abs(vUv.y + scanNoise - scanEdge);
    float scanGlow = exp(-scanDist * 55.0) * max(0.0, 1.0 - uScan * 1.4);
    vec3 glowColor = vec3(0.45, 0.75, 1.0);

    gl_FragColor = vec4(col.rgb * reveal + glowColor * scanGlow, 1.0);
  }
`;

// ─── R3F scene ───────────────────────────────────────────────────────────────

interface PlaneProps {
  mouseXRef: React.MutableRefObject<number>;
  scanRef:   React.MutableRefObject<number>;
}

function BrainPlane({ mouseXRef, scanRef }: PlaneProps) {
  const textures = useLoader(THREE.TextureLoader, [
    '/images/brain-design.webp',
    '/images/brain-ai.webp',
    '/images/brain-astrion.webp',
  ]);

  const { viewport, size } = useThree();
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const smoothMX = useRef(0.5);

  const uniforms = useMemo(
    () => ({
      uTex0:   { value: textures[0] },
      uTex1:   { value: textures[1] },
      uTex2:   { value: textures[2] },
      uMouse:  { value: 0.5 },
      uScan:   { value: 0.0 },
      uTime:   { value: 0.0 },
      uAspect: { value: 1.0 },
    }),
    [textures]
  );

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms;
    // Lerp mouse for smooth following
    smoothMX.current += (mouseXRef.current - smoothMX.current) * 0.07;
    u.uMouse.value  = smoothMX.current;
    u.uScan.value   = scanRef.current;
    u.uTime.value   = clock.getElapsedTime();
    u.uAspect.value = size.width / size.height;
  });

  return (
    <mesh scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
      />
    </mesh>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function BrainHero() {
  const mouseXRef = useRef(0.5);
  const scanRef   = useRef(0);

  const [zone,   setZone]   = useState<Zone>(null);
  const [labels, setLabels] = useState({ design: 0, ai: 0, astrion: 0 });

  // Intro scan animation (drives scanRef, no re-renders)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      scanRef.current = 1;
      return;
    }
    const duration = 2600;
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      scanRef.current = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      if (p < 1) requestAnimationFrame(step);
    };
    const id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, []);

  const getZone = (nx: number): Zone =>
    nx < 0.33 ? 'design' : nx > 0.66 ? 'astrion' : 'ai';

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const nx = e.clientX / e.currentTarget.clientWidth;
    mouseXRef.current = nx;
    const z = getZone(nx);
    if (z !== zone) {
      setZone(z);
      setLabels({ design: 0, ai: 0, astrion: 0, [z]: 1 });
    }
  }, [zone]);

  const handleMouseLeave = useCallback(() => {
    mouseXRef.current = 0.5;
    setZone(null);
    setLabels({ design: 0, ai: 0, astrion: 0 });
  }, []);

  const handleClick = useCallback(() => {
    if (zone) window.location.href = ROUTES[zone];
  }, [zone]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const nx = e.touches[0].clientX / e.currentTarget.clientWidth;
    mouseXRef.current = nx;
    const z = getZone(nx);
    setZone(z);
    setLabels({ design: 0, ai: 0, astrion: 0, [z]: 1 });
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (zone) window.location.href = ROUTES[zone];
  }, [zone]);

  return (
    <div
      style={{
        width: '100vw', height: '100dvh',
        background: '#000', position: 'relative', overflow: 'hidden',
        cursor: zone ? 'pointer' : 'crosshair',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false }}
        style={{ display: 'block' }}
      >
        <color attach="background" args={['#000']} />
        <Suspense fallback={null}>
          <BrainPlane mouseXRef={mouseXRef} scanRef={scanRef} />
        </Suspense>
        <EffectComposer>
          <Bloom luminanceThreshold={0.35} intensity={0.6} mipmapBlur radius={0.5} />
        </EffectComposer>
      </Canvas>

      {/* Zone labels */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          alignItems: 'flex-end', padding: '0 6% 7%',
        }}
      >
        {(['design', 'ai', 'astrion'] as const).map((z) => (
          <span
            key={z}
            style={{
              display: 'block',
              textAlign: z === 'design' ? 'left' : z === 'astrion' ? 'right' : 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 'clamp(0.65rem, 1.2vw, 0.85rem)',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: COLORS[z],
              opacity: labels[z],
              transition: 'opacity 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
              userSelect: 'none',
            }}
          >
            {z}
          </span>
        ))}
      </div>

      {/* Screen-reader nav */}
      <nav aria-label="Portfolio sections" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        <a href="/work">Design Work</a>
        <a href="/ai">AI Work</a>
        <a href="/astrion">Astrion</a>
      </nav>
    </div>
  );
}
