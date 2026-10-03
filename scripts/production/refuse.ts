console.error(
  'Generic migration commands are disabled. Use a guarded db:migrate:a*:local command or the explicit Production operator runbook. No database was contacted.',
);
process.exitCode = 1;
