const fs = require("node:fs");

for (const fileName of ["package-lock.json", "yarn.lock"]) {
  try {
    fs.rmSync(fileName, { force: true });
  } catch {
    // Silinemeyen kilit dosyası varsa pnpm kurulumu yine devam eder.
  }
}

const userAgent = process.env.npm_config_user_agent ?? "";
if (!userAgent.startsWith("pnpm/")) {
  console.error("Bu proje pnpm ile kurulmalıdır. 'pnpm install' komutunu kullanın.");
  process.exit(1);
}
