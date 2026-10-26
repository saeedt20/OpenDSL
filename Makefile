.PHONY: check-source check check-production-ui check-ui-browser \
        inventory release release-verify

# Normal gate: PRODUCTION sources and frozen-input contracts only (review A04:
# retired demo sources are excluded).
check:
	python3 tools/check_baseline.py
	python3 tools/check_size_gate.py
	python3 tools/check_frontend_contracts.py
	python3 tools/qa/check_legacy_theme.py
	python3 overlays/native-english/qa/check_state.py
	python3 overlays/native-english/qa/check_monitor_retirement.py
	python3 overlays/native-english/qa/check_wizard_branding.py
	python3 overlays/security/qa/check_guard_boundary.py
	python3 overlays/security/qa/check_boot_state_neutralization.py
	python3 overlays/lean-ipv4/qa/check_runtime.py
	python3 overlays/lean-ipv4/qa/check_english_loader.py
	python3 patches/tests/check_boa_cookie.py
	python3 patches/tests/check_boa_request_security.py
	python3 patches/tests/check_retired-controller.py
	python3 tools/qa/check_verifier_controls.py
	python3 tools/qa/check_container_pin.py
	python3 tools/qa/check_release_selection.py
	python3 tools/qa/check_release_checksums.py

# Browser suites are separate targets: the production suite runs the production
# frontend sources; missing optional browser prerequisites produce an explicit
# SKIPPED-INCOMPLETE status (exit 2), never a pass.
check-production-ui:
	python3 tools/run_production_ui_check.py

# The production browser suite plus the wizard render gate (real DOM parse of
# markup, with the nested-comment negative control).
check-ui-browser: check-production-ui
	node overlays/native-english/qa/check_wizard_render.cjs

inventory:
	python3 tools/inventory.py analysis/verified/rootfs --out analysis/component-inventory.json

# One release run: staging (per run in the pinned build container, one fakeroot
# session each), vendor trx no-change roundtrip proof, packing, header/7z/metadata
# gates and the generated release-manifest.json/checksums.txt/RELEASE.md.
# Review C01: an explicit shared CURRENT_VERSION is passed to BOTH build and
# validate-only so the bare make targets cannot silently select a superseded
# version; override with `make release CURRENT_VERSION=0.1.0-experimental`.
CURRENT_VERSION ?= 1.0.0
# Recheck D05: every QA gate that inspects a built release must examine the
# SAME release that build/release-verify target via CURRENT_VERSION — never a
# lexicographic "newest" pick — and follow an explicit override.
# (tools/qa/release_selection.py gives the numeric ordering; this export is
# the precedence signal itself.)
export OPENDSL_RELEASE := $(CURRENT_VERSION)
release:
	python3 tools/build_image.py --version $(CURRENT_VERSION)

# Re-run the static gates + full filesystem re-verification over the release
# directory selected by the same shared CURRENT_VERSION (review C01).
release-verify:
	python3 tools/build_image.py --version $(CURRENT_VERSION) --validate-only

# Lightweight checks need no firmware, SDK or local build cache.
check-source:
	node --check overlays/opendsl-ui/src/legacy.js
	node --check overlays/opendsl-ui/boaroot/html/opendsl/panel.js
	python3 tools/qa/check_release_selection.py
	python3 tools/qa/check_release_checksums.py
	python3 tools/qa/check_container_pin.py
