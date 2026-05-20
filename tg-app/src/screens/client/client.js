'use strict';

// Онбординг — первый запуск
function renderOnboarding() {
  const u = state.tgUser || {};
  const name = u.first_name || 'друг';
  return `
    <div class="onboarding-screen">
      <div class="onboarding-hero">
        <div class="onboarding-emoji">👋</div>
        <div class="onboarding-title">Привет, ${name}!</div>
        <div class="onboarding-sub">BeautyBook — твой помощник для записи к мастерам красоты прямо в Telegram</div>
      </div>
      <div class="onboarding-features">
        <div class="onboarding-feature">
          <span class="onboarding-feature-icon">💅</span>
          <div>
            <div class="onboarding-feature-title">Каталог мастеров</div>
            <div class="onboarding-feature-desc">Маникюр, ресницы, брови и волосы — рядом с вами</div>
          </div>
        </div>
        <div class="onboarding-feature">
          <span class="onboarding-feature-icon">📅</span>
          <div>
            <div class="onboarding-feature-title">Онлайн-запись</div>
            <div class="onboarding-feature-desc">Выберите удобное время и запишитесь в пару кликов</div>
          </div>
        </div>
        <div class="onboarding-feature">
          <span class="onboarding-feature-icon">⭐</span>
          <div>
            <div class="onboarding-feature-title">Портфолио и отзывы</div>
            <div class="onboarding-feature-desc">Смотрите работы и выбирайте лучшего мастера</div>
          </div>
        </div>
      </div>
      <div class="screen-footer">
        <button class="btn btn-primary" id="btn-onboarding-start">Начать</button>
      </div>
    </div>`;
}

// Выбор роли — первый экран после сплэша
function renderRoleSelect() {
  return `
    <div class="role-select-screen">
      <div class="role-select-logo">✨</div>
      <div class="role-select-title">BeautyBook</div>
      <div class="role-select-sub">Кто вы сегодня?</div>
      <div class="role-cards">
        <button class="role-card role-card-client" id="btn-role-client">
          <span class="role-card-icon">🙋</span>
          <span class="role-card-body">
            <span class="role-card-title">Я Клиент</span>
            <span class="role-card-desc">Найти мастера и записаться на услугу</span>
          </span>
          <span class="role-card-arrow">›</span>
        </button>
        <button class="role-card role-card-master" id="btn-role-master">
          <span class="role-card-icon">✂️</span>
          <span class="role-card-body">
            <span class="role-card-title">Я Мастер</span>
            <span class="role-card-desc">Вести кабинет и принимать записи</span>
          </span>
          <span class="role-card-arrow">›</span>
        </button>
      </div>
    </div>`;
}

// Экран загрузки
function renderSplash() {
  return `
    <div class="splash">
      <div class="splash-icon">✨</div>
      <div class="splash-title">BeautyBook</div>
      <div class="splash-sub">Маркетплейс бьюти-мастеров</div>
      <div class="splash-bar-wrap"><div class="splash-bar"></div></div>
    </div>`;
}

// Каталог мастеров
function renderCatalog() {
  const masters = getMastersByCategory(state.catalogFilter);

  const catChips = CATEGORIES.map(c =>
    `<button class="cat-chip ${c.id === state.catalogFilter ? 'active' : ''}" data-cat="${c.id}">
       ${c.emoji} ${c.label}
     </button>`
  ).join('');

  const masterCards = masters.length
    ? masters.map(m => `
      <div class="master-card" data-master-id="${m.id}">
        <div class="master-avatar" style="background-image:${m.avatar}">${m.avatar.startsWith('url(') ? '' : m.initials}</div>
        <div class="master-info">
          <div class="master-name">${m.name}</div>
          <div class="master-specialty">${m.specialty}</div>
          <div class="master-meta">
            <span class="stars">⭐</span>
            <span class="rating-val">${m.rating}</span>
            <span class="review-cnt">(${m.reviewCount})</span>
          </div>
          <div class="master-price-row">
            <span class="master-price">от ${formatPrice(m.priceFrom)}</span>
            ${m.availableToday ? '<span class="badge-today">Сегодня свободно</span>' : ''}
          </div>
          ${m.promo ? `<div class="master-card-promo">🎉 ${m.promo}</div>` : ''}
        </div>
      </div>`).join('')
    : `<div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">Мастера не найдены</div>
        <div class="empty-sub">Попробуйте другую категорию</div>
      </div>`;

  return `
    ${renderBackBar()}
    <div class="catalog-header">
      <div class="greeting">BeautyBook</div>
      <div class="greeting-sub">Найди своего мастера</div>
    </div>
    <div class="category-scroll">${catChips}</div>
    <div class="masters-list">${masterCards}</div>`;
}

// Профиль мастера
function renderMasterProfile() {
  const m = getMasterById(state.selectedMasterId);
  if (!m) return renderCatalog();

  const gallery = m.gallery.map(g =>
    `<div class="gallery-item" style="background-image:${g.bg}">${g.label}</div>`
  ).join('');

  const services = m.services.map(s => `
    <div class="service-item" data-service-id="${s.id}">
      <div>
        <div class="service-name">${s.name}</div>
        <div class="service-meta">${s.duration} мин</div>
      </div>
      <div class="service-right">
        <div class="service-price">${formatPrice(s.price)}</div>
        <button class="btn btn-sm btn-primary" data-book="${s.id}">Записаться</button>
      </div>
    </div>`).join('');

  return `
    ${renderBackBar()}
    <div class="profile-hero" style="background-image:${m.avatar}"></div>
    <div class="profile-body">
      <div class="profile-name">${m.name}</div>
      <div class="profile-rating">
        <span class="stars">⭐</span>
        <span class="rating-val">${m.rating}</span>
        <span class="review-cnt">${m.reviewCount} отзывов · 📍 ${m.city}</span>
      </div>
      <div class="profile-bio">${m.bio}</div>
      ${m.promo ? `<div class="promo-banner"><span class="promo-banner-icon">🎉</span><span class="promo-banner-text">${m.promo}</span></div>` : ''}
      <div class="section-title">Портфолио</div>
      <div class="gallery-scroll">${gallery}</div>
      <div class="section-title">Услуги</div>
      ${services}
    </div>`;
}

// Выбор даты и времени
function renderDateTime() {
  const m = getMasterById(state.selectedMasterId);
  const svc = m ? m.services.find(s => s.id === state.selectedServiceId) : null;
  if (!m || !svc) return '';

  const slots = generateSlots(state.selectedMasterId);
  const dates = Object.keys(slots).sort();
  if (!state.selectedDate || !slots[state.selectedDate]) state.selectedDate = dates[0] || null;

  const dateChips = dates.map(d => {
    const [, , dd] = d.split('-');
    const dayLabel = formatDate(d).split(', ')[0];
    return `<button class="date-chip ${d === state.selectedDate ? 'active' : ''}" data-date="${d}">
      <span class="date-day">${dayLabel}</span>
      <span class="date-num">${parseInt(dd, 10)}</span>
    </button>`;
  }).join('');

  const daySlots = state.selectedDate ? (slots[state.selectedDate] || []) : [];
  const slotsHtml = daySlots.length
    ? daySlots.map(t =>
        `<button class="slot-chip ${t === state.selectedSlot ? 'active' : ''}" data-slot="${t}">${t}</button>`
      ).join('')
    : `<p class="no-slots">Нет свободных слотов</p>`;

  return `
    ${renderBackBar()}
    <div class="booking-mini-header">
      <div class="mini-avatar" style="background-image:${m.avatar}">${m.avatar.startsWith('url(') ? '' : m.initials}</div>
      <div>
        <div class="mini-master">${m.name}</div>
        <div class="mini-service">${svc.name} · ${formatPrice(svc.price)}</div>
      </div>
    </div>
    <div class="date-scroll">${dateChips}</div>
    <div class="time-section">
      <div class="time-day-label">Доступное время</div>
      <div class="slots-grid" id="slots-grid">${slotsHtml}</div>
    </div>
    <div class="screen-footer">
      <button class="btn btn-primary" id="btn-continue" ${state.selectedSlot ? '' : 'disabled'}>
        Продолжить
      </button>
    </div>`;
}

// Подтверждение записи
function renderBookingSummary() {
  const m = getMasterById(state.selectedMasterId);
  const svc = getServiceById(state.selectedMasterId, state.selectedServiceId);
  if (!m || !svc) return '';

  return `
    ${renderBackBar()}
    <div class="screen-header">Подтверждение</div>
    <div class="summary-card">
      <div class="summary-master-row">
        <div class="mini-avatar" style="background-image:${m.avatar}">${m.avatar.startsWith('url(') ? '' : m.initials}</div>
        <div>
          <div class="summary-master-name">${m.name}</div>
          <div class="summary-master-spec">${m.specialty}</div>
        </div>
      </div>
      <div class="summary-row"><span class="summary-icon">✂️</span>
        <div><div class="summary-label">Услуга</div><div class="summary-value">${svc.name}</div></div>
      </div>
      <div class="summary-row"><span class="summary-icon">📅</span>
        <div><div class="summary-label">Дата</div><div class="summary-value">${formatDate(state.selectedDate)}</div></div>
      </div>
      <div class="summary-row"><span class="summary-icon">🕐</span>
        <div><div class="summary-label">Время</div><div class="summary-value">${state.selectedSlot}</div></div>
      </div>
      <div class="summary-row"><span class="summary-icon">⏱️</span>
        <div><div class="summary-label">Длительность</div><div class="summary-value">${svc.duration} мин</div></div>
      </div>
      <div class="summary-row"><span class="summary-icon">💰</span>
        <div><div class="summary-label">Итого</div><div class="summary-price">${formatPrice(svc.price)}</div></div>
      </div>
    </div>
    <div class="screen-footer">
      <button class="btn btn-primary" id="btn-confirm">Записаться</button>
      <button class="btn btn-secondary" style="margin-top:10px" id="btn-back-time">Изменить время</button>
    </div>`;
}

// Успешная запись
function renderBookingSuccess() {
  const m = getMasterById(state.selectedMasterId);
  const svc = getServiceById(state.selectedMasterId, state.selectedServiceId);
  return `
    <div class="success-screen">
      <div class="success-icon">✅</div>
      <div class="success-title">Запись подтверждена!</div>
      <div class="success-sub">Мастер получит уведомление о вашей записи</div>
      <div class="success-detail-card">
        <div class="success-detail-row">
          <span class="detail-label">Мастер</span>
          <span class="detail-value">${m ? m.name : ''}</span>
        </div>
        <div class="success-detail-row">
          <span class="detail-label">Услуга</span>
          <span class="detail-value">${svc ? svc.name : ''}</span>
        </div>
        <div class="success-detail-row">
          <span class="detail-label">Дата и время</span>
          <span class="detail-value">${formatDate(state.selectedDate)}, ${state.selectedSlot}</span>
        </div>
        <div class="success-detail-row">
          <span class="detail-label">Стоимость</span>
          <span class="detail-value">${svc ? formatPrice(svc.price) : ''}</span>
        </div>
      </div>
      <div class="success-actions">
        <button class="btn btn-primary" id="btn-go-bookings">Мои записи</button>
        <button class="btn btn-secondary" id="btn-go-catalog">На главную</button>
      </div>
    </div>`;
}

// Мои записи
function renderMyBookings() {
  const upcoming = MY_BOOKINGS.filter(b => b.status === 'confirmed' || b.status === 'pending');
  const past = MY_BOOKINGS.filter(b => b.status === 'completed' || b.status === 'cancelled');

  function card(b) {
    const ini = b.masterName.split(' ').map(w => w[0]).join('').slice(0, 2);
    return `
      <div class="booking-item">
        <div class="booking-item-header">
          <div class="mini-avatar" style="background:${b.masterAvatar}">${ini}</div>
          <div>
            <div class="booking-item-name">${b.masterName}</div>
            <div class="booking-item-service">${b.serviceName}</div>
          </div>
        </div>
        <div class="status-badge status-${b.status}">${statusLabel(b.status)}</div>
        <div class="booking-item-footer">
          <span class="booking-datetime">📅 ${formatDate(b.date)}, ${b.time}</span>
          <span class="booking-price">${formatPrice(b.price)}</span>
        </div>
        ${b.status === 'confirmed' ? `<div class="booking-actions">
          <button class="btn btn-sm btn-danger" data-cancel-id="${b.id}">Отменить</button>
        </div>` : ''}
      </div>`;
  }

  const emptyMsg = (text) => `<div style="padding:16px;color:var(--hint);font-size:14px">${text}</div>`;

  return `
    ${renderBackBar()}
    <div class="screen-header">Мои записи</div>
    <div class="section-title" style="margin:20px 16px 12px">Предстоящие</div>
    ${upcoming.length ? upcoming.map(card).join('') : emptyMsg('Нет предстоящих записей')}
    <div class="section-title" style="margin:20px 16px 12px">История</div>
    ${past.length ? past.map(card).join('') : emptyMsg('Нет прошедших записей')}`;
}

// Профиль пользователя
function renderProfile() {
  const u = state.tgUser || { first_name: 'Пользователь', last_name: '' };
  const ini = (u.first_name[0] || 'П') + (u.last_name ? u.last_name[0] : '');
  const upcoming = MY_BOOKINGS.filter(b => b.status === 'confirmed').length;
  const completed = MY_BOOKINGS.filter(b => b.status === 'completed').length;

  return `
    ${renderBackBar()}
    <div class="user-profile-card">
      <div class="user-avatar-big">${ini}</div>
      <div>
        <div class="user-name">${u.first_name} ${u.last_name || ''}</div>
        <div class="user-username">${u.username ? '@' + u.username : 'Telegram'}</div>
      </div>
    </div>
    <div class="stats-row">
      <div class="stat-item"><div class="stat-num">${upcoming}</div><div class="stat-label">Предстоящих</div></div>
      <div class="stat-item"><div class="stat-num">${completed}</div><div class="stat-label">Завершённых</div></div>
      <div class="stat-item"><div class="stat-num">${MY_BOOKINGS.length}</div><div class="stat-label">Всего</div></div>
    </div>
    <div class="menu-group">
      <div class="menu-item" id="menu-my-bookings">
        <span class="menu-icon">📅</span><span class="menu-label">Мои записи</span><span class="menu-arrow">›</span>
      </div>
      <div class="menu-item">
        <span class="menu-icon">🔔</span><span class="menu-label">Уведомления</span><span class="menu-arrow">›</span>
      </div>
      <div class="menu-item">
        <span class="menu-icon">💬</span><span class="menu-label">Поддержка</span><span class="menu-arrow">›</span>
      </div>
    </div>
    <button class="share-btn" id="btn-share">
      <span class="share-btn-icon">🔗</span>
      <span class="share-btn-text">Поделиться с другом</span>
      <span class="share-btn-arrow">›</span>
    </button>
    <div class="master-promo-card">
      <div>
        <div class="master-promo-title">Вы мастер?</div>
        <div class="master-promo-sub">Принимайте записи прямо в Telegram</div>
      </div>
      <button class="btn btn-sm" style="background:#fff;color:var(--accent);min-width:90px" id="btn-master-cabinet">Кабинет</button>
    </div>`;
}

// Метка статуса записи
function statusLabel(s) {
  return { confirmed: 'Подтверждено', pending: 'Ожидание', completed: 'Завершено', cancelled: 'Отменено' }[s] || s;
}
