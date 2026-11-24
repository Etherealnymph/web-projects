// Integrate the piecewise-linear transient trace on its actual (possibly adaptive) time grid.
export function statistics(times, values) {
  const count = values.length;
  if (!count || count !== times.length) throw new Error('缺少匹配的时域采样');
  let min = values[0], max = values[0], integral = 0, energy = 0;
  for (let i = 1; i < count; i++) {
    const dt = times[i]-times[i-1], a = values[i-1], b = values[i];
    if (dt < 0) throw new Error('时间轴必须单调递增');
    integral += dt*(a+b)/2;
    energy += dt*(a*a+a*b+b*b)/3;
    min = Math.min(min,b);
    max = Math.max(max,b);
  }
  const duration = times[count-1]-times[0];
  const mean = duration ? integral/duration : values[count-1];
  const rms = duration ? Math.sqrt(Math.max(0,energy/duration)) : Math.abs(values[count-1]);
  return { min, max, mean, rms, acRms: Math.sqrt(Math.max(0,rms*rms-mean*mean)), pp: max-min };
}

export function triggerCrossing(times, values, threshold, slope = 'rise', earliest = -Infinity, latest = Infinity) {
  for (let i = 1; i < values.length; i++) {
    const a = values[i-1], b = values[i];
    if (times[i] < earliest) continue;
    if (times[i-1] > latest) break;
    const crossed = slope === 'fall' ? a >= threshold && b < threshold : a <= threshold && b > threshold;
    if (crossed) {
      const time = times[i-1] + (threshold-a)/(b-a) * (times[i]-times[i-1]);
      if (time >= earliest && time <= latest) return time;
    }
  }
  return null;
}

function fft(real, imag) {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [real[i],real[j]] = [real[j],real[i]];
  }
  for (let width = 2; width <= n; width *= 2) {
    const half = width/2;
    for (let j = 0; j < half; j++) {
      const phase = -2*Math.PI*j/width, c = Math.cos(phase), s = Math.sin(phase);
      for (let i = j; i < n; i += width) {
        const k = i + half;
        const r = c*real[k] - s*imag[k], im = s*real[k]+c*imag[k];
        real[k] = real[i]-r; imag[k] = imag[i]-im;
        real[i] += r; imag[i] += im;
      }
    }
  }
}

export function spectrum(times, values, { window = 'hann', size = 2048 } = {}) {
  if (times.length !== values.length || times.length < 8) throw new Error('频谱至少需要 8 个时域采样点');
  if (!['hann','rect'].includes(window)) throw new Error('未知 FFT 窗');
  if (!Number.isInteger(size) || size < 8 || size > 16384 || (size & (size-1))) throw new Error('FFT 点数应为 8–16384 之间的 2 的幂');
  let maxGap = 0;
  for (let i = 1; i < times.length; i++) {
    const gap = times[i]-times[i-1];
    if (gap < 0) throw new Error('频谱要求递增的时间轴');
    maxGap = Math.max(maxGap,gap);
  }
  const duration = times.at(-1)-times[0];
  if (!(duration > 0)) throw new Error('频谱需要非零采样时长');
  // Use the final contiguous record without synthesizing bandwidth across a large acquisition gap.
  const safeSamples = Math.floor(duration/maxGap*(1+1e-9)) + 1;
  const n = 2**Math.floor(Math.log2(Math.min(size,safeSamples,times.length)));
  if (n < 8) throw new Error('时间采样过疏。请缩小瞬态分析的最大步长并重新采集');
  const real = new Float64Array(n), imag = new Float64Array(n);
  // Retain the record end and use the native-density grid. When the FFT cap is below
  // the capture length, take the latest n samples rather than downsampling without filtering.
  const dt = duration/(safeSamples-1), start = times.at(-1) - (n-1)*dt;
  let index = 0, weightSum = 0, weightSquareSum = 0;
  for (let i = 0; i < n; i++) {
    const t = start + i*dt;
    while (index < times.length-2 && times[index+1] <= t) index++;
    const width = times[index+1]-times[index], frac = width ? Math.min(1,Math.max(0,(t-times[index])/width)) : 0;
    const sample = values[index] + (values[index+1]-values[index])*frac;
    const weight = window === 'hann' ? 0.5-0.5*Math.cos(2*Math.PI*i/n) : 1;
    real[i] = sample*weight;
    weightSum += weight;
    weightSquareSum += weight*weight;
  }
  fft(real,imag);
  const bins = n/2+1, frequencies = new Float64Array(bins), rms = new Float64Array(bins);
  const fs = 1/dt, df = fs/n;
  for (let i = 0; i < bins; i++) {
    frequencies[i] = i*df;
    // DC and the Nyquist bin are not doubled. Interior sinusoidal bins use peak / sqrt(2).
    rms[i] = Math.hypot(real[i],imag[i])/weightSum*(i && i < n/2 ? Math.SQRT2 : 1);
  }
  return { frequencies, rms, size: n, fs, df, rbw: fs*weightSquareSum/(weightSum*weightSum) };
}

export function nearestIndex(x, target) {
  let low = 0, high = x.length-1;
  const asc = x[low] <= x[high];
  while (low < high) {
    const mid = (low+high) >> 1;
    if (asc ? x[mid] < target : x[mid] > target) low = mid+1;
    else high = mid;
  }
  return low && Math.abs(x[low-1]-target) < Math.abs(x[low]-target) ? low-1 : low;
}

export function formatSI(value, unit = '', precision = 4) {
  if (!Number.isFinite(value)) return '—';
  if (!value) return '0' + (unit ? ' '+unit : '');
  if (unit === 'dB' || unit === '°' || !unit) return Number(value.toPrecision(precision)) + (unit ? ' '+unit : '');
  const exponents = [-15,-12,-9,-6,-3,0,3,6,9,12];
  const prefixes = ['f','p','n','µ','m','','k','M','G','T'];
  const e = 3*Math.floor(Math.log10(Math.abs(value))/3);
  const i = exponents.indexOf(e);
  if (i < 0) return value.toExponential(precision-1)+(unit ? ' '+unit : '');
  return Number((value/10**e).toPrecision(precision)) + ' ' + prefixes[i] + unit;
}
