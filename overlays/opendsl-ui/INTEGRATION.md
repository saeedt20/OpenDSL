# Production OpenDSL interface overlay

Copy only `boaroot/` into the staged firmware filesystem. `qa/`, this note and `integration.json` are host-side review artifacts and must not be packed as device files.

The overlay now includes native HTML template replacements in addition to the
modern login/dashboard. These replace existing files; their total source bytes
are not an added firmware-size estimate. See `integration.json` for the exact
pack list/budget and the release manifest for actual compressed image size.

`src/legacy.css` and `src/legacy.js` are host sources, never packed. The two
shared packable assets are compacted CSS and a small local enhancement script.
There is no framework, external font, new raster asset, credential storage,
background polling or new modem process. Light effects use borders/gradients
and short transitions; shadows are disabled in modern and legacy interfaces.

`legacy-contracts.json` pins 87 reviewed 0.1.5 documents. The presentation
transform is reversible: remove the stylesheet tag, conditional enhancement tag, added viewport, marked
branding text and documented home redirects, and each document must hash to
its original reviewed bytes. Existing overlay ownership is preserved without
conflicting pack destinations. The data endpoints are not themed.

## Preserved device contracts

The exact official `_743` source recovered at `artifacts/source/extracted/dsl-n12e-c1_gpl/apps/public/boa-asp/src/` corroborates the shipped ASP templates:

- `request.c:1076` and `request.c:1483`: CSS/JS can load before login; `/opendsl/styles.css` and `/opendsl/login.js` need no authentication bypass change.
- `request.c:1980`: native POST handling still checks the same-origin Referer. The login page uses an ordinary same-origin POST to `/login.cgi` and does not change the backend check.
- `request.c:2049`: native login retry counting and lockout remain in the server; `boa.h:162` specifies the 300-second block period.
- `request.c:2124`: native `/cgi-bin/Main_Login.asp` canonicalization and `login.cgi` → `login.asp` mapping remain intact.
- `asp/asp_handler.c:16611`: `do_login` reads `login_authorization`, decodes Base64 `username:password`, compares the modem's configured account, and delegates session creation to `send_login_packet`.
- `asp/asp_handler.c:16403`: `http_login_header` sets the existing HttpOnly `asus_token` cookie. No token is created, read or stored by the new frontend.
- `asp/asp_handler.c:14063` and `asp/asp_handler.c:17729`: native `login_state_hook` and `login_error_info` continue to provide concurrent-session state and lockout/account errors. The latter's JSON is inserted directly as a JavaScript JSON object, avoiding the old extra single-quoted JSON-string layer. Its `page` string is intentionally ignored by the frontend; the fixed `next_page=index.asp` preserves the first-run setup decision and avoids arbitrary login return targets.
- `asp/asp_handler.c:504`: requesting the unchanged `Logout.asp` removes the native token. Both logout links point there.
- `request.c:2212`: root `*.asp` URLs are mapped internally to `/cgi-bin/`. XML is not mapped this way, so the status reader uses the shipped `/cgi-bin/ajax_status.xml` URL and `/cgi-bin/ajax_AdslStatus.asp`.

`Main_Login.asp` retains all original hidden field names: `group_id`, `action_mode`, `action_script`, `action_wait`, `current_page`, `next_page`, `login_authorization`. The original username/password limits of 20/16 characters are retained. Visible username/password inputs are disabled before submission exactly as in the stock page, so the server receives the native authorization field rather than duplicate cleartext fields. Base64 remains the existing transport representation; this overlay does not add TLS or alter the device's HTTP service.

The original first-run `index.asp` condition, `x_Setting`/`noRedirectQIS`, and `/QIS_wizard.asp` route are untouched. Only the configured-device branch now points to `/OpenDSL.asp`. The original `index2.asp` device map, all setting forms and the firmware upload backend remain present.

The firmware upload page at `/Advanced_FirmwareUpgrade_Content.asp` is linked in the sidebar, header and settings column. The security-owned upload page receives the same shared presentation assets; its native upload form and backend are unchanged. Updates remain manual firmware-file uploads through the native page; there is no new cloud updater.

## Production behavior

The dark English OpenDSL login and overview follow the existing `ui/` design but contain no demo sign-in, sample devices, sample SSID/password, pretend settings writes, IPv6 menu or traffic history menu. The overview reads status once on load and then only when Refresh is pressed. Each same-origin response has an 8-second timeout and 32-KiB limit; XML/script-shaped responses are parsed as data, never executed. Failed reads clear displayed readings and do not fall back to sample values.

Wireless/LAN/WAN/IPTV/firewall/admin changes are links to the existing server-validated pages. The native settings retain their server-validated forms and now share the OpenDSL layout. Ordinary forms stack on phones, dense rule tables scroll, and the native device map uses cards. The model has no USB port; its map has no USB placeholder cards. A local presentation script toggles the mobile menu, labels keyboard-operable native menu controls and fits same-origin setup/map frames; it does not read credentials, intercept settings forms, poll, fetch data or write storage. Native menu actions still run when the user activates them.

## Validation and remaining limits

`qa/check-browser.cjs` passed 12 grouped checks in loopback Chromium using synthetic ASP hook output and status responses: login POST encoding/field contract/Referer/no storage; account-error display; fixed local redirect; lockout/logout/concurrent-session UI; invalid login state failing closed; two bounded status reads; no dashboard writes/polling; malformed response rejection; native upgrade/logout links; layouts from 320 through 1586 px; menu keyboard behavior; no JavaScript page errors. Desktop/mobile login and panel screenshots were inspected. The script needs a host Playwright package and Chromium via `OPENDSL_PLAYWRIGHT_MODULE` and `OPENDSL_CHROMIUM`.

These checks do not execute Boa or firmware binaries, authenticate against a modem, verify cookie enforcement on a running device, measure device RAM, exercise first-run setup, submit settings, or flash/upgrade hardware. The dynamic login JSON block retains the stock server-generated state mechanism and requires inline script permission in its page CSP; the underlying C input/escaping implementation has not been declared fully secure by this integration.

## Native layout validation

Run `make check-ui-browser` with local Playwright/Chromium. The native fixture
server expands English dictionary values, supplies representative native
initialization states (for example WPA2 and no USB), and suppresses server
scripts and write handlers. It executes the new presentation script, checks
all 87 documents at desktop/phone sizes, and records screenshots/results under
`analysis/legacy-ui-016/browser/`. This is host rendering, not modem execution.
Exact native form/script/ASP preservation is checked separately against the
reviewed byte hashes; rendered appearance alone is not a behavior proof.
