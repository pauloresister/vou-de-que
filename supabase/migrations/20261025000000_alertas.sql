-- =====================================================================
-- Vou de Quê? | Alertas colaborativos (lotação e ocorrências)
--
-- Segurança: o app usa só a chave pública (anon). Ele pode LER alertas
-- ativos e EXECUTAR três funções validadas. Não pode gravar na tabela
-- diretamente nem ver quem criou cada alerta.
-- =====================================================================

-- Normaliza o nome da linha: "Linha 8700-10" -> "870010".
-- Mesma regra da função lineKey() da Edge Function.
create or replace function public.line_key(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        upper(translate(coalesce(raw, ''),
          'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
          'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),
        '^LINHA\s*', ''),
      '[^A-Z0-9]', '', 'g'),
    '')
$$;

create table if not exists public.alerts (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('lotacao', 'ocorrencia')),
  crowd_level   text check (crowd_level in ('vazio', 'moderado', 'lotado')),
  incident_type text check (incident_type in ('transito_parado', 'acidente', 'atraso_linha')),
  line          text check (char_length(line) between 1 and 40),
  line_key      text generated always as (public.line_key(line)) stored,
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  note          text check (char_length(note) <= 140),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  confirmations integer not null default 0,
  constraint alerta_lotacao check (kind <> 'lotacao' or (crowd_level is not null and line is not null and incident_type is null)),
  constraint alerta_ocorrencia check (kind <> 'ocorrencia' or (incident_type is not null and crowd_level is null)),
  constraint alerta_atraso check (incident_type is distinct from 'atraso_linha' or line is not null)
);

create index if not exists alerts_expires_idx on public.alerts (expires_at);
create index if not exists alerts_line_key_idx on public.alerts (line_key) where line_key is not null;
create index if not exists alerts_geo_idx on public.alerts (lat, lng);

-- Tabelas privadas: autoria e confirmações (só o hash do aparelho, nunca o id original).
create table if not exists public.alert_authors (
  alert_id    uuid primary key references public.alerts (id) on delete cascade,
  device_hash text not null,
  created_at  timestamptz not null default now()
);
create index if not exists alert_authors_device_idx on public.alert_authors (device_hash, created_at);

create table if not exists public.alert_confirmations (
  alert_id    uuid not null references public.alerts (id) on delete cascade,
  device_hash text not null,
  primary key (alert_id, device_hash)
);

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
alter table public.alerts enable row level security;
alter table public.alert_authors enable row level security;
alter table public.alert_confirmations enable row level security;

drop policy if exists "alertas ativos sao publicos" on public.alerts;
create policy "alertas ativos sao publicos" on public.alerts
  for select to anon, authenticated
  using (expires_at > now());

revoke all on public.alerts, public.alert_authors, public.alert_confirmations from anon, authenticated;
grant select on public.alerts to anon, authenticated;

-- ---------------------------------------------------------------------
-- Criar alerta (validação, antirrepetição e limite por hora)
-- ---------------------------------------------------------------------
create or replace function public.create_alert(
  p_kind text,
  p_lat double precision,
  p_lng double precision,
  p_device_id text,
  p_crowd_level text default null,
  p_incident_type text default null,
  p_line text default null,
  p_note text default null
)
returns public.alerts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device text;
  v_line text := nullif(trim(coalesce(p_line, '')), '');
  v_key text;
  v_row public.alerts;
begin
  if p_device_id is null or char_length(p_device_id) not between 8 and 64 then
    raise exception 'Aparelho não identificado.' using errcode = 'P0001';
  end if;
  if p_kind is null or p_kind not in ('lotacao', 'ocorrencia') then
    raise exception 'Tipo de alerta inválido.' using errcode = 'P0001';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Localização inválida.' using errcode = 'P0001';
  end if;
  if p_kind = 'lotacao' and (p_crowd_level is null or p_crowd_level not in ('vazio', 'moderado', 'lotado')) then
    raise exception 'Informe o nível de lotação.' using errcode = 'P0001';
  end if;
  if p_kind = 'lotacao' and v_line is null then
    raise exception 'Informe a linha do ônibus ou trem.' using errcode = 'P0001';
  end if;
  if p_kind = 'ocorrencia' and (p_incident_type is null or p_incident_type not in ('transito_parado', 'acidente', 'atraso_linha')) then
    raise exception 'Informe o tipo de ocorrência.' using errcode = 'P0001';
  end if;
  if p_kind = 'ocorrencia' and p_incident_type = 'atraso_linha' and v_line is null then
    raise exception 'Informe qual linha está atrasada.' using errcode = 'P0001';
  end if;
  if char_length(v_line) > 40 then
    raise exception 'O nome da linha deve ter até 40 caracteres.' using errcode = 'P0001';
  end if;
  if char_length(p_note) > 140 then
    raise exception 'O comentário deve ter até 140 caracteres.' using errcode = 'P0001';
  end if;

  -- Ocorrência de via (trânsito parado, acidente) não leva linha.
  if p_kind = 'ocorrencia' and p_incident_type <> 'atraso_linha' then
    v_line := null;
  end if;
  v_key := public.line_key(v_line);
  v_device := md5(p_device_id);

  if exists (
    select 1
    from public.alert_authors au
    join public.alerts a on a.id = au.alert_id
    where au.device_hash = v_device
      and a.kind = p_kind
      and coalesce(a.line_key, '') = coalesce(v_key, '')
      and a.created_at > now() - interval '5 minutes'
  ) then
    raise exception 'Você já enviou um alerta parecido há poucos minutos. Obrigado!' using errcode = 'P0001';
  end if;

  if (select count(*) from public.alert_authors
      where device_hash = v_device and created_at > now() - interval '1 hour') >= 12 then
    raise exception 'Limite de alertas por hora atingido. Tente mais tarde.' using errcode = 'P0001';
  end if;

  insert into public.alerts (kind, crowd_level, incident_type, line, lat, lng, note, expires_at)
  values (
    p_kind,
    case when p_kind = 'lotacao' then p_crowd_level end,
    case when p_kind = 'ocorrencia' then p_incident_type end,
    v_line,
    p_lat,
    p_lng,
    nullif(trim(coalesce(p_note, '')), ''),
    now() + case when p_kind = 'lotacao' then interval '30 minutes' else interval '60 minutes' end
  )
  returning * into v_row;

  insert into public.alert_authors (alert_id, device_hash) values (v_row.id, v_device);
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- "Ainda está assim": um voto por aparelho, prolonga a validade em 10 min
-- ---------------------------------------------------------------------
create or replace function public.confirm_alert(p_alert_id uuid, p_device_id text)
returns public.alerts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.alerts;
  v_device text;
  v_max timestamptz;
begin
  if p_device_id is null or char_length(p_device_id) not between 8 and 64 then
    raise exception 'Aparelho não identificado.' using errcode = 'P0001';
  end if;
  v_device := md5(p_device_id);

  select * into v_row from public.alerts where id = p_alert_id and expires_at > now() for update;
  if not found then
    raise exception 'Este alerta já expirou.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.alert_authors where alert_id = p_alert_id and device_hash = v_device) then
    raise exception 'Você criou este alerta.' using errcode = 'P0001';
  end if;

  begin
    insert into public.alert_confirmations (alert_id, device_hash) values (p_alert_id, v_device);
  exception when unique_violation then
    raise exception 'Você já confirmou este alerta.' using errcode = 'P0001';
  end;

  v_max := now() + case when v_row.kind = 'lotacao' then interval '30 minutes' else interval '60 minutes' end;
  update public.alerts
     set confirmations = confirmations + 1,
         expires_at = least(v_max, expires_at + interval '10 minutes')
   where id = p_alert_id
  returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- Alertas ativos num raio (km), do mais recente para o mais antigo
-- ---------------------------------------------------------------------
create or replace function public.alerts_near(p_lat double precision, p_lng double precision, p_radius_km double precision default 10)
returns setof public.alerts
language sql
stable
set search_path = ''
as $$
  with r as (select least(greatest(coalesce(p_radius_km, 10), 0.5), 50) as km)
  select a.*
  from public.alerts a, r
  where a.expires_at > now()
    and a.lat between p_lat - r.km / 111.0 and p_lat + r.km / 111.0
    and a.lng between p_lng - r.km / (111.0 * greatest(0.1, cos(radians(p_lat))))
                  and p_lng + r.km / (111.0 * greatest(0.1, cos(radians(p_lat))))
    and 2 * 6371 * asin(least(1, sqrt(
          power(sin(radians(a.lat - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(a.lat)) * power(sin(radians(a.lng - p_lng) / 2), 2)
        ))) <= r.km
  order by a.created_at desc
  limit 200
$$;

revoke all on function public.create_alert(text, double precision, double precision, text, text, text, text, text) from public;
revoke all on function public.confirm_alert(uuid, text) from public;
revoke all on function public.alerts_near(double precision, double precision, double precision) from public;
grant execute on function public.create_alert(text, double precision, double precision, text, text, text, text, text) to anon, authenticated;
grant execute on function public.confirm_alert(uuid, text) to anon, authenticated;
grant execute on function public.alerts_near(double precision, double precision, double precision) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Tempo real: o app recebe inserções, confirmações e remoções na hora
-- ---------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.alerts;
exception
  when duplicate_object then null;
  when undefined_object then raise notice 'Publicação supabase_realtime não existe (fora do Supabase).';
end $$;

-- ---------------------------------------------------------------------
-- Limpeza automática a cada 10 minutos (pg_cron, incluso no plano gratuito).
-- Se não estiver disponível, nada quebra: alertas vencidos já ficam invisíveis.
-- ---------------------------------------------------------------------
create or replace function public.purge_expired_alerts()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.alerts where expires_at < now() - interval '10 minutes' returning 1
  )
  select count(*)::integer from gone
$$;
revoke all on function public.purge_expired_alerts() from public;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('vou-de-que-limpeza', '*/10 * * * *', 'select public.purge_expired_alerts()');
exception
  when others then raise notice 'pg_cron indisponível (%). Limpeza automática desativada.', sqlerrm;
end $$;
