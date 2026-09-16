import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drawingEnv } from '../server/drawing-env.js';

test('project .env overrides inherited credentials without changing the process environment', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'drawing-env-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const inherited = { OPENAI_API_KEY: 'shell-placeholder', OPENAI_DRAW_MODEL: 'configured-model' };
  assert.deepEqual(drawingEnv(inherited, directory), inherited);
  await writeFile(join(directory, '.env'), 'OPENAI_API_KEY="project-placeholder" # local key\n');
  assert.deepEqual(drawingEnv(inherited, directory), { ...inherited, OPENAI_API_KEY: 'project-placeholder' });
  assert.equal(inherited.OPENAI_API_KEY, 'shell-placeholder');
  await writeFile(join(directory, '.env'), 'OPENAI_API_KEY=\n');
  assert.equal(drawingEnv(inherited, directory).OPENAI_API_KEY, '');
});
