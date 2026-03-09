// Number formatting with suffix notation
const SUFFIXES = [
  '', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc',
  'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg',
];

export function fmt(n: number, decimals = 1): string {
  if (n < 0) return '-' + fmt(-n, decimals);
  if (n < 1000) return n < 10 ? n.toFixed(decimals) : Math.floor(n).toString();
  const tier = Math.min(Math.floor(Math.log10(n) / 3), SUFFIXES.length - 1);
  const scaled = n / Math.pow(10, tier * 3);
  return scaled.toFixed(decimals) + SUFFIXES[tier];
}

export function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

export function fmtTime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
