alter table public.tenants
  add column if not exists address_street text;

alter table public.tenants
  add column if not exists address_number text;

alter table public.tenants
  add column if not exists address_neighborhood text;

alter table public.tenants
  add column if not exists address_zip_code text;

update public.tenants
set address_street = address
where coalesce(trim(address_street), '') = ''
  and coalesce(trim(address), '') <> '';
