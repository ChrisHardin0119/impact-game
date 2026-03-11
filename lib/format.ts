// ============================================================
// Number formatting utilities for Impact v13
// ============================================================

const SUFFIXES = [
  '', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc',
  'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg',
];

export function fmt(n: number, decimals = 2): string {
  if (n === 0) return '0';
  if (n < 0) return '-' + fmt(-n, decimals);
  if (!isFinite(n)) return '∞';
  if (n < 1000) return n < 10 ? n.toFixed(decimals) : n < 100 ? n.toFixed(1) : Math.floor(n).toString();
  const tier = Math.min(Math.floor(Math.log10(n) / 3), SUFFIXES.length - 1);
  const scaled = n / Math.pow(10, tier * 3);
  return scaled.toFixed(decimals) + SUFFIXES[tier];
}

export function fmtKg(n: number): string {
  return fmt(n) + ' Kg';
}

export function fmtRate(n: number): string {
  if (n === 0) return '0/s';
  return fmt(n) + '/s';
}

export function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

export function fmtPercent(multiplier: number): string {
  const pct = Math.round((multiplier - 1) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

export function fmtTime(seconds: number): string {
  if (seconds < 0) seconds = 0;
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
