import { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import type { Scene } from '@sopscape/contracts';
import type { UIPhase } from '../lib/api';
import { getDecisionVisual, getQualityProfile } from './render-loop';
import { getPerformanceMonitor, type PerformanceMetrics } from '../lib/performance';

interface CommandRoomProps {
  phase: UIPhase;
  scene: Scene;
  decisionChoice: string | null;
  view: 'consensus' | 'risk' | 'evidence';
}

export default function CommandRoom({
  phase,
  scene: sceneData,
  decisionChoice,
  view,
}: CommandRoomProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const phaseRef = useRef(phase);
  const decisionRef = useRef(decisionChoice);
  const viewRef = useRef(view);
  const [perfMetrics, setPerfMetrics] = useState<PerformanceMetrics | null>(null);
  const monitorRef = useRef(getPerformanceMonitor());

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    decisionRef.current = decisionChoice;
  }, [decisionChoice]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const handleMount = useCallback((el: HTMLDivElement | null) => {
    mountRef.current = el;
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;

    // Single render loop — Three.js owns renderer.setAnimationLoop
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    const quality = getQualityProfile();
    const initialBounds = mount.getBoundingClientRect();
    const initialWidth = Math.max(initialBounds.width, 1);
    const initialHeight = Math.max(initialBounds.height, 1);
    renderer.setPixelRatio(quality.dpr);
    renderer.setSize(initialWidth, initialHeight, false);
    renderer.setClearColor(0x060811, 1);
    rendererRef.current = renderer;

    mount.appendChild(renderer.domElement);

    const threeScene = new THREE.Scene();
    sceneRef.current = threeScene;

    const camera = new THREE.PerspectiveCamera(60, initialWidth / initialHeight, 0.1, 1000);
    camera.position.set(0, 2.1, 7);
    camera.lookAt(0, 1.1, 0);

    // Lighting: one directional + ambient (budget: 2 lights)
    const ambient = new THREE.AmbientLight(0x58658f, 0.65);
    threeScene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0x60e9ff, 1.2);
    dirLight.position.set(5, 5, 5);
    threeScene.add(dirLight);

    // Floor: subtle grid
    const gridHelper = new THREE.GridHelper(20, 24, 0x173b58, 0x10192c);
    threeScene.add(gridHelper);

    // Three expert nodes (icosahedrons) + central core
    const expertGeo = new THREE.IcosahedronGeometry(0.46, 1);
    const expertMaterials: THREE.MeshStandardMaterial[] = [];
    const expertMeshes: THREE.Mesh[] = [];
    sceneData.agentStates.forEach((agent, index) => {
      const angle = (index / Math.max(sceneData.agentStates.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const pos: [number, number, number] = [Math.cos(angle) * 3, 1.5, Math.sin(angle) * 2 - 1];
      const color =
        agent.status === 'failed' ? 0xef4444 : agent.status === 'complete' ? 0x00d4aa : 0xf59e0b;
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.8,
        wireframe: true,
      });
      expertMaterials.push(mat);
      const mesh = new THREE.Mesh(expertGeo, mat);
      mesh.position.set(...pos);
      threeScene.add(mesh);
      expertMeshes.push(mesh);
    });

    // Central consensus core
    const coreGeo = new THREE.IcosahedronGeometry(0.78, 3);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x60e9ff,
      emissive: 0x60e9ff,
      emissiveIntensity: 0.75,
      transparent: true,
      opacity: 0.6,
      wireframe: true,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.set(0, 1.5, 0);
    threeScene.add(coreMesh);

    // Connection lines from experts to core
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x60e9ff,
      transparent: true,
      opacity: 0.34,
    });
    const lineGeometries: THREE.BufferGeometry[] = [];
    expertMeshes.forEach((mesh) => {
      const geo = new THREE.BufferGeometry().setFromPoints([mesh.position, coreMesh.position]);
      lineGeometries.push(geo);
      const line = new THREE.Line(geo, lineMat);
      threeScene.add(line);
    });

    const riskMat = new THREE.LineBasicMaterial({
      color: 0xff6f83,
      transparent: true,
      opacity: 0.42,
    });
    const riskGeo = new THREE.BufferGeometry().setFromPoints([
      expertMeshes[1]?.position ?? new THREE.Vector3(3, 1.5, -2),
      coreMesh.position,
    ]);
    threeScene.add(new THREE.Line(riskGeo, riskMat));

    const evidenceGeo = new THREE.OctahedronGeometry(0.14, 0);
    const evidenceMat = new THREE.MeshStandardMaterial({
      color: 0x9c86ff,
      emissive: 0x9c86ff,
      emissiveIntensity: 0.75,
    });
    const evidenceMeshes = sceneData.evidenceNodes.map((_, index) => {
      const mesh = new THREE.Mesh(evidenceGeo, evidenceMat);
      mesh.position.set((index - 0.5) * 1.5, 0.65, -0.5 - index * 0.35);
      threeScene.add(mesh);
      return mesh;
    });

    // Render loop — single setAnimationLoop
    let time = 0;
    const renderFrame = () => {
      time += 0.008;

      // Record frame time for performance monitoring
      monitorRef.current.recordFrame();

      // Rotate expert nodes
      expertMeshes.forEach((mesh, i) => {
        mesh.rotation.x = time * (0.3 + i * 0.1);
        mesh.rotation.y = time * (0.5 + i * 0.05);
      });

      // Core pulse
      const pulse = quality.reducedMotion ? 1 : 1 + Math.sin(time * 2) * 0.05;
      coreMesh.scale.set(pulse, pulse, pulse);
      coreMesh.rotation.y = time * 0.3;

      // Phase-reactive coloring
      const currentPhase = phaseRef.current;
      const visual = getDecisionVisual(decisionRef.current);
      const activeView = viewRef.current;
      riskMat.opacity =
        activeView === 'risk' ? Math.max(visual.riskOpacity, 0.72) : visual.riskOpacity;
      evidenceMeshes.forEach((mesh, index) => {
        const scale = activeView === 'evidence' ? 1.5 + Math.sin(time * 3 + index) * 0.12 : 1;
        mesh.scale.setScalar(quality.reducedMotion ? 1 : scale);
        mesh.rotation.y = time * (0.5 + index * 0.1);
      });
      if (currentPhase === 'SPECIALISTS_RUNNING') {
        coreMat.color.set(0x00d4aa);
        coreMat.emissive.set(0x00d4aa);
        coreMat.opacity = 0.6;
        coreMat.emissiveIntensity = 0.5 + Math.sin(time * 3) * 0.3;
      } else if (currentPhase === 'READY') {
        coreMat.color.set(visual.color);
        coreMat.emissive.set(visual.color);
        coreMat.emissiveIntensity = 0.8;
        coreMat.opacity = 0.9;
      } else if (currentPhase === 'FAILED') {
        coreMat.color.set(0xef4444);
        coreMat.emissive.set(0xef4444);
        coreMat.emissiveIntensity = 0.8;
        coreMat.opacity = 0.9;
      } else {
        coreMat.color.set(visual.color);
        coreMat.emissive.set(visual.color);
        coreMat.emissiveIntensity = 0.5;
        coreMat.opacity = 0.6;
      }

      renderer.render(threeScene, camera);
    };
    renderer.setAnimationLoop(renderFrame);

    // Responsive resize
    const handleResize = () => {
      const bounds = mount.getBoundingClientRect();
      const w = Math.max(bounds.width, 1);
      const h = Math.max(bounds.height, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(getQualityProfile().dpr);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);

    // Visibility API — pause when hidden
    const handleVisibility = () => {
      if (document.hidden) {
        renderer.setAnimationLoop(null);
      } else {
        renderer.setAnimationLoop(renderFrame);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Performance metrics update — every 1 second
    const perfUpdate = setInterval(() => {
      if (!document.hidden) {
        setPerfMetrics(monitorRef.current.getMetrics());
      }
    }, 1000);

    return () => {
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(perfUpdate);
      renderer.setAnimationLoop(null);
      renderer.dispose();
      expertGeo.dispose();
      coreGeo.dispose();
      lineMat.dispose();
      riskGeo.dispose();
      riskMat.dispose();
      evidenceGeo.dispose();
      evidenceMat.dispose();
      lineGeometries.forEach((geometry) => geometry.dispose());
      expertMaterials.forEach((material) => material.dispose());
      coreMat.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [sceneData]);

  // Performance overlay in development
  if (perfMetrics && process.env.NODE_ENV === 'development') {
    const target = perfMetrics.isDesktop ? { median: 55, low1p: 45 } : { median: 45, low1p: 35 };

    return (
      <div className="relative w-full h-full" style={{ zIndex: 0 }}>
        <div ref={handleMount} className="w-full h-full" />
        <div
          className="absolute top-2 right-2 bg-black/80 text-white text-xs p-2 rounded font-mono"
          style={{ zIndex: 1000 }}
        >
          <div className="font-bold mb-1">Performance Monitor</div>
          <div>FPS: {perfMetrics.fps.toFixed(1)}</div>
          <div>
            Median: {perfMetrics.fpsMedian.toFixed(1)} (target: {target.median})
          </div>
          <div>
            1% Low: {perfMetrics.fps1pLow.toFixed(1)} (target: {target.low1p})
          </div>
          <div>Min: {perfMetrics.fpsMin.toFixed(1)}</div>
          <div>Frame Time: {perfMetrics.frameTime.toFixed(2)}ms</div>
          <div>Frames: {perfMetrics.frameCount}</div>
          <div className="mt-1 text-gray-400">{perfMetrics.isDesktop ? 'Desktop' : 'Mobile'}</div>
        </div>
      </div>
    );
  }

  return <div ref={handleMount} className="w-full h-full" style={{ zIndex: 0 }} />;
}
