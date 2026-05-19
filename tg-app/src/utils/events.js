'use strict';

// Диспетчер: вызывается сразу после рендера нового экрана
function bindScreenEvents(screen) {
  switch (screen) {
    case 'role-select':       return bindRoleSelectEvents();
    case 'catalog':           return bindCatalogEvents();
    case 'master-profile':    return bindMasterProfileEvents();
    case 'date-time':         return bindDateTimeEvents();
    case 'booking-summary':   return bindBookingSummaryEvents();
    case 'booking-success':   return bindBookingSuccessEvents();
    case 'my-bookings':       return bindMyBookingsEvents();
    case 'profile':           return bindProfileEvents();
    case 'master-dashboard':    return bindMasterDashboardEvents();
    case 'master-services':     return bindMasterServicesEvents();
    case 'master-schedule':     return bindMasterScheduleEvents();
    case 'master-profile-edit': return bindMasterProfileEditEvents();
    case 'master-service-edit': return bindMasterServiceEditEvents();
  }
}

function bindRoleSelectEvents() {
  document.getElementById('btn-role-client')?.addEventListener('click', () => {
    tg.HapticFeedback.impactOccurred('light');
    state.isMasterMode = false;
    state.activeTab = 'catalog';
    state.screenHistory = [];
    navigate('catalog', {}, 'forward');
  });

  document.getElementById('btn-role-master')?.addEventListener('click', () => {
    tg.HapticFeedback.impactOccurred('light');
    state.isMasterMode = true;
    state.activeTab = 'master-home';
    state.screenHistory = [];
    navigate('master-dashboard', {}, 'forward');
  });
}

function bindCatalogEvents() {
  document.querySelectorAll('.cat-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      state.catalogFilter = btn.dataset.cat;
      navigate('catalog', {}, 'none');
    });
  });

  document.querySelectorAll('.master-card').forEach(card => {
    card.addEventListener('click', () => {
      tg.HapticFeedback.impactOccurred('light');
      navigate('master-profile', { selectedMasterId: card.dataset.masterId });
    });
  });
}

function bindMasterProfileEvents() {
  document.querySelectorAll('[data-book]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      tg.HapticFeedback.impactOccurred('light');
      navigate('date-time', {
        selectedServiceId: btn.dataset.book,
        selectedDate: null,
        selectedSlot: null,
      });
    });
  });
}

function bindDateTimeEvents() {
  const slots = generateSlots(state.selectedMasterId);

  document.querySelectorAll('.date-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.selectedDate = chip.dataset.date;
      state.selectedSlot = null;

      document.querySelectorAll('.date-chip').forEach(c =>
        c.classList.toggle('active', c.dataset.date === state.selectedDate)
      );

      const daySlots = slots[state.selectedDate] || [];
      document.getElementById('slots-grid').innerHTML = daySlots.length
        ? daySlots.map(t => `<button class="slot-chip" data-slot="${t}">${t}</button>`).join('')
        : `<p class="no-slots">Нет свободных слотов</p>`;

      bindSlotEvents();

      const btn = document.getElementById('btn-continue');
      if (btn) btn.disabled = true;
    });
  });

  bindSlotEvents();

  document.getElementById('btn-continue')?.addEventListener('click', () => {
    if (!state.selectedSlot) return;
    tg.HapticFeedback.impactOccurred('medium');
    navigate('booking-summary');
  });
}

function bindSlotEvents() {
  document.querySelectorAll('.slot-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.selectedSlot = chip.dataset.slot;
      document.querySelectorAll('.slot-chip').forEach(c =>
        c.classList.toggle('active', c.dataset.slot === state.selectedSlot)
      );
      tg.HapticFeedback.impactOccurred('light');

      const btn = document.getElementById('btn-continue');
      if (btn) btn.disabled = false;
    });
  });
}

function bindBookingSummaryEvents() {
  tg.enableClosingConfirmation();

  document.getElementById('btn-confirm')?.addEventListener('click', () => {
    const m = getMasterById(state.selectedMasterId);
    const svc = getServiceById(state.selectedMasterId, state.selectedServiceId);

    MY_BOOKINGS.unshift({
      id: 'b' + Date.now(),
      masterId: state.selectedMasterId,
      masterName: m.name,
      masterAvatar: m.avatar,
      serviceId: state.selectedServiceId,
      serviceName: svc.name,
      price: svc.price,
      date: state.selectedDate,
      time: state.selectedSlot,
      status: 'confirmed',
    });

    tg.HapticFeedback.notificationOccurred('success');
    navigate('booking-success', {}, 'forward');
  });

  document.getElementById('btn-back-time')?.addEventListener('click', goBack);
}

function bindBookingSuccessEvents() {
  document.getElementById('btn-go-bookings')?.addEventListener('click', () => {
    state.activeTab = 'bookings';
    state.screenHistory = [];
    navigate('my-bookings', {}, 'none');
    updateTabBar('my-bookings');
  });

  document.getElementById('btn-go-catalog')?.addEventListener('click', () => {
    state.activeTab = 'catalog';
    state.screenHistory = [];
    navigate('catalog', {}, 'none');
    updateTabBar('catalog');
  });
}

function bindMyBookingsEvents() {
  document.querySelectorAll('[data-cancel-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      tg.showConfirm('Отменить запись?', (ok) => {
        if (!ok) return;
        const b = MY_BOOKINGS.find(x => x.id === btn.dataset.cancelId);
        if (b) b.status = 'cancelled';
        tg.HapticFeedback.notificationOccurred('warning');
        navigate('my-bookings', {}, 'none');
        showToast('Запись отменена');
      });
    });
  });
}

function bindProfileEvents() {
  document.getElementById('menu-my-bookings')?.addEventListener('click', () => {
    state.activeTab = 'bookings';
    navigate('my-bookings', {}, 'forward');
    updateTabBar('my-bookings');
  });

  document.getElementById('btn-master-cabinet')?.addEventListener('click', () => {
    tg.HapticFeedback.impactOccurred('medium');
    state.isMasterMode = true;
    state.activeTab = 'master-home';
    state.screenHistory = [];
    navigate('master-dashboard', {}, 'none');
    updateTabBar('master-dashboard');
  });
}

function bindMasterDashboardEvents() {
  // Заглушка — события добавятся с реальным бэкендом
}

function bindMasterServicesEvents() {
  document.getElementById('btn-add-service')?.addEventListener('click', () => {
    state.editingServiceId = null;
    navigate('master-service-edit', {}, 'forward');
  });

  document.querySelectorAll('[data-edit-svc]').forEach(btn =>
    btn.addEventListener('click', () => {
      state.editingServiceId = btn.dataset.editSvc;
      navigate('master-service-edit', {}, 'forward');
    })
  );
}

function bindMasterProfileEditEvents() {
  document.getElementById('btn-save-profile')?.addEventListener('click', () => {
    const name      = document.getElementById('inp-master-name')?.value.trim();
    const specialty = document.getElementById('inp-master-specialty')?.value.trim();
    const city      = document.getElementById('inp-master-city')?.value.trim();
    const bio       = document.getElementById('inp-master-bio')?.value.trim();
    const promo     = document.getElementById('inp-master-promo')?.value.trim();

    if (!name) { showToast('Введите имя'); return; }

    const m = getMasterById('m1');
    m.name      = name;
    m.specialty = specialty;
    m.city      = city;
    m.bio       = bio;
    m.promo     = promo;
    const parts = name.split(' ');
    m.initials  = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');

    tg.HapticFeedback.notificationOccurred('success');
    showToast('Профиль сохранён ✓');
  });

  document.querySelectorAll('.gallery-del-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.galleryIdx, 10);
      getMasterById('m1').gallery.splice(idx, 1);
      navigate('master-profile-edit', {}, 'none');
    });
  });

  document.querySelectorAll('[data-replace-idx]').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.replaceIdx, 10);
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { showToast('Файл слишком большой (макс. 10 МБ)'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
          getMasterById('m1').gallery[idx] = { bg: `url(${ev.target.result})`, label: '' };
          navigate('master-profile-edit', {}, 'none');
          showToast('Фото заменено ✓');
        };
        reader.readAsDataURL(file);
      };
      input.click();
    });
  });

  document.getElementById('btn-add-gallery')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        showToast('Файл слишком большой (макс. 10 МБ)');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        getMasterById('m1').gallery.push({
          bg: `url(${ev.target.result})`,
          label: '',
        });
        navigate('master-profile-edit', {}, 'none');
        showToast('Фото добавлено ✓');
      };
      reader.readAsDataURL(file);
    };
    input.click();
  });

}

function bindMasterServiceEditEvents() {
  document.getElementById('btn-save-service')?.addEventListener('click', () => {
    const name     = document.getElementById('inp-svc-name')?.value.trim();
    const duration = parseInt(document.getElementById('inp-svc-duration')?.value, 10);
    const price    = parseInt(document.getElementById('inp-svc-price')?.value, 10);

    if (!name)         { showToast('Введите название'); return; }
    if (!price || price < 1) { showToast('Введите стоимость'); return; }

    const m = getMasterById('m1');
    if (state.editingServiceId) {
      const svc = m.services.find(s => s.id === state.editingServiceId);
      if (svc) { svc.name = name; svc.duration = duration; svc.price = price; }
    } else {
      m.services.push({ id: 's_' + Date.now(), name, duration, price });
    }
    m.priceFrom = Math.min(...m.services.map(s => s.price));

    tg.HapticFeedback.notificationOccurred('success');
    showToast(state.editingServiceId ? 'Услуга обновлена ✓' : 'Услуга добавлена ✓');
    goBack();
  });

  document.getElementById('btn-delete-service')?.addEventListener('click', () => {
    tg.showConfirm('Удалить услугу?', (ok) => {
      if (!ok) return;
      const m = getMasterById('m1');
      m.services = m.services.filter(s => s.id !== state.editingServiceId);
      if (m.services.length) m.priceFrom = Math.min(...m.services.map(s => s.price));
      tg.HapticFeedback.notificationOccurred('warning');
      showToast('Услуга удалена');
      goBack();
    });
  });
}

function bindMasterScheduleEvents() {
  document.querySelectorAll('.toggle input[type=checkbox]').forEach(toggle => {
    toggle.addEventListener('change', () => {
      const day = toggle.dataset.day;
      const row = toggle.closest('.schedule-item');
      const works = toggle.checked;
      MASTER_DASHBOARD.schedule[day].work = works;

      const hoursEl = row.querySelector('.schedule-hours');
      const offEl = row.querySelector('.sched-off');

      if (works) {
        if (offEl) offEl.style.display = 'none';
        if (hoursEl) hoursEl.style.display = 'flex';
        else {
          const span = document.createElement('div');
          span.className = 'schedule-hours';
          span.innerHTML = `<input type="time" class="time-input" value="10:00" data-day="${day}" data-type="start">
            <span style="color:var(--hint)">—</span>
            <input type="time" class="time-input" value="19:00" data-day="${day}" data-type="end">`;
          row.appendChild(span);
        }
      } else {
        if (hoursEl) hoursEl.style.display = 'none';
        if (offEl) offEl.style.display = 'inline';
      }
    });
  });

  document.getElementById('btn-save-schedule')?.addEventListener('click', () => {
    document.querySelectorAll('.time-input').forEach(inp => {
      const d = inp.dataset.day;
      MASTER_DASHBOARD.schedule[d][inp.dataset.type] = inp.value;
    });
    tg.HapticFeedback.notificationOccurred('success');
    showToast('Расписание сохранено ✓');
  });
}
