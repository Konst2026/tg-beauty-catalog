'use strict';

// Главная кабинета мастера
function renderMasterDashboard() {
  const d = MASTER_DASHBOARD;

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
    <div class="master-banner">
      <div class="master-banner-name">Мария Иванова</div>
      <div class="master-banner-role">Мастер маникюра · педикюра</div>
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
    <div class="screen-header">Мои услуги</div>
    <div class="p-16">
      <div class="section-title" style="margin-top:16px">Прайс-лист</div>
    </div>
    ${items}
    <div class="screen-footer">
      <button class="btn btn-primary" id="btn-add-service">+ Добавить услугу</button>
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
    <div class="screen-header">Расписание</div>
    <div class="p-16">
      <div class="section-title" style="margin-top:16px">Рабочие часы</div>
    </div>
    ${rows}
    <div class="screen-footer">
      <button class="btn btn-primary" id="btn-save-schedule">Сохранить</button>
    </div>`;
}
