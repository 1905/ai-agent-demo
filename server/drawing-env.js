import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

// The project key wins over credentials inherited from the parent shell.
export function drawingEnv(inherited, directory = process.cwd()) {
  try {
    return { ...inherited, ...parseEnv(readFileSync(join(directory, '.env'), 'utf8')) };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { ...inherited };
  }
}
