import { mkdirSync, copyFileSync, existsSync, readdirSync, statSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, basename, join } from 'path';
import { execSync } from 'child_process';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const versionArgIndex = args.indexOf('--version');
const outputArgIndex = args.indexOf('--output');

const version = versionArgIndex >= 0 && args[versionArgIndex + 1] ? args[versionArgIndex + 1] : null;
const outputPath = outputArgIndex >= 0 && args[outputArgIndex + 1] ? args[outputArgIndex + 1] : null;

if (!version) {
  console.error('❌ --version es requerido para generar el ZIP.');
  process.exit(1);
}

const sourceDir = resolve(__dirname, '../dist');
if (!existsSync(sourceDir)) {
  console.error(`❌ No se encontró el directorio de build: ${sourceDir}`);
  process.exit(1);
}

const destZipName = outputPath ? outputPath : `../update-v${version}.zip`;
const resolvedDestZip = resolve(process.cwd(), destZipName);
const tempDir = resolve(os.tmpdir(), `control-pileta-update-${Date.now()}`);

function copyRecursive(src, dest) {
  const items = readdirSync(src);
  for (const item of items) {
    const srcPath = join(src, item);
    const destPath = join(dest, item);
    const stats = statSync(srcPath);
    if (stats.isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
      continue;
    }
    const lower = item.toLowerCase();
    const skipZipName = `update-v${version}.zip`;
    if (lower.endsWith('.apk') || lower.endsWith('.ipa') || lower === skipZipName) {
      continue;
    }
    mkdirSync(dirname(destPath), { recursive: true });
    copyFileSync(srcPath, destPath);
  }
}

try {
  mkdirSync(tempDir, { recursive: true });
  copyRecursive(sourceDir, tempDir);

  const escapedTemp = tempDir.replace(/'/g, "''");
  const escapedDest = resolvedDestZip.replace(/'/g, "''");

  if (process.platform === 'win32') {
    execSync(`powershell.exe -NoProfile -Command "Compress-Archive -Path '${escapedTemp}\\*' -DestinationPath '${escapedDest}' -Force"`, { stdio: 'inherit' });
  } else {
    execSync(`zip -r -q '${escapedDest}' .`, { cwd: tempDir, stdio: 'inherit' });
  }

  const outputSize = statSync(resolvedDestZip).size;
  console.log(`✅ ZIP generado: ${resolvedDestZip}`);
  console.log(`✅ Tamaño: ${(outputSize / 1024 / 1024).toFixed(2)} MB`);
} catch (error) {
  console.error('❌ Error generando ZIP:', error.message || error);
  process.exit(1);
} finally {
  try {
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
  } catch (cleanupError) {
    console.warn('⚠️ No se pudo limpiar el directorio temporal:', cleanupError.message || cleanupError);
  }
}
