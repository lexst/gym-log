# Дневник тренировок

Личный дневник тренировок в зале: программа по дням, запись подходов с подсказками
по весу (двойная прогрессия), разминочный подход, история, графики и личные рекорды.
Работает на телефоне как приложение (PWA), без интернета; синхронизация через Supabase.

## Разработка

```sh
npm install
npm run dev      # локальный сервер
npm test         # тесты логики
npm run build    # сборка в dist/
```

Адрес и публичный ключ Supabase прописаны в `src/config.js`. Чтобы подключить другой проект, создайте `.env.local`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

## Supabase

1. Создать проект на supabase.com.
2. SQL Editor → выполнить `supabase/schema.sql`.
3. Authentication → URL Configuration: Site URL = `https://lexst.github.io/gym-log/`.

## Публикация

GitHub Actions (`.github/workflows/pages.yml`) собирает и выкладывает приложение на
GitHub Pages при каждом пуше в `main`. В Settings → Pages выбрать Source: GitHub Actions.
