const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');

function pathError(value) {
  if (value.includes('\\')) return 'contains a backslash';
  if (/^[A-Za-z]:/.test(value)) return 'contains a drive-letter path';
  if (/^file:\/\//i.test(value)) return 'contains a file:// URL';
  if (value.startsWith('/')) return 'is absolute';
  const normalized = path.posix.normalize(value);
  if (normalized === '..' || normalized.startsWith('../')) return 'escapes the repo root';
  if (value === '') return 'is not repo-relative';
  return null;
}

function checkMapPaths(directory = distDir) {
  if (!fs.existsSync(directory)) throw new Error(`dist directory is missing: ${directory}`);
  const files = fs.readdirSync(directory).filter((name) => name.endsWith('.map'));
  if (files.length === 0) throw new Error(`no source maps found in ${directory}`);

  const errors = [];
  for (const name of files) {
    const filePath = path.join(directory, name);
    let map;
    try {
      map = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      errors.push(`${path.relative(repoRoot, filePath)}: invalid JSON (${error.message})`);
      continue;
    }
    for (const field of ['sources', 'sourceRoot', 'file']) {
      const values = field === 'sources' ? map[field] : [map[field]];
      if (!Array.isArray(values)) continue;
      values.forEach((value, index) => {
        if (typeof value !== 'string' || value === '') return;
        const reason = pathError(value);
        if (reason) {
          const entry = field === 'sources' ? `${field}[${index}]` : field;
          errors.push(`${path.relative(repoRoot, filePath)} ${entry} ${reason}: ${value}`);
        }
      });
    }
  }
  if (errors.length) {
    throw new Error(`${errors.join('\n')}\nRebuild on Linux / run refresh-dist.`);
  }
  return files.length;
}

if (require.main === module) {
  try {
    const count = checkMapPaths();
    console.log(`checked ${count} source map(s)`);
  } catch (error) {
    console.error(`Source-map path check failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { checkMapPaths, pathError };