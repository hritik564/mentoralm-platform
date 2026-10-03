# Future HTTPS Production smoke tests

Not executed in P1. Use controlled approved existing identities and explicit minimal test-data ownership/cleanup plans. Do not invent permanent fake business data or rely on Development sign-in tickets. Keep traffic off until every applicable check passes and unresolved P2 feature gates are deliberately enforced.

| Surface         | Checks and expected results                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public          | mentoralm.com loads; static assets, canonical origins and headers correct; no secret/config/debug payload; unsupported hosts deny                                                                       |
| Dashboard       | Actual Clerk Production sign-in, provider verification/recovery, profile, theme persistence and own Student records; no cross-Student access                                                            |
| LMS entry       | Direct students.mentoralm.com/sign-in; entitlement denial provides intentional support state; authentication alone cannot enroll/enable access                                                          |
| LMS learning    | Own published Course Enrollment; correct curriculum/lesson, progress and support/profile; revoked entitlement/Enrollment denies next request; no cross-Course/Batch/file access                         |
| LMS media       | Private P2 delivery authorizes session/User/entitlement/Enrollment/publication/Batch; signed URL expiration/range/download policies; no permanent public video URLs. Remains blocked/unconfigured in P1 |
| Admin           | Dedicated sign-in; no signup CTA; non-Admin Access Denied without Student redirect; Governor opens all authorized surfaces; scoped and empty policies deny unrelated data/actions                       |
| Governance      | Two approved Governors for transfer tests; no self/final-governor lockout; stale revision conflict; grant empty policy, revoke/removal and regrant behavior; audit failure rollback                     |
| Audit           | Safe projections/filters; unknown envelope; attempted UPDATE/DELETE/TRUNCATE denied under non-superuser role; successful operations insert history                                                      |
| Cross-subdomain | Same Clerk User across Website/Dashboard/LMS/Admin; exact allowed subdomains/authorized parties; expected shared session/logout behavior; attacker sibling/return URLs/origin downgrade deny            |
| Database        | Actual target/schema, all eleven successful migration checksums, stable Student IDs, Enrollment/Batch, learning history, additional roles/Admin policy, intact academic audit                           |
| Operations      | health 200/minimal; readiness 200 only after actual Upstash write/EVAL and database/config/migration/audit gates; connection failure/drift/guard loss gives 503; request IDs correlate safe logs        |
| Infrastructure  | Verified HTTPS/renewal, short HSTS opt-in, safe secrets/logs, distributed rate limits, private asset/provider readiness, backup age/failure alert and successful isolated restore evidence              |

Explicitly test logout from each surface, followed by denied API requests and direct protected navigation on all three hosts. Test profile/theme does not grant roles. Record status/result, release/build, UTC time, approved identity labels and request IDs; never record passwords, cookies, tokens, URLs bearing secrets or private answer/Support bodies. Production provider-specific cookie/SSL/DNS/OAuth evidence cannot be replaced by local tests.

## Provider-specific acceptance

- Confirm Replit Reserved VM/Asia selection, supported Node, actual PORT mapping and 0.0.0.0 binding; verify pre-listen refusal, real shutdown/drain and bounded pool under load. Generated hostname allows only configured safe probes, never auth/business/static assets.
- Measure direct Replit→Singapore Neon warm/cold connection and transaction latency; verify CA/hostname validation, runtime/operator role separation, direct endpoint identity, serializable/advisory-lock contention, prepared statements and plan connection headroom.
- Verify actual Upstash Lua quotas across two controlled callers/processes, expiry, bounded keys, ACLs, REST outage/fail-closed 503 and quota 429. Denial must not commit business/audit mutations. Missing both credentials/read-only behavior and outage/readiness 503 need observation. No live credentials or diagnostic bodies in evidence.
- Verify Better Stack correlation/redaction and stdout fallback during timeout/outage; missing observability must not block business success or readiness. Alert on independent monitors, not transport retries.
- Verify all three exact Replit custom domains, DNS-only Cloudflare A/TXT records copied from Replit, retained replit-verify TXT, certificate issuance/renewal and HTTPS redirect. Do not assume proxying is safe even after initial issuance; require a separately approved renewal-compatible strategy.
- Complete independent encrypted dump/isolated restore and immutable audit/AdminAuthorization/history checks before traffic. Real resource/account tests remain unexecuted.
