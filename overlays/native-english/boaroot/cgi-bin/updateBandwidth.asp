//
// OpenDSL: retired endpoint. The background traffic-history producer (rstats)
// is no longer started (sbin/rc candidate keeps start_rstats() as a no-op).
// This endpoint intentionally does NOT run the native bandwidth consumer:
// that handler would unlink its output file, signal the absent producer and
// block for up to five seconds inside the web management path. Direct
// requests therefore get this immediate empty-history response instead.
// Real-time network statistics remain available in the OpenDSL UI.
//
speed_history = [];
rstats_busy = 1;
