-- =====================================================================
-- 0009 — Una sola caja: ingresos y egresos
--
-- Hasta ahora la plata vivía en dos tablas sueltas (cobros y pagos) que
-- no sabían de cuentas ni de con quién fue la operación. El histórico de
-- la planilla necesita las dos cosas.
--
-- A partir de acá hay una sola tabla, movimientos, donde cae todo: lo
-- que se importa del Excel y lo que se carga desde Pedidos o desde la
-- pantalla de caja. Cada movimiento sabe de qué cuenta salió o entró,
-- con quién fue, en qué categoría cae y, si corresponde, contra qué
-- venta se imputa.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cuentas: de dónde sale y entra la plata
-- ---------------------------------------------------------------------
create table if not exists cuentas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  tipo text not null default 'otro'
    check (tipo in ('efectivo', 'banco', 'billetera', 'socio', 'usd', 'otro')),
  moneda text not null default 'ARS' check (moneda in ('ARS', 'USD')),
  activa boolean not null default true,
  orden int not null default 100,
  notas text,
  created_at timestamptz not null default now()
);

insert into cuentas (nombre, tipo, moneda, orden) values
  ('Efectivo',      'efectivo',  'ARS', 10),
  ('Banco del Sol', 'banco',     'ARS', 20),
  ('Galicia MC',    'banco',     'ARS', 30),
  ('Banco PC',      'banco',     'ARS', 40),
  ('Banco CM',      'banco',     'ARS', 50),
  ('M.Pago',        'billetera', 'ARS', 60),
  ('MC',            'socio',     'ARS', 70),
  ('VC',            'socio',     'ARS', 80),
  ('USD',           'usd',       'USD', 90)
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------------
-- 2. Persona o empresa: con quién fue la operación
--
-- Es la lista cerrada de gente y empresas con las que operás. El detalle
-- libre de cada movimiento va aparte, en su propio campo.
-- ---------------------------------------------------------------------
create table if not exists personas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  tipo text not null default 'otro'
    check (tipo in ('proveedor', 'comprador', 'empleado', 'socio', 'otro')),
  cliente_id uuid references clientes(id) on delete set null,
  telefono text,
  notas text,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists personas_nombre_idx on personas (lower(nombre));

-- ---------------------------------------------------------------------
-- 3. Categorías: las tuyas, con sus subcategorías colgando
-- ---------------------------------------------------------------------
create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  padre_id uuid references categorias(id) on delete cascade,
  tipo_mov text not null default 'E' check (tipo_mov in ('I', 'E', 'ambos')),
  orden int not null default 100,
  activa boolean not null default true,
  unique (nombre, padre_id)
);
create index if not exists categorias_padre_idx on categorias (padre_id);

-- ---------------------------------------------------------------------
-- 4. Movimientos: el libro de caja
-- ---------------------------------------------------------------------
create table if not exists movimientos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  tipo text not null check (tipo in ('I', 'E')),
  cuenta_id uuid references cuentas(id) on delete restrict,
  categoria_id uuid references categorias(id) on delete set null,
  persona_id uuid references personas(id) on delete set null,
  detalle text,
  monto numeric(16,2) not null,
  moneda text not null default 'ARS' check (moneda in ('ARS', 'USD')),
  cotizacion numeric(12,2),
  monto_usd numeric(16,2),
  lote_id uuid references lotes(id) on delete set null,
  venta_id uuid references ventas(id) on delete set null,
  cliente_id uuid references clientes(id) on delete set null,
  origen text not null default 'manual'
    check (origen in ('manual', 'importado', 'venta', 'pedido')),
  notas text,
  created_by uuid references perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists movimientos_fecha_idx on movimientos (fecha desc);
create index if not exists movimientos_cuenta_idx on movimientos (cuenta_id, fecha desc);
create index if not exists movimientos_venta_idx on movimientos (venta_id);
create index if not exists movimientos_cliente_idx on movimientos (cliente_id);
create index if not exists movimientos_categoria_idx on movimientos (categoria_id);

-- ---------------------------------------------------------------------
-- 5. Pasar lo que había en cobros y pagos
-- ---------------------------------------------------------------------
insert into movimientos (fecha, tipo, detalle, monto, venta_id, cliente_id, origen, created_by, created_at)
select fecha, 'I', notas, monto, venta_id, cliente_id, 'venta', created_by, created_at
from cobros;

insert into movimientos (fecha, tipo, detalle, monto, lote_id, venta_id, origen, created_by, created_at)
select fecha, 'E', coalesce(proveedor, '') || case when notas is null then '' else ' — ' || notas end,
       monto, lote_id, venta_id, 'manual', created_by, created_at
from pagos;

-- ---------------------------------------------------------------------
-- 6. Las vistas pasan a leer de movimientos
-- ---------------------------------------------------------------------
drop view if exists v_cuenta_clientes;
drop view if exists v_pedidos_pendientes;
drop view if exists v_margen_ventas;

drop table if exists cobros;
drop table if exists pagos;

create view v_cuenta_clientes as
select
  c.id as cliente_id,
  c.nombre,
  coalesce(v.total_vendido, 0) as total_vendido,
  coalesce(v.m2_vendidos, 0) as m2_vendidos,
  coalesce(co.total_cobrado, 0) as total_cobrado,
  coalesce(v.total_vendido, 0) - coalesce(co.total_cobrado, 0) as saldo,
  v.ultima_venta
from clientes c
left join (
  select cliente_id, sum(total) as total_vendido, sum(m2) as m2_vendidos, max(fecha) as ultima_venta
  from ventas where estado in ('confirmada', 'entregada') group by cliente_id
) v on v.cliente_id = c.id
left join (
  select cliente_id, sum(monto) as total_cobrado
  from movimientos where tipo = 'I' and cliente_id is not null group by cliente_id
) co on co.cliente_id = c.id;

create view v_pedidos_pendientes as
select
  v.id, v.fecha, v.fecha_entrega, v.m2, v.m2_pedido, v.precio_m2, v.flete, v.total,
  v.notas, v.canal, v.cliente_id,
  comp.nombre as comprador,
  v.vinculante_id, vinc.nombre as vinculante, v.cliente_final,
  v.lote_id, l.nombre as lote,
  cd.precipitacion_mm, cd.prob_precipitacion, cd.temp_max, cd.temp_min,
  coalesce(se.senado, 0) as senado
from ventas v
join clientes comp on comp.id = v.cliente_id
left join clientes vinc on vinc.id = v.vinculante_id
left join lotes l on l.id = v.lote_id
left join clima_dias cd on cd.fecha = v.fecha_entrega
left join (
  select venta_id, sum(monto) as senado
  from movimientos where tipo = 'I' and venta_id is not null group by venta_id
) se on se.venta_id = v.id
where v.estado = 'pedido';

create view v_margen_ventas as
select
  v.id as venta_id, v.fecha, v.fecha_entrega, v.estado, v.canal, v.cliente_id,
  comp.nombre as comprador, vinc.nombre as vinculante, v.cliente_final, l.nombre as lote,
  v.m2, v.m2_cortesia, v.m2_entregados, v.precio_m2, v.flete,
  v.total as facturado,
  coalesce(g.gastos, 0) as gastos,
  v.total - coalesce(g.gastos, 0) as margen,
  coalesce(co.cobrado, 0) as cobrado,
  v.total - coalesce(co.cobrado, 0) as pendiente
from ventas v
join clientes comp on comp.id = v.cliente_id
left join clientes vinc on vinc.id = v.vinculante_id
left join lotes l on l.id = v.lote_id
left join (
  select venta_id, sum(monto) as gastos
  from movimientos where tipo = 'E' and venta_id is not null group by venta_id
) g on g.venta_id = v.id
left join (
  select venta_id, sum(monto) as cobrado
  from movimientos where tipo = 'I' and venta_id is not null group by venta_id
) co on co.venta_id = v.id
where v.estado in ('confirmada', 'entregada');

-- ---------------------------------------------------------------------
-- 7. Saldo de cada cuenta y resumen por categoría
-- ---------------------------------------------------------------------
create or replace view v_saldos_cuentas as
select
  c.id as cuenta_id,
  c.nombre,
  c.tipo,
  c.moneda,
  c.activa,
  c.orden,
  coalesce(sum(case when m.tipo = 'I' then m.monto else -m.monto end), 0) as saldo,
  count(m.id) as movimientos,
  max(m.fecha) as ultimo_movimiento
from cuentas c
left join movimientos m on m.cuenta_id = c.id
group by c.id, c.nombre, c.tipo, c.moneda, c.activa, c.orden;

create or replace view v_movimientos as
select
  m.id, m.fecha, m.tipo, m.monto, m.moneda, m.cotizacion, m.monto_usd,
  m.detalle, m.origen, m.notas, m.created_at,
  m.cuenta_id, cu.nombre as cuenta,
  m.categoria_id,
  coalesce(pad.nombre, cat.nombre) as categoria,
  case when pad.nombre is null then null else cat.nombre end as subcategoria,
  m.persona_id, p.nombre as persona, p.tipo as persona_tipo,
  m.lote_id, l.nombre as lote,
  m.venta_id, m.cliente_id, cl.nombre as cliente
from movimientos m
left join cuentas cu on cu.id = m.cuenta_id
left join categorias cat on cat.id = m.categoria_id
left join categorias pad on pad.id = cat.padre_id
left join personas p on p.id = m.persona_id
left join lotes l on l.id = m.lote_id
left join clientes cl on cl.id = m.cliente_id;

-- ---------------------------------------------------------------------
-- 8. Mismas reglas de acceso que el resto
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['cuentas', 'personas', 'categorias', 'movimientos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists miembros_all on %I', t);
    execute format(
      'create policy miembros_all on %I for all to authenticated using (public.es_miembro()) with check (public.es_miembro())',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 9. Tu catálogo de categorías, tal cual está en la planilla
-- ---------------------------------------------------------------------
insert into categorias (nombre, padre_id, tipo_mov, orden) values
  ('Cosecha', null, 'E', 10),
  ('Mantenimiento', null, 'E', 20),
  ('Ventas', null, 'ambos', 30),
  ('Cobros', null, 'E', 40),
  ('Plantación', null, 'E', 50),
  ('Preparación terreno', null, 'E', 60),
  ('Insumos', null, 'E', 70),
  ('Riego', null, 'E', 80),
  ('Maquinas y Herramientas', null, 'E', 90),
  ('Compra USD', null, 'E', 100),
  ('Venta USD', null, 'I', 110),
  ('Aportes', null, 'E', 120),
  ('Impuestos', null, 'E', 130)
on conflict (nombre, padre_id) do nothing;

insert into categorias (nombre, padre_id, tipo_mov, orden)
select v.nombre, (select id from categorias where nombre = 'Cosecha' and padre_id is null), 'E', v.orden
from (values
  ('Mano de obra', 10),
  ('Combustible', 20),
  ('Pallets', 30),
  ('Flete', 40)
) as v(nombre, orden)
on conflict (nombre, padre_id) do nothing;

insert into categorias (nombre, padre_id, tipo_mov, orden)
select v.nombre, (select id from categorias where nombre = 'Mantenimiento' and padre_id is null), 'E', v.orden
from (values
  ('Mano de obra', 10),
  ('Electricidad', 20),
  ('Nafta', 30),
  ('Reparaciones', 40),
  ('Tractor', 50),
  ('Tigre', 60),
  ('Seguros', 70),
  ('Combustible', 80),
  ('Gasoil', 90),
  ('Herrero', 100),
  ('Riego', 110)
) as v(nombre, orden)
on conflict (nombre, padre_id) do nothing;

insert into categorias (nombre, padre_id, tipo_mov, orden)
select v.nombre, (select id from categorias where nombre = 'Ventas' and padre_id is null), 'ambos', v.orden
from (values
  ('Distribuidores', 10),
  ('Particulares', 20),
  ('Dividendos', 30)
) as v(nombre, orden)
on conflict (nombre, padre_id) do nothing;

insert into categorias (nombre, padre_id, tipo_mov, orden)
select v.nombre, (select id from categorias where nombre = 'Cobros' and padre_id is null), 'E', v.orden
from (values
  ('Dividendos', 10)
) as v(nombre, orden)
on conflict (nombre, padre_id) do nothing;

insert into categorias (nombre, padre_id, tipo_mov, orden)
select v.nombre, (select id from categorias where nombre = 'Plantación' and padre_id is null), 'E', v.orden
from (values
  ('Mano de obra', 10),
  ('Cesped', 20)
) as v(nombre, orden)
on conflict (nombre, padre_id) do nothing;

insert into categorias (nombre, padre_id, tipo_mov, orden)
select v.nombre, (select id from categorias where nombre = 'Preparación terreno' and padre_id is null), 'E', v.orden
from (values
  ('Mano de obra', 10),
  ('Trabajos con maquinas', 20),
  ('Muestras', 30),
  ('Gs. Varios', 40),
  ('Trabajos sin maquinas', 50)
) as v(nombre, orden)
on conflict (nombre, padre_id) do nothing;

insert into categorias (nombre, padre_id, tipo_mov, orden)
select v.nombre, (select id from categorias where nombre = 'Insumos' and padre_id is null), 'E', v.orden
from (values
  ('Fertilizantes', 10),
  ('Herbicidas', 20),
  ('Tierra', 30),
  ('Fungicidas', 40)
) as v(nombre, orden)
on conflict (nombre, padre_id) do nothing;

insert into categorias (nombre, padre_id, tipo_mov, orden)
select v.nombre, (select id from categorias where nombre = 'Riego' and padre_id is null), 'E', v.orden
from (values
  ('Mano de obra', 10),
  ('Materiales', 20),
  ('Electricidad', 30),
  ('Bomba', 40),
  ('Reparaciones', 50),
  ('Zanjeo', 60),
  ('Caños', 70),
  ('Perforación', 80)
) as v(nombre, orden)
on conflict (nombre, padre_id) do nothing;

insert into categorias (nombre, padre_id, tipo_mov, orden)
select v.nombre, (select id from categorias where nombre = 'Maquinas y Herramientas' and padre_id is null), 'E', v.orden
from (values
  ('Herramientas', 10),
  ('Mano de obra', 20),
  ('Tigre', 30),
  ('Pulverizadora', 40),
  ('Mochila pulverizadora', 50),
  ('Tractor', 60),
  ('Cortadora Cesped', 70)
) as v(nombre, orden)
on conflict (nombre, padre_id) do nothing;

insert into categorias (nombre, padre_id, tipo_mov, orden)
select v.nombre, (select id from categorias where nombre = 'Compra USD' and padre_id is null), 'E', v.orden
from (values
  ('Compra USD', 10)
) as v(nombre, orden)
on conflict (nombre, padre_id) do nothing;

insert into categorias (nombre, padre_id, tipo_mov, orden)
select v.nombre, (select id from categorias where nombre = 'Venta USD' and padre_id is null), 'I', v.orden
from (values
  ('Venta USD', 10)
) as v(nombre, orden)
on conflict (nombre, padre_id) do nothing;

insert into categorias (nombre, padre_id, tipo_mov, orden)
select v.nombre, (select id from categorias where nombre = 'Aportes' and padre_id is null), 'E', v.orden
from (values
  ('VC entrego a MC', 10)
) as v(nombre, orden)
on conflict (nombre, padre_id) do nothing;

insert into categorias (nombre, padre_id, tipo_mov, orden)
select v.nombre, (select id from categorias where nombre = 'Impuestos' and padre_id is null), 'E', v.orden
from (values
  ('Monotributo', 10)
) as v(nombre, orden)
on conflict (nombre, padre_id) do nothing;
