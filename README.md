# OpenDSL

**A modern, local management interface for the ASUS DSL-N12E C1.**

[![Release](https://img.shields.io/github/v/release/saeedt20/OpenDSL)](https://github.com/saeedt20/OpenDSL/releases/latest)
[![Hardware](https://img.shields.io/badge/hardware-DSL--N12E_C1-blue)](#supported-hardware)
[![License](https://img.shields.io/badge/OpenDSL_source-GPL--2.0--or--later-blue)](LICENSE)

[Download v1.0.0](https://github.com/saeedt20/OpenDSL/releases/tag/v1.0.0) · [Installation](docs/INSTALLATION.md) · [Validation](docs/VALIDATION.md) · [Building](docs/BUILDING.md)

OpenDSL keeps the modem's native DSL and networking stack while replacing its management interface with a responsive graphite design. Version **1.0.0** is the first stable OpenDSL release, based on **0.1.27-experimental**, with the release identity updated inside the interface.

This is an independent community project. It is not an ASUS release, is not ASUS-signed, and is not affiliated with ASUS. See the [validation record](docs/VALIDATION.md) for the limits of the stable designation: the maintainer reports about two hours of operation on the predecessor build; long-term and recovery testing are not established.

![OpenDSL Network Map with connected devices and gateway details](docs/images/network-map.png)

*The screenshot uses synthetic device names, addresses and readings. It contains no live network information.*

## What changes

- **Responsive interface:** desktop, tablet and narrow phone layouts, consistent navigation, page transitions and reduced-motion support.
- **Network Map:** visual topology, connected-device previews, gateway details and native Wi-Fi controls.
- **Native settings:** redesigned administration, firmware upload, backup/restore, DSL settings, firewall and diagnostic pages.
- **Focused fixes:** clean MAC readouts, reliable Traffic Monitor layout, navigation-owned branding, visible login errors and honest unavailable-data states.
- **Local maintenance:** reviewed firmware uploads use the native manual-upload page. The retired online updater is disabled.

The image preserves the stock compressed kernel, vendor DSL/Wi-Fi components and native upload validation. The source also includes the reviewed Boa authentication/configuration-restore corrections and the existing English/IPv4 profile. It does not add an OpenVPN client, new telemetry service or a claim that every legacy vulnerability is fixed. No measured RAM reduction is claimed.

## Supported hardware

| Item | Support |
|---|---|
| Exact model | **ASUS DSL-N12E C1 / DSL-N12E_C1** |
| Vendor base | **1.1.2.3_743** |
| Firmware format | Native **2RDH `.trx`**, kernel + root filesystem |
| Interface | English; local browser management |
| Networking retained | Native DSL, IPv4, 2.4 GHz Wi-Fi and IPTV components |
| Other ASUS models or revisions | **Not supported** |

This is a vendor-based firmware modification, not an OpenWrt image. Native components remain legacy software; keep management access restricted to a trusted local network.

## Download and verify

Download **`OpenDSL_DSL-N12E-C1_1.0.0.trx`** from [Releases](https://github.com/saeedt20/OpenDSL/releases/tag/v1.0.0). Use the `.trx` asset for the native firmware-upload page; the source archives are not firmware images.

| Property | v1.0.0 |
|---|---|
| Image size | **7,027,427 bytes** |
| Project policy limit | **7,957,219 bytes** |
| Headroom below that limit | **929,792 bytes** |
| SHA-256 | `3cdef80911b81c8e4410800b6d2b37d87eb999dec3591d34d97bd2ecd06bc3e4` |

```sh
sha256sum OpenDSL_DSL-N12E-C1_1.0.0.trx
```

The release also supplies `SHA256SUMS` and a minimal machine-readable manifest. A checksum verifies downloaded bytes; it is not a vendor signature. Read [installation and recovery limits](docs/INSTALLATION.md) before uploading.

## Validation and privacy

The release pipeline checks the native header, model, region sizes, CRC, stock-kernel identity, filesystem contents and metadata, and reproducible packing. UI checks cover **87 native documents at four widths: 348 renders with zero horizontal overflow**, plus modern, generated-interface and focused regression tests. Exact scope is in [VALIDATION.md](docs/VALIDATION.md).

Publication uses a clean source export and a fresh firmware privacy scan. Personal screenshots, device backups, local paths, captured environments and session logs are excluded. Test addresses were replaced with synthetic examples. Stock vendor sample material is distinguished from personal secrets; see [PRIVACY.md](docs/PRIVACY.md). This is a bounded audit, not a guarantee that every possible encoded secret or legacy networking behavior has been identified.

## Source and development

| Directory | Purpose |
|---|---|
| `overlays/` | Firmware changes, maintained UI source, generated assets and regression fixtures |
| `patches/` | Reviewed native and host-tool corrections |
| `native-source/` | Exact modified native source files used for the release |
| `build/native/` | Native compilation recipes and compatibility patches |
| `tools/` | Theme generation, packing, validation and source-check tools |
| `docs/` | Installation, validation, privacy and build guidance |

Run the lightweight source checks without an SDK:

```sh
make check-source
```

Firmware rebuilding needs the matching ASUS GPL archive, original stock image, legacy toolchain and a reviewed build environment. This repository does not include a preconfigured build cache. Follow [BUILDING.md](docs/BUILDING.md); do not substitute an arbitrary root filesystem or bypass a failed identity check.

When reporting a bug, include the model/revision, OpenDSL version, browser, viewport and reproduction steps. Redact account names, WAN addresses, MAC addresses and passwords. Do not attach configuration backups. See [SECURITY.md](SECURITY.md) for security reports.

## License and credits

Original OpenDSL work is available under **GPL-2.0-or-later**, unless a file says otherwise. Existing vendor and third-party files retain their own notices and licenses; the complete firmware is not relicensed as a single OpenDSL-owned work. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The matching ASUS GPL source archive is provided alongside the firmware release, with its original notices, together with this repository's modifications and build recipes. Credit to ASUS, MediaTek and the upstream projects whose software makes the modem work.

Maintained by [@saeedt20](https://github.com/saeedt20).
