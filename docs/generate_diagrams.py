import os
import numpy as np
import matplotlib.pyplot as plt

os.makedirs("/media/documents/2025/gemini_scratch/programming_projects/Parking-/docs/diagrams", exist_ok=True)
diag_dir = "/media/documents/2025/gemini_scratch/programming_projects/Parking-/docs/diagrams"

# Style settings
plt.style.use('dark_background')
colors = {
    'bg': '#1e1e1e',
    'panel': '#2a2a2a',
    'accent': '#44ff88',
    'blue': '#44aaff',
    'yellow': '#ffbb33',
    'red': '#ff5555',
    'text': '#eeeeee',
    'muted': '#888888',
    'grid': '#333333'
}
plt.rcParams['font.family'] = 'DejaVu Sans'
plt.rcParams['text.color'] = colors['text']
plt.rcParams['axes.labelcolor'] = colors['text']
plt.rcParams['xtick.color'] = colors['text']
plt.rcParams['ytick.color'] = colors['text']

# ==============================================================================
# Diagram 0: System Architecture (Overview)
# ==============================================================================
fig, ax = plt.subplots(figsize=(10, 3.5), facecolor=colors['bg'])
ax.set_facecolor(colors['bg'])
ax.set_xlim(0, 10)
ax.set_ylim(0, 4)
ax.axis('off')

# Boxes
def draw_box(x, y, w, h, title, subtitle, color):
    rect = plt.Rectangle((x, y), w, h, facecolor='#25282a', edgecolor=color, linewidth=2, linestyle='-', zorder=2)
    ax.add_patch(rect)
    ax.text(x + w/2, y + h*0.65, title, ha='center', va='center', fontsize=11, fontweight='bold', color=color, zorder=3)
    ax.text(x + w/2, y + h*0.35, subtitle, ha='center', va='center', fontsize=8.5, color='#cccccc', zorder=3)

draw_box(0.4, 0.8, 2.4, 2.4, "1. Drivetrain & Load", "60 Hz Game Loop\nThrottle, Slip, Flywheel,\nReverse & Overrun", colors['accent'])
draw_box(3.8, 0.8, 2.5, 2.4, "2. Acoustic Source", "Tier 1: Web Audio Oscs\nTier 2: 48 kHz Worklet\nCrank Blowdown Pulses", colors['blue'])
draw_box(7.2, 0.8, 2.4, 2.4, "3. Formant Cabinet", "Stationary Body EQ\nAirbox & Runners\nExhaust Muffler Low-Pass", colors['yellow'])

# Arrows
ax.annotate("", xy=(3.8, 2.0), xytext=(2.8, 2.0), arrowprops=dict(arrowstyle="->", color=colors['muted'], lw=2.5))
ax.annotate("", xy=(7.2, 2.0), xytext=(6.3, 2.0), arrowprops=dict(arrowstyle="->", color=colors['muted'], lw=2.5))
ax.text(3.3, 2.25, "rpm, load", ha='center', fontsize=8, color=colors['muted'])
ax.text(6.75, 2.25, "raw sound", ha='center', fontsize=8, color=colors['muted'])

plt.tight_layout()
fig.savefig(f"{diag_dir}/arch_overview.png", dpi=200, facecolor=colors['bg'])
plt.close(fig)

# ==============================================================================
# Diagram 1: Low-Pass Filter Frequency Response, Q & -24 dB/oct Cascade
# ==============================================================================
fig, ax = plt.subplots(figsize=(8.2, 4.2), facecolor=colors['bg'])
ax.set_facecolor(colors['bg'])

f = np.logspace(1, 4, 1000) # 10 Hz to 10 kHz
fc = 300.0 # Cutoff at 300 Hz

for Q_label, Q, color, ls in [("High Q (Underdamped: Whistles/Rings)", 3.5, colors['red'], '-'),
                              ("Single 2nd-Order Butterworth (-12 dB/oct)", 0.707, colors['blue'], '-'),
                              ("2x Cascaded Butterworth (-24 dB/oct Rounding!)", 0.707, colors['accent'], '-')]:
    w_ratio = f / fc
    mag = 1.0 / np.sqrt((1 - w_ratio**2)**2 + (w_ratio / Q)**2)
    if "2x Cascaded" in Q_label:
        db = 40 * np.log10(mag)
        lw = 2.6
    else:
        db = 20 * np.log10(mag)
        lw = 2.0
    ax.semilogx(f, db, label=f"{Q_label} [Q={Q}]", color=color, lw=lw, linestyle=ls)

ax.axvline(fc, color='#666666', linestyle='--', label=f'Cutoff $f_c$ = {int(fc)} Hz')
ax.axhline(0, color='#444444', linestyle=':')
ax.axhline(-36, color=colors['blue'], linestyle='-.', alpha=0.6)
ax.text(2100, -33, "1x LP @ 2.4 kHz: -36 dB", color=colors['blue'], fontsize=8)
ax.annotate("2x Cascade @ 2.4 kHz: -72 dB!\n(Zero high-freq synth buzz)", xy=(2400, -72), xytext=(750, -68),
            arrowprops=dict(arrowstyle="->", color=colors['accent'], lw=1.5), fontsize=8.2, fontweight='bold', color=colors['accent'])

ax.set_title("2nd-Order (-12 dB/oct) vs. Cascaded 4th-Order (-24 dB/oct) Butterworth Low-Pass", fontsize=11.5, pad=10, color=colors['text'])
ax.set_xlabel("Frequency (Hz, logarithmic)", fontsize=10)
ax.set_ylabel("Gain (dB)", fontsize=10)
ax.set_ylim(-80, 16)
ax.grid(True, which='both', color=colors['grid'], linestyle='-', linewidth=0.5)
ax.legend(loc='lower left', framealpha=0.85, facecolor='#252525', fontsize=8.2)

plt.tight_layout()
fig.savefig(f"{diag_dir}/ch1_lowpass_response.png", dpi=200, facecolor=colors['bg'])
plt.close(fig)

# ==============================================================================
# Diagram 2: Formant Filtering Concept (Wide-Q Body Dome + Zing Formant)
# ==============================================================================
fig, (ax1, ax2, ax3) = plt.subplots(3, 1, figsize=(8.2, 6.2), facecolor=colors['bg'], sharex=True)
for a in (ax1, ax2, ax3):
    a.set_facecolor(colors['bg'])
    a.grid(True, color=colors['grid'], linestyle='-', linewidth=0.5)

freqs = np.linspace(20, 3200, 2500)

# 1. Stratified Harmonic Source (Sub 1x/1.5x controlled, 3x dominant core, 9x zing)
f0 = 110.0 # ~6,600 RPM crank fundamental
orders = [(1.0, 0.28), (1.5, 0.45), (3.0, 1.0), (4.5, 0.35), (6.0, 0.65), (9.0, 0.58),
          (12.0, 0.38), (15.0, 0.28), (18.0, 0.32), (21.0, 0.24), (24.0, 0.20), (27.0, 0.16)]
h_freqs = np.array([m * f0 for m, _ in orders])
h_amps = np.array([a for _, a in orders])

ax1.vlines(h_freqs, 0, h_amps, color=colors['blue'], lw=2.4)
ax1.text(3.0 * f0, 1.03, "3.0x Core", color=colors['blue'], ha='center', fontsize=8, fontweight='bold')
ax1.text(9.0 * f0, 0.63, "9.0x Zing", color=colors['blue'], ha='center', fontsize=8)
ax1.set_title("1. Phase-Locked Crankshaft Orders: Tamed 1x/1.5x + Dominant 3x Core + 9x Zing", fontsize=9.8, color=colors['blue'])
ax1.set_ylabel("Source Mag")
ax1.set_ylim(0, 1.18)

# 2. Wide-Q Body Dome (F1 + F2) + Throat (F3) + Metallic Zing Formant (F4)
formants = [(155, 1.3, 0.52), (340, 1.3, 0.55), (980, 1.7, 0.42), (2350, 2.0, 0.72)]
filter_curve = np.zeros_like(freqs) + 0.28
for fc_k, Q_k, gain_k in formants:
    filter_curve += gain_k * np.exp(-0.5 * ((freqs - fc_k) / (fc_k / (1.8*Q_k)))**2)
# Cascaded -24 dB/oct lowpass rolloff above 2850 Hz
lp_mag = 1.0 / (1.0 + (freqs / 2850.0)**8)**0.5
filter_curve *= lp_mag

ax2.plot(freqs, filter_curve, color=colors['yellow'], lw=2.5)
ax2.text(320, 1.15, "Wide-Q Body Dome\n(F1 140Hz + F2 280Hz, Q=1.3)", color=colors['yellow'], ha='center', fontsize=8)
ax2.text(1020, 0.90, "F3 Throat\n(~980 Hz)", color=colors['yellow'], ha='center', fontsize=8)
ax2.text(2320, 1.03, "F4 Metallic Zing\n(~2.35 kHz) + -24dB/oct LP", color=colors['yellow'], ha='center', fontsize=8)
ax2.set_title("2. Acoustic Cavity Transfer Function: Broad Low-Mid Dome + Top-End Zing Window", fontsize=9.8, color=colors['yellow'])
ax2.set_ylabel("Cavity Gain")
ax2.set_ylim(0, 1.38)

# 3. Output Spectrum = Source x Filter
out_amps = [a * filter_curve[np.argmin(np.abs(freqs - (m * f0)))] for m, a in orders]
ax3.vlines(h_freqs, 0, out_amps, color=colors['accent'], lw=2.5)
ax3.plot(freqs, filter_curve * 0.9, color=colors['yellow'], linestyle='--', alpha=0.5)
ax3.set_title("3. Radiated Engine Spectrum: Full Warm Body + Crisp 2–3 kHz Metallic Zing", fontsize=9.8, color=colors['accent'])
ax3.set_ylabel("Radiated Mag")
ax3.set_xlabel("Frequency (Hz)")
ax3.set_ylim(0, 1.15)

plt.tight_layout()
fig.savefig(f"{diag_dir}/ch1_formant_concept.png", dpi=200, facecolor=colors['bg'])
plt.close(fig)

# ==============================================================================
# Diagram 2B: Nonlinear Cam-Crossover Curve & Engine Order Hierarchy Across RPM
# ==============================================================================
fig, (axL, axR) = plt.subplots(1, 2, figsize=(9.2, 3.9), facecolor=colors['bg'])
for a in (axL, axR):
    a.set_facecolor(colors['bg'])
    a.grid(True, color=colors['grid'], linestyle='--', linewidth=0.5)

rpms = np.linspace(900, 7400, 400)
u = (rpms - 900.0) / (7400.0 - 900.0)
throttle = np.clip(0.2 + 0.8 * u, 0, 1)

# Left: Linear (gamma=1.0) vs Convex Cam-Crossover (gamma=2.8) Low-Pass Cutoff
fc_linear = 245 + 520 * throttle + 2550 * (u ** 1.0)
fc_capped = 245 + 520 * throttle + 450 * (u ** 1.0)
fc_cam = 245 + 520 * throttle + 2550 * (u ** 2.8)

axL.plot(rpms, fc_linear, color=colors['red'], linestyle='--', lw=1.8, label='Linear Wide ($\gamma=1.0$): Midrange Buzz!')
axL.plot(rpms, fc_capped, color=colors['muted'], linestyle=':', lw=1.8, label='Linear Capped: Muffled Top-End')
axL.plot(rpms, fc_cam, color=colors['accent'], lw=2.6, label='Cam-Crossover ($\gamma=2.8$): Warm Mid + Zing!')
axL.axvspan(3000, 5000, color=colors['blue'], alpha=0.08)
axL.axvspan(5600, 7400, color=colors['yellow'], alpha=0.10)
axL.text(4000, 1180, "Warm Midrange\n(fc ~ 700 Hz)", color=colors['blue'], ha='center', fontsize=8, fontweight='bold')
axL.text(6500, 2950, "VarioCam Zing\n(fc -> 3.3 kHz)", color=colors['yellow'], ha='center', fontsize=8, fontweight='bold')
axL.set_title("A. Nonlinear Cam-Crossover Low-Pass ($u^\\gamma$)", fontsize=10.5, color=colors['text'])
axL.set_xlabel("Engine Speed (RPM)", fontsize=9.5)
axL.set_ylabel("Stage-1 Low-Pass Cutoff (Hz)", fontsize=9.5)
axL.set_ylim(0, 3600)
axL.legend(loc='upper left', framealpha=0.85, facecolor='#252525', fontsize=7.5)

# Right: Order Gain Hierarchy Across RPM
g_10 = 0.28 + 0.12 * throttle - 0.10 * u
g_15 = 0.44 + 0.20 * throttle - 0.06 * u
g_30 = 0.62 + 0.38 * throttle + 0.22 * u
g_60 = 0.08 + 0.24 * throttle + 0.52 * (u ** 2.2)
g_90 = 0.02 + 0.14 * throttle + 0.44 * (u ** 2.8)

axR.plot(rpms, g_30, color=colors['accent'], lw=2.5, label='3.0x Sawtooth (Primary Firing Core)')
axR.plot(rpms, g_60, color=colors['yellow'], lw=2.1, label='6.0x Sawtooth (VarioCam Howl, $\gamma=2.2$)')
axR.plot(rpms, g_90, color=colors['red'], lw=2.0, label='9.0x Sawtooth (Top-End Zing, $\gamma=2.8$)')
axR.plot(rpms, g_15, color=colors['blue'], lw=1.8, linestyle='--', label='1.5x Triangle (Bank Undertone)')
axR.plot(rpms, g_10, color=colors['muted'], lw=1.8, linestyle=':', label='1.0x Triangle (Sub Floor, steps back)')
axR.set_title("B. Stratified Engine-Order Gain Hierarchy", fontsize=10.5, color=colors['text'])
axR.set_xlabel("Engine Speed (RPM)", fontsize=9.5)
axR.set_ylabel("Oscillator Gain", fontsize=9.5)
axR.set_ylim(0, 1.35)
axR.legend(loc='upper left', framealpha=0.85, facecolor='#252525', fontsize=7.3)

plt.tight_layout()
fig.savefig(f"{diag_dir}/ch1_nonlinear_cam_and_orders.png", dpi=200, facecolor=colors['bg'])
plt.close(fig)

# ==============================================================================
# Diagram 3: Single Cylinder Blowdown Wavelet (Tier 2)
# ==============================================================================
fig, ax = plt.subplots(figsize=(8, 4), facecolor=colors['bg'])
ax.set_facecolor(colors['bg'])

tau0 = 0.0004 # 0.4 ms (under load)
t = np.linspace(0, 0.004, 1000) # 0 to 4 ms
u = t / tau0
w = 2.17 * u * (2.0 - u) * np.exp(-u)

ax.plot(t * 1000, w, color=colors['accent'], lw=2.5, label='Biphasic Blowdown Wavelet $w(u)$')
ax.axhline(0, color='#555555', linestyle='-')
ax.axvline(2 * tau0 * 1000, color=colors['yellow'], linestyle=':', label='Zero Crossing ($u=2$)')

# Annotations
ax.annotate('Positive Blowdown Crest\n(+ Turbulent gas shear)', xy=(0.59 * tau0 * 1000, 1.0), xytext=(0.8, 1.15),
            arrowprops=dict(arrowstyle="->", color=colors['accent'], lw=1.5), fontsize=8.5, color=colors['accent'])
ax.annotate('Scavenging Rarefaction Trough\n(Negative area == Positive area -> ZERO DC)', xy=(3.41 * tau0 * 1000, -0.34), xytext=(1.8, -0.65),
            arrowprops=dict(arrowstyle="->", color=colors['yellow'], lw=1.5), fontsize=8.5, color=colors['yellow'])

ax.set_title("Single-Cylinder Exhaust Blowdown Pressure Wavelet $w(t)$", fontsize=12, pad=10, color=colors['text'])
ax.set_xlabel("Time (milliseconds)", fontsize=10)
ax.set_ylabel("Normalized Gauge Pressure", fontsize=10)
ax.set_ylim(-0.9, 1.4)
ax.grid(True, color=colors['grid'], linestyle='-', linewidth=0.5)
ax.legend(loc='upper right', framealpha=0.8, facecolor='#252525')

plt.tight_layout()
fig.savefig(f"{diag_dir}/ch2_blowdown_wavelet.png", dpi=200, facecolor=colors['bg'])
plt.close(fig)

# ==============================================================================
# Diagram 4: V8 Firing Order vs Flat-6 Firing Spacing
# ==============================================================================
fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(8.5, 4.5), facecolor=colors['bg'])
for a in (ax1, ax2):
    a.set_facecolor(colors['bg'])
    a.set_xlim(0, 720)
    a.set_xticks(np.arange(0, 721, 90))
    a.set_xticklabels([f"{deg}°" for deg in np.arange(0, 721, 90)])
    a.grid(True, color=colors['grid'], linestyle='--', linewidth=0.5)

# V8 Cross-Plane Bank Pulse Intervals
# Left: 0, 270, 450, 540
# Right: 90, 180, 360, 630
v8_left = [0, 270, 450, 540]
v8_right = [90, 180, 360, 630]

ax1.eventplot(v8_left, lineoffsets=0.7, linelengths=0.5, colors=colors['blue'], lw=3.0, label='Left Bank (Cyl 1,3,5,7) [270° - 180° - 90° - 180°]')
ax1.eventplot(v8_right, lineoffsets=0.2, linelengths=0.5, colors=colors['red'], lw=3.0, label='Right Bank (Cyl 2,4,6,8) [180° - 90° - 180° - 270°]')
ax1.set_ylim(-0.1, 1.1)
ax1.set_yticks([0.2, 0.7])
ax1.set_yticklabels(["Right Pipe", "Left Pipe"])
ax1.set_title("Cross-Plane V8: Uneven Bank Spacing Causes Signature 'Motorboat Burble'!", fontsize=10.5, color=colors['text'])
ax1.annotate("90° Double-Hit!", xy=(540, 0.7), xytext=(480, 0.95), arrowprops=dict(arrowstyle="->", color=colors['yellow']), fontsize=8, color=colors['yellow'])
ax1.legend(loc='upper right', framealpha=0.7, facecolor='#252525', fontsize=8)

# Flat-6 Bank Pulse Intervals
# Left: 0, 240, 480
# Right: 120, 360, 600
f6_left = [0, 240, 480]
f6_right = [120, 360, 600]

ax2.eventplot(f6_left, lineoffsets=0.7, linelengths=0.5, colors=colors['accent'], lw=3.0, label='Left Bank (Cyl 1,2,3) [Even 240° Spacing]')
ax2.eventplot(f6_right, lineoffsets=0.2, linelengths=0.5, colors=colors['yellow'], lw=3.0, label='Right Bank (Cyl 4,5,6) [Even 240° Spacing]')
ax2.set_ylim(-0.1, 1.1)
ax2.set_yticks([0.2, 0.7])
ax2.set_yticklabels(["Right Pipe", "Left Pipe"])
ax2.set_title("Porsche 987.2 Flat-6: Even 240° Bank Spacing Interleaved at 120° for a Pure High-RPM Wail", fontsize=10.5, color=colors['text'])
ax2.set_xlabel("Crankshaft Angle Over 4-Stroke Cycle ($0°$ to $720°$ / $4\\pi$ rad)", fontsize=9.5)
ax2.legend(loc='upper right', framealpha=0.7, facecolor='#252525', fontsize=8)

plt.tight_layout()
fig.savefig(f"{diag_dir}/ch2_firing_orders.png", dpi=200, facecolor=colors['bg'])
plt.close(fig)

# ==============================================================================
# Diagram 5: 1D Acoustic Waveguide Delay Loop
# ==============================================================================
fig, ax = plt.subplots(figsize=(8.5, 3.8), facecolor=colors['bg'])
ax.set_facecolor(colors['bg'])
ax.set_xlim(0, 10)
ax.set_ylim(0, 5)
ax.axis('off')

# Waveguide blocks
draw_box(0.5, 2.5, 1.8, 1.6, "Collector Pulse", "Input $x[n]$\nCrank Blowdown", colors['accent'])
draw_box(3.2, 2.5, 2.8, 1.6, "Circular Delay Line", "Ring Buffer ($N_{\\text{RT}}$ floats)\n$N = 2L / c_{\\text{exhaust}} \\cdot f_s$", colors['blue'])
draw_box(7.0, 2.5, 2.5, 1.6, "Open Tailpipe", "Negative Reflection\n$R \\approx -0.6$ (Phase Flip!)", colors['red'])
draw_box(4.5, 0.4, 2.5, 1.4, "1-Pole Wall Loss", "Low-Pass Damping\n$lp = (1-d)v + d\\cdot lp$", colors['yellow'])

# Connecting lines
ax.annotate("", xy=(3.2, 3.3), xytext=(2.3, 3.3), arrowprops=dict(arrowstyle="->", color=colors['muted'], lw=2))
ax.annotate("", xy=(7.0, 3.3), xytext=(6.0, 3.3), arrowprops=dict(arrowstyle="->", color=colors['muted'], lw=2))
ax.annotate("", xy=(8.2, 2.5), xytext=(8.2, 1.1), arrowprops=dict(arrowstyle="-", color=colors['muted'], lw=2))
ax.annotate("", xy=(7.0, 1.1), xytext=(8.2, 1.1), arrowprops=dict(arrowstyle="->", color=colors['muted'], lw=2))
ax.annotate("", xy=(4.5, 1.1), xytext=(2.0, 1.1), arrowprops=dict(arrowstyle="-", color=colors['muted'], lw=2))
ax.annotate("", xy=(2.0, 2.5), xytext=(2.0, 1.1), arrowprops=dict(arrowstyle="->", color=colors['muted'], lw=2))

ax.text(5.0, 4.4, "1D Acoustic Waveguide: Quarter-Wave Tailpipe Resonator ($f_1 = c / 4L$)", ha='center', fontsize=11, fontweight='bold', color=colors['text'])

plt.tight_layout()
fig.savefig(f"{diag_dir}/ch2_waveguide_loop.png", dpi=200, facecolor=colors['bg'])
plt.close(fig)

print("All 5 vector diagrams generated successfully!")
