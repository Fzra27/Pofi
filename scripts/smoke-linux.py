"""Validate the actual packaged app window and its shared timer on Linux CI."""
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request

base = 'http://127.0.0.1:4317'
key_file = Path(os.environ.get('POFI_SMOKE_DATA_DIR','/tmp/pofi-smoke-user')) / 'pairing-key'
end = time.monotonic() + 45
while True:
    try:
        token = key_file.read_text()
        request = urllib.request.Request(base + '/api/state', headers={'X-Pofi-Token': token})
        with urllib.request.urlopen(request, timeout=2) as response:
            state = json.load(response)
        windows = subprocess.check_output(['xwininfo', '-root', '-tree'], text=True)
        if 'Pofi' in windows:
            break
    except (OSError, ValueError, subprocess.CalledProcessError):
        pass
    if time.monotonic() > end:
        raise RuntimeError('Packaged app did not show its native window and serve the timer')
    time.sleep(.25)

assert state['mode'] == 'focus'
assert state['focusMinutes'] == 45

def command(action):
    request = urllib.request.Request(base + '/api/command', data=json.dumps({'action': action}).encode(), headers={'X-Pofi-Token': token, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.load(response)

assert command('toggle')['running']
assert command('early-walk')['mode'] == 'break'
state = command('early-focus')
assert state['mode'] == 'focus' and state['running']
assert state['sessions'] == 2
assert not command('toggle')['running']
print('PASS: packaged Linux app; real Electron window, focus/walk/early return and shared API verified.')
