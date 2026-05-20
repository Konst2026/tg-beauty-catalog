'use strict';

/**
 * data.js — Мок-данные приложения BeautyBook
 * Здесь: мастера, услуги, категории, галерея, мои записи
 * Для подключения реального бэкенда — заменить функции getters на fetch-запросы
 */

// ─── Категории ──────────────────────────────────────────────
const CATEGORIES = [
  { id: 'all',    label: 'Все',      emoji: '✨' },
  { id: 'nails',  label: 'Маникюр',  emoji: '💅' },
  { id: 'lashes', label: 'Ресницы',  emoji: '👁️' },
  { id: 'brows',  label: 'Брови',    emoji: '🤨' },
  { id: 'hair',   label: 'Волосы',   emoji: '💇' },
];

// ─── Мастера ─────────────────────────────────────────────────
const MASTERS = [
  {
    id: 'm1',
    name: 'Мария Иванова',
    initials: 'МИ',
    avatar: 'linear-gradient(135deg, #E8B4B8 0%, #C4956A 100%)',
    specialty: 'Маникюр · педикюр',
    categoryId: 'nails',
    rating: 4.9,
    reviewCount: 47,
    city: 'Москва, Таганская',
    priceFrom: 1200,
    availableToday: true,
    bio: 'Профессиональный мастер маникюра с 8-летним опытом. Специализируюсь на миндальной форме, объёмных дизайнах и gel-x. Работаю только с сертифицированными материалами. Принимаю на дому в чистой, оборудованной зоне.',
    gallery: [
      { bg: 'linear-gradient(145deg,#FFB6C1,#FF69B4)', label: 'Миндаль' },
      { bg: 'linear-gradient(145deg,#F5CBA7,#E59866)', label: 'Нюд' },
      { bg: 'linear-gradient(145deg,#D7BDE2,#9B59B6)', label: 'Омбре' },
      { bg: 'linear-gradient(145deg,#AED6F1,#2980B9)', label: 'Синий' },
      { bg: 'linear-gradient(145deg,#A9DFBF,#27AE60)', label: 'Дизайн' },
    ],
    services: [
      { id: 's1_1', name: 'Маникюр классический',  price: 1200, duration: 60 },
      { id: 's1_2', name: 'Маникюр + гель-лак',    price: 1800, duration: 90 },
      { id: 's1_3', name: 'Педикюр классический',  price: 1500, duration: 75 },
      { id: 's1_4', name: 'Маникюр + педикюр',     price: 2800, duration: 150 },
      { id: 's1_5', name: 'Парафинотерапия рук',   price: 800,  duration: 30 },
    ],
  },
  {
    id: 'm2',
    name: 'Елена Соколова',
    initials: 'ЕС',
    avatar: 'linear-gradient(135deg, #C8A8E9 0%, #9B59B6 100%)',
    specialty: 'Ресницы · брови',
    categoryId: 'lashes',
    rating: 4.8,
    reviewCount: 32,
    city: 'Москва, Академическая',
    priceFrom: 1500,
    availableToday: true,
    bio: 'Сертифицированный мастер по наращиванию и ламинированию ресниц. Работаю с корейскими материалами. Стаж 5 лет, более 400 успешных работ. Индивидуальный подбор формы под разрез глаз.',
    gallery: [
      { bg: 'linear-gradient(145deg,#E8DAEF,#BB8FCE)', label: 'Классика' },
      { bg: 'linear-gradient(145deg,#D5EAF5,#7FB3D3)', label: 'Объём 2D' },
      { bg: 'linear-gradient(145deg,#FDEBD0,#FAD7A0)', label: 'Мегаобъём' },
      { bg: 'linear-gradient(145deg,#D6EAF8,#5DADE2)', label: 'Голливуд' },
    ],
    services: [
      { id: 's2_1', name: 'Наращивание классика',   price: 2500, duration: 120 },
      { id: 's2_2', name: 'Наращивание объём 2D',   price: 3200, duration: 150 },
      { id: 's2_3', name: 'Коррекция ресниц',       price: 1500, duration: 60  },
      { id: 's2_4', name: 'Снятие ресниц',          price: 600,  duration: 30  },
      { id: 's2_5', name: 'Ламинирование ресниц',   price: 2800, duration: 90  },
    ],
  },
  {
    id: 'm3',
    name: 'Юлия Петрова',
    initials: 'ЮП',
    avatar: 'linear-gradient(135deg, #F9E4B7 0%, #D4A017 100%)',
    specialty: 'Брови · макияж',
    categoryId: 'brows',
    rating: 4.7,
    reviewCount: 28,
    city: 'Москва, Аэропорт',
    priceFrom: 800,
    availableToday: false,
    bio: 'Мастер по оформлению бровей и макияжу. Провожу консультации по подбору формы и цвета под тип лица. Авторские техники архитектуры бровей. Работаю с Henna Brow и THUYA.',
    gallery: [
      { bg: 'linear-gradient(145deg,#FDEBD0,#D4AC0D)', label: 'Архитектура' },
      { bg: 'linear-gradient(145deg,#E8DAEF,#A569BD)', label: 'Окрашивание' },
      { bg: 'linear-gradient(145deg,#FDFEFE,#BDC3C7)', label: 'Натуральный' },
      { bg: 'linear-gradient(145deg,#D5F5E3,#52BE80)', label: 'Ламинирование' },
    ],
    services: [
      { id: 's3_1', name: 'Коррекция бровей',        price: 800,  duration: 45 },
      { id: 's3_2', name: 'Окрашивание хной',         price: 600,  duration: 30 },
      { id: 's3_3', name: 'Архитектура бровей',       price: 1200, duration: 60 },
      { id: 's3_4', name: 'Ламинирование бровей',     price: 2000, duration: 90 },
      { id: 's3_5', name: 'Коррекция + окрашивание',  price: 1300, duration: 70 },
    ],
  },
  {
    id: 'm4',
    name: 'Кристина Новикова',
    initials: 'КН',
    avatar: 'linear-gradient(135deg, #A8D8EA 0%, #2980B9 100%)',
    specialty: 'Стрижки · окраска',
    categoryId: 'hair',
    rating: 4.9,
    reviewCount: 61,
    city: 'Москва, Молодёжная',
    priceFrom: 2500,
    availableToday: true,
    bio: 'Топ-стилист с 12-летним опытом. Специализируюсь на женских стрижках, балаяже и тонировании. Обучение в Toni&Guy London. Работаю с профессиональной косметикой L\'Oreal и Wella Professionals.',
    gallery: [
      { bg: 'linear-gradient(145deg,#D5F5E3,#1E8449)', label: 'Боб' },
      { bg: 'linear-gradient(145deg,#FDEBD0,#CA6F1E)', label: 'Балаяж' },
      { bg: 'linear-gradient(145deg,#D6DBDF,#566573)', label: 'Пепельный' },
      { bg: 'linear-gradient(145deg,#FDEDEC,#C0392B)', label: 'Рыжий' },
      { bg: 'linear-gradient(145deg,#EBF5FB,#2471A3)', label: 'Пикси' },
    ],
    services: [
      { id: 's4_1', name: 'Женская стрижка',          price: 2500, duration: 60  },
      { id: 's4_2', name: 'Стрижка + укладка',        price: 3500, duration: 90  },
      { id: 's4_3', name: 'Одноцветное окрашивание',  price: 4500, duration: 150 },
      { id: 's4_4', name: 'Балаяж / мелирование',    price: 6500, duration: 210 },
      { id: 's4_5', name: 'Восстановление волос',     price: 3000, duration: 90  },
    ],
  },
  {
    id: 'm5',
    name: 'Анастасия Козлова',
    initials: 'АК',
    avatar: 'linear-gradient(135deg, #FADBD8 0%, #E74C3C 100%)',
    specialty: 'Маникюр · дизайн',
    categoryId: 'nails',
    rating: 4.6,
    reviewCount: 19,
    city: 'Москва, Выхино',
    priceFrom: 1500,
    availableToday: true,
    bio: 'Молодой мастер маникюра с акцентом на nail art. Создаю уникальные дизайны под любой образ. Специализируюсь на гелевых системах и акриловых покрытиях.',
    gallery: [
      { bg: 'linear-gradient(145deg,#FDEDEC,#F1948A)', label: 'Коралл' },
      { bg: 'linear-gradient(145deg,#EAFAF1,#58D68D)', label: 'Летний' },
      { bg: 'linear-gradient(145deg,#F0F3F4,#ABB2B9)', label: 'Серебро' },
      { bg: 'linear-gradient(145deg,#FEF9E7,#F4D03F)', label: 'Золото' },
    ],
    services: [
      { id: 's5_1', name: 'Маникюр с покрытием',      price: 1500, duration: 75 },
      { id: 's5_2', name: 'Снятие гель-лака',         price: 400,  duration: 20 },
      { id: 's5_3', name: 'Nail art (1 ноготь)',       price: 200,  duration: 15 },
      { id: 's5_4', name: 'Маникюр + укрепление',     price: 2000, duration: 90 },
      { id: 's5_5', name: 'Коррекция гелевых ногтей', price: 1800, duration: 80 },
    ],
  },
];

// ─── Мои записи (демо-данные) ────────────────────────────────
let MY_BOOKINGS = [
  {
    id: 'b001',
    masterId: 'm1',
    masterName: 'Мария Иванова',
    masterAvatar: MASTERS[0].avatar,
    serviceId: 's1_2',
    serviceName: 'Маникюр + гель-лак',
    price: 1800,
    date: getFutureDate(2),
    time: '14:00',
    status: 'confirmed',
  },
  {
    id: 'b002',
    masterId: 'm2',
    masterName: 'Елена Соколова',
    masterAvatar: MASTERS[1].avatar,
    serviceId: 's2_1',
    serviceName: 'Наращивание классика',
    price: 2500,
    date: getPastDate(14),
    time: '11:00',
    status: 'completed',
  },
];

// ─── Данные мастера для личного кабинета (демо) ─────────────
const MASTER_DASHBOARD = {
  masterId: 'm1',
  todayBookings: [
    { time: '10:00', clientName: 'Алина Петрова',   service: 'Маникюр классический', status: 'confirmed' },
    { time: '12:30', clientName: 'Карина Михайлова', service: 'Маникюр + гель-лак',  status: 'confirmed' },
    { time: '15:00', clientName: 'Вера Сидорова',   service: 'Педикюр классический', status: 'pending'   },
  ],
  weekStats: { bookings: 8, revenue: 14400 },
  schedule: {
    1: { work: true,  start: '10:00', end: '19:00' },
    2: { work: true,  start: '10:00', end: '19:00' },
    3: { work: true,  start: '10:00', end: '19:00' },
    4: { work: true,  start: '10:00', end: '19:00' },
    5: { work: true,  start: '10:00', end: '18:00' },
    6: { work: true,  start: '11:00', end: '16:00' },
    0: { work: false, start: '',      end: ''       },
  },
};

// ─── Вспомогательные функции ─────────────────────────────────
function getMasterById(id) {
  return MASTERS.find(m => m.id === id) || null;
}

function getMastersByCategory(categoryId) {
  if (categoryId === 'all') return MASTERS;
  return MASTERS.filter(m => m.categoryId === categoryId);
}

function getServiceById(masterId, serviceId) {
  const master = getMasterById(masterId);
  return master ? master.services.find(s => s.id === serviceId) || null : null;
}

/** Генерирует доступные слоты на 7 дней вперёд */
function generateSlots(masterId) {
  const slots = {};
  const today = new Date();
  // Мастер m3 не работает сегодня и завтра — для реализма
  const daysOff = masterId === 'm3' ? [today.getDay(), (today.getDay() + 1) % 7] : [0];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (daysOff.includes(d.getDay())) continue;

    const key = dateToStr(d);
    const allSlots = [];
    for (let h = 10; h < 19; h++) {
      allSlots.push(hhmm(h, 0));
      allSlots.push(hhmm(h, 30));
    }
    // Псевдослучайно убираем ~30% слотов (занятые)
    const seed = masterId.charCodeAt(1) + d.getDate();
    slots[key] = allSlots.filter((_, idx) => (idx + seed) % 3 !== 0);
  }
  return slots;
}

function dateToStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function hhmm(h, m) {
  return `${pad(h)}:${pad(m)}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function getFutureDate(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return dateToStr(d);
}

function getPastDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return dateToStr(d);
}

/** Форматирует дату "2026-05-21" → "Вт, 21 мая" */
function formatDate(dateStr) {
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  const days  = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  return `${days[d.getDay()]}, ${day} ${months[m - 1]}`;
}

/** Форматирует цену 1800 → "1 800 ₽" */
function formatPrice(price) {
  return price.toLocaleString('ru-RU') + ' ₽';
}

// ─── Персистентность профиля мастера ─────────────────────────

function saveMasterToStorage() {
  const m = getMasterById('m1');
  if (!m) return;
  try {
    localStorage.setItem('bb_master_m1', JSON.stringify(m));
  } catch (e) {
    // Фото слишком большие — сохраняем без base64 изображений
    try {
      const safe = Object.assign({}, m, {
        avatar:  m.avatar.startsWith('url(data:') ? 'linear-gradient(135deg, #E8B4B8 0%, #C4956A 100%)' : m.avatar,
        gallery: m.gallery.filter(g => !g.bg.startsWith('url(data:')),
      });
      localStorage.setItem('bb_master_m1', JSON.stringify(safe));
    } catch (e2) {}
  }
}

function loadMasterFromStorage() {
  try {
    const raw = localStorage.getItem('bb_master_m1');
    if (!raw) return;
    const saved = JSON.parse(raw);
    const m = getMasterById('m1');
    if (!m || !saved) return;
    Object.assign(m, saved);
  } catch (e) {}
}
