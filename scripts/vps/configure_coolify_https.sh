#!/usr/bin/env bash
set -euo pipefail

sudo docker exec coolify php artisan tinker --execute='
$service = App\Models\Service::findOrFail(2);
$application = App\Models\ServiceApplication::findOrFail(15);
$application->fqdn = "https://supabasekong-ueh7xuehxl9thmhre7fpk4xx.150.136.210.37.sslip.io:8000";
$application->save();

$values = [
    "GOTRUE_SITE_URL" => "https://juanemadrid.github.io/odontocloudsaas/",
    "ADDITIONAL_REDIRECT_URLS" => "https://juanemadrid.github.io/odontocloudsaas/,https://juanemadrid.github.io/odontocloudsaas/reset-password",
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

echo "Coolify configuration regenerated and OdontoCloud restarted." . PHP_EOL;
'
