"""Logical keys shared by every OS. Stored configurations keep their names."""
KEYS = {name:name for name in ('CTRL','SHIFT','ALT','WIN','ENTER','TAB','ESC',
    'SPACE','BACKSPACE','DELETE','LEFT','UP','RIGHT','DOWN','HOME','END',
    'PAGEUP','PAGEDOWN','VOLUMEUP','VOLUMEDOWN','MUTE','PLAYPAUSE')}
KEYS['WIN'] = 'SUPER'
KEYS.update({c:c for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'})
KEYS.update({f'F{i}':f'F{i}' for i in range(1,25)})
MODIFIERS = frozenset(('CTRL','SHIFT','ALT','SUPER'))
