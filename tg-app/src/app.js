'use strict';

// ─── Состояние приложения ─────────────────────────────────────
const state = {
  currentScreen: 'splash',
  screenHistory: [],
  activeTab: 'catalog',
  isMasterMode: false,
  myMasterId: 'm1',
  selectedMasterId: null,
  selectedServiceId: null,
  selectedDate: null,
  selectedSlot: null,
  catalogFilter: 'all',
  tgUser: null,
  editingServiceId: null,
};

// ─── Telegram SDK (мок для разработки в браузере) ─────────────
let tg = window.Telegram?.WebApp;

if (!tg) {
  tg = {
    ready: () => {},
    expand: () => {},
    enableClosingConfirmation: () => {},
    initDataUnsafe: { user: { first_name: 'Алина', last_name: 'Петрова', username: 'alina_p', id: 12345 } },
    themeParams: {},
    MainButton: {
      show: () => {}, hide: () => {}, setText: () => {},
      onClick: () => {}, offClick: () => {},
    },
    BackButton: {
      show: () => {}, hide: () => {},
      onClick: (fn) => { tg.BackButton._fn = fn; },
      offClick: () => {},
      _fn: null,
    },
    HapticFeedback: {
      impactOccurred: () => {},
      notificationOccurred: () => {},
    },
    showAlert: (msg) => alert(msg),
    showConfirm: (msg, cb) => cb(confirm(msg)),
    openLink: (url) => window.open(url, '_blank'),
    colorScheme: 'light',
  };
}

// ─── Роутер ───────────────────────────────────────────────────
const NO_TAB = new Set(['splash', 'onboarding', 'role-select', 'date-time', 'booking-summary', 'booking-success', 'master-service-edit']);

function navigate(screen, data = {}, direction = 'forward') {
  Object.assign(state, data);

  if (direction === 'forward') {
    state.screenHistory.push(state.currentScreen);
  }
  state.currentScreen = screen;

  const container = document.getElementById('screen-container');
  const oldEl = container.querySelector('.screen');

  const newEl = document.createElement('div');
  newEl.className = 'screen' + (NO_TAB.has(screen) ? ' no-tab' : '');
  newEl.innerHTML = renderScreen(screen);

  if (oldEl && direction === 'forward') {
    oldEl.classList.add('anim-slide-out-left');
    newEl.classList.add('anim-slide-in-right');
  } else if (oldEl && direction === 'back') {
    oldEl.classList.add('anim-slide-out-right');
    newEl.classList.add('anim-slide-in-left');
  } else {
    newEl.classList.add('anim-fade-in');
  }

  container.appendChild(newEl);

  if (oldEl && direction !== 'none') {
    setTimeout(() => oldEl.remove(), 260);
  } else if (oldEl) {
    oldEl.remove();
  }

  updateTabBar(screen);
  updateBackButton(screen);
  bindScreenEvents(screen);
}

function goBack() {
  if (state.screenHistory.length === 0) return;
  const prev = state.screenHistory.pop();
  state.currentScreen = prev;

  const container = document.getElementById('screen-container');
  const oldEl = container.querySelector('.screen');

  const newEl = document.createElement('div');
  newEl.className = 'screen' + (NO_TAB.has(prev) ? ' no-tab' : '');
  newEl.innerHTML = renderScreen(prev);
  newEl.classList.add('anim-slide-in-left');

  if (oldEl) oldEl.classList.add('anim-slide-out-right');
  container.appendChild(newEl);
  if (oldEl) setTimeout(() => oldEl.remove(), 260);

  updateTabBar(prev);
  updateBackButton(prev);
  bindScreenEvents(prev);
}

function switchTab(tabId) {
  const tabToScreen = {
    'catalog':          'catalog',
    'bookings':         'my-bookings',
    'profile':          'profile',
    'master-home':      'master-dashboard',
    'master-orders':    'master-orders',
    'master-services':  'master-services',
    'master-profile':   'master-profile-edit',
  };
  state.activeTab = tabId;
  state.screenHistory = [];
  navigate(tabToScreen[tabId] || 'catalog', {}, 'none');
}

// ─── Рендер экрана ───────────────────────────────────────────
function renderScreen(screen) {
  switch (screen) {
    case 'splash':            return renderSplash();
    case 'onboarding':        return renderOnboarding();
    case 'role-select':       return renderRoleSelect();
    case 'catalog':           return renderCatalog();
    case 'master-profile':    return renderMasterProfile();
    case 'date-time':         return renderDateTime();
    case 'booking-summary':   return renderBookingSummary();
    case 'booking-success':   return renderBookingSuccess();
    case 'my-bookings':       return renderMyBookings();
    case 'profile':           return renderProfile();
    case 'master-dashboard':    return renderMasterDashboard();
    case 'master-orders':       return renderMasterOrders();
    case 'master-services':     return renderMasterServices();
    case 'master-schedule':     return renderMasterSchedule();
    case 'master-profile-edit': return renderMasterProfileEdit();
    case 'master-service-edit': return renderMasterServiceEdit();
    default:                  return renderCatalog();
  }
}

// ─── Таб-бар ──────────────────────────────────────────────────
const CLIENT_TABS = [
  { id: 'catalog',  icon: '🏠', label: 'Каталог' },
  { id: 'bookings', icon: '📅', label: 'Записи'  },
  { id: 'profile',  icon: '👤', label: 'Профиль' },
];

const MASTER_TABS = [
  { id: 'master-home',     icon: '🏠', label: 'Главная'  },
  { id: 'master-orders',   icon: '📅', label: 'Записи'   },
  { id: 'master-services', icon: '✂️', label: 'Услуги'   },
  { id: 'master-profile',  icon: '👤', label: 'Профиль'  },
];

function updateTabBar(screen) {
  const tabBar = document.getElementById('tab-bar');
  if (!tabBar) return;

  if (NO_TAB.has(screen)) {
    tabBar.classList.add('hidden');
    return;
  }
  tabBar.classList.remove('hidden');

  const tabs = state.isMasterMode ? MASTER_TABS : CLIENT_TABS;
  tabBar.innerHTML = tabs.map(t =>
    `<button class="tab-btn ${t.id === state.activeTab ? 'active' : ''}" data-tab="${t.id}">
       <span class="tab-icon">${t.icon}</span>${t.label}
     </button>`
  ).join('');

  tabBar.querySelectorAll('.tab-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      state.activeTab = btn.dataset.tab;
      switchTab(btn.dataset.tab);
    })
  );
}

function updateBackButton(screen) {
  if (state.screenHistory.length > 0) {
    tg.BackButton.show();
    tg.BackButton.offClick(goBack);
    tg.BackButton.onClick(goBack);
  } else {
    tg.BackButton.hide();
  }
}

function renderBackBar() {
  if (state.screenHistory.length === 0) return '';
  return `
    <div class="back-bar">
      <button class="back-btn" data-action="back">
        <span class="back-icon">‹</span>Назад
      </button>
    </div>`;
}

// ─── Тост ─────────────────────────────────────────────────────
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

// ─── Тёмная тема из TG ────────────────────────────────────────
function applyTheme() {
  const isDark = tg.colorScheme === 'dark'
    || (tg.themeParams && tg.themeParams.bg_color && parseInt(tg.themeParams.bg_color.replace('#',''), 16) < 0x888888);
  if (isDark) document.documentElement.setAttribute('data-theme', 'dark');
}

// ─── Оффер (показывается один раз) ───────────────────────────
function showOfferIfNeeded() {
  if (localStorage.getItem('bb_offer_shown')) return;
  const modal = document.getElementById('offer-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  function closeOffer() {
    localStorage.setItem('bb_offer_shown', '1');
    modal.classList.add('hidden');
  }

  document.getElementById('btn-offer-get')?.addEventListener('click', () => {
    closeOffer();
    tg.openLink('https://t.me/BeautyAppBook_bot?start=from_app');
  });
  document.getElementById('btn-offer-skip')?.addEventListener('click', closeOffer);
}

// ─── Инициализация ────────────────────────────────────────────
function init() {
  tg.ready();
  tg.expand();

  state.tgUser = tg.initDataUnsafe?.user || { first_name: 'Пользователь' };

  // Уникальный ID мастера = m_ + Telegram user ID
  if (state.tgUser.id) {
    state.myMasterId = 'm_' + state.tgUser.id;
  }

  applyTheme();
  loadMasterFromStorage();

  // Загружаем всех мастеров с сервера (async), обновляем каталог когда придут
  loadMastersFromServer().then(() => {
    if (state.currentScreen === 'catalog') navigate('catalog', {}, 'none');
  });

  document.getElementById('screen-container').addEventListener('click', e => {
    if (e.target.closest('[data-action="back"]')) goBack();
  });

  navigate('splash', {}, 'none');

  setTimeout(() => {
    state.screenHistory = [];
    const params = new URLSearchParams(window.location.search);
    if (params.get('role') === 'master') {
      let m = getMasterById(state.myMasterId);
      if (!m) {
        // Новый мастер — создаём запись в MASTERS
        const u = state.tgUser;
        const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ');
        const parts = (fullName || 'Мастер').split(' ');
        m = {
          id: state.myMasterId,
          name: fullName || 'Мастер',
          initials: (parts[0]?.[0] || '') + (parts[1]?.[0] || ''),
          avatar: 'linear-gradient(135deg, #E8B4B8 0%, #C4956A 100%)',
          specialty: '',
          categoryId: 'nails',
          rating: 5.0,
          reviewCount: 0,
          city: '',
          priceFrom: 0,
          availableToday: false,
          bio: '',
          gallery: [],
          services: [],
          promo: '',
        };
        MASTERS.push(m);
      }
      // Загружаем сохранённый профиль из localStorage если есть
      const savedRaw = localStorage.getItem('bb_master_' + state.myMasterId);
      if (savedRaw) try { Object.assign(m, JSON.parse(savedRaw)); } catch (e) {}

      state.isMasterMode = true;
      state.activeTab = 'master-profile';
      navigate('master-profile-edit', {}, 'none');
    } else {
      const firstScreen = localStorage.getItem('bb_onboarding_done') ? 'catalog' : 'onboarding';
      navigate(firstScreen, {}, 'none');
      showOfferIfNeeded();
    }
  }, 1500);
}

document.addEventListener('DOMContentLoaded', init);
