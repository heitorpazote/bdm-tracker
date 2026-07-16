-- Dor 1: conciliação recebido vs projetado.
-- Rodar no SQL Editor do dashboard Supabase (ou via CLI: npx supabase db push).
alter table public.events
  add column if not exists received boolean not null default false;
