// Release manifest: verified against migration files in P1 tests/preflight.
export const migrationManifest = [
  {
    name: '20261001000000_student_foundation',
    checksum:
      '9d598402f9bc07c75c50b5844809a9f63987f9e50528a00fe39b3093a285c9e2',
  },
  {
    name: '20261001005000_instructor_role',
    checksum:
      '76285bca3b35dd0598dfec6afbd811c0ef71d73edb46f9f83a2e57aaa39cbe11',
  },
  {
    name: '20261001010000_lms_foundation',
    checksum:
      '490e45c063d52d4b9170ae5c35135faf6eeb0344ce396c7dbcb5d0856f13f6e7',
  },
  {
    name: '20261001020000_lms_entitlement',
    checksum:
      'f55a2bbebe05adfac4834b589f27d39c60f312d641b74d64feee113d1a73f3b9',
  },
  {
    name: '20261001030000_lesson_delivery_progress',
    checksum:
      '7b2448a5bb398a31e7d7215c5463f89b5b2a4180292027f4e705bbb131abc48a',
  },
  {
    name: '20261001100000_academic_engine',
    checksum:
      'f4e40022a4a720fe7c51815a861e710c3e79dbf3c267fcce1e720e4528378053',
  },
  {
    name: '20261001120000_lms_integration',
    checksum:
      '018316293e9b974b6af4d383c7b7f8fce7ad0dd0b5bf6c68feb7e9ab02c24281',
  },
  {
    name: '20261002180000_admin_a1_recordings',
    checksum:
      '8df566c84e60f69201a7897a9a8caaa29b4460fab9226b191c9442cc3d9530d4',
  },
  {
    name: '20261002190000_user_role_assignments',
    checksum:
      '1248845ba7a1a660415c7fe31842a450b960b4fa9509be27ba914bdfc2c93a15',
  },
  {
    name: '20261003000000_admin_a3_operations',
    checksum:
      '6f0a3b338670779dbba9842ac00e77329a496e87a316f2a870e97bebabe2fb5a',
  },
  {
    name: '20261003010000_admin_a4_governance',
    checksum:
      'f64fe4c2d6b91f57d5b881623cb95477ec9aea16afc7cd4454b2577e5eaf151d',
  },
] as const;
