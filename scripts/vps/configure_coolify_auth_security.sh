#!/usr/bin/env bash
set -euo pipefail

tinker_output="$(sudo docker exec coolify php artisan tinker --execute='
$service = App\Models\Service::findOrFail(2);

$generatedSecurityBlock = <<<'"'"'YAML'"'"'
      GOTRUE_PASSWORD_MIN_LENGTH: '"'"'8'"'"'
      GOTRUE_RATE_LIMIT_EMAIL_SENT: '"'"'10'"'"'
      GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED: '"'"'true'"'"'
      GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL: '"'"'10'"'"'
      GOTRUE_MAILER_NOTIFICATIONS_PASSWORD_CHANGED_ENABLED: '"'"'true'"'"'
      GOTRUE_MAILER_NOTIFICATIONS_EMAIL_CHANGED_ENABLED: '"'"'true'"'"'
YAML;

$rawSecurityBlock = <<<'"'"'YAML'"'"'
      - '"'"'GOTRUE_PASSWORD_MIN_LENGTH=8'"'"'
      - '"'"'GOTRUE_RATE_LIMIT_EMAIL_SENT=10'"'"'
      - '"'"'GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED=true'"'"'
      - '"'"'GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL=10'"'"'
      - '"'"'GOTRUE_MAILER_NOTIFICATIONS_PASSWORD_CHANGED_ENABLED=true'"'"'
      - '"'"'GOTRUE_MAILER_NOTIFICATIONS_EMAIL_CHANGED_ENABLED=true'"'"'
YAML;

$raw = (string) $service->docker_compose_raw;
$raw = str_replace(
    "\\n      - '"'"'GOTRUE_PASSWORD_MIN_LENGTH=8'"'"'",
    "\n      - '"'"'GOTRUE_PASSWORD_MIN_LENGTH=8'"'"'",
    $raw,
);
$service->docker_compose_raw = $raw;
if (!str_contains($raw, "GOTRUE_PASSWORD_MIN_LENGTH=")) {
    $pattern = "/^(\\s+-\\s+'"'"'GOTRUE_DISABLE_SIGNUP=.*'"'"')$/m";
    $updated = preg_replace_callback(
        $pattern,
        fn ($matches) => $matches[0] . "\n" . $rawSecurityBlock,
        $raw,
        1,
        $count,
    );
    if ($count !== 1) {
        throw new RuntimeException("Could not locate GOTRUE_DISABLE_SIGNUP in docker_compose_raw.");
    }
    $service->docker_compose_raw = $updated;
}

$generated = (string) $service->docker_compose;
$generated = str_replace(
    "\\n      GOTRUE_PASSWORD_MIN_LENGTH: '"'"'8'"'"'",
    "\n      GOTRUE_PASSWORD_MIN_LENGTH: '"'"'8'"'"'",
    $generated,
);
$service->docker_compose = $generated;
if (!str_contains($generated, "GOTRUE_PASSWORD_MIN_LENGTH:")) {
    $pattern = "/^(\\s+GOTRUE_DISABLE_SIGNUP:.*)$/m";
    $updated = preg_replace_callback(
        $pattern,
        fn ($matches) => $matches[0] . "\n" . $generatedSecurityBlock,
        $generated,
        1,
        $count,
    );
    if ($count !== 1) {
        throw new RuntimeException("Could not locate GOTRUE_DISABLE_SIGNUP in docker_compose.");
    }
    $service->docker_compose = $updated;
}

foreach ([
    "DISABLE_SIGNUP" => "true",
    "ENABLE_PHONE_SIGNUP" => "false",
    "ENABLE_PHONE_AUTOCONFIRM" => "false",
] as $key => $value) {
    $variable = $service->environment_variables()->where("key", $key)->firstOrFail();
    $variable->value = $value;
    $variable->save();
}

\Symfony\Component\Yaml\Yaml::parse((string) $service->docker_compose_raw);
\Symfony\Component\Yaml\Yaml::parse((string) $service->docker_compose);
$service->save();
App\Actions\Service\RestartService::run(
    service: $service,
    pullLatestImages: false,
);

echo "OdontoCloud Auth hardening configured and service restarted." . PHP_EOL;
')"

printf '%s\n' "$tinker_output"
if [[ "$tinker_output" != *'OdontoCloud Auth hardening configured and service restarted.'* ]]; then
  echo 'Coolify did not confirm the Auth hardening.' >&2
  exit 1
fi
