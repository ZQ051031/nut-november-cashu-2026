import { existsSync, globSync } from 'node:fs';
import { chromium } from 'playwright';

export const fileURL = new URL('../index.html', import.meta.url).href;

export function launch() {
  const executablePath = process.env.CHROME_PATH
    || (!existsSync(chromium.executablePath())
      ? globSync('/opt/.devin/chrome/chrome/linux-*/chrome-linux64/chrome')[0] : undefined);
  return chromium.launch({ executablePath });
}
