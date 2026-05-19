'use strict';

// ─── Состояние приложения ─────────────────────────────────────
const state = {
  currentScreen: 'splash',
  screenHistory: [],
  activeTab: 'catalog',
  isMasterMode: false,
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
    colorScheme: 'light',
  };
}

// ─── Роутер ───────────────────────────────────────────────────
const NO_TAB = new Set(['splash', 'role-select', 'date-time', 'booking-summary', 'booking-success', 'master-service-edit']);

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

  if (oldEl) setTimeout(() => oldEl.remove(), 260);

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

// ─── Инициализация ────────────────────────────────────────────
function init() {
  tg.ready();
  tg.expand();

  state.tgUser = tg.initDataUnsafe?.user || { first_name: 'Пользователь' };
  applyTheme();

  document.getElementById('screen-container').addEventListener('click', e => {
    if (e.target.closest('[data-action="back"]')) goBack();
  });

  navigate('splash', {}, 'none');

  setTimeout(() => {
    state.screenHistory = [];
    navigate('role-select', {}, 'none');
  }, 1500);
}

document.addEventListener('DOMContentLoaded', init);
