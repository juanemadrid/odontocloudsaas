-- Migración: Agregar campos de Múltiples Responsables y Tercero de Facturación
-- Fecha: 2025-08-07
-- Descripción: Cuando se activa "Múltiples Responsables", las facturas electrónicas
--              se emiten a nombre del tercero seleccionado (paciente o entidad).
--              NO afecta recibos de pago ni saldos a favor.

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS multiples_responsables BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tercero_facturacion_id TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS tercero_facturacion_nombre TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS tercero_facturacion_tipo TEXT DEFAULT ''; -- 'paciente' | 'entidad'

COMMENT ON COLUMN public.pacientes.multiples_responsables IS 'Indica que las facturas electrónicas se deben emitir a nombre de un tercero';
COMMENT ON COLUMN public.pacientes.tercero_facturacion_id IS 'ID del tercero (paciente o entidad) responsable de las facturas electrónicas';
COMMENT ON COLUMN public.pacientes.tercero_facturacion_nombre IS 'Nombre del tercero responsable para mostrar en UI';
COMMENT ON COLUMN public.pacientes.tercero_facturacion_tipo IS 'Tipo del tercero: paciente o entidad';
