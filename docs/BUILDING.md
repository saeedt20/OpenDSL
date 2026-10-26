# Source and build process

OpenDSL uses a legacy ASUS/MediaTek SDK, a stock compressed kernel and a separately rebuilt root filesystem. This source export includes the maintained changes and build recipes, **not a preconfigured SDK or the maintainer's build cache**. A fresh firmware build requires manual environment preparation; no one-command clean-room build is claimed.

## Quick source checks

With Python 3 and Node.js installed:

```sh
make check-source
```

These checks exercise JavaScript syntax, stable/experimental release selection, checksum-list tamper detection and pinned-container command construction. They do not compile firmware or validate hardware.

## Required upstream material

1. Download `GPL_DSL-N12E_C1_v1123743.zip` from the release or the official URL in [third-party notices](../THIRD_PARTY_NOTICES.md). Verify its published SHA-256. Extract the nested `GPL_DSL-N12E_C1_1123743.tgz` using a safe archive extractor. Keep upstream license files.
2. Obtain the original **1.1.2.3_743 DSL-N12E C1** firmware from [ASUS support](https://www.asus.com/supportonly/dsl-n12e_c1/helpdesk_download/). The reviewed raw image SHA-256 is `927d93267ef1b33a5383e9b7b046287be20922586fb489f50352e83056603f4c`.
3. Import that exact image using `tools/inspect_firmware.py` into `analysis/verified/`. Its CLI enforces the reviewed baseline. Extracted regular-file analysis copies have normalized permissions and omitted device/symlink objects: **never repack that analysis tree**.

The expected SDK reference location is `artifacts/source/extracted/dsl-n12e-c1_gpl/`; a writable build copy goes in `build/native/sdk/`. The original source and stock firmware remain immutable inputs.

## Native compilation

Use the SDK's `dsl-n12e-c1` profile, original MIPS/uClibc toolchain and vendor libraries. The exact modified `services.c`, `request.c`, `asp_handler.c` and `parsers.c` are supplied under `native-source/`; the corresponding patches and `build/native/rebuild-native.py` reconstruct those changes from upstream.

The native recipes expect:

- The nested MIPS toolchain under `build/native/toolchain/mips-linux-uclibc`.
- Bison 2.5 and the SDK's flex 2.5.35 in the locations used by `build-native.py`. The Bison host compatibility patch is included.
- The original SDK libraries restored to the linker locations listed in `dependency-inputs.json`.
- The vendor make environment generated **inside the isolated container**, using `make -f Project/MakeFile_Main -f /work/driver.mk native-dump PROFILE=dsl-n12e-c1 CUSTOM=RT`. Do not reuse or publish an unrelated shell environment.

`run-container.py` mounts the source/toolchain read-only where appropriate, disables networking, drops capabilities and never executes a generated MIPS binary. `verify-native.py` checks the ELF format, interpreter, library dependencies, source identities and absence of new undefined symbols. Rebuilt Boa timestamps and the documented parser-generator difference can prevent a stock-byte-identical baseline; that is not a reason to skip compatibility checks.

## Packing and validation

The build environment is described by `tools/firmware-build.Dockerfile`. The release was built with the recorded immutable container ID `sha256:726a561f12fa35cf2b5a7b639927d64558e1599f92be28845de3312c546b2df1`. Building the Dockerfile later may produce a different ID because package repositories change. Review the resulting environment and update its identity consistently in the host and native wrappers; do not remove the identity checks.

Before packing, prepare the vendor tools with `build_vendor_tools.py`, obtain the stock filesystem metadata in one fakeroot extraction, and create a reviewed native `FREEZE.json` containing the output/recipe paths, sizes and SHA-256 values. The packing scripts expect `build/stock-check2.json`, the verified stock image regions, per-overlay `integration.json` declarations, vendor-tool hashes and the native freeze. None of these machine-local build outputs is supplied as a fake ready-to-use cache.

With those reviewed prerequisites and the immutable native-behavior QA fixtures available, the maintained pipeline is:

```sh
python3 tools/make_legacy_theme.py --baseline-tree PATH_TO_REVIEWED_BASELINE --release 1.0.0
make check-source
make check-ui-browser CURRENT_VERSION=1.0.0
make release CURRENT_VERSION=1.0.0
make release-verify CURRENT_VERSION=1.0.0
make check CURRENT_VERSION=1.0.0
```

The full host/browser gates need the reviewed baseline fixtures and existing Playwright/Chromium prerequisites. Those historical test inputs are separate from the runtime source export; source-only checks do not claim their coverage.

Packing extracts the original rootfs freshly inside fakeroot, applies the declared overlays and native candidates, preserves filesystem metadata, and packs with the vendor SquashFS/TRX tools. Two independent candidate runs must agree. The vendor packer must also reproduce stock byte-for-byte. Full release verification freshly extracts the resulting image and checks its contents, metadata and native upload form.

Use a new version/output directory for any subsequent build; never overwrite a published image. The stock kernel, model identity, reserved header fields and native upload checks must remain intact. This process builds the normal update image, not a bootloader, calibration or all-in-one image. See [validation](VALIDATION.md) for what the v1.0.0 release actually passed.
