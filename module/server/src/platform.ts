// Платформенные функции: на сервере — node:crypto, в браузерной сборке — Web Crypto.
// Модуль задаёт реализацию при старте через setPlatform().
export interface Platform {
  randomHex(bytes: number): string;
  hashPin(pin: string): string;
  checkPin(pin: string, stored: string | null): boolean;
}

let current: Platform | null = null;
export function setPlatform(p: Platform) { current = p; }
export function platform(): Platform {
  if (!current) throw new Error('Платформа не инициализирована');
  return current;
}
