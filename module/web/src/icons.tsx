// Иконки. Основные (вкладки, действия на главной, история) нарисованы под стиль Moby,
// остальные — из набора Lucide с той же толщиной линии.
import type { ReactNode } from 'react';
import {
  ArrowLeft, Ban, Banknote, Bell, Bike, BookOpen, Briefcase, Bus, ChartColumn, Check, ChevronDown, ChevronRight, Calculator, Percent, Sparkles, Trash2, UserPlus, X, Cigarette, Clapperboard,
  Clock, Cloud, Code, Coffee, Coins, CreditCard, Dices, Dumbbell, Eye, EyeOff, FerrisWheel, FileText, Footprints, Gamepad2, Gift,
  GraduationCap, Headphones, Info, KeyRound, Landmark, ListChecks, Lock, LockOpen, MapPin, MessageCircle, Music, Package, Pencil,
  Phone, PiggyBank, Plane, Plus, QrCode, Repeat, Rocket, Sandwich, School, Search, Send, Settings, Shield, ShieldAlert, ShieldCheck,
  SlidersHorizontal, Smartphone, Smile, Star, Sticker, Target, Tent, ToyBrick, Trophy, Tv, User, Users, Utensils, Watch, Wifi, CircleDollarSign,
  type LucideIcon,
} from 'lucide-react';

const LUCIDE: Record<string, LucideIcon> = {
  'arrow-left': ArrowLeft, ban: Ban, banknote: Banknote, bell: Bell, bike: Bike, 'book-open': BookOpen, briefcase: Briefcase, bus: Bus,
  'chart-column': ChartColumn, check: Check, 'chevron-right': ChevronRight, 'chevron-down': ChevronDown, calculator: Calculator, percent: Percent,
  sparkles: Sparkles, trash: Trash2, 'user-plus': UserPlus, x: X, cigarette: Cigarette, clapperboard: Clapperboard, clock: Clock,
  cloud: Cloud, code: Code, coffee: Coffee, coins: Coins, 'credit-card': CreditCard, dices: Dices, dumbbell: Dumbbell, eye: Eye, 'eye-off': EyeOff,
  'ferris-wheel': FerrisWheel, 'file-text': FileText, footprints: Footprints, 'gamepad-2': Gamepad2, gift: Gift, 'graduation-cap': GraduationCap,
  headphones: Headphones, info: Info, 'key-round': KeyRound, landmark: Landmark, 'list-checks': ListChecks, lock: Lock, 'lock-open': LockOpen,
  'map-pin': MapPin, 'message-circle': MessageCircle, music: Music, package: Package, pencil: Pencil, phone: Phone, 'piggy-bank': PiggyBank,
  plane: Plane, plus: Plus, 'qr-code': QrCode, repeat: Repeat, rocket: Rocket, sandwich: Sandwich, school: School, search: Search, send: Send,
  settings: Settings, shield: Shield, 'shield-alert': ShieldAlert, 'shield-check': ShieldCheck, 'sliders-horizontal': SlidersHorizontal,
  smartphone: Smartphone, smile: Smile, star: Star, sticker: Sticker, target: Target, tent: Tent, 'toy-brick': ToyBrick, trophy: Trophy, tv: Tv,
  user: User, users: Users, utensils: Utensils, watch: Watch, wifi: Wifi, 'circle-dollar-sign': CircleDollarSign,
};

const moby = (body: ReactNode) => ({ size = 26, sw = 1.6 }: { size?: number; sw?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{body}</svg>
);

const MOBY: Record<string, (p: { size?: number; sw?: number }) => ReactNode> = {
  // «Пополнить»: открытая коробка, в которую входит стрелка
  topup: moby(<><path d="M3 10.5h7l1.2 2h1.6l1.2-2H21v8.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M3 10.5 5 7h3.5M21 10.5 19.6 7" /><path d="M16 2.5v6.5M13.5 6.5 16 9l2.5-2.5" /></>),
  // «Перевести»: круг со встречными стрелками
  transfer: moby(<><circle cx="12" cy="12" r="9.5" /><path d="M7.5 10h9l-2.6-2.6M16.5 14h-9l2.6 2.6" /></>),
  // «Оплатить»: кошелёк с клапаном
  pay: moby(<><path d="M4 9.5h15.5a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><path d="M4 9.5 15.5 5l1.6 4.5" /><circle cx="16.5" cy="14.8" r="1" /></>),
  // История: часы со стрелкой против часовой
  history: moby(<><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.4" /><path d="M3.5 3.8v4.6h4.6" /><path d="M12 7.5V12l3 2" /></>),
  // Операция: лоток со стрелкой вверх
  upload: moby(<><path d="M3 11h6l1 2h4l1-2h6v7.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" /><path d="M3 11 4.5 6.5H8M21 11l-1.5-4.5H16" /><path d="M12 13V3.5M9.5 6 12 3.5 14.5 6" /></>),
  // Вкладка «Продукты»: две карты одна за другой
  products: moby(<><rect x="6" y="3.5" width="16" height="11.5" rx="1.5" /><rect x="2" y="8.5" width="16" height="12" rx="1.5" fill="#fff" /><path d="M2 12.5h16" /></>),
  // Вкладка «Чат»: два облачка
  chat: moby(<><path d="M3.2 3.5h12.6c.7 0 1.2.5 1.2 1.2v7.6c0 .7-.5 1.2-1.2 1.2H8.5L5 16.5v-3H3.2c-.7 0-1.2-.5-1.2-1.2V4.7c0-.7.5-1.2 1.2-1.2z" /><path d="M5.5 7.5h8M5.5 10.3h5.5" /><path d="M19.5 8h1.3c.7 0 1.2.5 1.2 1.2v7.6c0 .7-.5 1.2-1.2 1.2H20v3l-3.5-3h-6.3c-.7 0-1.2-.5-1.2-1.2v-1.3" /></>),
  // Вкладка «Ещё»: три кружка
  more: moby(<><circle cx="4.5" cy="12" r="2.2" /><circle cx="12" cy="12" r="2.2" /><circle cx="19.5" cy="12" r="2.2" /></>),
  card: moby(<><rect x="2.5" y="5.5" width="19" height="13" rx="2.5" fill="currentColor" stroke="none" /><rect x="5" y="12.5" width="5" height="2" rx="1" fill="#fff" stroke="none" /></>),
};

/** Логотип Moby для вкладки «Главная»: цветной, когда вкладка активна */
export function MobyLogo({ active, size = 30 }: { active: boolean; size?: number }) {
  const d = 'M4.5 19V8.6c0-2 2.5-2.9 3.7-1.3L12 12.6l3.8-5.3c1.2-1.6 3.7-.7 3.7 1.3V19';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="mobyM" x1="3" y1="12" x2="21" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2F6BFF" /><stop offset=".55" stopColor="#8C4DFF" /><stop offset="1" stopColor="#FF4F6E" />
        </linearGradient>
      </defs>
      {active
        ? <path d={d} stroke="url(#mobyM)" strokeWidth={4.2} strokeLinecap="round" strokeLinejoin="round" />
        : <><path d={d} stroke="#1A1F2B" strokeWidth={4.4} strokeLinecap="round" strokeLinejoin="round" /><path d={d} stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></>}
    </svg>
  );
}

export function Icon({ name, size = 22, sw = 1.7, className }: { name: string; size?: number; sw?: number; className?: string }) {
  const M = MOBY[name];
  if (M) return <>{M({ size, sw })}</>;
  const L = LUCIDE[name] ?? Info;
  return <L size={size} strokeWidth={sw} className={className} aria-hidden="true" />;
}
