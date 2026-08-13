#!/usr/bin/env node
/**
 * Lightweight load test — run against a live API instance.
 *
 * Usage:
 *   node scripts/load-test.mjs
 *   API_URL=http://localhost:4000 CONCURRENCY=20 REQUESTS=200 node scripts/load-test.mjs
 */

const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const CONCURRENCY = parseInt(process.env.CONCURRENCY ?? "10", 10);
const REQUESTS = parseInt(process.env.REQUESTS ?? "100", 10);

async function fetchOnce(path) {
  const start = performance.now();
  const res = await fetch(`${API_URL}${path}`);
  const ms = performance.now() - start;
  return { status: res.status, ms, ok: res.ok };
}

async function runBatch(tasks) {
  return Promise.all(tasks.map((fn) => fn()));
}

async function main() {
  console.log(`Load test: ${REQUESTS} requests, concurrency ${CONCURRENCY}`);
  console.log(`Target: ${API_URL}\n`);

  const paths = ["/health", "/api/ready"];
  const results = [];
  let index = 0;

  while (index < REQUESTS) {
    const batchSize = Math.min(CONCURRENCY, REQUESTS - index);
    const batch = Array.from({ length: batchSize }, () => {
      const path = paths[index % paths.length];
      index += 1;
      return () => fetchOnce(path);
    });
    const batchResults = await runBatch(batch);
    results.push(...batchResults);
  }

  const ok = results.filter((r) => r.ok).length;
  const failed = results.length - ok;
  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)] ?? 0;
  const p95 = times[Math.floor(times.length * 0.95)] ?? 0;
  const p99 = times[Math.floor(times.length * 0.99)] ?? 0;
  const avg = times.reduce((a, b) => a + b, 0) / times.length;

  console.log("Results:");
  console.log(`  Total:   ${results.length}`);
  console.log(`  Success: ${ok}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Avg:     ${avg.toFixed(1)} ms`);
  console.log(`  p50:     ${p50.toFixed(1)} ms`);
  console.log(`  p95:     ${p95.toFixed(1)} ms`);
  console.log(`  p99:     ${p99.toFixed(1)} ms`);

  if (failed > 0) {
    console.error("\nLoad test FAILED");
    process.exit(1);
  }
  console.log("\nLoad test PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
