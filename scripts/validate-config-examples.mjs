// Validates every example in schemas/examples against the project
// configuration schema, so a schema change that breaks a documented example
// fails CI instead of the first team that copies it.

import { readdirSync, readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse } from 'yaml';

const schema = JSON.parse(readFileSync('schemas/salesforce-devops.schema.json', 'utf8'));
const validate = new Ajv2020({ allErrors: true }).compile(schema);

const dir = 'schemas/examples';
let failed = false;
for (const file of readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))) {
  const config = parse(readFileSync(`${dir}/${file}`, 'utf8'));
  if (validate(config)) {
    console.log(`✔ ${file}`);
  } else {
    failed = true;
    console.error(`✘ ${file}`);
    for (const error of validate.errors) console.error(`  ${error.instancePath || '/'} ${error.message}`);
  }
}
process.exit(failed ? 1 : 0);
