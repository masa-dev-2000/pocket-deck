def requirements(button):
    kind = button.get('type')
    if kind in ('navigate', 'profile'): return set()
    if kind in ('touchpad', 'wheel', 'click'): return {'pointer'}
    if kind == 'text': return {'text'}
    if kind == 'macro':
        return {capability for step in button['steps'] for capability in
                (['text'] if step['kind'] == 'text' else ['keyboard'] if step['kind'] in ('shortcut', 'press', 'release') else ['pointer'] if step['kind']=='click' else [])}
    return {'keyboard'}

def require(status, capabilities):
    if any(status.get(capability) is not True for capability in capabilities):
        raise ValueError(status.get('reason') or 'PC側Pocket Deckで入力を許可してください。')
