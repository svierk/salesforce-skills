// Every plugin that reads or writes .github/salesforce-devops.yml carries its
// own reference to the format, because a plugin can only read files inside its
// folder. The schema is the canonical definition - this test fails when a
// field of the schema is missing from one of those references, so the copies
// cannot silently fall behind it.

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const schema = JSON.parse(read('schemas/salesforce-devops.schema.json'));

/** Dotted paths of every field, e.g. "blueprint", "branches.feature". */
function fields(properties, prefix = '') {
  return Object.entries(properties).flatMap(([name, spec]) =>
    spec.properties ? fields(spec.properties, `${prefix}${name}.`) : [`${prefix}${name}`]
  );
}

const references = [
  'plugins/devops-builder/skills/salesforce-devops-builder/references/project-config.md',
  'plugins/devops-operator/skills/salesforce-devops-operator/references/project-config.md'
];

for (const reference of references) {
  test(`${reference.split('/')[1]} documents every field of the schema`, () => {
    const text = read(reference);
    const missing = fields(schema.properties).filter((field) => !text.includes(`\`${field}\``));
    assert.deepEqual(missing, [], `missing from ${reference}`);
  });
}
