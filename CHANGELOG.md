# Changelog

## 1.0.0 — 2026-10-26

First stable OpenDSL release for the ASUS DSL-N12E C1, promoted from the verified 0.1.27-experimental code.

- Displays `1.0.0` in the firmware interface.
- Retains the responsive graphite UI, Network Map, native administration pages and local manual-update route.
- Includes the MAC-summary, Traffic Monitor, native check-marker, branding/navigation and login-feedback corrections.
- Adds the 16px separation between the Connected devices heading divider and list.
- Includes authenticated app configuration restore and the scoped pre-login SVG allowance in the reviewed Boa candidate.
- Preserves the stock kernel, vendor networking components and native upload validation.
- Adds a clean public source export, privacy documentation, build recipes and corresponding upstream source availability.

The compiled firmware filesystem differs from 0.1.27-experimental in exactly one regular file: `legacy.js`. Replacing its `1.0.0` label with `0.1.27-experimental` reproduces the previous file exactly. Host checks were updated to recognize stable version identities.

Testing remains bounded: approximately two hours of maintainer-reported operation on the predecessor build, plus the documented automated host and packed-image checks. No long-term, recovery or independently observed hardware validation is claimed.
