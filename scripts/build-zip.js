import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const zipPath = path.join(projectRoot, 'ticket-booking-system.zip');

console.log('📦 Creating clean project ZIP package...');

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

// Build PowerShell command excluding node_modules and .git
const powershellCmd = `
  $exclude = @('node_modules', '.git', 'dist', '.vite', 'ticket-booking-system.zip');
  Get-ChildItem -Path "${projectRoot}" | Where-Object { $exclude -notcontains $_.Name } | Compress-Archive -DestinationPath "${zipPath}" -Force
`;

try {
  execSync(`powershell -Command "${powershellCmd.replace(/\n/g, ' ')}"`, { stdio: 'inherit' });
  console.log(`✅ Project successfully packaged into: ${zipPath}`);
} catch (err) {
  console.error('❌ Zip creation error:', err.message);
}
