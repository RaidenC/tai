import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ConfirmationPanelComponent architecture', () => {
  it('does not import dialog, overlay, focus, or Material primitives', () => {
    const componentPath = join(
      process.cwd(),
      'libs/ui/design-system/src/lib/molecules/confirmation-panel/confirmation-panel.component.ts',
    );
    const source = readFileSync(componentPath, 'utf8');

    expect(source).not.toContain('@angular/cdk/dialog');
    expect(source).not.toContain('@angular/cdk/overlay');
    expect(source).not.toContain('@angular/cdk/a11y');
    expect(source).not.toContain('@angular/material');
    expect(source).not.toContain('DialogRef');
    expect(source).not.toContain('DIALOG_DATA');
    expect(source).not.toContain('FocusTrap');
    expect(source).not.toContain('OverlayModule');
  });
});
