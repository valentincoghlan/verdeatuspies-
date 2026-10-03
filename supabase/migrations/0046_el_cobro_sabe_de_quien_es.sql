-- ---------------------------------------------------------------------
-- 0046 · Un cobro sabe de quién es
--
-- El formulario de Movimientos deja elegir el PEDIDO, no el cliente: es
-- lo que uno tiene en la cabeza cuando entra una transferencia ("esto es
-- de la entrega del jueves"). Ese movimiento quedaba con `venta_id` pero
-- sin `cliente_id`.
--
-- Y la cuenta corriente suma lo cobrado mirando solo `cliente_id`. O sea
-- que esos cobros se veían en la ficha del pedido pero NO bajaban el
-- saldo del comprador. La plata estaba, el saldo no se movía, y mirando
-- la pantalla no había manera de darse cuenta: el número era coherente
-- consigo mismo, simplemente le faltaba plata de un lado.
--
-- Se arregla en dos tiempos: acá se acomoda lo ya cargado y se blinda la
-- vista; en el código, `movimientoDe()` saca el cliente del pedido
-- cuando el formulario no lo manda, para que no vuelva a pasar.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. Lo ya cargado: el cliente sale del pedido del que cuelga
--
-- Solo toca las filas que NO tienen cliente. Una que ya lo tiene se
-- respeta aunque no coincida con la venta: puede ser a propósito —un
-- flete que paga un tercero, por ejemplo— y no es esto lo que se está
-- arreglando.
-- ---------------------------------------------------------------------
update movimientos m
   set cliente_id = v.cliente_id
  from ventas v
 where m.venta_id = v.id
   and m.cliente_id is null
   and v.cliente_id is not null;

-- ---------------------------------------------------------------------
-- 2. La vista, blindada
--
-- Aunque el punto 1 ya dejó los datos derechos, la vista pasa a resolver
-- el cliente igual que el código: el del movimiento si lo tiene, y si no
-- el del pedido. Así un cobro que entre por cualquier otro camino sin
-- cliente propio igual cae en la cuenta corriente de quien corresponde.
--
-- El resto de la vista queda igual. Lo vendido sigue contando solo las
-- ventas cosechadas, confirmadas o entregadas: un pedido que todavía no
-- se cortó no es plata facturada, y si dejó seña el saldo da negativo a
-- propósito —es un anticipo—, que es lo que dice el pie de la pantalla.
-- ---------------------------------------------------------------------
create or replace view v_cuenta_clientes as
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
  from ventas where estado in ('cosechada', 'confirmada', 'entregada') group by cliente_id
) v on v.cliente_id = c.id
left join (
  select coalesce(m.cliente_id, ve.cliente_id) as cliente_id,
         sum(m.monto) as total_cobrado
    from movimientos m
    left join ventas ve on ve.id = m.venta_id
   where m.tipo = 'I'
     and coalesce(m.cliente_id, ve.cliente_id) is not null
   group by 1
) co on co.cliente_id = c.id;
