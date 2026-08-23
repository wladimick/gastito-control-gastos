-- Mejora la categorización automática de gastos para movimientos identificables.
-- Las categorías personales (p. ej. Entretenimiento / Salidas) se usan solo si
-- existen para el usuario; de lo contrario la función conserva el fallback a Otros.

create or replace function public.infer_expense_category_id(
  p_user_id uuid,
  p_description text
)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_text text := upper(coalesce(p_description, ''));
  v_label text;
  v_category_id uuid;
begin
  v_label := case
    when v_text ~ '(COMISION ADMINISTRACION|SERVICIO ADMINISTRACION|TRASPASO DEUDA INTERNACIONAL|TRANSPASO INTERNACIONAL|TRASPASO INTERNACIONAL|INTERESES ROTATIVOS|INTERES DE MORA|SEG CESANTIA|SEG DESGRAVAMEN|DESGRAVAMEN|IMPUESTO DECRETO LEY|IMPUESTO COMPRA)' then 'Costos financieros'
    when v_text ~ '(CINEPLANET|ENTRADAS CINE|CORP CULTURAL|CINE )' then 'Entretenimiento / Salidas'
    when v_text ~ '(URBAN CUT|BARBER|PELUQUER)' then 'Cuidado personal'
    when v_text ~ '(SHELL|COPEC|PETROBRAS|ARAMCO|BENCINA|COMBUSTIBLE)' then 'Bencina'
    when v_text ~ '(LIDER|ALVI|UNIMARC|TOTTUS|JUMBO|SANTA ISABEL|ACUENTA|SUPERMERC|MAYORISTA|EL 9|CARNICERIA)' then 'Supermercado'
    when v_text ~ '(PANADERI)' then 'Panadería'
    when v_text ~ '(CGE|ENEL|CHILQUINTA|LUZ)' then 'Luz'
    when v_text ~ '(NUEVO SUR|AGUAS|ESSBIO|ESVAL|AGUA)' then 'Agua'
    when v_text ~ '(TELSUR|INTERNET|VTR|MUNDO PACIFICO|GTD)' then 'Internet'
    when v_text ~ '(GASCO|ABASTIBLE|LIPIGAS|METROGAS|GAS )' then 'Gas'
    when v_text ~ '(VETERIN|VET TODOS|MASCOT|PETSHOP|PET SHOP)' then 'Mascota'
    when v_text ~ '(CENTRO DE DEPORTE|GIMNAS|GYM|DEPORTE|CINART)' then 'Deporte'
    when v_text ~ '(CLOUDWAYS|DONWEB|HOSTING|DOMINIO|DOMAIN|SOFTWARE|OPENAI|CLAUDE|MICROSOFT|GOOGLE CLOUD)' then 'Tecnología'
    when v_text ~ '(FARMAC|CRUZ VERDE|SALCOBRAND|AHUMADA|CLINICA|CLÍNICA|MEDIC|DENTAL)' then 'Salud'
    when v_text ~ '(EL OTTO|MAMUT|RESTAUR|CAFE|CAFÉ|PIZZA|SUSHI|BURGER|MCDONALD|COMIDA|PEDIDOSYA|UBER EATS)' then 'Comida'
    when v_text ~ '(ADIDAS|NIKE|ZAPAT|ROPA|VESTUARIO)' then 'Ropa'
    when v_text ~ '(SODIMAC|HOMECENTER|EASY|FERRETER|MUEBLE)' then 'Hogar'
    when v_text ~ '(NETFLIX|SPOTIFY|DISNEY|YOUTUBE|PRIME VIDEO|HBO|MAX )' then 'Suscripciones'
    when v_text ~ '(UBER|CABIFY|METRO|TRANSANTIAGO|TRANSPORTE PUBLICO|TRANSPORTE PÚBLICO)' then 'Transporte'
    when v_text ~ '(ARRIENDO|ARRENDAMIENTO)' then 'Arriendo'
    when v_text ~ '(NEUMA|AUTOMOTRIZ|TALLER|REPUESTO)' then 'Vehículo'
    else 'Otros'
  end;

  select category.id
    into v_category_id
    from public.categories as category
   where category.label = v_label
     and (category.user_id = p_user_id or category.user_id is null)
   order by case when category.user_id = p_user_id then 0 else 1 end,
            category.sort_order,
            category.created_at
   limit 1;

  if v_category_id is null then
    select category.id
      into v_category_id
      from public.categories as category
     where category.label = 'Otros'
       and (category.user_id = p_user_id or category.user_id is null)
     order by case when category.user_id = p_user_id then 0 else 1 end,
              category.sort_order,
              category.created_at
     limit 1;
  end if;

  return v_category_id;
end;
$$;
