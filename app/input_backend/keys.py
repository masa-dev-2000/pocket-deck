"""Logical keys shared by every OS. Stored configurations keep their names."""
KEYS = {name:name for name in ('CTRL','SHIFT','ALT','WIN','ENTER','TAB','ESC',
    'SPACE','BACKSPACE','DELETE','LEFT','UP','RIGHT','DOWN','HOME','END',
    'PAGEUP','PAGEDOWN','VOLUMEUP','VOLUMEDOWN','MUTE','PLAYPAUSE')}
KEYS['WIN'] = 'SUPER'
KEYS.update({c:c for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'})
KEYS.update({f'F{i}':f'F{i}' for i in range(1,25)})
MODIFIERS = frozenset(('CTRL','SHIFT','ALT','SUPER'))
WINDOWS_ONLY = frozenset({'NUMLOCK','CAPSLOCK','SCROLLLOCK','INSERT','PRINTSCREEN','PAUSE','APPS','NUMPADENTER','NUMPADDECIMAL','NUMPADADD','NUMPADSUBTRACT','NUMPADMULTIPLY','NUMPADDIVIDE','OEM_COMMA','OEM_PERIOD','OEM_2','OEM_MINUS','OEM_PLUS','OEM_1','OEM_3','OEM_4','OEM_5','OEM_6','OEM_7','OEM_8','OEM_102'} | {f'NUMPAD{i}' for i in range(10)})
KEYS.update({name:name for name in WINDOWS_ONLY})
NO_REPEAT = frozenset(('NUMLOCK','CAPSLOCK','SCROLLLOCK','INSERT','PRINTSCREEN','PAUSE'))
