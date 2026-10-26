#!/bin/sh
# OpenDSL security overlay (review A01 fix): the online-update network path is
# retired. This guard reports retirement by exiting nonzero and deliberately
# performs NO tcapi/configuration writes:
#   - writing WebCustom_Entry webs_state_error=1 would make the next otherwise
#     valid MANUAL upload fail cfg_manager's operation-2 gate, which requires
#     webs_state_error "0";
#   - writing webs_rsa_state_upgrade=1 would fake a completed signed-upgrade
#     state.
# The native controller honours a nonzero guard result and returns before any
# service-stop, upgrade-state or commit action
# (build/native/boa-retire-online-update-controller.patch), so nothing else is
# triggered. The local firmware upload path stays fully intact.
set -u
echo "Online updates are retired in this image; use the local firmware upload page." >&2
exit 1
