#!/usr/bin/env bash
set -euo pipefail

panel_matches="$(rg -n "from ['\"]@angular/cdk/(dialog|overlay|a11y)['\"]|from ['\"]@angular/material|DialogRef|DIALOG_DATA|FocusTrap|OverlayModule|MatDialog" libs/ui/design-system/src/lib/molecules/confirmation-panel apps/portal-web/src/app/features/users/users-confirmation-host.component.ts --glob '!*.spec.ts' || true)"

if [[ -n "$panel_matches" ]]; then
  echo "Banned CDK/Material confirmation boundary import found:"
  echo "$panel_matches"
  exit 1
fi

echo "Confirmation boundary scan passed."
