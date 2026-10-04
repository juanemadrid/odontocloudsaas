#!/usr/bin/env bash
# ==============================================================================
# SCRIPT DE APLICACIÓN Y VALIDACIÓN DEL PASO 1.3 EN EL VPS DE ODONTOCLOUD
# Contenedor DB: supabase-db-ueh7xuehxl9thmhre7fpk4xx
# ==============================================================================
set -euo pipefail

CONTAINER="supabase-db-ueh7xuehxl9thmhre7fpk4xx"
BACKUP_DIR="/data/backups/odontocloud-pre-p13"
BACKUP_FILE="${BACKUP_DIR}/evoluciones_backup_$(date +%Y%m%d_%H%M%S).dump"

echo "=========================================================="
echo " PASO 1: BACKUP DE public.evoluciones"
echo "=========================================================="
mkdir -p "${BACKUP_DIR}"
docker exec -i "${CONTAINER}" pg_dump -U postgres -d postgres -t public.evoluciones -Fc > "${BACKUP_FILE}"

if [ ! -s "${BACKUP_FILE}" ]; then
    echo "ERROR: El archivo de backup está vacío o no se generó correctamente."
    exit 1
fi

echo "✅ Backup exitoso generado en: ${BACKUP_FILE}"
ls -lh "${BACKUP_FILE}"

echo ""
echo "=========================================================="
echo " PASO 2: VERIFICACIÓN PREVIA DEL GUARD (7 + 8 = 15)"
echo "=========================================================="
docker exec -i "${CONTAINER}" psql -U postgres -d postgres -c "
DO \$\$
DECLARE
    v_time TIMESTAMPTZ := clock_timestamp();
    v_cutoff TIMESTAMPTZ := v_time - interval '72 hours';
    v_tot INT;
    v_old INT;
    v_rec INT;
BEGIN
    SELECT count(*) INTO v_tot FROM public.evoluciones;
    SELECT count(*) INTO v_old FROM public.evoluciones WHERE COALESCE(created_at, fecha) < v_cutoff;
    SELECT count(*) INTO v_rec FROM public.evoluciones WHERE COALESCE(created_at, fecha) >= v_cutoff;
    RAISE NOTICE 'Guard Check: Total=%, Antiguas (>72h)=%, Recientes (<=72h)=%', v_tot, v_old, v_rec;
    IF v_tot <> 15 OR v_old <> 7 OR v_rec <> 8 THEN
        RAISE EXCEPTION 'GUARD FALLIDO: Conteo incompatible con aprobacion 7/8/15.';
    END IF;
END \$\$;
"

echo "✅ Guard verificado exitosamente."
