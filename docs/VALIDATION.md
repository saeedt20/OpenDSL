# v1.0.0 validation

Version **1.0.0** is the first stable release designated by the OpenDSL maintainer. The word stable is a release-channel designation, not a promise of long-term reliability or complete security coverage.

## Relationship to 0.1.27

All **841 regular files** in the verified 1.0.0 and 0.1.27-experimental filesystems were compared. Exactly one differs: `boaroot/html/opendsl/legacy.js`. Replacing the new `1.0.0` display value with `0.1.27-experimental` reproduces the old file exactly. The native Boa/rc candidates, UI behavior, stock kernel, libraries and vendor components are unchanged.

Host QA was updated to check exact stable release identities and to select stable/experimental releases consistently. The new tests also require stable to win a tie with the same experimental version, while honoring explicit version overrides.

## Local verification

| Check | Result |
|---|---|
| Image size | 7,027,427 bytes; 929,792 below the 7,957,219-byte project cap |
| Native image parser | Model, magic, bounded header, lengths, CRC and filesystem format pass |
| Stock kernel | Compressed bytes unchanged |
| Vendor packer | Reproduces the original stock image byte-for-byte twice |
| Candidate reproducibility | Independent rootfs and complete TRX packing runs agree |
| Fresh filesystem comparison | 1,109 entries; expected metadata/content identical; upload contract intact |
| Packed critical-file checks | 16/16 files identical to the reviewed inputs |
| Static/security/host tests | Pass, including native request guards and intended-reason malformed-image controls |
| Browser tests | 87 native documents × four widths = 348 renders; zero horizontal overflow; modern, generated-interface and focused regressions also pass |

The native sweep covers 1440/1024/390/320px. The generated-interface suite adds 18 renders and chart/control cases. The wizard includes its malformed-markup defect control. The browser fixtures use synthetic state and do not execute live modem/Boa operations.

## Hardware evidence

The maintainer reports approximately **two hours of operation on 0.1.27-experimental**. This is user-reported evidence. Individual DSL, Wi-Fi, IPTV, UPnP, save/reboot and subsequent-upgrade results were not separately recorded, and no independent device session was performed for this release.

Long-term load, recovery, physical flash mapping, native restore failure/success handling, live polling and every UI state remain unverified. Full design-owner approval of all pages/states is not claimed. The source comparison above explains the narrow difference between the reported predecessor and this release; it does not turn the short run into a long-term test.

## Signature and upgrade limits

The image uses the native **2RDH `.trx`** format and preserves existing model, CRC, size and conditional signature checks. It is **not ASUS-signed**. Receiving firmware state can still cause an upload rejection, including a pre-existing vendor RSA/update state. Passing the local checks does not prove acceptance or boot on a particular unit.

No OpenVPN feature, new telemetry service or measured memory-saving result is included. Original vendor binaries and legacy vulnerabilities remain outside any claim of comprehensive remediation.
