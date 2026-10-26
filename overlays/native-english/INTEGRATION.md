# Native English/OpenDSL integration

Pack the manifest-listed `boaroot` and `userfs` files through the reviewed
pipeline. `qa/`, this guide, patches and `integration.json` are host material.
The manifest is authoritative for exact files/hashes; it currently pins 24 files.

The shared `state.js` offers only English, renders OpenDSL text branding and
keeps native form/authentication/upgrade identifiers. The Boa English-loader
patch and the English-only dictionary pruning remain paired with this overlay.
The unused foreign switch is retained as unreachable source, not offered in UI.

The previously reviewed traffic-history retirement remains: retired daily/
last-24-hour pages and endpoints return immediate producer-independent
responses; the realtime switcher does not offer them. Do not regenerate state.js
in a way that restores those links or enables retired background producers.

Quick Internet Setup retains detection, annex, PPP, wireless forms and apply
contracts, with OpenDSL display branding, local finish-page text and a neutral
favicon. The shared native-page theme now adds local CSS/JS and a viewport;
setup completion/skip and first-level overview links lead to `OpenDSL.asp`.
The original first-run condition and `index2.asp` device-map route remain.

Five dictionary **values** differ from stock, with every key unchanged:

- `QIS_pass_desc1`, `not_support_script`: OpenDSL setup/browser prose.
- `WC11b_x_Phrase_in`: neutral passphrase label.
- `FW_desc0`: reviewed local OpenDSL image/manual upload guidance.
- `FW_n2`: conditional recovery wording, without promising automatic recovery.

Original vendor service/legal attributions and backend identifiers are retained;
product branding changes do not turn a vendor service into an OpenDSL service.

## Checks and regeneration

`tools/make_native_english.py` regenerates the bounded state.js patch, including
the history-retirement links and the two dashboard menu destinations.
`tools/make_legacy_theme.py --baseline-tree PATH` applies the reviewed
presentation transform to the native HTML pages, checks baseline hashes and
refreshes the affected manifests. It refuses to overwrite new native behavior.
Edit shared presentation source in `overlays/opendsl-ui/src/`.

`qa/check_state.py`, `qa/check_monitor_retirement.py` and
`qa/check_wizard_branding.py` retain the earlier regression controls. The wizard
comparison reverses the separately checked theme/navigation edits before
checking the original bounded branding changes. `tools/qa/check_legacy_theme.py`
independently verifies all 87 native document contracts and failing mutations.

`make check-ui-browser` includes modern UI, native document and wizard rendering
checks with synthetic ASP/native states. These do not execute Boa or prove
configuration saves, WAN operation, recovery or subsequent hardware uploads.
See [UI maintenance](../../docs/BUILDING.md) for current evidence and limits.
