import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DISTRIBUTION_BOUNDS,
  getBucketKey,
  erf,
  normalCdf,
  logNormalCdf,
  getCalibratedSetPercentile,
  calculateHistogramPercentile,
  getCachedDistribution,
  setCachedDistribution,
  recordDistributionIncrement,
  getSetPercentile
} from './distributionService.js';

test('getBucketKey maps completion times to appropriate bucket intervals', () => {
  assert.equal(getBucketKey(4500), 'b0'); // < 8s
  assert.equal(getBucketKey(7999), 'b0');
  assert.equal(getBucketKey(8000), 'b1'); // 8-12s
  assert.equal(getBucketKey(11999), 'b1');
  assert.equal(getBucketKey(15000), 'b2'); // 12-16s
  assert.equal(getBucketKey(19000), 'b3'); // 16-20s
  assert.equal(getBucketKey(24000), 'b4'); // 20-25s
  assert.equal(getBucketKey(28000), 'b5'); // 25-30s
  assert.equal(getBucketKey(35000), 'b6'); // 30-40s
  assert.equal(getBucketKey(45000), 'b7'); // 40-55s
  assert.equal(getBucketKey(65000), 'b8'); // 55-75s
  assert.equal(getBucketKey(85000), 'b9'); // 75-100s
  assert.equal(getBucketKey(120000), 'b10'); // 100s+
});

test('erf and normalCdf compute accurate cumulative probabilities', () => {
  // erf(0) == 0
  assert.ok(Math.abs(erf(0)) < 1e-6);
  // erf(1) ≈ 0.8427
  assert.ok(Math.abs(erf(1) - 0.8427) < 1e-3);
  // normalCdf at mean is exactly 0.5
  assert.equal(normalCdf(0, 0, 1), 0.5);
  // normalCdf at +1.96 stdDev is approx 0.975 (two-tailed 95%)
  assert.ok(Math.abs(normalCdf(1.96, 0, 1) - 0.975) < 1e-2);
});

test('logNormalCdf returns 0.50 at the median time', () => {
  const median = 20000;
  const cdfAtMedian = logNormalCdf(median, median, 0.45);
  assert.ok(Math.abs(cdfAtMedian - 0.50) < 1e-4);

  // Faster time (< median) should have lower CDF (fewer people faster)
  const cdfFast = logNormalCdf(10000, median, 0.45);
  assert.ok(cdfFast < 0.15);

  // Slower time (> median) should have higher CDF
  const cdfSlow = logNormalCdf(40000, median, 0.45);
  assert.ok(cdfSlow > 0.85);
});

test('getCalibratedSetPercentile scales accurately with difficulty and time', () => {
  // Fast time on medium photo set
  const fast = getCalibratedSetPercentile('photo_set_001', 12000, 'Medium', true);
  assert.ok(fast.topPercentile <= 10);
  assert.ok(fast.beatPercentile >= 90);
  assert.match(fast.rankLabel, /TOP/);

  // Median time on medium photo set (~25s)
  const median = getCalibratedSetPercentile('photo_set_001', 25000, 'Medium', true);
  assert.ok(median.topPercentile >= 40 && median.topPercentile <= 60);

  // Slow time on medium photo set
  const slow = getCalibratedSetPercentile('photo_set_001', 65000, 'Medium', true);
  assert.ok(slow.topPercentile >= 85);
  assert.ok(slow.beatPercentile <= 15);

  // Difficulty adjustment: Easy sets expect faster times, Hard sets expect slower
  const mediumRes = getCalibratedSetPercentile('photo_set_001', 20000, 'Medium', true);
  const hardRes = getCalibratedSetPercentile('photo_set_001', 20000, 'Hard', true);
  // Same time of 20s is more impressive on Hard than on Medium
  assert.ok(hardRes.topPercentile <= mediumRes.topPercentile);
});

test('calculateHistogramPercentile uses bucket counts and linear interpolation', () => {
  // Distribution with 100 players:
  // b0 (0-8s): 5 players
  // b1 (8-12s): 15 players
  // b2 (12-16s): 30 players
  // b3 (16-20s): 25 players
  // b4 (20-25s): 15 players
  // b5 (25-30s): 10 players
  const distribution = {
    count: 100,
    b0: 5,
    b1: 15,
    b2: 30,
    b3: 25,
    b4: 15,
    b5: 10
  };

  // Player finished in 6000ms (in b0, 0-8s):
  // Should beat nearly everyone!
  const fastResult = calculateHistogramPercentile(distribution, 6000);
  assert.equal(fastResult.isLiveDistribution, true);
  assert.equal(fastResult.sampleCount, 100);
  assert.ok(fastResult.beatPercentile >= 95);
  assert.ok(fastResult.topPercentile <= 5);

  // Player finished in 18000ms (in b3, 16-20s):
  // 62.5% are faster, 37.5% are slower
  const midResult = calculateHistogramPercentile(distribution, 18000);
  assert.ok(midResult.topPercentile >= 50 && midResult.topPercentile <= 70);

  // Player finished in 50000ms (slower than all 100 recorded players):
  const slowResult = calculateHistogramPercentile(distribution, 50000);
  assert.equal(slowResult.beatPercentile, 1);
  assert.equal(slowResult.topPercentile, 99);
});

test('calculateHistogramPercentile smoothly blends with baseline on small sample sizes', () => {
  const smallDist = {
    count: 2,
    b0: 2
  };
  const baseline = {
    topPercentile: 50,
    beatPercentile: 50,
    rankLabel: 'TOP 50%'
  };

  // With only 2 samples, Bayesian blending anchors the result close to baseline
  const result = calculateHistogramPercentile(smallDist, 20000, baseline);
  assert.ok(result.beatPercentile >= 35 && result.beatPercentile <= 65);
});

test('caching and optimistic updates work correctly in memory and localStorage', async () => {
  const testId = 'test_set_cache_999';
  const data = { count: 10, b2: 10 };
  setCachedDistribution(testId, data);

  const cached = getCachedDistribution(testId);
  assert.deepEqual(cached, data);

  // Optimistic increment
  const updated = await recordDistributionIncrement('set_distributions', testId, 14000);
  assert.equal(updated.count, 11);
  assert.equal(updated.b2, 11);

  // getSetPercentile reads the cached distribution
  const percentile = getSetPercentile(testId, 14000);
  assert.equal(percentile.isLiveDistribution, true);
  assert.equal(percentile.sampleCount, 11);
});
