# brief.md — TG Beauty Marketplace: план разработки v1.0

> Основано на: research.md, Architecture.md, CLAUDE.md  
> Дата: 2026-05-18  
> Принцип: сначала клиентский flow → потом личный кабинет мастера

---

## Быстрый обзор

**Что строим:** Telegram Mini App — маркетплейс бьюти-мастеров.  
**Одна ссылка:** `t.me/BeautyBot` → роль определяется по Telegram ID.  
**Клиент:** находит мастера → видит его работы → записывается за 4 шага.  
**Мастер:** ведёт профиль, услуги, расписание, видит записи.

---

## Карта экранов

```
КЛИЕНТ
───────────────────────────────────────────────────────
[Splash] → [Каталог мастеров] → [Профиль мастера]
                                       ↓
                               [Выбор услуги]
                                       ↓
                               [Дата и время]
                                       ↓
                               [Итог записи]
                                       ↓
                               [Успех!]

Нижняя панель: [Каталог] [Мои записи] [Избранное*] [Профиль]

МАСТЕР (другое дерево роутов, тот же бот)
───────────────────────────────────────────────────────
[Дашборд] → [Мои записи] → [Детали записи]
   ↓
[Услуги] → [Редактировать услугу]
   ↓
[Расписание]
   ↓
[Галерея]
   ↓
[Настройки профиля]

Нижняя панель: [Дашборд] [Записи] [Услуги] [Профиль]

* Избранное — v2
```

---

## Экраны: детали

---

### КЛИЕНТСКАЯ ЧАСТЬ

---

#### Экран 1: Splash / Загрузка

**Что видит пользователь:**
- Логотип / название платформы по центру
- Скелетон-анимация (не спиннер)
- Фоновый цвет из `themeParams.bg_color`

**Что происходит:**
- `tg.expand()` — полный экран
- `tg.ready()` — убирает нативный loader Telegram
- Запрос `/api/v1/me` — определение роли (client/master/admin)
- Предзагрузка каталога мастеров

**Переход:** → Каталог мастеров (если роль = client) / Дашборд (если роль = master)

---

#### Экран 2: Каталог мастеров

**Что видит пользователь:**
```
Привет, [Имя]! 👋
Найди своего мастера

[Поиск...]

[Все] [Ногти] [Ресницы] [Брови] [Волосы]  ← горизонтальный скролл чипов

┌─────────────────────────────┐
│ [Фото мастера]  Маша Иванова│
│                 ★ 4.9 (47)  │
│                 Маникюр     │
│                 от 1 200 ₽  │
│                 ✓ Сегодня   │
└─────────────────────────────┘
(карточки 2 в ряд или полная ширина)
```

**Элементы:**
- Персонализированное приветствие (имя из `tg.getUser()`)
- Строка поиска (фильтр по имени/категории)
- Чипы категорий (горизонтальный скролл, отступ 16px от краёв)
- Карточки мастеров: фото, имя, рейтинг (число отзывов), специализация, цена «от», бейдж «Сегодня»
- Скелетон при загрузке
- Индикатор «X слотов на этой неделе» на карточке

**Действия:**
- Тап на карточку → Профиль мастера
- Тап на чип категории → фильтрация списка
- Поиск → фильтрация по имени/специализации

**BackButton:** скрыт (корневой экран)  
**MainButton:** скрыт

---

#### Экран 3: Профиль мастера

**Что видит пользователь:**
```
← [BackButton]

[Большое фото мастера — 100% ширина, 200px высота]

Маша Иванова
★ 4.9 · 47 отзывов · Москва
«Специализируюсь на миндальной форме и...»

[Фото1] [Фото2] [Фото3] [Фото4] [→]   ← галерея работ

УСЛУГИ
┌────────────────────────────────┐
│ Маникюр классический  1 200 ₽  │
│                       60 мин   │
└────────────────────────────────┘
┌────────────────────────────────┐
│ Маникюр + покрытие   1 800 ₽   │
│                       90 мин   │
└────────────────────────────────┘

[=====  ЗАПИСАТЬСЯ  =====]  ← MainButton
```

**Элементы:**
- Hero-фото мастера (cover, без скругления)
- Имя, рейтинг со звёздами, количество отзывов, город
- Bio (2–3 строки, «Показать больше»)
- Горизонтальная галерея работ (фото + тап для увеличения)
- Список услуг: название, цена, длительность
- MainButton «Записаться» (появляется после скролла к услугам)

**Действия:**
- Тап на услугу → выбирается услуга, MainButton становится «Выбрать дату»
- Тап на фото галереи → полноэкранный просмотр
- MainButton → Выбор даты и времени

**Transitions:**
- BackButton → Каталог мастеров
- MainButton → Выбор даты и времени (с выбранной услугой)

---

#### Экран 4: Выбор даты и времени

**Что видит пользователь:**
```
← [BackButton]

Маша Иванова · Маникюр классический · 1 200 ₽

ПН    ВТ    СР    ЧТ    ПТ    СБ    ВС
18    19    20    21    22    23    24

        Четверг, 21 мая

[10:00]  [10:30]  [11:00]  [───]
[12:00]  [12:30]  [13:00]  [───]
[16:00]  [16:30]  [17:00]  [17:30]

[=====  Выберите время  =====]  ← MainButton (disabled)
```

**Элементы:**
- Мини-сводка: мастер + услуга + цена (один блок сверху)
- Недельный скролл дат (горизонтально, 7 дней)
- Чипы слотов времени: зелёные = свободно, серые = занято
- Выбранный слот — подсвечен акцентным цветом
- MainButton: disabled до выбора слота, активен после

**Действия:**
- Тап на дату → загрузка слотов для этого дня
- Тап на слот → выбор, MainButton активируется «Продолжить»
- MainButton → Итог записи

**Haptics:**
- `tg.hapticLight()` при выборе слота

---

#### Экран 5: Итог записи

**Что видит пользователь:**
```
← [BackButton]

ВАША ЗАПИСЬ

[Фото Маши]
Маша Иванова

📋 Маникюр классический
📅 Четверг, 21 мая 2026
⏰ 16:00 — 17:00
💰 1 200 ₽

Политика отмены: бесплатно за 24ч

[=====  Подтвердить запись  =====]
```

**Элементы:**
- Сводка: фото мастера, имя, услуга, дата/время, цена
- Иконки перед каждым пунктом (эмодзи или SF Symbols через CSS)
- Политика отмены (текст, не попап)
- MainButton «Подтвердить запись»

**Что вызывается:**
- `tg.enableClosingConfirmation()` — спрашивает «Уверены?» если пытаются закрыть

**Действия:**
- BackButton → Дата и время (слот не сбрасывается)
- MainButton → POST `/api/v1/bookings` → Экран успеха

---

#### Экран 6: Успешная запись

**Что видит пользователь:**
```
✅  (анимация появления галочки)

Запись подтверждена!

Маша Иванова
Маникюр классический
Четверг, 21 мая · 16:00

[  Добавить в календарь  ]
[  Мои записи            ]
[  Назад в каталог       ]
```

**Элементы:**
- Анимированная иконка успеха (CSS-анимация, не gif)
- Краткие детали записи
- Три кнопки действий (48px высота каждая)

**Что вызывается:**
- `tg.hapticSuccess()` при появлении экрана
- `tg.hideMainButton()` — MainButton скрыт
- `tg.hideBackButton()` — BackButton скрыт

**Действия:**
- «Добавить в календарь» → `tg.openLink(calendarUrl)` или deep link
- «Мои записи» → переключение на вкладку Мои записи
- «Назад в каталог» → возврат на главный экран

---

#### Экран 7: Мои записи

**Что видит пользователь:**
```
Мои записи

[ПРЕДСТОЯЩИЕ]  [ПРОШЛЫЕ]    ← переключатель вкладок

┌─────────────────────────────────┐
│ [Фото]  Маша Иванова            │
│         Маникюр классический    │
│         Чт, 21 мая · 16:00      │
│         ПОДТВЕРЖДЕНА ●          │
│ [Отменить]        [Перенести*]  │
└─────────────────────────────────┘

(пусто в ПРОШЛЫХ: «Пока нет прошлых записей»)
```

**Элементы:**
- Переключатель Предстоящие / Прошлые
- Карточка записи: фото мастера, имя, услуга, дата, статус-бейдж
- Кнопки действий внутри карточки (44px)
- Пустое состояние с иллюстрацией и CTA «Найти мастера»

**Действия:**
- Тап на карточку → детали записи (дополнительный экран, v1 — inline раскрытие)
- «Отменить» → `tg.showConfirm(«Отменить запись у Маши на 21 мая?»)` → POST cancel
- «Перенести» — v2

**BackButton:** скрыт (корневой экран — вкладка)

---

#### Экран 8: Профиль клиента

**Что видит пользователь:**
```
Профиль

[Фото из Telegram]
Алина Петрова
@alinapetro

📊 Записей всего: 4
⭐ Любимый мастер: Маша Иванова

ИСТОРИЯ ВИЗИТОВ
─────────────────
Маша · Маникюр · 1 апр · 1 200 ₽
Маша · Маникюр · 12 мар · 1 200 ₽
```

**Элементы:**
- Фото, имя, username из Telegram (автоматически)
- Статистика (число записей, любимый мастер)
- История визитов (список, 5 последних)

**BackButton:** скрыт

---

### МАСТЕРСКАЯ ЧАСТЬ (личный кабинет)

---

#### Экран 9: Дашборд мастера

**Что видит пользователь:**
```
Добро пожаловать, Маша!

📅 Сегодня, 21 мая
──────────────────
[КЛИЕНТ]      [ВРЕМЯ]   [УСЛУГА]
Алина П.      10:00     Маникюр
Карина М.     12:30     Маникюр+покрытие

📈 Эта неделя: 8 записей · 14 400 ₽

[Ближайшая:]
Алина Петрова — сегодня в 10:00
[Написать клиенту]
```

**Элементы:**
- Приветствие с именем
- Расписание сегодня (мини-таблица)
- Статистика недели (число записей, выручка)
- Ближайшая запись + кнопка написать клиенту

**Нижняя панель мастера:** [Дашборд] [Записи] [Услуги] [Профиль]

---

#### Экран 10: Записи мастера

**Что видит пользователь:**
```
Мои записи

[СЕГОДНЯ]  [ЗАВТРА]  [НЕДЕЛЯ]  ← фильтр

┌──────────────────────────────────┐
│ 10:00   Алина Петрова            │
│         Маникюр классический     │
│         ПОДТВЕРЖДЕНА             │
│ [Принять]  [Не пришла]  [✓]     │
└──────────────────────────────────┘
```

**Действия:**
- «Принять» → CONFIRM booking (если PENDING)
- «Не пришла» → NO_SHOW
- «✓» → COMPLETED (если вручную)

---

#### Экран 11: Управление услугами

**Что видит пользователь:**
```
Мои услуги

[+ Добавить услугу]

┌──────────────────────────────────┐
│ Маникюр классический             │
│ 1 200 ₽ · 60 мин · ✓ Активна    │
│                    [✏️] [🗑️]    │
└──────────────────────────────────┘
```

**Действия:**
- «+ Добавить» → форма новой услуги (название, категория, цена, длительность)
- «✏️» → редактирование услуги
- «🗑️» → `tg.showConfirm(«Удалить услугу?»)` → DELETE

---

#### Экран 12: Расписание мастера

**Что видит пользователь:**
```
Моё расписание

ПН  ВТ  СР  ЧТ  ПТ  СБ  ВС
 ✓   ✓   ✓   ✓   ✓   ✓   —

Понедельник   10:00 — 19:00  [✏️]
Вторник       10:00 — 19:00  [✏️]
Суббота       11:00 — 16:00  [✏️]
Воскресенье   Выходной

[+ Добавить выходной день]
```

**Действия:**
- «✏️» → редактирование часов конкретного дня
- Тоггл дня вкл/выкл
- «+ Добавить выходной» → выбор даты → override на конкретный день

---

#### Экран 13: Галерея работ

**Что видит пользователь:**
```
Галерея

[+ Добавить фото]

[фото1] [фото2] [фото3]
[фото4] [фото5] [    +]  ← сетка 3 в ряд

Всего: 5 фото
```

**Действия:**
- «+ Добавить фото» → выбор из галереи телефона → загрузка на S3
- Тап на фото → просмотр + кнопка удалить

---

#### Экран 14: Настройки профиля мастера

**Что видит пользователь:**
```
Профиль

[Сменить фото]
[Аватар 80px]

Имя:          [Маша Иванова      ]
Специализация:[Маникюр, педикюр  ]
Город:        [Москва            ]
Bio:          [Специализируюсь...]
Телефон:      [+7 999...         ]

[  Сохранить изменения  ]
```

---

## Чего НЕ будет в v1

| Фича | Причина отложить | Версия |
|---|---|---|
| Оплата (Telegram Payments) | Нужен merchant account, юрлицо | v2 |
| Отзывы и рейтинг | Нет данных без записей, cold start | v2 |
| Избранные мастера | Retention без базы пользователей бесполезен | v2 |
| Перенос записи | Сложный flow (отмена + новая + уведомления) | v2 |
| Поиск по геолокации | `requestLocation()` — отдельное разрешение, страшит | v2 |
| Уведомление «появился слот» | Сложный механизм подписок | v2 |
| Программа лояльности | Нет данных для расчёта | v3 |
| Deeplink на услугу | После наполнения каталога | v2 |
| Поделиться в Stories | Нет контента без записей | v2 |
| Публичная аналитика мастера | LTV, Retention — нужны данные | v2 |
| Онбординг мастера через бот-диалог | Отдельная фаза, через Mini App форму в v1 | — |
| Admin-панель | Ручная модерация через БД в v1 | v2 |
| Каталог дизайнов / Вдохновение | Требует контентного наполнения | v2 |
| Запрос телефона `requestContact()` | В v1 телефон не нужен для записи | v2 |

---

## Шаги разработки

> Каждый шаг = 1 сессия с AI. Одна ответственность. Сначала backend-слой, потом frontend-компонент.  
> Порядок: инфраструктура → домен → use cases → adapters → frontend.

---

### Шаг 1 — Инициализация проекта

**Что создаётся:**
- `docker-compose.yml` — PostgreSQL 16 + Redis 7
- `backend/package.json` + `tsconfig.json` (path aliases: `@/domain/`, `@/use-cases/`, `@/adapters/`, `@/infrastructure/`, `@/shared/`)
- `backend/app.ts` — Fastify instance, регистрация plugins
- `backend/server.ts` — только `app.listen()`
- `backend/src/shared/config/env.ts` — Zod-валидация всех env vars
- `frontend/package.json` + `vite.config.ts` + `tsconfig.json`

**Результат:** `docker-compose up` поднимает БД и Redis. `npm run dev` стартует пустой Fastify.

---

### Шаг 2 — База данных: миграция

**Что создаётся:**
- `backend/src/infrastructure/postgres/pool.ts` — pg Pool singleton
- `backend/src/infrastructure/postgres/migrations/001_initial.sql` — полная DDL из Architecture.md §5

**Что проверить:** `npm run db:migrate` применяет схему без ошибок. `\dt` в psql показывает все таблицы.

---

### Шаг 3 — Domain: ядро без зависимостей

**Что создаётся (6 маленьких файлов, каждый ≤ 60 строк):**
- `domain/booking/booking.entity.ts` — типы Booking, BookingStatus ('PENDING'|'CONFIRMED'|...)
- `domain/booking/booking.events.ts` — BookingDomainEvent union type
- `domain/master/master.entity.ts` — тип Master
- `domain/service/service.entity.ts` — тип Service
- `domain/services/slot-calculator.ts` — `generateAvailableSlots()` чистая функция
- `domain/ports/` — 4 файла: booking.repo.port.ts, master.repo.port.ts, notification.port.ts, event-bus.port.ts

**Результат:** `npm run test` — unit-тесты slot-calculator работают без БД.

---

### Шаг 4 — Auth: Telegram initData + JWT

**Что создаётся:**
- `infrastructure/telegram/telegram-auth.ts` — `verifyInitData(hash, botToken)` HMAC-проверка
- `infrastructure/telegram/bot.ts` — Grammy bot instance
- `adapters/http/auth/auth.schema.ts` — Zod схема initData
- `adapters/http/auth/auth.controller.ts` — POST /api/v1/auth → JWT
- `adapters/http/auth/auth.routes.ts`
- `shared/middleware/authenticate.ts` — JWT → req.user

**Результат:** POST `/api/v1/auth` с валидным initData возвращает JWT. Невалидный → 401.

---

### Шаг 5 — Каталог мастеров: backend

**Что создаётся:**
- `adapters/repositories/postgres-master.repo.ts` — implements `IMasterRepository` (raw SQL)
- `use-cases/get-masters-catalog/get-masters-catalog.use-case.ts` — фильтры: category, city
- `use-cases/get-master-by-id/get-master-by-id.use-case.ts`
- `adapters/http/catalog/catalog.controller.ts`
- `adapters/http/catalog/catalog.routes.ts`

**Endpoints:** `GET /api/v1/catalog/masters`, `GET /api/v1/catalog/masters/:id`

---

### Шаг 6 — Услуги и расписание: backend

**Что создаётся:**
- `adapters/repositories/postgres-service.repo.ts`
- `adapters/repositories/postgres-schedule.repo.ts`
- `use-cases/get-available-slots/get-available-slots.use-case.ts` — вызывает slot-calculator
- `adapters/http/masters/masters.controller.ts` — GET /masters/:id/availability
- `adapters/http/masters/masters.routes.ts`

**Endpoint:** `GET /api/v1/masters/:id/availability?date=2026-05-21`

---

### Шаг 7 — Бронирование: backend (Use Case + Events + Queue)

**Что создаётся:**
- `adapters/repositories/postgres-booking.repo.ts` — implements `IBookingRepository`
- `use-cases/create-booking/create-booking.use-case.ts` — проверка мастера, create + eventBus.publish
- `use-cases/cancel-booking/cancel-booking.use-case.ts`
- `infrastructure/queue/notification.queue.ts` — BullMQ Queue
- `infrastructure/queue/notification.worker.ts` — BullMQ Worker (отправка через Grammy)
- `infrastructure/telegram/notification-adapter.ts` — implements `INotificationPort`
- `infrastructure/event-handlers/notification.event-handler.ts` — подписка на BookingConfirmed
- `adapters/http/bookings/bookings.controller.ts`
- `adapters/http/bookings/bookings.schema.ts`
- `adapters/http/bookings/bookings.routes.ts`

**Endpoints:** `POST /api/v1/bookings`, `POST /api/v1/bookings/:id/cancel`  
**Результат:** запись создаётся, мастер и клиент получают уведомление в Telegram.

---

### Шаг 8 — Frontend: инициализация + Telegram SDK

**Что создаётся:**
- `frontend/src/app/init.ts` — `tg.expand()`, `tg.ready()`
- `frontend/src/shared/lib/telegram.ts` — обёртка tg (единственный файл с @telegram-apps/sdk)
- `frontend/src/shared/api/client.ts` — fetch wrapper, добавляет `X-Telegram-Init-Data` header
- `frontend/src/shared/config/queryClient.ts` — TanStack Query config
- `frontend/src/app/router.tsx` — MemoryRouter + RoleGate (client/master)
- `frontend/src/app/providers/QueryProvider.tsx`
- `frontend/src/app/providers/TelegramProvider.tsx`

**Результат:** Vite app открывается в Telegram, `tg.ready()` вызывается, нет нативного loader.

---

### Шаг 9 — Frontend: Каталог мастеров

**Что создаётся:**
- `frontend/src/entities/master/model/master.types.ts`
- `frontend/src/entities/master/api/mastersApi.ts` — useQuery для каталога
- `frontend/src/entities/master/ui/MasterCard.tsx` — карточка мастера (фото, рейтинг, цена «от»)
- `frontend/src/pages/catalog/ui/CatalogPage.tsx` — приветствие + чипы категорий + список
- `frontend/src/shared/ui/Skeleton/Skeleton.tsx` — универсальный skeleton-блок
- `frontend/src/shared/ui/CategoryChips/CategoryChips.tsx`

**Результат:** главный экран каталога со скелетонами, фильтрацией по категории.

---

### Шаг 10 — Frontend: Профиль мастера + галерея

**Что создаётся:**
- `frontend/src/pages/master-profile/ui/MasterProfilePage.tsx` — hero фото, bio, галерея, услуги
- `frontend/src/entities/service/model/service.types.ts`
- `frontend/src/entities/service/ui/ServiceCard.tsx` — название, цена, длительность
- `frontend/src/shared/ui/PhotoGallery/PhotoGallery.tsx` — горизонтальный скролл с отступом 16px

**BackButton:** `tg.showBackButton()` при монтировании, `tg.hideBackButton()` при unmount.  
**MainButton:** появляется при выборе услуги — «Выбрать время».

---

### Шаг 11 — Frontend: Выбор даты и времени

**Что создаётся:**
- `frontend/src/features/create-booking/model/bookingFlowStore.ts` — Zustand (selectedService, selectedSlot, masterId)
- `frontend/src/features/create-booking/ui/DatePicker.tsx` — горизонтальный скролл 7 дней
- `frontend/src/features/create-booking/ui/TimeSlotGrid.tsx` — чипы слотов
- `frontend/src/pages/booking/ui/BookingDateTimePage.tsx`

**MainButton:** disabled до выбора слота. `tg.hapticLight()` при выборе.

---

### Шаг 12 — Frontend: Итог + Успех

**Что создаётся:**
- `frontend/src/pages/booking-summary/ui/BookingSummaryPage.tsx` — сводка + политика отмены
- `frontend/src/features/create-booking/model/useCreateBooking.ts` — useMutation
- `frontend/src/pages/booking-success/ui/BookingSuccessPage.tsx` — анимация + кнопки

**Что вызывается:**
- `tg.enableClosingConfirmation()` на экране итога
- `tg.hapticSuccess()` при появлении экрана успеха

---

### Шаг 13 — Frontend: Мои записи

**Что создаётся:**
- `frontend/src/entities/booking/model/booking.types.ts`
- `frontend/src/entities/booking/api/bookingsApi.ts`
- `frontend/src/entities/booking/ui/BookingStatusBadge.tsx`
- `frontend/src/features/cancel-booking/model/useCancelBooking.ts` — useMutation + tg.showConfirm
- `frontend/src/pages/my-bookings/ui/MyBookingsPage.tsx` — вкладки Предстоящие/Прошлые
- `frontend/src/shared/ui/EmptyState/EmptyState.tsx`

---

### Шаг 14 — Frontend: Профиль клиента

**Что создаётся:**
- `frontend/src/pages/profile/ui/ProfilePage.tsx` — данные из Telegram + история визитов

**Данные:** `tg.getUser()` для фото и имени. История через `GET /api/v1/bookings?role=client`.

---

### Шаг 15 — Личный кабинет мастера: Дашборд + Записи

**Что создаётся (backend):**
- `use-cases/get-master-dashboard/get-master-dashboard.use-case.ts` — сегодня + неделя
- `use-cases/get-master-bookings/get-master-bookings.use-case.ts`
- `use-cases/confirm-booking/confirm-booking.use-case.ts`
- `use-cases/mark-no-show/mark-no-show.use-case.ts`
- `adapters/http/master-cabinet/master-cabinet.controller.ts`
- `adapters/http/master-cabinet/master-cabinet.routes.ts`

**Что создаётся (frontend):**
- `frontend/src/app/router.tsx` — RoleGate: if master → `<MasterApp />`
- `frontend/src/pages/master/dashboard/ui/MasterDashboardPage.tsx`
- `frontend/src/pages/master/orders/ui/MasterOrdersPage.tsx`

---

### Шаг 16 — Личный кабинет мастера: Услуги

**Что создаётся (backend):**
- `use-cases/manage-service/create-service.use-case.ts`
- `use-cases/manage-service/update-service.use-case.ts`
- `use-cases/manage-service/delete-service.use-case.ts`
- `adapters/http/services/services.controller.ts` + routes + schema

**Что создаётся (frontend):**
- `frontend/src/pages/master/services/ui/MasterServicesPage.tsx`
- Форма добавления/редактирования услуги (inline sheet)

---

### Шаг 17 — Личный кабинет мастера: Расписание

**Что создаётся (backend):**
- `use-cases/manage-schedule/update-schedule.use-case.ts`
- `use-cases/manage-schedule/create-override.use-case.ts`
- `adapters/http/schedules/schedules.controller.ts` + routes

**Что создаётся (frontend):**
- `frontend/src/pages/master/schedule/ui/MasterSchedulePage.tsx`
- `frontend/src/features/master-manage-schedule/ui/WeekScheduleEditor.tsx`

---

### Шаг 18 — Личный кабинет мастера: Галерея + Профиль

**Что создаётся (backend):**
- `infrastructure/storage/s3-adapter.ts` — implements `IFileStoragePort`
- `use-cases/gallery/upload-photo.use-case.ts`
- `use-cases/gallery/delete-photo.use-case.ts`
- `adapters/http/gallery/gallery.controller.ts` + routes

**Что создаётся (frontend):**
- `frontend/src/pages/master/gallery/ui/MasterGalleryPage.tsx`
- `frontend/src/pages/master/profile/ui/MasterProfileSettingsPage.tsx`

---

### Шаг 19 — Polish: скелетоны, ошибки, haptics, тёмная тема

**Что делается:**
- Проверка всех экранов в тёмной теме Telegram
- Добавление `HapticFeedback` на ключевые действия
- Проверка BackButton на каждом экране
- Обработка ошибок сети (toast/inline)
- Оптимизация изображений (WebP, lazy loading)
- `GET /health` + `GET /ready` endpoints

**Результат:** приложение готово к деплою на Vercel + Railway.

---

### Шаг 20 — Деплой

**Что делается:**
- Backend: Railway (или VPS) — Fastify + Grammy бот
- Frontend: Vercel — React Vite app (HTTPS из коробки)
- Env vars в обоих сервисах
- Webhook Grammy → production URL
- Тест полного flow с телефона в Telegram

---

## Сводная таблица шагов

| Шаг | Слой | Что создаётся | Новых файлов |
|---|---|---|---|
| 1 | Infra | docker-compose, package.json, app.ts | ~6 |
| 2 | Infra | pool.ts, 001_initial.sql | 2 |
| 3 | Domain | Entities, Events, Ports, SlotCalculator | ~10 |
| 4 | Auth | HMAC, JWT, middleware | ~6 |
| 5 | Use Cases + Adapters | Каталог мастеров | ~5 |
| 6 | Use Cases + Adapters | Услуги + слоты | ~5 |
| 7 | Use Cases + Infra | Бронирование + очередь + уведомления | ~9 |
| 8 | Frontend | TG SDK, router, providers | ~7 |
| 9 | Frontend | CatalogPage + MasterCard | ~6 |
| 10 | Frontend | MasterProfilePage + галерея | ~5 |
| 11 | Frontend | DateTimePicker + Zustand store | ~5 |
| 12 | Frontend | BookingSummary + Success | ~4 |
| 13 | Frontend | MyBookings + cancel | ~6 |
| 14 | Frontend | ProfilePage клиента | ~2 |
| 15 | Use Cases + Frontend | Мастер: Дашборд + Записи | ~8 |
| 16 | Use Cases + Frontend | Мастер: Услуги | ~6 |
| 17 | Use Cases + Frontend | Мастер: Расписание | ~5 |
| 18 | Use Cases + Frontend | Мастер: Галерея + Профиль | ~6 |
| 19 | Quality | Polish, тёмная тема, haptics | ~3 |
| 20 | Deploy | Vercel + Railway, webhook | ~1 |
| **Итого** | | | **~112 файлов** |

---

## Дизайн-правила (неизменны на всех экранах)

```
Цвета:      CSS vars из themeParams — базовые
            Акцент: Dusty Rose #E8B4B8 / Warm Gold #D4AF37 (поверх темы)
            Тестировать в светлой И тёмной теме обязательно

Кнопки:     MainButton — нативный TG, 100% ширина
            Вторичные кнопки — min-height: 48px, border-radius: 12px
            Иконки внутри кнопок — 20px

Типографика: Нет своих шрифтов — системный шрифт Telegram
             Заголовок экрана: 18px bold
             Основной текст: 15px regular
             Вспомогательный: 13px, opacity 0.6

Отступы:    Горизонтальный padding: 16px (защита от iOS-свайпа)
            Между карточками: 8px gap
            Нижний отступ под Tab Bar: 84px (высота Tab Bar + safe area)

Навигация:  BackButton — только tg.showBackButton(), никаких кастомных ←
            Tab Bar — скрыт на шагах booking flow (5, 6)
            MemoryRouter — никогда не BrowserRouter

Загрузка:   Skeleton вместо spinner везде
            LCP цель: < 2.5 сек

Telegram API: Только через shared/lib/telegram.ts
              window.Telegram.WebApp — запрещён в компонентах
```

---

## Что делать в следующей сессии

**Начать с Шага 1:** создать структуру папок, docker-compose, package.json, app.ts, server.ts, env.ts.

Скажи: _«Начинаем Шаг 1»_ — и я создам все файлы согласно этому плану.
