# IPv4/IPTV runtime overlay — prepared, not hardware-tested

Pack **only `rootfs/`** as firmware filesystem replacements. `qa/`, `source-patches/`, this note and `integration.json` are host review material. The UI overlay remains separate and unchanged.

Runtime replacements:

- `userfs/profile.cfg`: empties the 14 active `TCSUPPORT_IPV6*`, MLD proxy/snooping, DS-Lite, 6RD and option-212 shell flags. Other profile lines are preserved; IGMP, Wi-Fi multicast, port binding, VLAN tagging, ATM/application QoS, hardware NAT and DSL/Wi-Fi drivers remain enabled.
- `usr/etc/init.d/rcS`: after `mount -a`, before driver/config-manager startup, guarded writes set `default` then `all` `disable_ipv6=1`, `accept_ra=0`, and `autoconf=0`. No timer or daemon is added. Apart from that inserted block, the file is identical to stock.
- `usr/script/wan_start.sh`: after sourcing the current generated PVC config, forces only the shell-local `IPVERSION=IPv4`; after existing custom PPP options, adds `noipv6` to disable IPv6CP. The stock PPP binary advertises `noipv6`; exact vendor pppd source documents that option. Original account/password/PVC/ATM rates/MTU/VLAN/IPTV fields and the newer IPTV bridge/port binding logic remain intact. This does not substitute the older `wan_start_ipv4.sh`.
- `usr/script/wan_start_ipv6.sh`, `ipv6rd_start.sh`, `dslite_start.sh`: read the shipped profile and return before their original network changes when the corresponding disabled flag is empty. This prevents persisted old IPv6 settings from starting these helper paths or replacing the IPv4 default route through DS-Lite.

There are no added `tcapi set/save/commit`, ROM-file changes or factory resets. The existing native WAN script's runtime state updates and `tcapi commit IPTV` activation are retained verbatim; they were not introduced by this overlay. Saved user settings are not migrated or erased. Existing custom PPP options are retained, with the explicit IPv4-only policy appended.

## Important limits

The stock kernel/driver ABI and `CONFIG_IPV6=y` remain. This is **not an IPv6-free kernel** and no measured RAM savings are claimed.

The exact vendor kernel has important deviations from modern Linux behavior:

- `linux/net/ipv6/addrconf.c:3950` propagates `all/disable_ipv6` into existing interface flags and the default for new interfaces; new interface configuration copies the default at line356.
- `linux/net/ipv6/ip6_input.c:79` drops received IPv6 packets when the global/interface disable flag is set.
- However, `addrconf.c:3923` has the device down/up notification body under `#if 0`. `addrconf_dev_config()` at line2202 still creates link-local addresses without a disable check. Consequently these sysctls do not prove that all kernel IPv6 addresses, timers, outgoing MLD reports or IPv6 RAM structures disappear. Layer-2 bridge forwarding is not changed by this overlay.
- The unchanged native `cfg_manager` includes direct `dhcp6c`, `dhcp6s`, `radvd` and MLD-related call paths. Empty shell profile flags do not recompile those branches or establish that they never attempt to launch a daemon from saved settings. No replacement/stub daemon binary, process-kill loop or configuration-manager race was added. Live process and packet checks remain necessary; do not describe this candidate as complete removal of IPv6/MLD.

The early all/default writes avoid adding repeated concurrent sysctl changes during WAN setup. No live device, modem credentials, network interfaces, real host `/proc`, or firmware executables were accessed by the tests.

## English dictionary source guard

`source-patches/0004-boa-english-only-dictionary.patch` modifies exact vendor `apps/public/boa-asp/src/asp/parsers.c`, whose actual loader uses `LanguageSwitch_Entry.Type`/`detected_lang_type`. It opens `EN.dict` directly and makes `islangChanged()` return0, so a saved non-English choice cannot reference an omitted dictionary or repeatedly reload it. It keeps the parser and optional ODM substitution logic, with no configuration writes. The native source-recovery agent applied this patch separately in its build copy; it is not a shell overlay or a binary edit. Source archives/extraction remain unchanged.

## Validation completed

- All six runtime replacement files pass `sh -n`.
- `python3 overlays/lean-ipv4/qa/check_runtime.py` passes six grouped fixture checks: runtime flags; sysctl presence/absence and ordering; exact preservation of other rcS/WAN content; disabled helper paths; complete WAN startup with saved dual-stack/IPv6-only PPP choices; IPTV bridge/PVC/ATM QoS/port binding/account/MTU preservation. Every system command is a host stub, filesystem paths are relocated into a temporary fixture and original saved fixture config bytes are unchanged.
- `python3 overlays/lean-ipv4/qa/check_english_loader.py` compiles the exact parser source on the host under ASan/UBSan with a stubbed config API and relocated dictionary path. Stock parser fails with only EN.dict and a saved foreign language; patched parser passes seven language choices (0,1,2,3,14,19,99), with no configuration reads/writes or dictionary reload requests.

These artifacts are prepared for review/staging. They have not been packed into a new image or tested/flashed on hardware by this agent. No test servers, background commands or running exec sessions remain from this work.
