# Installation

OpenDSL v1.0.0 targets **ASUS DSL-N12E C1 only**, based on vendor firmware **1.1.2.3_743**. Similar product names are not interchangeable.

## Before uploading

1. Confirm the model and hardware revision on the unit.
2. Save a private copy of the current settings and the ISP connection details needed to restore service. Never post that backup publicly.
3. Keep a suitable original vendor image and a recovery method appropriate to the unit available. OpenDSL has not established a tested recovery procedure or physical flash-partition map.
4. Use reliable power and a wired connection where possible. Obtain the image from this repository's release and verify its SHA-256 against `SHA256SUMS`.

## Native web upload

1. Open the modem's local management page and sign in.
2. Go to **Administration → Firmware Upgrade**. On the native interface this is `Advanced_FirmwareUpgrade_Content.asp`.
3. Select **`OpenDSL_DSL-N12E-C1_1.0.0.trx`** and start the upload.
4. Allow the modem to finish its own upload/reboot sequence. Do not interrupt power during an update.
5. Reopen the local page and confirm the **OpenDSL release** reads **1.0.0**. Check internet service and the functions used on your network.

This describes the intended native upload route. Local format checks do not guarantee that a receiving firmware or its update state will accept the image. If it rejects the file, record the error and stop; do not bypass model, CRC, size or signature checks. A stale vendor RSA/update state can still trigger an existing signature requirement.

## Important boundaries

- The `.trx` contains the normal kernel/rootfs update image. It is not a bootloader, configuration, calibration or all-in-one flash image.
- Do not write it to a raw flash offset or use another model's image.
- Do not reset settings automatically as part of an update. Record any settings or migration problem before choosing a separate recovery action.
- IPv6 and an on-modem OpenVPN client are not supported by this profile.
- A successful first boot does not establish recovery safety or long-term reliability. See [validation](VALIDATION.md).
