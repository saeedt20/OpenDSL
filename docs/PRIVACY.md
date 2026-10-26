# Publication privacy audit

The v1.0.0 publication is prepared from a separate allowlisted source export. The development workspace was not uploaded as a repository.

## Material excluded

- Personal screenshots, device/session captures and raw network logs.
- Device configuration backups, account/ISP credentials and VPN configurations.
- Raw build environments, environment JSON files, local shell/command history and authentication files.
- Investigation/session history and raw manifests containing local filesystem paths.
- SDK/build caches and previous firmware binaries.

Private path headers were normalized in an exported patch. User-derived MAC addresses in a browser fixture were replaced with locally administered example addresses. Existing upstream copyright and author attribution remain intact. The published Git author uses only the maintainer's GitHub handle and its GitHub noreply address.

The README screenshot was produced by a synthetic host fixture. Its device names, private LAN addresses, locally administered MACs and readings are examples, and the PNG has no embedded metadata fields.

## Firmware scan

The audit examines every regular file in the freshly verified release filesystem, the header and decompressed kernel, looking for known personal identifiers, local development paths, common credential-token formats and private-key markers. It also checks the source export and release metadata. Positive scan controls must detect seeded examples; matches are classified rather than silently discarded.

No known maintainer-specific identifiers or personal credentials were found in the audited release files. This is a bounded scan for identified values and recognizable patterns, not a mathematical proof that no encoded secret can exist.

## Inherited vendor material

Some unmodified vendor binaries contain vendor development paths. A vendor-supplied `usr/etc/802_1X/PKEY/client.key` sample also triggers the private-key rule. These files are byte-identical to the original stock firmware and were not created from the maintainer's modem or personal key material. They are disclosed as inherited sample material, not described as personal secrets or silently claimed absent.

Do not reuse a bundled sample key as a secret identity. The audit does not certify the security of every legacy service, validate all vendor keys or remove vendor networking features.

## Runtime behavior

No new analytics or telemetry service was added by OpenDSL. Existing vendor functions, external support links and native networking behavior remain subject to their existing implementation and settings. This audit does not claim that the entire legacy firmware makes no outbound requests.

When submitting an issue, redact account names, public addresses, MACs and passwords. Never publish a settings backup. See [SECURITY.md](../SECURITY.md).
