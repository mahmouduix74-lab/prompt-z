"""Generates the web promo's voice-over with Kokoro-82M (Apache-2.0), voice af_heart.

Lines and their start times live in src/web/timeline.json; this writes one trimmed WAV per
line to public/vo/ plus durations.json, which the composition uses for timing and captions.

Needs: pip install kokoro-onnx soundfile numpy, and the model files from
https://github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0):
kokoro-v1.0.onnx and voices-v1.0.bin, in $KOKORO_DIR (default: ./kokoro).
"""
import json, os
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'public', 'vo')
MODEL_DIR = os.environ.get('KOKORO_DIR', os.path.join(HERE, 'kokoro'))

# Slightly slower than default for the short lines so they don't sound clipped.
SPEED = {'l1': 0.95, 'l2': 1.0, 'l3': 0.95, 'l12': 0.92}

tl = json.load(open(os.path.join(ROOT, 'src', 'web', 'timeline.json')))
k = Kokoro(os.path.join(MODEL_DIR, 'kokoro-v1.0.onnx'), os.path.join(MODEL_DIR, 'voices-v1.0.bin'))
os.makedirs(OUT, exist_ok=True)
durations = {}
for line in tl['vo']:
    samples, sr = k.create(line['text'], voice='af_heart', speed=SPEED.get(line['id'], 0.97), lang='en-us')
    loud = np.where(np.abs(samples) > 0.01)[0]
    samples = samples[max(0, loud[0] - int(0.03 * sr)): loud[-1] + int(0.08 * sr)]
    sf.write(os.path.join(OUT, f"{line['id']}.wav"), samples, sr)
    durations[line['id']] = round(len(samples) / sr, 3)
    print(line['id'], durations[line['id']], line['text'])
json.dump(durations, open(os.path.join(OUT, 'durations.json'), 'w'), indent=1)
