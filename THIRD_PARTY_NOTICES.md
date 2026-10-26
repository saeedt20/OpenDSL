# Licensing and upstream source

## OpenDSL changes

Original OpenDSL code, documentation and modifications are offered under **GPL-2.0-or-later**, unless otherwise stated in a file. The license text is in [LICENSE](LICENSE). Copyright 2026 OpenDSL contributors.

This notice does not replace existing copyright headers, grant ownership of third-party software or relicense the complete firmware as one work.

## Vendor base

The base is ASUS DSL-N12E C1 firmware **1.1.2.3_743**. Matching source was obtained from ASUS's publicly provided GPL archive:

- Official archive: [GPL_DSL-N12E_C1_v1123743.zip](https://dlcdnets.asus.com/pub/ASUS/wireless/DSL-N12E_C1/GPL_DSL-N12E_C1_v1123743.zip).
- Archive size: **342,716,850 bytes**.
- SHA-256: `adfddf4b12489df6ab10b1b627678dac609da2f228aeb37ecbcb3bccb0a39f84`.
- A copy is attached to the [v1.0.0 release](https://github.com/saeedt20/OpenDSL/releases/tag/v1.0.0), alongside the binary and OpenDSL source snapshot.

The archive includes upstream source, licensing notices, profiles and the legacy toolchain. Combine it with this repository's exact modified native source, overlays, patches and compilation scripts to inspect the release's changes. [BUILDING.md](docs/BUILDING.md) describes the maintained build process and its environment requirements.

## Component boundaries

- **Linux, Boa, BusyBox, dnsmasq, iptables and other upstream projects** retain the licenses and attribution supplied with their source. Some components use different GPL versions or other licenses; consult each component's original files.
- **ASUS/MediaTek components, libraries and drivers** retain their original ownership, notices and licensing. Some functionality remains available only as vendor-supplied binaries; no source availability or additional rights are invented for those components.
- **Host build dependencies** are separate from the installed modem software. The build recipes identify the toolchain and compatibility patches; the release does not claim to have rebuilt every vendor binary from source.

GPL-covered object-code distribution requires the corresponding source and compilation/installation scripts under the applicable terms. The upstream archive and OpenDSL source are made available with the release for that purpose; this is not a claim that all third-party licensing questions have been independently legally certified. See the [GNU GPLv2 text](https://www.gnu.org/licenses/old-licenses/gpl-2.0.en.html).

ASUS and other product names are used to identify compatibility. OpenDSL is not affiliated with or endorsed by ASUS or MediaTek.
