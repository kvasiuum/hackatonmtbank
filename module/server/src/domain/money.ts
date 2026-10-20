// Формат сумм как в Moby: «1 240.50 BYN». На входе — копейки.
export function fmt(kopecks: number): string {
  const [int, frac] = (Math.abs(kopecks) / 100).toFixed(2).split('.');
  return `${kopecks < 0 ? '−' : ''}${int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${frac} BYN`;
}

export const toKopecks = (byn: number) => Math.round(byn * 100);
