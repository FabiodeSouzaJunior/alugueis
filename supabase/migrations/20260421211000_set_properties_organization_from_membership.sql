create or replace function public.set_properties_organization_id_from_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
begin
  if new.organization_id is not null then
    return new;
  end if;

  select m.organization_id
    into v_organization_id
  from public.memberships m
  where m.user_id = auth.uid()
  order by m.created_at asc
  limit 1;

  if v_organization_id is null then
    raise exception 'Nao foi possivel definir organization_id do imovel para o usuario autenticado.';
  end if;

  new.organization_id := v_organization_id;
  return new;
end;
$$;

drop trigger if exists trg_properties_set_organization_id_from_membership on public.properties;

create trigger trg_properties_set_organization_id_from_membership
before insert on public.properties
for each row
execute function public.set_properties_organization_id_from_membership();
