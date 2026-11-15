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
# Diagram 1: Low-Pass Filter Frequency Response & Q
# ==============================================================================
fig, ax = plt.subplots(figsize=(8, 4), facecolor=colors['bg'])
ax.set_facecolor(colors['bg'])

f = np.logspace(1, 4, 1000) # 10 Hz to 10 kHz
fc = 300.0 # Cutoff at 300 Hz

for Q_label, Q, color in [("High Q (Ringing / Boom)", 3.0, colors['red']),
                          ("Flat / Damped (Q=0.707)", 0.707, colors['accent']),
                          ("Overdamped (Soft)", 0.4, colors['blue'])]:
    # Standard 2nd order analog low-pass response approximation
    w_ratio = f / fc
    mag = 1.0 / np.sqrt((1 - w_ratio**2)**2 + (w_ratio / Q)**2)
    db = 20 * np.log10(mag)
    ax.semilogx(f, db, label=f"{Q_label} [Q={Q}]", color=color, lw=2.2)

ax.axvline(fc, color='#666666', linestyle='--', label=f'Cutoff $f_c$ = {int(fc)} Hz')
ax.axhline(0, color='#444444', linestyle=':')
ax.axhline(-36, color=colors['muted'], linestyle='-.', alpha=0.7)
ax.text(2400, -33, "2400 Hz: -36 dB (1.6% left)", color=colors['muted'], fontsize=8.5)

ax.set_title("2nd-Order Low-Pass Filter: Cutoff $f_c$ and Quality Factor $Q$", fontsize=12, pad=10, color=colors['text'])
ax.set_xlabel("Frequency (Hz, logarithmic)", fontsize=10)
ax.set_ylabel("Gain (dB)", fontsize=10)
ax.set_ylim(-50, 18)
ax.grid(True, which='both', color=colors['grid'], linestyle='-', linewidth=0.5)
ax.legend(loc='lower left', framealpha=0.8, facecolor='#252525')

plt.tight_layout()
fig.savefig(f"{diag_dir}/ch1_lowpass_response.png", dpi=200, facecolor=colors['bg'])
plt.close(fig)

# ==============================================================================
# Diagram 2: Formant Filtering Concept (Source vs Stationary Filter vs Output)
# ==============================================================================
fig, (ax1, ax2, ax3) = plt.subplots(3, 1, figsize=(8, 6), facecolor=colors['bg'], sharex=True)
for a in (ax1, ax2, ax3):
    a.set_facecolor(colors['bg'])
    a.grid(True, color=colors['grid'], linestyle='-', linewidth=0.5)

freqs = np.linspace(20, 2500, 2000)

# 1. Harmonic Source (e.g. 150 Hz fund)
fund = 150.0
harmonics = np.arange(fund, 2500, fund)
source_spectrum = np.zeros_like(freqs)
for h in harmonics:
    idx = np.argmin(np.abs(freqs - h))
    source_spectrum[idx] = 1.0 / (h / fund)**0.7
ax1.vlines(harmonics, 0, 1.0 / (harmonics/fund)**0.7, color=colors['blue'], lw=2)
ax1.set_title("1. Acoustic Source: Periodic Harmonic Teeth ($1f_0, 2f_0, 3f_0 \\dots$)", fontsize=10, color=colors['blue'])
ax1.set_ylabel("Source Mag")
ax1.set_ylim(0, 1.1)

# 2. Formant Cavity Filter (Stationary F1, F2, F3)
formants = [(240, 2.5, 0.9), (750, 3.5, 0.75), (1450, 4.0, 0.85)]
filter_curve = np.zeros_like(freqs) + 0.15
for fc_k, Q_k, gain_k in formants:
    filter_curve += gain_k * np.exp(-0.5 * ((freqs - fc_k) / (fc_k / (2*Q_k)))**2)
ax2.plot(freqs, filter_curve, color=colors['yellow'], lw=2.5)
ax2.text(240, 0.95, "F1: Box Boom\n(240 Hz)", color=colors['yellow'], ha='center', fontsize=8)
ax2.text(750, 0.82, "F2: Header Mid\n(750 Hz)", color=colors['yellow'], ha='center', fontsize=8)
ax2.text(1450, 0.92, "F3: Tailpipe Wail\n(1450 Hz)", color=colors['yellow'], ha='center', fontsize=8)
ax2.set_title("2. Physical Formant Filter: Stationary Body Cavities ($F_1, F_2, F_3$ stay fixed in Hz)", fontsize=10, color=colors['yellow'])
ax2.set_ylabel("Cavity Gain")
ax2.set_ylim(0, 1.2)

# 3. Output Spectrum = Source x Filter
out_spectrum = np.zeros_like(freqs)
for h in harmonics:
    idx = np.argmin(np.abs(freqs - h))
    val = (1.0 / (h / fund)**0.7) * filter_curve[idx]
    out_spectrum[idx] = val
ax3.vlines(harmonics, 0, [ (1.0 / (h / fund)**0.7) * filter_curve[np.argmin(np.abs(freqs - h))] for h in harmonics ], color=colors['accent'], lw=2.2)
ax3.plot(freqs, filter_curve * 0.8, color=colors['yellow'], linestyle='--', alpha=0.5, label='Envelope from Formants')
ax3.set_title("3. Output Acoustic Spectrum: Harmonics Shaped by Fixed Formant Envelope", fontsize=10, color=colors['accent'])
ax3.set_ylabel("Radiated Mag")
ax3.set_xlabel("Frequency (Hz)")
ax3.set_ylim(0, 1.1)

plt.tight_layout()
fig.savefig(f"{diag_dir}/ch1_formant_concept.png", dpi=200, facecolor=colors['bg'])
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
