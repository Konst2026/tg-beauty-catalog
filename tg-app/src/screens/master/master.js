'use strict';

// Главная кабинета мастера
function renderMasterDashboard() {
  const d = MASTER_DASHBOARD;
  const m = getMasterById('m1');

  const todayHtml = d.todayBookings.length
    ? d.todayBookings.map(b => `
      <div class="today-item">
        <div class="today-time">${b.time}</div>
        <div>
          <div class="today-name">${b.clientName}</div>
          <div class="today-svc">${b.service}</div>
        </div>
        <div class="status-badge status-${b.status}">${statusLabel(b.status)}</div>
      </div>`).join('')
    : `<div style="padding:16px;color:var(--hint);font-size:14px">Записей нет</div>`;

  return `
    ${renderBackBar()}
    <div class="master-banner">
      <div class="master-banner-name">${m.name}</div>
      <div class="master-banner-role">${m.specialty}</div>
    </div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card-num">${d.weekStats.bookings}</div>
        <div class="stat-card-label">Записей за неделю</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-num">${formatPrice(d.weekStats.revenue)}</div>
        <div class="stat-card-label">Выручка</div>
      </div>
    </div>
    <div class="section-title" style="padding:0 16px;margin-top:4px">Сегодня</div>
    <div class="today-list">${todayHtml}</div>`;
}

// Записи мастера (демо-данные из MY_BOOKINGS)
function renderMasterOrders() {
  const items = MY_BOOKINGS.map(b => `
    <div class="booking-item">
      <div class="booking-item-header">
        <div class="mini-avatar" style="background:linear-gradient(135deg,#2AABEE,#1565c0)">КЛ</div>
        <div>
          <div class="booking-item-name">Клиент Telegram</div>
          <div class="booking-item-service">${b.serviceName}</div>
        </div>
      </div>
      <div class="status-badge status-${b.status}">${statusLabel(b.status)}</div>
      <div class="booking-item-footer">
        <span class="booking-datetime">📅 ${formatDate(b.date)}, ${b.time}</span>
        <span class="booking-price">${formatPrice(b.price)}</span>
      </div>
    </div>`).join('');

  return `
    ${renderBackBar()}
    <div class="screen-header">Мои записи</div>
    <div class="section-title" style="margin:20px 16px 12px">Все записи</div>
    ${items || '<div style="padding:0 16px;color:var(--hint)">Нет записей</div>'}`;
}

// Услуги мастера
function renderMasterServices() {
  const m = getMasterById('m1');
  const items = m.services.map(s => `
    <div class="service-manage-item">
      <div class="svc-info">
        <div class="svc-name">${s.name}</div>
        <div class="svc-detail">${s.duration} мин · ${formatPrice(s.price)}</div>
      </div>
      <button class="btn btn-sm btn-secondary" data-edit-svc="${s.id}">Изменить</button>
    </div>`).join('');

  return `
    ${renderBackBar()}
    <div class="screen-header">Мои услуги</div>
    <div style="padding:8px 16px 0">
      <div class="section-title" style="margin-top:8px">Прайс-лист (${m.services.length})</div>
    </div>
    ${items || '<div style="padding:16px;color:var(--hint)">Услуги не добавлены</div>'}
    <div class="screen-footer">
      <button class="btn btn-primary" id="btn-add-service">+ Добавить услугу</button>
    </div>`;
}

// Редактирование / добавление услуги
function renderMasterServiceEdit() {
  const isNew = !state.editingServiceId;
  const svc = isNew ? null : getServiceById('m1', state.editingServiceId);
  const curDuration = svc ? svc.duration : 60;

  const durations = [15, 20, 30, 45, 60, 75, 90, 120, 150, 180];
  const durationOptions = durations.map(d =>
    `<option value="${d}" ${curDuration === d ? 'selected' : ''}>${d} мин</option>`
  ).join('');

  return `
    ${renderBackBar()}
    <div class="screen-header">${isNew ? 'Новая услуга' : 'Редактировать услугу'}</div>
    <div class="form-section">
      <div class="form-group">
        <label class="form-label">Название услуги</label>
        <input class="form-input" id="inp-svc-name" type="text"
          value="${svc ? svc.name : ''}" placeholder="Маникюр классический">
      </div>
      <div class="form-group">
        <label class="form-label">Длительность</label>
        <select class="form-select" id="inp-svc-duration">${durationOptions}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Стоимость, ₽</label>
        <input class="form-input" id="inp-svc-price" type="number" inputmode="numeric"
          value="${svc ? svc.price : ''}" placeholder="1200">
      </div>
    </div>
    <div class="screen-footer">
      <button class="btn btn-primary" id="btn-save-service">
        ${isNew ? '+ Добавить услугу' : 'Сохранить изменения'}
      </button>
      ${!isNew ? `<button class="btn btn-danger" style="margin-top:10px" id="btn-delete-service">Удалить услугу</button>` : ''}
    </div>`;
}

// Редактирование профиля мастера
function renderMasterProfileEdit() {
  const m = getMasterById('m1');

  const galleryItems = m.gallery.map((g, idx) => `
    <div class="gallery-manage-item" style="background:${g.bg}">
      <span class="gallery-item-label">${g.label}</span>
      <button class="gallery-del-btn" data-gallery-idx="${idx}">✕</button>
    </div>`).join('');

  return `
    ${renderBackBar()}
    <div class="screen-header">Мой профиль</div>
    <div class="profile-edit-top">
      <div class="profile-edit-avatar" style="background:${m.avatar}">${m.initials}</div>
    </div>
    <div class="form-section">
      <div class="form-group">
        <label class="form-label">Имя и фамилия</label>
        <input class="form-input" id="inp-master-name" type="text"
          value="${m.name}" placeholder="Имя Фамилия">
      </div>
      <div class="form-group">
        <label class="form-label">Специализация</label>
        <input class="form-input" id="inp-master-specialty" type="text"
          value="${m.specialty}" placeholder="Маникюр · педикюр">
      </div>
      <div class="form-group">
        <label class="form-label">Город и район</label>
        <input class="form-input" id="inp-master-city" type="text"
          value="${m.city}" placeholder="Москва, Таганская">
      </div>
      <div class="form-group">
        <label class="form-label">О себе</label>
        <textarea class="form-textarea" id="inp-master-bio"
          placeholder="Расскажите о себе и своём опыте...">${m.bio}</textarea>
      </div>
    </div>
    <div class="section-title" style="padding:0 16px;margin-top:4px">Портфолио</div>
    <div class="gallery-manage-row">
      ${galleryItems}
      <button class="gallery-add-btn" id="btn-add-gallery">
        <span class="gallery-add-icon">📷</span>
        <span>Добавить</span>
      </button>
    </div>
    <div class="section-title" style="padding:0 16px;margin-top:4px">Дополнительно</div>
    <div class="profile-menu">
      <div class="profile-menu-item" id="menu-master-schedule">
        <span class="profile-menu-icon">🗓️</span>
        <span class="profile-menu-label">Рабочие часы</span>
        <span class="profile-menu-arrow">›</span>
      </div>
      <div class="profile-menu-item" id="menu-master-services">
        <span class="profile-menu-icon">✂️</span>
        <span class="profile-menu-label">Мои услуги</span>
        <span class="profile-menu-arrow">›</span>
      </div>
    </div>
    <div class="screen-footer">
      <button class="btn btn-primary" id="btn-save-profile">Сохранить изменения</button>
    </div>`;
}

// Расписание мастера
function renderMasterSchedule() {
  const sch = MASTER_DASHBOARD.schedule;
  const dayNames = { 0:'Вс', 1:'Пн', 2:'Вт', 3:'Ср', 4:'Чт', 5:'Пт', 6:'Сб' };

  const rows = Object.entries(sch).map(([num, day]) => {
    const timeBlock = day.work
      ? `<div class="schedule-hours">
           <input type="time" class="time-input" value="${day.start}" data-day="${num}" data-type="start">
           <span style="color:var(--hint)">—</span>
           <input type="time" class="time-input" value="${day.end}" data-day="${num}" data-type="end">
         </div>`
      : `<span class="sched-off">Выходной</span>`;

    return `
      <div class="schedule-item">
        <span class="sched-day">${dayNames[num]}</span>
        <label class="toggle">
          <input type="checkbox" data-day="${num}" ${day.work ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
        ${timeBlock}
      </div>`;
  }).join('');

  return `
    ${renderBackBar()}
    <div class="screen-header">Расписание</div>
    <div class="p-16">
      <div class="section-title" style="margin-top:16px">Рабочие часы</div>
    </div>
    ${rows}
    <div class="screen-footer">
      <button class="btn btn-primary" id="btn-save-schedule">Сохранить</button>
    </div>`;
}
