import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { expect } from 'vitest';
import { parse } from 'yaml';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- เดิน YAML ที่ไม่มี type
type Json = Record<string, any>;

const spec: Json = parse(readFileSync(join(import.meta.dirname, '../../openapi.yaml'), 'utf8'));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats.default(ajv);
ajv.addSchema({ $id: 'openapi', components: spec.components });

function deref(node: Json): Json {
  if (!node.$ref) return node;
  const path = (node.$ref as string).replace(/^#\//, '').split('/');
  return path.reduce((acc: Json, key) => acc[key], spec);
}

// ตรวจว่า response ตรงกับ openapi.yaml: status ต้องประกาศไว้ และ body ต้องผ่าน schema
export function expectMatchesSpec(method: string, path: string, response: { status: number; body: unknown }) {
  const operation = spec.paths[path]?.[method.toLowerCase()];
  expect(operation, `${method} ${path} ไม่มีใน openapi.yaml`).toBeDefined();
  const declared = operation.responses[String(response.status)];
  expect(declared, `${method} ${path} ไม่ได้ประกาศ status ${response.status}`).toBeDefined();

  const schemaRef = deref(declared).content['application/json'].schema.$ref as string;
  const validate = ajv.getSchema(`openapi${schemaRef}`)!;
  const valid = validate(response.body);
  expect(validate.errors ?? [], `body ไม่ตรง ${schemaRef}: ${JSON.stringify(response.body)}`).toEqual([]);
  expect(valid).toBe(true);
}
