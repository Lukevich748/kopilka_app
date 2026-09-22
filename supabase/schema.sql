-- Схема для Копилки. Выполнить один раз в Supabase SQL Editor
-- (Project → SQL Editor → New query → вставить и Run).

create extension if not exists pgcrypto;

-- Настройки — единственная строка с id = 1.
create table if not exists settings (
  id smallint primary key default 1,
  base_currency text not null default 'USD',
  enabled_currencies text[] not null default array['USD', 'EUR', 'PLN', 'RUB', 'BYN'],
  constraint settings_singleton check (id = 1)
);

insert into settings (id, base_currency, enabled_currencies)
values (1, 'USD', array['USD', 'EUR', 'PLN', 'RUB', 'BYN'])
on conflict (id) do nothing;

-- История пополнений/снятий.
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null,
  type text not null check (type in ('deposit', 'withdrawal')),
  date date not null,
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists transactions_date_idx on transactions (date desc, created_at desc);

-- Аккаунт для входа в приложение. Регистрация через форму в приложении
-- разрешена только пока эта таблица пуста — одного аккаунта достаточно.
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- Сессии входа: кука хранит только token, сама сессия и её срок годности —
-- здесь. Без этого на serverless (Vercel) пришлось бы держать секрет для
-- подписи куки отдельной переменной окружения.
create table if not exists sessions (
  token text primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists sessions_expires_at_idx on sessions (expires_at);

-- Row Level Security: сервер обращается к базе через service-role ключ,
-- который обходит RLS, поэтому таблицы можно оставить закрытыми для
-- анонимного/публичного доступа (anon-ключ в приложении не используется).
alter table settings enable row level security;
alter table transactions enable row level security;
alter table users enable row level security;
alter table sessions enable row level security;
