-- ===============================================================
-- MIGRACIÓN COMPLETA DEL SISTEMA ODONTOCLOUD A SUPABASE
-- Fecha: 2025-01-27
-- Descripción: Crea todas las tablas necesarias para migrar de Firestore a Supabase
-- IMPORTANTE: No migra datos históricos, solo prepara estructura para datos nuevos
-- ===============================================================

-- -------------------------------------------------------
-- 1. RECIBOS DE CAJA
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recibos_caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  nro_consecutivo TEXT NOT NULL,
  fecha DATE NOT NULL,
  profesional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  profesional_nombre TEXT,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  paciente_nombre TEXT,
  condicion_pago TEXT DEFAULT 'Contado',
  medio_pago TEXT,
  conceptos JSONB DEFAULT '[]'::jsonb, -- Array de {concepto, descripcion, precioUnitario, cantidad, descuento, total}
  subtotal NUMERIC(12,2) DEFAULT 0,
  descuento_total NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL,
  observaciones TEXT,
  caja_id UUID,
  estado TEXT DEFAULT 'activo', -- activo, anulado
  motivo_anulacion TEXT,
  anulado_por UUID,
  anulado_en TIMESTAMPTZ,
  creado_por UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_recibo_consecutivo UNIQUE (tenant_id, nro_consecutivo)
);

CREATE INDEX idx_recibos_caja_tenant ON public.recibos_caja(tenant_id);
CREATE INDEX idx_recibos_caja_fecha ON public.recibos_caja(fecha DESC);
CREATE INDEX idx_recibos_caja_paciente ON public.recibos_caja(paciente_id);
CREATE INDEX idx_recibos_caja_caja ON public.recibos_caja(caja_id);

-- -------------------------------------------------------
-- 2. CAJAS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cajas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  usuario_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  usuario_nombre TEXT NOT NULL,
  estado TEXT DEFAULT 'abierta', -- abierta, cerrada
  saldo_inicial NUMERIC(12,2) DEFAULT 0,
  saldo_actual NUMERIC(12,2) DEFAULT 0,
  total_ingresos NUMERIC(12,2) DEFAULT 0,
  total_egresos NUMERIC(12,2) DEFAULT 0,
  fecha_apertura TIMESTAMPTZ DEFAULT now(),
  fecha_cierre TIMESTAMPTZ,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cajas_tenant ON public.cajas(tenant_id);
CREATE INDEX idx_cajas_usuario ON public.cajas(usuario_id);
CREATE INDEX idx_cajas_estado ON public.cajas(estado);
CREATE INDEX idx_cajas_fecha_apertura ON public.cajas(fecha_apertura DESC);

-- -------------------------------------------------------
-- 3. MOVIMIENTOS DE CAJA
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.movimientos_caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caja_id UUID REFERENCES public.cajas(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL, -- ingreso, egreso
  concepto TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  metodo_pago TEXT,
  descripcion TEXT,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  paciente_nombre TEXT,
  recibo_id UUID,
  usuario_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  usuario_nombre TEXT,
  fecha TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_movimientos_caja ON public.movimientos_caja(caja_id);
CREATE INDEX idx_movimientos_tenant ON public.movimientos_caja(tenant_id);
CREATE INDEX idx_movimientos_tipo ON public.movimientos_caja(tipo);
CREATE INDEX idx_movimientos_fecha ON public.movimientos_caja(fecha DESC);

-- -------------------------------------------------------
-- 4. PROFESIONALES
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profesionales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  nombre_completo TEXT NOT NULL,
  especialidad TEXT,
  telefono TEXT,
  email TEXT,
  registro_medico TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profesionales_tenant ON public.profesionales(tenant_id);
CREATE INDEX idx_profesionales_activo ON public.profesionales(activo);

-- -------------------------------------------------------
-- 5. SUCURSALES
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sucursales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  direccion TEXT,
  ciudad TEXT,
  telefono TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sucursales_tenant ON public.sucursales(tenant_id);
CREATE INDEX idx_sucursales_activo ON public.sucursales(activo);

-- -------------------------------------------------------
-- 6. RECURSOS FÍSICOS (Consultorios, Equipos)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recursos_fisicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL, -- consultorio, equipo, sala
  disponible BOOLEAN DEFAULT true,
  sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_recursos_tenant ON public.recursos_fisicos(tenant_id);
CREATE INDEX idx_recursos_tipo ON public.recursos_fisicos(tipo);
CREATE INDEX idx_recursos_disponible ON public.recursos_fisicos(disponible);

-- -------------------------------------------------------
-- 7. HORARIOS PREDEFINIDOS (Para profesionales y recursos)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.horarios_predefinidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  entidad_tipo TEXT NOT NULL, -- profesional, recurso
  entidad_id UUID NOT NULL, -- ID del profesional o recurso
  dia_semana INTEGER NOT NULL, -- 0=Domingo, 1=Lunes, ..., 6=Sábado
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_horarios_entidad ON public.horarios_predefinidos(entidad_tipo, entidad_id);
CREATE INDEX idx_horarios_dia ON public.horarios_predefinidos(dia_semana);

-- -------------------------------------------------------
-- 8. CONVENIOS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.convenios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  tipo_convenio TEXT, -- eps, particular, empresa
  activo BOOLEAN DEFAULT true,
  fecha_inicio DATE,
  fecha_fin DATE,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_convenios_tenant ON public.convenios(tenant_id);
CREATE INDEX idx_convenios_activo ON public.convenios(activo);

-- -------------------------------------------------------
-- 9. DESCUENTOS POR CONVENIO
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.convenios_descuentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convenio_id UUID REFERENCES public.convenios(id) ON DELETE CASCADE NOT NULL,
  procedimiento_codigo TEXT,
  procedimiento_nombre TEXT,
  tipo_descuento TEXT DEFAULT 'porcentaje', -- porcentaje, monto_fijo
  valor_descuento NUMERIC(12,2) NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_descuentos_convenio ON public.convenios_descuentos(convenio_id);

-- -------------------------------------------------------
-- 10. EPS CATÁLOGO
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.eps_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  codigo TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_eps_nombre UNIQUE (tenant_id, nombre)
);

CREATE INDEX idx_eps_tenant ON public.eps_catalogo(tenant_id);
CREATE INDEX idx_eps_activo ON public.eps_catalogo(activo);

-- -------------------------------------------------------
-- 11. MÉTODOS DE PAGO
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.metodos_pago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  requiere_referencia BOOLEAN DEFAULT false,
  activo BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_metodo_nombre UNIQUE (tenant_id, nombre)
);

CREATE INDEX idx_metodos_tenant ON public.metodos_pago(tenant_id);
CREATE INDEX idx_metodos_activo ON public.metodos_pago(activo);
CREATE INDEX idx_metodos_orden ON public.metodos_pago(orden);

-- -------------------------------------------------------
-- 12. CONSECUTIVOS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consecutivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL, -- recibo_caja, factura, orden_compra, etc.
  valor_actual INTEGER DEFAULT 0,
  prefijo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_consecutivo_nombre UNIQUE (tenant_id, nombre)
);

CREATE INDEX idx_consecutivos_tenant ON public.consecutivos(tenant_id);

-- -------------------------------------------------------
-- 13. ODONTOGRAMAS (Migrar de subcollection a tabla plana)
-- -------------------------------------------------------
ALTER TABLE public.odontogramas 
ADD COLUMN IF NOT EXISTS sesion_nombre TEXT,
ADD COLUMN IF NOT EXISTS creado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS plan_tratamiento JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS firma TEXT,
ADD COLUMN IF NOT EXISTS huella TEXT,
ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ;

-- -------------------------------------------------------
-- 14. COMPLETAR TABLA FACTURAS
-- -------------------------------------------------------
ALTER TABLE public.facturas
ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pendiente',
ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS descuento NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS iva NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total NUMERIC(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS observaciones TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_facturas_estado ON public.facturas(estado);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha ON public.facturas(fecha_emision DESC);

-- -------------------------------------------------------
-- 15. NOTAS CRÉDITO
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notas_credito (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  factura_id UUID REFERENCES public.facturas(id) ON DELETE SET NULL,
  nro_consecutivo TEXT,
  fecha DATE NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  concepto TEXT NOT NULL,
  estado TEXT DEFAULT 'activo',
  motivo_anulacion TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notas_credito_tenant ON public.notas_credito(tenant_id);
CREATE INDEX idx_notas_credito_factura ON public.notas_credito(factura_id);

-- -------------------------------------------------------
-- 16. INVENTARIO
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  cantidad NUMERIC(12,2) DEFAULT 0,
  unidad TEXT, -- unidad, caja, frasco, etc.
  categoria TEXT,
  precio_unitario NUMERIC(12,2) DEFAULT 0,
  precio_venta NUMERIC(12,2) DEFAULT 0,
  minimo_stock NUMERIC(12,2) DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_inventario_codigo UNIQUE (tenant_id, codigo)
);

CREATE INDEX idx_inventario_tenant ON public.inventario(tenant_id);
CREATE INDEX idx_inventario_categoria ON public.inventario(categoria);
CREATE INDEX idx_inventario_activo ON public.inventario(activo);

-- -------------------------------------------------------
-- 17. MOVIMIENTOS DE INVENTARIO
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.movimientos_inventario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.inventario(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL, -- entrada, salida, ajuste
  cantidad NUMERIC(12,2) NOT NULL,
  cantidad_anterior NUMERIC(12,2),
  cantidad_nueva NUMERIC(12,2),
  concepto TEXT,
  referencia TEXT, -- ID de cita, evolución, etc.
  usuario_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  fecha TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_movimientos_inv_tenant ON public.movimientos_inventario(tenant_id);
CREATE INDEX idx_movimientos_inv_item ON public.movimientos_inventario(item_id);
CREATE INDEX idx_movimientos_inv_tipo ON public.movimientos_inventario(tipo);
CREATE INDEX idx_movimientos_inv_fecha ON public.movimientos_inventario(fecha DESC);

-- -------------------------------------------------------
-- 18. RESIDUOS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tipos_residuos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  color TEXT,
  unidad TEXT DEFAULT 'kg',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.registro_residuos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  tipo_residuo_id UUID REFERENCES public.tipos_residuos(id) ON DELETE SET NULL,
  peso NUMERIC(12,2) NOT NULL,
  fecha DATE NOT NULL,
  responsable TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_residuos_tenant ON public.registro_residuos(tenant_id);
CREATE INDEX idx_residuos_fecha ON public.registro_residuos(fecha DESC);

-- -------------------------------------------------------
-- 19. CONFIGURACIÓN DE FORMULARIOS (De subcollection a tabla)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.configuracion_formularios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  tipo_formulario TEXT NOT NULL, -- pacientes, historia_clinica, etc.
  configuracion JSONB NOT NULL, -- Campos visibles, requeridos, etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_config_formulario UNIQUE (tenant_id, tipo_formulario)
);

-- -------------------------------------------------------
-- 20. PLANTILLAS CLÍNICAS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plantillas_clinicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  tipo TEXT, -- evolucion, consentimiento, formula, etc.
  contenido TEXT NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_plantillas_tenant ON public.plantillas_clinicas(tenant_id);
CREATE INDEX idx_plantillas_tipo ON public.plantillas_clinicas(tipo);

-- -------------------------------------------------------
-- 21. DOCUMENTOS CLÍNICOS (Para consolidar docClis)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documentos_clinicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE NOT NULL,
  tipo_documento TEXT NOT NULL, -- consulta, formula, consentimiento, remision
  contenido JSONB NOT NULL,
  firma_doctor TEXT,
  firmado_en TIMESTAMPTZ,
  firmado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  creado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  fecha_documento DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_docs_clinicos_paciente ON public.documentos_clinicos(paciente_id);
CREATE INDEX idx_docs_clinicos_tipo ON public.documentos_clinicos(tipo_documento);
CREATE INDEX idx_docs_clinicos_fecha ON public.documentos_clinicos(fecha_documento DESC);

-- -------------------------------------------------------
-- 22. BARRIOS CATÁLOGO
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.barrios_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  ciudad TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_barrio_nombre UNIQUE (tenant_id, nombre)
);

CREATE INDEX idx_barrios_tenant ON public.barrios_catalogo(tenant_id);

-- -------------------------------------------------------
-- 23. TRIGGER PARA UPDATED_AT
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger a tablas que lo necesitan
DO $$ 
DECLARE
  t text;
BEGIN
  FOR t IN 
    SELECT table_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND column_name = 'updated_at'
    AND table_name NOT LIKE '%_old%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at 
                    BEFORE UPDATE ON public.%I 
                    FOR EACH ROW 
                    EXECUTE FUNCTION update_updated_at_column()', t);
  END LOOP;
END $$;

-- -------------------------------------------------------
-- 24. COMENTARIOS PARA DOCUMENTACIÓN
-- -------------------------------------------------------
COMMENT ON TABLE public.recibos_caja IS 'Recibos de caja emitidos';
COMMENT ON TABLE public.cajas IS 'Cajas abiertas/cerradas por usuario';
COMMENT ON TABLE public.movimientos_caja IS 'Movimientos de ingreso/egreso de caja';
COMMENT ON TABLE public.profesionales IS 'Profesionales de la salud';
COMMENT ON TABLE public.sucursales IS 'Sucursales del negocio';
COMMENT ON TABLE public.recursos_fisicos IS 'Consultorios, equipos y salas';
COMMENT ON TABLE public.horarios_predefinidos IS 'Horarios de atención de profesionales y recursos';
COMMENT ON TABLE public.convenios IS 'Convenios con EPS, empresas, etc.';
COMMENT ON TABLE public.convenios_descuentos IS 'Descuentos por procedimiento según convenio';
COMMENT ON TABLE public.metodos_pago IS 'Métodos de pago aceptados';
COMMENT ON TABLE public.consecutivos IS 'Numeración consecutiva de documentos';
COMMENT ON TABLE public.inventario IS 'Inventario de insumos y materiales';
COMMENT ON TABLE public.movimientos_inventario IS 'Registro de entradas/salidas de inventario';
COMMENT ON TABLE public.documentos_clinicos IS 'Documentos clínicos (fórmulas, consentimientos, etc.)';
COMMENT ON TABLE public.plantillas_clinicas IS 'Plantillas de documentos clínicos';

-- ===============================================================
-- FIN DE MIGRACIÓN
-- ===============================================================
