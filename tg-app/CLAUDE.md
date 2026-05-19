# tg-app — BeautyBook Telegram Mini App

Vanilla HTML/CSS/JS — без фреймворков.  
Точка входа: `index.html`. Открывается как Telegram Mini App.

## Файлы

| Файл | Назначение |
|---|---|
| `index.html` | HTML-каркас: подключает SDK, стили, скрипты в правильном порядке |
| `styles.css` | Все стили: переменные, темы, компоненты, анимации переходов |
| `data.js` | Данные: CATEGORIES, MASTERS, MY_BOOKINGS, MASTER_DASHBOARD + хелперы |
| `screens-client.js` | Рендер клиентских экранов: каталог, мастер, бронирование, профиль |
| `screens-master.js` | Рендер кабинета мастера: дашборд, записи, услуги, расписание |
| `events.js` | Привязка событий к DOM после каждого рендера экрана |
| `app.js` | Состояние `state`, роутер, TG SDK инициализация, таб-бар, тосты |

## Навигация

```
Каталог → [клик карточки] → Профиль мастера → [Записаться] → Дата/Время
               ↑                                                    ↓
           goBack()          [goBack]          Подтверждение → Успех
                                                               ↓
                                                     (Мои записи / Каталог)
```

Вкладки клиента: Каталог / Записи / Профиль  
Вкладки мастера: Главная / Записи / Услуги / Профиль

Экраны **без** таб-бара: `splash`, `date-time`, `booking-summary`, `booking-success`

## Как добавить экран

1. `renderXxx()` → в `screens-client.js` или `screens-master.js`
2. В `app.js` добавить `case 'xxx': return renderXxx();` в `renderScreen()`
3. В `events.js` добавить `function bindXxxEvents()` и вызов в `bindScreenEvents()`
4. Если нужна вкладка — добавить объект в `CLIENT_TABS` или `MASTER_TABS` в `app.js`

## Как изменить данные

- Мастера: `data.js` → `MASTERS[]`
- Категории: `data.js` → `CATEGORIES[]`
- Демо-записи клиента: `data.js` → `MY_BOOKINGS[]`
- Статистика мастера: `data.js` → `MASTER_DASHBOARD`

## TG SDK

Глобальная переменная `tg` в `app.js`.  
При отсутствии SDK (браузер) — мок с демо-пользователем `Алина Петрова`.

## Стили

CSS-переменные (`:root` / `[data-theme="dark"]`):
- `--accent` — основной синий (#2AABEE)
- `--bg`, `--bg2`, `--card` — фоны
- `--text`, `--hint` — цвета текста

Тёмная тема устанавливается автоматически из `tg.colorScheme` при инициализации.

## Переход к реальному бэкенду

В `data.js` — заменить хелперы `getMastersByCategory`, `getMasterById` и т.д.  
на `fetch`-вызовы к API. Состояние бронирования останется в `state` (app.js),  
хелперы форматирования (`formatDate`, `formatPrice`) переиспользуются без изменений.
