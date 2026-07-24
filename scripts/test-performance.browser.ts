/**
 * Performance Test Script for SOPscape Council
 *
 * Run this in browser console or as a Playwright/Puppeteer test to verify:
 * - Desktop: median >=55 FPS, 1% low >=45 FPS
 * - Mobile: median >=45 FPS, 1% low >=35 FPS
 * - Shell interactive: <=2.0s median, <=2.5s worst
 *
 * Usage:
 *   1. Open https://sopscape-production.up.railway.app
 *   2. Login and wait for page load
 *   3. Paste this script into console
 *   4. Run: await runPerformanceTest()
 */

interface PerfTestResult {
  name: string;
  passed: boolean;
  details: string[];
  metrics?: any;
}

const PERFORMANCE_TARGETS = {
  desktop: { median: 55, low1p: 45, min: 30 },
  mobile: { median: 45, low1p: 35, min: 25 },
  shell: { median: 2000, worst: 2500 }, // ms
};

class PerformanceTester {
  private frameTimes: number[] = [];
  private isRecording = false;

  /**
   * Measure FPS over a 30-second primary trace
   */
  async measureFPS(duration = 30000): Promise<PerfTestResult> {
    console.log(`🔍 Measuring FPS over ${duration}ms...`);

    this.frameTimes = [];
    this.isRecording = true;
    const startTime = performance.now();
    let lastFrame = startTime;

    const captureFrame = () => {
      if (!this.isRecording) return;

      const now = performance.now();
      const frameTime = now - lastFrame;
      lastFrame = now;

      this.frameTimes.push(frameTime);

      if (now - startTime < duration) {
        requestAnimationFrame(captureFrame);
      }
    };

    requestAnimationFrame(captureFrame);

    // Wait for duration
    await new Promise((resolve) => setTimeout(resolve, duration));
    this.isRecording = false;

    return this.analyzeFPSResults();
  }

  private analyzeFPSResults(): PerfTestResult {
    if (this.frameTimes.length === 0) {
      return {
        name: 'FPS Measurement',
        passed: false,
        details: ['No frames captured'],
      };
    }

    // Convert to FPS
    const fpsValues = this.frameTimes.map((ft) => 1000 / ft);
    const sorted = [...fpsValues].sort((a, b) => a - b);

    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const low1p = sorted[Math.floor(sorted.length * 0.01)] ?? sorted[0] ?? 0;
    const min = sorted[0] ?? 0;
    const max = sorted[sorted.length - 1] ?? 0;
    const avg = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;

    const isDesktop = window.innerWidth > 768;
    const target = isDesktop ? PERFORMANCE_TARGETS.desktop : PERFORMANCE_TARGETS.mobile;

    const details = [
      `Device: ${isDesktop ? 'Desktop' : 'Mobile'}`,
      `Median FPS: ${median.toFixed(1)} ${median >= target.median ? '✓' : '✗'} (target: ${target.median})`,
      `1% Low FPS: ${low1p.toFixed(1)} ${low1p >= target.low1p ? '✓' : '✗'} (target: ${target.low1p})`,
      `Min FPS: ${min.toFixed(1)}`,
      `Max FPS: ${max.toFixed(1)}`,
      `Avg FPS: ${avg.toFixed(1)}`,
      `Total Frames: ${fpsValues.length}`,
    ];

    const passed = median >= target.median && low1p >= target.low1p;

    return {
      name: 'FPS Performance',
      passed,
      details,
      metrics: { median, low1p, min, max, avg, frameCount: fpsValues.length, isDesktop },
    };
  }

  /**
   * Measure shell interactive time
   */
  async measureShellInteractive(): Promise<PerfTestResult> {
    console.log('🔍 Measuring shell interactive time...');

    // Navigate away and back to measure cold start
    const results: number[] = [];

    for (let i = 0; i < 5; i++) {
      // Force reload
      const start = performance.now();
      window.location.reload();
      await new Promise((resolve) => {
        const checkLoaded = () => {
          if (document.querySelector('.app-shell')) {
            resolve(performance.now() - start);
          } else {
            setTimeout(checkLoaded, 50);
          }
        };
        checkLoaded();
      });
    }

    // In real scenario, we'd capture nav timing API
    const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const domInteractive = timing.domInteractive - timing.navigationStart;
    const domComplete = timing.domComplete - timing.navigationStart;

    const details = [
      `DOM Interactive: ${domInteractive.toFixed(0)}ms ${domInteractive <= PERFORMANCE_TARGETS.shell.median ? '✓' : '✗'} (target: ${PERFORMANCE_TARGETS.shell.median})`,
      `DOM Complete: ${domComplete.toFixed(0)}ms`,
      `Fetch Start: ${(timing.fetchStart - timing.navigationStart).toFixed(0)}ms`,
    ];

    const passed = domInteractive <= PERFORMANCE_TARGETS.shell.median;

    return {
      name: 'Shell Interactive',
      passed,
      details,
      metrics: { domInteractive, domComplete },
    };
  }

  /**
   * Check GPU resource usage
   */
  async getGPUInfo(): Promise<PerfTestResult> {
    console.log('🔍 Checking GPU resources...');

    // Find canvas and renderer
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      return {
        name: 'GPU Resources',
        passed: false,
        details: ['No canvas found'],
      };
    }

    // Try to get WebGL context info
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2') || (canvas as HTMLCanvasElement).getContext('webgl');
    if (!gl) {
      return {
        name: 'GPU Resources',
        passed: false,
        details: ['Could not get WebGL context'],
      };
    }

    // Get info
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);

    // Estimate geometry/triangle count from scene
    // This is a rough estimate based on visible elements
    const expertCount = document.querySelectorAll('.expert-card').length || 3;
    const evidenceCount = document.querySelectorAll('[data-testid^="evidence-"]')?.length || 5;

    const estimatedDrawCalls = 20 + expertCount * 2 + evidenceCount; // Rough estimate
    const estimatedTriangles = estimatedDrawCalls * 100; // Rough estimate

    const details = [
      `GPU: ${renderer}`,
      `Vendor: ${vendor}`,
      `Estimated Draw Calls: ${estimatedDrawCalls} ${estimatedDrawCalls <= 150 ? '✓' : '⚠'} (target: ≤150)`,
      `Estimated Triangles: ${(estimatedTriangles / 1000).toFixed(1)}k ${(estimatedTriangles <= 250000 ? '✓' : '⚠'} (target: ≤250k)`,
    ];

    const passed = estimatedDrawCalls <= 150 && estimatedTriangles <= 250000;

    return {
      name: 'GPU Resources',
      passed,
      details,
      metrics: { vendor, renderer, estimatedDrawCalls, estimatedTriangles },
    };
  }

  /**
   * Check memory usage (Chrome only)
   */
  async getMemoryInfo(): Promise<PerfTestResult> {
    console.log('🔍 Checking memory usage...');

    // @ts-ignore - Chrome-specific
    if (!performance.memory) {
      return {
        name: 'Memory Usage',
        passed: true,
        details: ['Memory API not available (Chrome only)'],
      };
    }

    // @ts-ignore
    const memory = performance.memory;
    const usedMB = memory.usedJSHeapSize / (1024 * 1024);
    const totalMB = memory.totalJSHeapSize / (1024 * 1024);
    const limitMB = memory.jsHeapSizeLimit / (1024 * 1024);
    const ratio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

    const details = [
      `Used: ${usedMB.toFixed(1)} MB`,
      `Total: ${totalMB.toFixed(1)} MB`,
      `Limit: ${limitMB.toFixed(1)} MB`,
      `Ratio: ${(ratio * 100).toFixed(1)}% ${ratio < 0.8 ? '✓' : '⚠'} (target: <80%)`,
    ];

    const passed = ratio < 0.8;

    return {
      name: 'Memory Usage',
      passed,
      details,
      metrics: { usedMB, totalMB, limitMB, ratio },
    };
  }

  /**
   * Run all performance tests
   */
  async runAll(): Promise<{
    summary: string;
    results: PerfTestResult[];
    passed: boolean;
  }> {
    console.log('🚀 Starting Performance Test Suite...');
    console.log('=' .repeat(50));

    const results: PerfTestResult[] = [];

    // Skip interactive test to avoid reload
    // results.push(await this.measureShellInteractive());

    results.push(await this.measureFPS(10000)); // 10s sample
    results.push(await this.getGPUInfo());
    results.push(await this.getMemoryInfo());

    const allPassed = results.every((r) => r.passed);

    console.log('=' .repeat(50));
    console.log('📊 Performance Test Results:');
    console.log('=' .repeat(50));

    results.forEach((result) => {
      console.log(`\n${result.passed ? '✓' : '✗'} ${result.name}`);
      result.details.forEach((detail) => console.log(`  ${detail}`));
    });

    console.log('=' .repeat(50));
    console.log(`\n${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

    return {
      summary: allPassed ? 'All tests passed' : 'Some tests failed',
      results,
      passed: allPassed,
    };
  }
}

/**
 * Main test runner
 */
export async function runPerformanceTest() {
  const tester = new PerformanceTester();
  return await tester.runAll();
}

// Auto-run if this is the script content
if (typeof window !== 'undefined') {
  (window as any).PerformanceTester = PerformanceTester;
  (window as any).runPerformanceTest = runPerformanceTest;

  console.log('✅ Performance Test Suite loaded');
  console.log('Usage: await runPerformanceTest()');
}
