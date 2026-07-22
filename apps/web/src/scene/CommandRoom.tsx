import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import type { Scene } from '@sopscape/contracts';
import type { UIPhase } from '../lib/api';
import { getDecisionVisual, getNextOrbit, getQualityProfile } from './render-loop';

interface CommandRoomProps {
  phase: UIPhase;
  scene: Scene;
  decisionChoice: string | null;
  view: 'consensus' | 'risk' | 'evidence';
  orbitLabel?: string;
  resetLabel?: string;
}

export default function CommandRoom({
  phase,
  scene: sceneData,
  decisionChoice,
  view,
  orbitLabel = '按住鼠标中键拖动 · 360° 环视',
  resetLabel = '复位视角',
}: CommandRoomProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const phaseRef = useRef(phase);
  const decisionRef = useRef(decisionChoice);
  const viewRef = useRef(view);
  const resetCameraRef = useRef<(() => void) | null>(null);

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
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;

    mount.appendChild(renderer.domElement);

    const threeScene = new THREE.Scene();
    sceneRef.current = threeScene;

    const camera = new THREE.PerspectiveCamera(60, initialWidth / initialHeight, 0.1, 1000);
    const cameraTarget = new THREE.Vector3(0, 1.1, 0);
    const initialOrbit = { yaw: 0, pitch: 0.14 };
    const orbit = { ...initialOrbit };
    const cameraRadius = 7.1;
    const updateCamera = () => {
      const horizontalRadius = cameraRadius * Math.cos(orbit.pitch);
      camera.position.set(
        cameraTarget.x + horizontalRadius * Math.sin(orbit.yaw),
        cameraTarget.y + cameraRadius * Math.sin(orbit.pitch),
        cameraTarget.z + horizontalRadius * Math.cos(orbit.yaw),
      );
      camera.lookAt(cameraTarget);
    };
    updateCamera();
    resetCameraRef.current = () => {
      orbit.yaw = initialOrbit.yaw;
      orbit.pitch = initialOrbit.pitch;
      updateCamera();
    };

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

    // Desktop orbit: middle-button drag rotates the camera around the council core.
    let orbiting = false;
    let lastPointer = { x: 0, y: 0 };
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 1) return;
      event.preventDefault();
      orbiting = true;
      lastPointer = { x: event.clientX, y: event.clientY };
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.classList.add('is-orbiting');
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (!orbiting) return;
      event.preventDefault();
      const next = getNextOrbit(
        orbit,
        event.clientX - lastPointer.x,
        event.clientY - lastPointer.y,
      );
      orbit.yaw = next.yaw;
      orbit.pitch = next.pitch;
      lastPointer = { x: event.clientX, y: event.clientY };
      updateCamera();
    };
    const stopOrbit = (event: PointerEvent) => {
      if (!orbiting) return;
      orbiting = false;
      renderer.domElement.classList.remove('is-orbiting');
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    };
    const preventMiddleClick = (event: MouseEvent) => {
      if (event.button === 1) event.preventDefault();
    };
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', stopOrbit);
    renderer.domElement.addEventListener('pointercancel', stopOrbit);
    renderer.domElement.addEventListener('auxclick', preventMiddleClick);

    // Visibility API — pause when hidden
    const handleVisibility = () => {
      if (document.hidden) {
        renderer.setAnimationLoop(null);
      } else {
        renderer.setAnimationLoop(renderFrame);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', stopOrbit);
      renderer.domElement.removeEventListener('pointercancel', stopOrbit);
      renderer.domElement.removeEventListener('auxclick', preventMiddleClick);
      resetCameraRef.current = null;
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

  return (
    <div className="command-room-viewport">
      <div ref={handleMount} className="command-room-canvas" />
      <div className="orbit-controls" aria-label={orbitLabel}>
        <span>{orbitLabel}</span>
        <button type="button" onClick={() => resetCameraRef.current?.()}>
          {resetLabel}
        </button>
      </div>
    </div>
  );
}
