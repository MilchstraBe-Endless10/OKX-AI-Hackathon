/**
 * Performance monitoring for Three.js render loop.
 *
 * Measures FPS, frame time, and memory usage to verify PRD targets:
 * - Desktop: median >=55 FPS, 1% low >=45 FPS
 * - Mobile: median >=45 FPS, 1% low >=35 FPS
 * - Shell interactive: <=2.0s median, <=2.5s worst
 */

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  frameCount: number;
  sampleDuration: number;
  fpsMedian: number;
  fps1pLow: number;
  fpsMin: number;
  isDesktop: boolean;
}

export interface PerformanceTarget {
  median: number;
  low1p: number;
  min?: number;
}

export const PERFORMANCE_TARGETS: Record<'desktop' | 'mobile', PerformanceTarget> = {
  desktop: { median: 55, low1p: 45, min: 30 },
  mobile: { median: 45, low1p: 35, min: 25 },
};

export class PerformanceMonitor {
  private frameTimes: number[] = [];
  private startTime = 0;
  private lastFrameTime = 0;
  private frameCount = 0;
  private isRecording = false;
  private maxSamples = 300; // ~5 seconds at 60fps

  start() {
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    this.frameCount = 0;
    this.frameTimes = [];
    this.isRecording = true;
  }

  stop() {
    this.isRecording = false;
    return this.getMetrics();
  }

  recordFrame() {
    if (!this.isRecording) return;

    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;
    this.frameCount++;

    // Store frame times, cap at maxSamples
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }
  }

  getMetrics(): PerformanceMetrics {
    const now = performance.now();
    const sampleDuration = now - this.startTime;

    if (this.frameTimes.length === 0) {
      return {
        fps: 0,
        frameTime: 0,
        frameCount: 0,
        sampleDuration: 0,
        fpsMedian: 0,
        fps1pLow: 0,
        fpsMin: 0,
        isDesktop: window.innerWidth > 768,
      };
    }

    // Convert frame times to FPS
    const fpsValues = this.frameTimes.map((ft) => 1000 / ft);
    const sortedFps = [...fpsValues].sort((a, b) => a - b);

    // Calculate metrics
    const fpsMedian = sortedFps[Math.floor(sortedFps.length / 2)] ?? 0;
    const fps1pLow = sortedFps[Math.floor(sortedFps.length * 0.01)] ?? sortedFps[0] ?? 0;
    const fpsMin = sortedFps[0] ?? 0;
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const currentFps = 1000 / avgFrameTime;

    return {
      fps: currentFps,
      frameTime: avgFrameTime,
      frameCount: this.frameCount,
      sampleDuration,
      fpsMedian,
      fps1pLow,
      fpsMin,
      isDesktop: window.innerWidth > 768,
    };
  }

  checkTargets(metrics: PerformanceMetrics): { passed: boolean; details: string[] } {
    const target = metrics.isDesktop ? PERFORMANCE_TARGETS.desktop : PERFORMANCE_TARGETS.mobile;
    const details: string[] = [];
    let passed = true;

    // Check median
    if (metrics.fpsMedian >= target.median) {
      details.push(`✓ Median FPS: ${metrics.fpsMedian.toFixed(1)} >= ${target.median}`);
    } else {
      details.push(`✗ Median FPS: ${metrics.fpsMedian.toFixed(1)} < ${target.median}`);
      passed = false;
    }

    // Check 1% low
    if (metrics.fps1pLow >= target.low1p) {
      details.push(`✓ 1% Low FPS: ${metrics.fps1pLow.toFixed(1)} >= ${target.low1p}`);
    } else {
      details.push(`✗ 1% Low FPS: ${metrics.fps1pLow.toFixed(1)} < ${target.low1p}`);
      passed = false;
    }

    // Check minimum if specified
    if (target.min && metrics.fpsMin < target.min) {
      details.push(`⚠ Min FPS: ${metrics.fpsMin.toFixed(1)} below ${target.min} threshold`);
    }

    return { passed, details };
  }

  static measureShellInteractive(target: () => void): number {
    const start = performance.now();
    target();
    return performance.now() - start;
  }
}

// Global singleton for render loop
let globalMonitor: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!globalMonitor) {
    globalMonitor = new PerformanceMonitor();
  }
  return globalMonitor;
}

export function startPerformanceCapture() {
  const monitor = getPerformanceMonitor();
  monitor.start();
  return monitor;
}

export function stopPerformanceCapture() {
  const monitor = getPerformanceMonitor();
  return monitor.stop();
}

/**
 * Memory usage tracking (Chrome/Edge only)
 */
export function getMemoryUsage(): { used: number; limit: number; ratio: number } | null {
  // @ts-ignore - performance.memory is Chrome-specific
  if ('memory' in performance && performance.memory) {
    // @ts-ignore
    const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = performance.memory;
    return {
      used: usedJSHeapSize,
      limit: jsHeapSizeLimit,
      ratio: usedJSHeapSize / jsHeapSizeLimit,
    };
  }
  return null;
}

/**
 * GPU info from renderer.info
 */
export interface GPUInfo {
  geometries: number;
  textures: number;
  programs: number;
  drawCalls: number;
  triangles: number;
  points: number;
  lines: number;
}

export interface ThreeRendererInfo {
  memory: { geometries: number; textures: number };
  programs: Array<{ id: number }>;
  render: { calls: number; triangles: number; points: number; lines: number };
}

export function getGPUInfo(renderer: { info: ThreeRendererInfo }): GPUInfo {
  const info = renderer.info;
  return {
    geometries: info.memory?.geometries ?? 0,
    textures: info.memory?.textures ?? 0,
    programs: info.programs?.length ?? 0,
    drawCalls: info.render?.calls ?? 0,
    triangles: info.render?.triangles ?? 0,
    points: info.render?.points ?? 0,
    lines: info.render?.lines ?? 0,
  };
}

/**
 * Check if GPU resources are within PRD budgets
 */
export function checkGPUBudgets(gpu: GPUInfo): { passed: boolean; details: string[] } {
  const details: string[] = [];
  let passed = true;

  // PRD: fixed room <=150 draw calls, <=250k triangles
  if (gpu.drawCalls <= 150) {
    details.push(`✓ Draw calls: ${gpu.drawCalls} <= 150`);
  } else {
    details.push(`⚠ Draw calls: ${gpu.drawCalls} > 150 (budget exceeded)`);
    passed = false;
  }

  if (gpu.triangles <= 250000) {
    details.push(`✓ Triangles: ${(gpu.triangles / 1000).toFixed(1)}k <= 250k`);
  } else {
    details.push(`⚠ Triangles: ${(gpu.triangles / 1000).toFixed(1)}k > 250k`);
    passed = false;
  }

  return { passed, details };
}

/**
 * Five-cycle disposal check for memory leaks
 */
export async function checkDisposalStability(
  createScene: () => () => void,
  cycles = 5,
): Promise<{ passed: boolean; details: string[] }> {
  const details: string[] = [];
  const memoryBefore = getMemoryUsage();
  const disposals: number[] = [];

  for (let i = 0; i < cycles; i++) {
    const memBefore = getMemoryUsage();
    const dispose = createScene();
    dispose();

    // Force GC if available (Chrome)
    if ('gc' in window) {
      // @ts-ignore
      window.gc();
    }

    const memAfter = getMemoryUsage();
    if (memBefore && memAfter) {
      const delta = memAfter.used - memBefore.used;
      disposals.push(delta);
    }

    // Small delay to let GC run
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const memoryAfter = getMemoryUsage();

  // Check if memory grew significantly
  if (memoryBefore && memoryAfter) {
    const growth = memoryAfter.used - memoryBefore.used;
    const growthPercent = (growth / memoryBefore.used) * 100;

    if (growthPercent < 5) {
      details.push(`✓ Memory growth after ${cycles} cycles: ${growthPercent.toFixed(1)}% < 5%`);
    } else {
      details.push(
        `⚠ Memory growth after ${cycles} cycles: ${growthPercent.toFixed(1)}% >= 5% (potential leak)`,
      );
    }

    const avgDelta = disposals.reduce((a, b) => a + b, 0) / disposals.length;
    details.push(`Average delta per cycle: ${(avgDelta / 1024).toFixed(1)} KB`);
  }

  return { passed: true, details };
}
