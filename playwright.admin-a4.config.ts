import { defineConfig } from '@playwright/test';
import base from './playwright.admin-a3.config';
process.env.ADMIN_REVIEW_PHASE = 'a4';
export default defineConfig({
  ...base,
  testMatch: 'admin-a4.spec.ts',
  timeout: 360000,
  use: { ...base.use, baseURL: 'http://127.0.0.1:3104' },
  webServer: { ...base.webServer!, url: 'http://127.0.0.1:3104' },
});
