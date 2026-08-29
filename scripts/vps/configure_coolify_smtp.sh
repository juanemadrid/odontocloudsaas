#!/usr/bin/env bash
set -euo pipefail

secret_file='/tmp/odontocloud-smtp-key.txt'
container_secret_file='/tmp/odontocloud-smtp-key.txt'

cleanup() {
  sudo docker exec -u root coolify rm -f "$container_secret_file" >/dev/null 2>&1 || true
  rm -f "$secret_file"
}
trap cleanup EXIT

if [[ ! -s "$secret_file" ]]; then
  echo 'SMTP secret file is missing or empty.' >&2
  exit 1
fi

sudo chmod 600 "$secret_file"
sudo docker cp "$secret_file" "coolify:${container_secret_file}" >/dev/null
sudo docker exec -u root coolify chown 9999:9999 "$container_secret_file"
sudo docker exec -u root coolify chmod 600 "$container_secret_file"

tinker_output="$(sudo docker exec coolify php artisan tinker --execute='
$smtpPassword = trim(file_get_contents("/tmp/odontocloud-smtp-key.txt"));
if (!str_starts_with($smtpPassword, "xsmtpsib-") || strlen($smtpPassword) < 64) {
    throw new RuntimeException("Invalid Brevo SMTP key format.");
}

$service = App\Models\Service::findOrFail(2);
$values = [
    "SMTP_HOST" => "smtp-relay.brevo.com",
    "SMTP_PORT" => "587",
    "SMTP_USER" => "b71a27001@smtp-brevo.com",
    "SMTP_PASS" => $smtpPassword,
    "SMTP_ADMIN_EMAIL" => "odontocloud.soporte@gmail.com",
    "SMTP_SENDER_NAME" => "OdontoCloud",
];

foreach ($values as $key => $value) {
    $variable = $service->environment_variables()->where("key", $key)->firstOrFail();
    $variable->value = $value;
    $variable->save();
}

App\Actions\Service\RestartService::run(
    service: $service,
    pullLatestImages: false,
);

echo "Brevo SMTP configured and OdontoCloud restarted." . PHP_EOL;
')"

printf '%s\n' "$tinker_output"
if [[ "$tinker_output" != *'Brevo SMTP configured and OdontoCloud restarted.'* ]]; then
  echo 'Coolify did not confirm the SMTP configuration.' >&2
  exit 1
fi
