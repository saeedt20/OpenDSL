# Initialize Boa's optional login cookie header

`0003-boa-initialize-login-cookie-header.patch` is a one-line source patch against the exact recovered ASUS DSL-N12E C1 `_743` GPL tree. Apply with `patch -p1` from that source-tree root, in a separate build copy.

In `apps/public/boa-asp/src/asp/asp_handler.c:16465`, `http_login_header()` declares an uninitialized `set_cookie[256]`. It writes that array only when `token` is non-null, but then unconditionally reads it through both `snprintf(..., "%s", set_cookie)` and `strlen(set_cookie)`. `send_login_packet()` passes a null token on authentication failure. The source therefore reads uninitialized stack memory on that path; output disclosure, invalid response bytes or out-of-bounds reading depend on stack contents. No exploit against the running modem has been attempted or established.

The patch zero-initializes the existing array. The null-token path then appends an empty string; successful native `asus_token` cookies retain their original name and HttpOnly attribute. No authentication comparison, lockout, token generation, Referer handling, firmware upload or API contract changes.

Validation:

- `patch --dry-run -p1` accepts the exact recovered baseline source without modification.
- `python3 patches/tests/check_boa_cookie.py` extracts this exact source function and compiles host-only copies with stubbed I/O. The original null-token path produces an AddressSanitizer stack-buffer-overflow under GCC's forced automatic-variable pattern initialization, which makes the undefined uninitialized read deterministic. The patched function passes 42 cases across all five client types, token present/absent, both write channels, both charset branches and write failures under AddressSanitizer/UndefinedBehaviorSanitizer.
- Source-function SHA-256: `a9dcc66896255a0fea3c89163385f346f71f9a47b6dffdfdecaf82af8a6fdfb3`.

This patch is **not applied to the extracted source baseline or shipped native Boa binary**. Including the patch in a workspace does not fix the modem; a compatible Boa cross-build must be produced and explicitly included in a staged firmware image before claiming the change is present. The host harness does not execute firmware binaries or test native-device behavior.
