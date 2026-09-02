import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentSource = readFileSync(
  resolve(
    process.cwd(),
    'libs/ui/design-system/src/lib/organisms/stepper/stepper.component.ts',
  ),
  'utf8',
);
const templateSource = readFileSync(
  resolve(
    process.cwd(),
    'libs/ui/design-system/src/lib/organisms/stepper/stepper.component.html',
  ),
  'utf8',
);

describe('Stepper architecture', () => {
  it('does not depend on Angular router primitives', () => {
    const source = `${componentSource}\n${templateSource}`;

    expect(source).not.toContain('RouterModule');
    expect(source).not.toContain('ActivatedRoute');
    expect(source).not.toContain('routerLink');
    expect(source).not.toContain('routerLinkActive');
  });
});
