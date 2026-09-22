"""Synthesises the promo's light background track and UI sounds (no samples, no licences).

Output: public/audio/music.mp3 (25 s), click.wav, whoosh.wav
"""
import numpy as np, soundfile as sf, os, subprocess
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
DUR = 25.0
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio')
rng = np.random.default_rng(7)
N = int(SR * DUR)
t = np.arange(N) / SR

def midi(m): return 440.0 * 2 ** ((m - 69) / 12)
def lp(x, fc, order=2): return sosfilt(butter(order, fc, 'low', fs=SR, output='sos'), x)
def hp(x, fc, order=2): return sosfilt(butter(order, fc, 'high', fs=SR, output='sos'), x)

BPM = 100
beat = 60 / BPM
bar = 4 * beat
# Cmaj9 · Am9 · Fmaj9 · G6sus — two bars each, then back home.
chords = [
    [48, 55, 59, 62, 64],
    [45, 52, 55, 59, 60],
    [41, 48, 52, 55, 57],
    [43, 50, 55, 57, 60],
]
roots = [36, 33, 29, 31]

def env_adsr(n, a, d, s, r, sustain_len):
    e = np.zeros(n)
    A, D, R = int(a * SR), int(d * SR), int(r * SR)
    S = max(0, int(sustain_len * SR) - A - D)
    seg = np.concatenate([np.linspace(0, 1, A, endpoint=False), np.linspace(1, s, D, endpoint=False), np.full(S, s), np.linspace(s, 0, R)])
    e[: min(n, len(seg))] = seg[:n]
    return e

pad = np.zeros(N)
bass = np.zeros(N)
pluck = np.zeros(N)
chord_len = 2 * bar
k = 0
start = 0.0
while start < DUR:
    ch = chords[k % 4]
    if start + chord_len > DUR - 0.01 or DUR - start < chord_len * 1.2:
        ch = chords[0]
        k = 0
    i0 = int(start * SR)
    length = min(chord_len + 1.5, DUR - start)
    n = int(length * SR)
    tt = np.arange(n) / SR
    e = env_adsr(n, 1.2, 0.8, 0.8, 1.5, min(chord_len, DUR - start))
    voice = np.zeros(n)
    for m in ch:
        f = midi(m + 12)
        for det in (-0.12, 0.0, 0.11):
            ph = rng.uniform(0, 2 * np.pi)
            fr = f * 2 ** (det / 12)
            voice += np.sin(2 * np.pi * fr * tt + ph) + 0.25 * np.sin(4 * np.pi * fr * tt + ph)
    pad[i0:i0 + n] += voice * e
    # sub bass
    fb = midi(roots[k % 4])
    eb = env_adsr(n, 0.05, 0.4, 0.6, 0.6, min(chord_len, DUR - start))
    bass[i0:i0 + n] += (np.sin(2 * np.pi * fb * tt) + 0.2 * np.sin(4 * np.pi * fb * tt)) * eb
    # arpeggio in 8ths
    notes = [ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[4] + 12, ch[3] + 12, ch[2] + 12, ch[4] + 12, ch[3] + 24]
    step = beat / 2
    for j in range(int(chord_len / step)):
        ts = start + j * step
        if ts >= DUR - 0.2: break
        m = notes[j % len(notes)]
        f = midi(m)
        ln = int(1.2 * SR)
        a = int(ts * SR)
        ln = min(ln, N - a)
        tp = np.arange(ln) / SR
        tone = (np.sin(2 * np.pi * f * tp) + 0.35 * np.sin(2 * np.pi * 2 * f * tp) * np.exp(-tp * 9) + 0.12 * np.sin(2 * np.pi * 3.01 * f * tp) * np.exp(-tp * 14))
        vel = 0.75 + 0.25 * ((j % 4) == 0)
        pluck[a:a + ln] += tone * np.exp(-tp * 4.2) * np.minimum(1, tp * 400) * vel
    start += chord_len
    k += 1

pad = lp(pad, 1800) * 0.05
bass = lp(bass, 200) * 0.22
pluck = lp(pluck, 5200) * 0.09

# soft drums: kick on 1 & 3 and a hat on off-beats, entering when the product demo starts
drums = np.zeros(N)
b = 0.0
while b < DUR:
    idx = int(b * SR)
    in_mix = 8.5 <= b <= 22.0
    if in_mix:
        # kick
        if (round(b / beat) % 2) == 0:
            ln = min(int(0.35 * SR), N - idx)
            tk = np.arange(ln) / SR
            f = 45 + 70 * np.exp(-tk * 30)
            drums[idx:idx + ln] += np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tk * 11) * 0.45
        # hat on the off-beat
        o = int((b + beat / 2) * SR)
        if o < N:
            ln = min(int(0.06 * SR), N - o)
            th = np.arange(ln) / SR
            drums[o:o + ln] += hp(rng.standard_normal(ln), 7000) * np.exp(-th * 70) * 0.07
    b += beat

mix = pad + bass + pluck + drums

# reverb: exponential noise tail
ir_len = int(2.2 * SR)
ir = rng.standard_normal(ir_len) * np.exp(-np.arange(ir_len) / SR * 2.6)
ir = lp(ir, 6000)
ir /= np.sqrt(np.sum(ir ** 2))
wet = fftconvolve(pad + pluck, ir)[:N] * 0.35
left = mix + wet
# gentle stereo: slightly delayed copy of the plucks on the right
d = int(0.012 * SR)
right = mix.copy() + wet
right[d:] += pluck[:-d] * 0.25

st = np.stack([left, right], 1)
# fades
fade_in = np.minimum(1, t / 0.8)
fade_out = np.clip((DUR - t) / 2.2, 0, 1)
st *= (fade_in * fade_out)[:, None]
st /= np.max(np.abs(st)) / 0.89
wav = os.path.join(OUT, 'music.wav')
sf.write(wav, st, SR, subtype='PCM_16')
subprocess.run(['npx', 'remotion', 'ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '192k', os.path.join(OUT, 'music.mp3')],
               cwd=os.path.join(os.path.dirname(__file__), '..'), check=True)
os.remove(wav)

# UI click: short, soft, woody
ln = int(0.07 * SR)
tc = np.arange(ln) / SR
click = (np.sin(2 * np.pi * 1850 * tc) * 0.5 + hp(rng.standard_normal(ln), 2500) * 0.3) * np.exp(-tc * 90)
click = lp(click, 6000)
click /= np.max(np.abs(click)) / 0.7
sf.write(os.path.join(OUT, 'click.wav'), np.stack([click, click], 1), SR, subtype='PCM_16')

# Keyboard: four soft key variants (a damped tick over a short noise body) and a heavier backspace.
for i, (f0, body, name) in enumerate([(2400, 0.9, 'key1'), (2100, 1.0, 'key2'), (2700, 0.8, 'key3'), (1900, 1.1, 'key4'), (1500, 1.4, 'backspace')]):
    ln = int(0.09 * SR)
    tk = np.arange(ln) / SR
    tick = np.sin(2 * np.pi * f0 * tk) * np.exp(-tk * 160)
    thud = np.sin(2 * np.pi * (180 + 30 * i) * tk) * np.exp(-tk * 55) * 0.5 * body
    noise = hp(rng.standard_normal(ln), 1800) * np.exp(-tk * 120) * 0.35
    k = lp(tick + thud + noise, 7000)
    k /= np.max(np.abs(k)) / 0.6
    sf.write(os.path.join(OUT, f'{name}.wav'), np.stack([k, k], 1), SR, subtype='PCM_16')

# Quick whip for hard cuts: a short, bright noise swish
ln = int(0.32 * SR)
tw = np.arange(ln) / SR
sw = sosfilt(butter(2, [1500, 7000], 'band', fs=SR, output='sos'), rng.standard_normal(ln)) * np.sin(np.pi * tw / tw[-1]) ** 2
sw /= np.max(np.abs(sw)) / 0.5
sf.write(os.path.join(OUT, 'swish.wav'), np.stack([sw, np.roll(sw, 150)], 1), SR, subtype='PCM_16')

# Whoosh for the theme wipe: filtered noise sweeping up then down
ln = int(0.9 * SR)
tw = np.arange(ln) / SR
noise = rng.standard_normal(ln)
out = np.zeros(ln)
blk = 1024
for i in range(0, ln, blk):
    x = tw[i]
    fc = 300 + 3500 * np.sin(np.pi * min(1, x / 0.8)) ** 2
    seg = noise[max(0, i - 2048): i + blk]
    y = sosfilt(butter(2, [fc * 0.6, fc * 1.4], 'band', fs=SR, output='sos'), seg)
    out[i:i + blk] = y[-len(out[i:i + blk]):]
env = np.sin(np.pi * np.clip(tw / 0.85, 0, 1)) ** 1.5
wh = out * env
wh /= np.max(np.abs(wh)) / 0.6
sf.write(os.path.join(OUT, 'whoosh.wav'), np.stack([wh, np.roll(wh, 200)], 1), SR, subtype='PCM_16')
print('ok')
