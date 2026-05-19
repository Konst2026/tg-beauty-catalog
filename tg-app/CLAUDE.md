# tg-app — BeautyBook Telegram Mini App

Vanilla HTML/CSS/JS SPA без фреймворков.  
Точка входа: `index.html`.

## Структура

```
tg-app/
├── src/
│   ├── api/
│   │   └── data.js              # Данные, mock API, форматирование
│   ├── screens/
│   │   ├── client/
│   │   │   ├── client.js        # Рендер клиентских экранов
│   │   │   └── client.css       # Стили клиентских экранов
│   │   └── master/
│   │       ├── master.js        # Рендер кабинета мастера
│   │       └── master.css       # Стили кабинета мастера
│   ├── utils/
│   │   └── events.js            # Привязка событий к DOM
│   └── app.js                   # Состояние, роутер, TG SDK, init
├── styles.css                   # Глобальные стили (переменные, layout, кнопки)
├── index.html                   # Точка входа
└── CLAUDE.md
```

## Слои

| Слой | Файл | Ответственность |
|---|---|---|
| API / Данные | `src/api/data.js` | Константы, mock-данные, геттеры, форматирование |
| Представление | `src/screens/client/client.js` | HTML-строки клиентских экранов |
| Представление | `src/screens/master/master.js` | HTML-строки кабинета мастера |
| Обработка событий | `src/utils/events.js` | DOM-события после каждого рендера |
| Ядро | `src/app.js` | Состояние `state`, роутер, TG SDK, init |

## Навигация

```
Каталог → Профиль мастера → Дата/Время → Подтверждение → Успех
               ↑ goBack()                   ↑ goBack()
```

Таб-бар: **клиент** — Каталог / Записи / Профиль  
Таб-бар: **мастер** — Главная / Записи / Услуги / Профиль

Экраны без таб-бара: `splash`, `date-time`, `booking-summary`, `booking-success`

## Добавить новый экран

1. `renderXxx()` → в `src/screens/client/client.js` или `src/screens/master/master.js`
2. Стили → в co-located `client.css` или `master.css`
3. `case 'xxx': return renderXxx();` → в `renderScreen()` в `src/app.js`
4. `bindXxxEvents()` → в `src/utils/events.js`, добавить вызов в `bindScreenEvents()`
5. Если нужна вкладка → добавить в `CLIENT_TABS` или `MASTER_TABS` в `src/app.js`

## Изменить данные

- Мастера: `src/api/data.js` → `MASTERS[]`
- Категории: `src/api/data.js` → `CATEGORIES[]`
- Демо-записи: `src/api/data.js` → `MY_BOOKINGS[]`
- Расписание/статистика: `src/api/data.js` → `MASTER_DASHBOARD`

## Переход на реальный backend

Заменить функции `getMastersByCategory`, `getMasterById`, `getServiceById` в `src/api/data.js`  
на `fetch`-вызовы к API. Роутер (`src/app.js`) и события (`src/utils/events.js`) остаются без изменений.

## TG SDK

Глобальная переменная `tg` в `src/app.js`.  
При запуске в браузере — автоматически подключается мок с тест-пользователем.
