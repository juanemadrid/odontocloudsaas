#!/usr/bin/env bash
set -euo pipefail

# ====================================================================
# CONFIGURADOR EXCLUSIVO PARA ODONTOCLOUD (SERVICIO 2 EN COOLIFY)
# ADVERTENCIA: NO TOCA EDUNEXUS NI NINGÚN OTRO SERVICIO DEL VPS
# ====================================================================

secret_file='/tmp/odontocloud-resend-key.txt'
container_secret_file='/tmp/odontocloud-resend-key.txt'

cleanup() {
  sudo docker exec -u root coolify rm -f "$container_secret_file" >/dev/null 2>&1 || true
  rm -f "$secret_file"
}
trap cleanup EXIT

if [[ ! -s "$secret_file" ]]; then
  echo 'Error: Falta el archivo /tmp/odontocloud-resend-key.txt con la clave re_...' >&2
  echo 'Uso:' >&2
  echo '  echo "re_tu_api_key_aqui" > /tmp/odontocloud-resend-key.txt' >&2
  echo '  bash scripts/vps/configure_coolify_resend.sh' >&2
  exit 1
fi

sudo chmod 600 "$secret_file"
sudo docker cp "$secret_file" "coolify:${container_secret_file}" >/dev/null
sudo docker exec -u root coolify chown 9999:9999 "$container_secret_file"
sudo docker exec -u root coolify chmod 600 "$container_secret_file"

tinker_output="$(sudo docker exec coolify php artisan tinker --execute='
$resendKey = trim(file_get_contents("/tmp/odontocloud-resend-key.txt"));
if (!str_starts_with($resendKey, "re_") || strlen($resendKey) < 20) {
    throw new RuntimeException("Formato de clave Resend invalido. Debe iniciar por re_");
}

// Servicio 2 es EXCLUSIVAMENTE OdontoCloud en Coolify
$service = App\Models\Service::findOrFail(2);

$values = [
    "SMTP_HOST" => "smtp.resend.com",
    "SMTP_PORT" => "587",
    "SMTP_USER" => "resend",
    "SMTP_PASS" => $resendKey,
    "SMTP_ADMIN_EMAIL" => "bienvenido@odontocloudcolombia.com",
    "SMTP_SENDER_NAME" => "OdontoCloud",
];

foreach ($values as $key => $value) {
    $variable = $service->environment_variables()->where("key", $key)->first();
    if ($variable) {
        $variable->value = $value;
        $variable->save();
    }
}

// Guardar tambien RESEND_API_KEY si existe la variable o crearla
$resendVar = $service->environment_variables()->where("key", "RESEND_API_KEY")->first();
if ($resendVar) {
    $resendVar->value = $resendKey;
    $resendVar->save();
}

App\Actions\Service\RestartService::run(
    service: $service,
    pullLatestImages: false,
);

echo "Resend SMTP configurado exitosamente en OdontoCloud. Edunexus no fue modificado." . PHP_EOL;
')"

printf '%s\n' "$tinker_output"
if [[ "$tinker_output" != *'Resend SMTP configurado exitosamente en OdontoCloud'* ]]; then
  echo 'Coolify no confirmo la configuracion de OdontoCloud.' >&2
  exit 1
fi
