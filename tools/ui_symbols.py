"""Original OpenDSL line symbols from the approved revision-2 handoff artwork.

The shapes are the hand-drawn handoff glyphs (design/ui-handoff/icons), reduced
to 24x24 line paths so they can be reused as CSS masks. No icon library, font
or third-party dependency is introduced; the glyph set ships inside the shared
local stylesheet.
"""
from urllib.parse import quote

GLYPHS = {
    'activity':
        '<path d="M2 12h5l3-8 4 16 3-8h5"/>',
    'add':
        '<path d="M12 4v16M4 12h16"/>',
    'back':
        '<path d="m15 5-7 7 7 7"/>',
    'backup':
        '<path d="M4 3h13l3 3v15H4Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
    'calendar':
        '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2M12 14h2M7 18h2"/>',
    'check':
        '<path d="m5 12 5 5L20 7"/>',
    'chevron':
        '<path d="m9 5 7 7-7 7"/>',
    'clock':
        '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    'close':
        '<path d="m6 6 12 12M18 6 6 18"/>',
    'copy':
        '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    'devices':
        '<rect x="2" y="4" width="15" height="12" rx="1.5"/><path d="M9.5 16v4M6 20h7"/><rect x="17" y="11" width="5" height="10" rx="1"/>',
    'document':
        '<path d="M5 3h9l5 5v13H5ZM14 3v6h5M8 13h8M8 17h6"/>',
    'download':
        '<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
    'dsl':
        '<rect x="4" y="3" width="16" height="12" rx="2.5"/><path d="M8 3v5M12 3v5M16 3v5M8 15v3h8v-3M12 18v3"/>',
    'error':
        '<circle cx="12" cy="12" r="9"/><path d="m8 8 8 8M16 8l-8 8"/>',
    'ethernet':
        '<path d="M4 3h16v13l-4 5H8l-4-5ZM8 3v6M12 3v6M16 3v6M8 14h8"/>',
    'expand':
        '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    'eye':
        '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    'filter':
        '<path d="M3 4h18l-7 8v7l-4 2v-9Z"/>',
    'firewall':
        '<path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6Z"/>',
    'gateway':
        '<path d="M7 7a7 7 0 0 1 10 0M9.5 9.5a3.5 3.5 0 0 1 5 0"/><rect x="3" y="13" width="18" height="8" rx="2.5"/><path d="M7 17h.01M10 17h.01M16 17h2"/>',
    'guests':
        '<circle cx="9" cy="7" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v2"/>',
    'help':
        '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 1 1 5 3c-2 1-2 2-2 3M12 17h.01"/>',
    'info':
        '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    'internet':
        '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M4.5 7.5h15M4.5 16.5h15"/>',
    'iptv':
        '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4M8 21h8"/>',
    'key':
        '<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9M16 16l3-3M19 19l3-3"/>',
    'lan':
        '<path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10"/>',
    'lock':
        '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    'logout':
        '<path d="M10 4H4v16h6M9 12h12m-4-4 4 4-4 4"/>',
    'logs':
        '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    'mail':
        '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    'menu':
        '<path d="M4 6h16M4 12h16M4 18h16"/>',
    'network':
        '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="2" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M5 16v-4h14v4"/>',
    'pause':
        '<path d="M8 4v16M16 4v16"/>',
    'play':
        '<path d="m7 3 14 9-14 9Z"/>',
    'power':
        '<path d="M12 2v10M6 5a9 9 0 1 0 12 0"/>',
    'privacy':
        '<path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6Z"/><rect x="9" y="11" width="6" height="5" rx="1"/><path d="M10 11V9a2 2 0 0 1 4 0v2"/>',
    'reboot':
        '<path d="M20 10a8 8 0 1 0-1 8M20 3v7h-7"/>',
    'remove':
        '<path d="M4 7h16M9 3h6l1 4H8ZM6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
    'route':
        '<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h9a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h4M10 18l3 3-3 2"/>',
    'search':
        '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
    'settings':
        '<path d="m10 3-.5 2-2 1-2-.5-2 3 1.5 1.5v3L3.5 15l2 3 2-.5 2 1 .5 2h4l.5-2 2-1 2 .5 2-3-1.5-2v-3L21 8.5l-2-3-2 .5-2-1-.5-2Z"/><circle cx="12" cy="12" r="3"/>',
    'setup':
        '<path d="m4 18 10-10 3 3L7 21ZM12 10l3 3M5 3v5M2.5 5.5h5M19 2v4M17 4h4M20 15v4M18 17h4"/>',
    'signal':
        '<path d="M4 20v-3M9 20v-7M14 20V9M19 20V4"/>',
    'tools':
        '<path d="M14.5 3.7a5.3 5.3 0 0 0-6.4 6.6l-4.4 4.4a2.4 2.4 0 0 0 3.4 3.4l4.4-4.4a5.3 5.3 0 0 0 6.6-6.4l-3.3 3.3-3.2-3.2Z"/><circle cx="5.4" cy="16.4" r=".55" fill="black" stroke="none"/>',
    'traffic':
        '<path d="M3 20h18M4 15l5-6 4 4 7-9M16 4h4v4"/>',
    'upload':
        '<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>',
    'warning':
        '<path d="m12 3 10 18H2Z"/><path d="M12 9v5M12 17h.01"/>',
    'wifi':
        '<path d="M3 8a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0M9 16a4.5 4.5 0 0 1 6 0"/><circle cx="12" cy="20" r=".7" fill="black" stroke="none"/>',
}


def glyph_svg(name):
    """Return the standalone SVG document for one handoff glyph."""
    paths = GLYPHS[name]
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" '
            'stroke="black" stroke-width="1.7" stroke-linecap="round" '
            'stroke-linejoin="round">' + paths + '</svg>')


def symbol_css(names=None):
    """Emit the mask variables used by the shared stylesheets.

    ``names`` limits the emitted set to the glyphs a stylesheet actually uses.
    The glyphs are inlined as data URIs; pages that ship a Content Security
    Policy use :func:`symbol_file_css` instead, because a strict
    ``img-src 'self'`` blocks data URIs.
    """
    values = []
    for name, paths in GLYPHS.items():
        if names is not None and name not in names:
            continue
        values.append('--od-i-' + name + ':url("data:image/svg+xml,' + quote(glyph_svg(name), safe='') + '")')
    return ':root{' + ';'.join(values) + '}\n'


def symbol_file_css(names=None, prefix='/opendsl/symbols/'):
    """Emit mask variables that reference shipped SVG files.

    The same-origin file reference keeps a strict Content Security Policy
    (``img-src 'self'``) working for the modern overview and sign-in pages.
    """
    values = []
    for name in GLYPHS:
        if names is not None and name not in names:
            continue
        values.append('--od-i-' + name + ':url("' + prefix + name + '.svg")')
    return ':root{' + ';'.join(values) + '}\n'


def symbol_files(names=None):
    """Return {filename: svg} for the shipped symbol files."""
    files = {}
    for name in GLYPHS:
        if names is not None and name not in names:
            continue
        files[name + '.svg'] = glyph_svg(name)
    return files


# Glyphs referenced by the modern overview and sign-in pages.
MODERN_SYMBOLS = (
    'gateway', 'network', 'guests', 'traffic', 'lock', 'wifi', 'lan', 'internet',
    'firewall', 'settings', 'logs', 'tools', 'setup', 'reboot', 'logout', 'menu',
    'chevron', 'devices', 'eye', 'info', 'activity', 'power', 'key', 'privacy',
)
