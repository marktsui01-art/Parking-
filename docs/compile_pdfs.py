import re
import os
import subprocess
import markdown

try:
    import weasyprint
except (ImportError, OSError):
    weasyprint = None

docs_dir = "/media/documents/2025/gemini_scratch/programming_projects/Parking-/docs"

def extract_braced(s, idx):
    if idx >= len(s) or s[idx] != "{":
        return None, idx
    depth = 0
    for i in range(idx, len(s)):
        if s[i] == "{":
            depth += 1
        elif s[i] == "}":
            depth -= 1
            if depth == 0:
                return s[idx+1:i], i+1
    return None, idx

def replace_fracs(s):
    count = 0
    while "\\frac" in s and count < 15:
        count += 1
        idx = s.find("\\frac")
        b1 = idx + 5
        while b1 < len(s) and s[b1] == " ":
            b1 += 1
        num, b2 = extract_braced(s, b1)
        if num is None:
            s = s[:idx] + s[idx+5:]
            continue
        while b2 < len(s) and s[b2] == " ":
            b2 += 1
        den, next_idx = extract_braced(s, b2)
        if den is None:
            s = s[:idx] + num + s[b2:]
            continue
        num_c = replace_fracs(num)
        den_c = replace_fracs(den)
        if any(op in num_c for op in (" + ", " - ")):
            num_c = f"({num_c})"
        if any(op in den_c for op in (" + ", " - ")):
            den_c = f"({den_c})"
        s = s[:idx] + f"({num_c} / {den_c})" + s[next_idx:]
    return s

def format_math_expr(expr):
    e = expr.strip()
    e = replace_fracs(e)
    
    # Handle \underbrace{expr}_{label} -> expr [label]
    while "\\underbrace" in e:
        idx = e.find("\\underbrace")
        b1 = idx + len("\\underbrace")
        while b1 < len(e) and e[b1] == " ":
            b1 += 1
        inner, b2 = extract_braced(e, b1)
        if inner is None:
            e = e[:idx] + e[b1:]
            break
        while b2 < len(e) and e[b2] == " ":
            b2 += 1
        if b2 < len(e) and e[b2] == "_":
            b3 = b2 + 1
            while b3 < len(e) and e[b3] == " ":
                b3 += 1
            lbl, next_idx = extract_braced(e, b3)
            if lbl is not None:
                e = e[:idx] + f"{inner} [{lbl}]" + e[next_idx:]
            else:
                e = e[:idx] + inner + e[b2:]
        else:
            e = e[:idx] + inner + e[b2:]

    # Strip \text{...}, \mathrm{...}, \mathbf{...}, \mathrel{...}
    for cmd in ["\\text", "\\mathrm", "\\mathbf", "\\mathrel"]:
        while cmd in e:
            idx = e.find(cmd)
            b = idx + len(cmd)
            while b < len(e) and e[b] == " ":
                b += 1
            inner, next_idx = extract_braced(e, b)
            if inner is not None:
                e = e[:idx] + inner + e[next_idx:]
            else:
                e = e[:idx] + e[b:]
                break

    # Strip \left and \right delimiters FIRST before \le
    e = e.replace(r"\left(", "(").replace(r"\right)", ")")
    e = e.replace(r"\left[", "[").replace(r"\right]", "]")
    e = e.replace(r"\left|", "|").replace(r"\right|", "|")
    e = e.replace(r"\left.", "").replace(r"\right.", "")
    e = e.replace(r"\left", "").replace(r"\right", "")

    ordered_replacements = [
        ("^{\\circ}", "°"),
        ("^\\circ", "°"),
        ("\\circ", "°"),
        ("\\implies", "⇒"),
        ("\\Rightarrow", "⇒"),
        ("\\rightarrow", "→"),
        ("\\xrightarrow", "→"),
        ("\\to", "→"),
        ("\\downarrow", "↓"),
        ("\\approx", "≈"),
        ("\\cdot", "·"),
        ("\\times", "×"),
        ("\\pm", "±"),
        ("\\propto", "∝"),
        ("\\infty", "∞"),
        ("\\int", "∫"),
        ("\\in", "∈"),
        ("\\dots", "…"),
        ("\\sqrt", "√"),
        ("\\pi", "π"),
        ("\\theta", "θ"),
        ("\\gamma", "γ"),
        ("\\Delta", "Δ"),
        ("\\tau", "τ"),
        ("\\zeta", "ζ"),
        ("\\phi", "ϕ"),
        ("\\omega", "ω"),
        ("\\epsilon", "ε"),
        ("\\sim", "~"),
        ("\\bmod", "mod"),
        ("\\le", "≤"),
        ("\\ge", "≥"),
        ("\\ll", "≪"),
        ("\\gg", "≫"),
        ("\\Big[", "["),
        ("\\Big]", "]"),
        ("\\Big(", "("),
        ("\\Big)", ")"),
        ("\\big(", "("),
        ("\\big)", ")"),
        ("\\Big", ""),
        ("\\big", ""),
        ("\\,", " "),
        ("\\;", " "),
        ("\\qquad", "     "),
        ("\\quad", "   "),
        ("\\{", "{"),
        ("\\}", "}"),
        ("\\_", "_"),
        ("\\%", "%"),
    ]
    for old, new in ordered_replacements:
        e = e.replace(old, new)
    
    e = e.replace("^°", "°")
    e = e.replace("{", "").replace("}", "")
    e = re.sub(r"\\([a-zA-Z]+)", r"\1", e)
    return e

def convert_math_to_html(text):
    # 1. Block math: $$ ... $$
    text = re.sub(r'\$\$(.*?)\$\$', lambda m: f'<div class="math-block"><code>{format_math_expr(m.group(1))}</code></div>', text, flags=re.DOTALL)

    # 2. Inline math: $ ... $
    text = re.sub(r'\$([^\$\n]+)\$', lambda m: f'<span class="math-inline"><code>{format_math_expr(m.group(1))}</code></span>', text)
    return text

def convert_mermaid_blocks(text, chapter_num):
    # Block 1 in Chapter 1: Series Bandpass Trap
    b1_html = """<div class="flow-container">
  <table class="flow-table">
    <tr>
      <td class="flow-box">Noise / Osc</td>
      <td class="flow-arrow">➔</td>
      <td class="flow-box">Bandpass 220 Hz<br><span class="flow-sub">Kills everything except ~220 Hz</span></td>
      <td class="flow-arrow">➔<br><span class="flow-sub" style="color:#d9534f;">Only 220 Hz left</span></td>
      <td class="flow-box">Bandpass 1400 Hz<br><span class="flow-sub">Kills 220 Hz!</span></td>
      <td class="flow-arrow">➔</td>
      <td class="flow-box flow-box-danger">Near Silence!</td>
    </tr>
  </table>
</div>"""

    # Block 2 in Chapter 1: Parallel Intake Bank
    b2_html = """<div class="flow-container">
  <table class="flow-table">
    <tr>
      <td rowspan="2" class="flow-box flow-box-primary" style="width: 26%;">Filtered Pink Noise<br><span class="flow-sub">(No Raw Sawtooth Leak!)</span></td>
      <td class="flow-arrow">➔</td>
      <td class="flow-box">Bandpass F1<br><span class="flow-sub">240 Hz (Q=2.5)</span></td>
      <td class="flow-arrow">➔</td>
      <td class="flow-box">Gain 1</td>
      <td class="flow-arrow">➔</td>
      <td rowspan="2" class="flow-box flow-box-accent" style="width: 22%;">Intake Bus<br><span class="flow-sub">(Load-Gated)</span></td>
    </tr>
    <tr>
      <td class="flow-arrow">➔</td>
      <td class="flow-box">Bandpass F2<br><span class="flow-sub">1350 Hz (Q=3.2)</span></td>
      <td class="flow-arrow">➔</td>
      <td class="flow-box">Gain 2</td>
      <td class="flow-arrow">➔</td>
    </tr>
  </table>
</div>"""

    # Block 3 in Chapter 1: Complete Nonlinear Exhaust Chain (2-tier layout)
    b3_html = """<div class="flow-container">
  <table class="flow-table">
    <tr>
      <td class="flow-box flow-box-primary" style="width: 26%;">Phase-Locked Orders<br><span class="flow-sub">(0 cts) + Brown/Pink Noise</span></td>
      <td class="flow-arrow">➔</td>
      <td class="flow-box" style="width: 24%;">Soft Tanh Shaper<br><span class="flow-sub">sech² Intermodulation</span></td>
      <td class="flow-arrow">➔</td>
      <td class="flow-box" style="width: 24%;">Short Pipe Comb<br><span class="flow-sub">0.9–3.4 ms (R &lt; 0)</span></td>
      <td class="flow-arrow">➔</td>
      <td class="flow-box" style="width: 24%;">Peaking F1 + F2<br><span class="flow-sub">Wide-Q Body Dome</span></td>
    </tr>
    <tr>
      <td colspan="7" class="flow-arrow" style="text-align: center; padding: 2pt 0;">▼</td>
    </tr>
    <tr>
      <td class="flow-box" style="width: 26%;">Peaking F3 + F4<br><span class="flow-sub">Bark + Metallic Zing</span></td>
      <td class="flow-arrow">➔</td>
      <td colspan="3" class="flow-box" style="width: 48%;">2× Cascaded Butterworth Lowpass<br><span class="flow-sub">-24 dB/oct · Convex Cam Curve (u_RPM^γ)</span></td>
      <td class="flow-arrow">➔</td>
      <td class="flow-box flow-box-accent" style="width: 24%;">Exhaust Bus<br><span class="flow-sub">(To Master Limiter)</span></td>
    </tr>
  </table>
</div>"""

    # Block 1 in Chapter 2: Three-Thread Web Audio Architecture
    b4_html = """<div class="flow-container">
  <table class="flow-table">
    <tr>
      <td class="flow-box" style="width: 30%;">
        <strong>Main Thread (60 Hz Game Loop)</strong><br>
        <span class="flow-sub">GameEngine + Drivetrain</span><br>
        <div class="flow-sub-box">AudioWorkletNode</div>
      </td>
      <td class="flow-arrow">➔<br><span class="flow-sub">AudioParam (rpm, load)<br>postMessage (preset)</span></td>
      <td class="flow-box flow-box-primary" style="width: 35%;">
        <strong>Dedicated Audio Thread (48,000 Hz)</strong><br>
        <div class="flow-sub-box">EngineWorkletProcessor<br>process() every 128 samples (2.67 ms)</div>
      </td>
      <td class="flow-arrow">➔<br><span class="flow-sub">Raw Exhaust + Intake</span></td>
      <td class="flow-box flow-box-accent" style="width: 25%;">
        <strong>Web Audio Graph</strong><br>
        <div class="flow-sub-box">Stationary Formants + Limiter ➔ Speakers</div>
      </td>
    </tr>
  </table>
</div>"""

    # Block 2 in Chapter 2: 1D Waveguide Feedback Loop
    b5_html = """<div class="flow-container">
  <table class="flow-table">
    <tr>
      <td class="flow-box flow-box-primary" style="width: 28%;">Bank Collector Pulse x[n]</td>
      <td class="flow-arrow">➔</td>
      <td class="flow-box" style="font-size:11pt; font-weight:bold; width: 16%;">(+) Sum</td>
      <td class="flow-arrow">➔</td>
      <td class="flow-box" style="width: 24%;">Soft Clip<br><span class="flow-sub">Math.tanh()</span></td>
      <td class="flow-arrow">➔</td>
      <td class="flow-box flow-box-accent" style="width: 28%;">To Exhaust Formants</td>
    </tr>
    <tr>
      <td colspan="2"></td>
      <td class="flow-arrow" style="text-align:center;">▲<br><span class="flow-sub">Echo Feedback</span></td>
      <td class="flow-arrow">◀</td>
      <td class="flow-box" style="background:#fef2f2; border-color:#dc2626;">Open Reflection<br><span class="flow-sub">× R (-0.60)</span></td>
      <td class="flow-arrow">◀</td>
      <td class="flow-box">1-Pole Loss + Delay<br><span class="flow-sub">N_RT = 2L / c</span></td>
    </tr>
  </table>
</div>"""

    if chapter_num == 1:
        blocks = [b1_html, b2_html, b3_html]
    else:
        blocks = [b4_html, b5_html]

    for b in blocks:
        text = re.sub(r'```mermaid.*?```', lambda m: b, text, count=1, flags=re.DOTALL)
    return text

css = """
@page {
    size: A4;
    margin: 18mm 15mm 18mm 15mm;
    @bottom-right {
        content: counter(page);
        font-family: 'DejaVu Sans', sans-serif;
        font-size: 8pt;
        color: #777777;
    }
    @bottom-left {
        content: "Procedural Engine Sound DSP & Acoustics — Parking Simulator";
        font-family: 'DejaVu Sans', sans-serif;
        font-size: 8pt;
        color: #777777;
    }
}

body {
    font-family: 'DejaVu Sans', sans-serif;
    font-size: 9.3pt;
    line-height: 1.54;
    color: #222222;
    background-color: #ffffff;
}

h1 {
    font-size: 17pt;
    color: #0b4f6c;
    border-bottom: 2px solid #0b4f6c;
    padding-bottom: 4pt;
    margin-top: 0;
    margin-bottom: 12pt;
    page-break-before: always;
}
body > h1:first-of-type {
    page-break-before: avoid;
}

h2 {
    font-size: 12.5pt;
    color: #1f6e8c;
    border-bottom: 1px solid #d0d7de;
    padding-bottom: 3pt;
    margin-top: 15pt;
    margin-bottom: 8pt;
    page-break-after: avoid;
}

h3 {
    font-size: 10.2pt;
    color: #2e4057;
    margin-top: 12pt;
    margin-bottom: 5pt;
    page-break-after: avoid;
}

p {
    margin-top: 4pt;
    margin-bottom: 6pt;
}

ul, ol {
    margin-top: 5pt;
    margin-bottom: 8pt;
    padding-left: 18pt;
}

li {
    margin-top: 2pt;
    margin-bottom: 6pt;
    line-height: 1.52;
}

li > ul, li > ol {
    margin-top: 3pt;
    margin-bottom: 3pt;
    padding-left: 16pt;
}

code {
    font-family: 'DejaVu Sans Mono', monospace;
    font-size: 8.5pt;
    background-color: #f3f4f6;
    color: #b31d28;
    padding: 1pt 3.5pt;
    border-radius: 3pt;
}

pre {
    background-color: #f6f8fa;
    border: 1px solid #d0d7de;
    border-radius: 4pt;
    padding: 8pt;
    overflow-x: auto;
    font-size: 8pt;
    line-height: 1.35;
    margin: 8pt 0;
    page-break-inside: avoid;
}
pre code {
    background-color: transparent;
    color: #24292f;
    padding: 0;
}

blockquote {
    border-left: 4px solid #0b4f6c;
    background-color: #f0f7fa;
    margin: 8pt 0;
    padding: 6pt 12pt;
    color: #333333;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin: 10pt 0;
    font-size: 8.4pt;
    page-break-inside: avoid;
}
th, td {
    border: 1px solid #d0d7de;
    padding: 5pt 7pt;
    text-align: left;
    vertical-align: top;
}
th {
    background-color: #f6f8fa;
    color: #24292f;
    font-weight: bold;
}
tr:nth-child(even) td {
    background-color: #fcfcfc;
}

.pause-box {
    background-color: #fff9e6;
    border: 1.5px solid #d4a017;
    border-radius: 5pt;
    padding: 10pt 12pt;
    margin: 12pt 0;
    page-break-inside: avoid;
}
.pause-box h3 {
    color: #8c6500;
    margin-top: 0;
    margin-bottom: 6pt;
    font-size: 10.5pt;
    border-bottom: 1px solid #f0d58a;
    padding-bottom: 3pt;
}
.pause-box p {
    margin-top: 3pt;
    margin-bottom: 5pt;
}
.pause-box ol, .pause-box ul {
    margin-top: 4pt;
    margin-bottom: 5pt;
    padding-left: 18pt;
}
.pause-box li {
    margin-bottom: 5pt;
}

.solution-box {
    background-color: #f0faf0;
    border: 1.2px solid #38a169;
    border-radius: 5pt;
    padding: 10pt 12pt;
    margin: 10pt 0;
    font-size: 8.8pt;
    page-break-inside: avoid;
}
.solution-box strong.title {
    display: block;
    color: #22543d;
    font-weight: bold;
    font-size: 9.8pt;
    margin-bottom: 6pt;
    border-bottom: 1px solid #c6f6d5;
    padding-bottom: 3pt;
}
.solution-box p {
    margin-top: 3pt;
    margin-bottom: 5pt;
}
.solution-box ol, .solution-box ul {
    margin-top: 4pt;
    margin-bottom: 5pt;
    padding-left: 18pt;
}
.solution-box li {
    margin-bottom: 5pt;
}

img.diagram {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 10pt auto 4pt auto;
    border: 1px solid #d0d7de;
    border-radius: 4pt;
    box-shadow: 0 2px 4px rgba(0,0,0,0.06);
    page-break-inside: avoid;
}
.caption {
    font-size: 8pt;
    color: #555555;
    text-align: center;
    font-style: italic;
    margin-top: 4pt;
    margin-bottom: 11pt;
    page-break-after: avoid;
}

/* Math styling */
.math-inline code {
    font-family: 'DejaVu Sans', sans-serif;
    font-size: 8.8pt;
    font-style: italic;
    background-color: #f3f6fa;
    color: #0b4f6c;
    padding: 0.5pt 3pt;
    border-radius: 2pt;
    border: 1px solid #e1e7ee;
}
.math-block {
    text-align: center;
    margin: 8pt auto;
    padding: 6pt;
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4pt;
    page-break-inside: avoid;
}
.math-block code {
    font-family: 'DejaVu Sans', sans-serif;
    font-size: 9.8pt;
    font-weight: bold;
    color: #0b4f6c;
    background: transparent;
    padding: 0;
    border: none;
}

/* Flowchart Diagram Tables */
.flow-container {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 5pt;
    padding: 8pt 10pt;
    margin: 10pt 0;
    page-break-inside: avoid;
}
.flow-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 5pt;
    border: none;
    margin: 0;
}
.flow-table td {
    border: none;
    padding: 4pt 6pt;
    vertical-align: middle;
}
.flow-box {
    background: #ffffff;
    border: 1.5px solid #0b4f6c;
    border-radius: 4pt;
    font-size: 8.2pt;
    font-weight: bold;
    color: #0b4f6c;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.flow-box-primary {
    background: #f0f7fa;
    border: 1.5px solid #0b4f6c;
}
.flow-box-accent {
    background: #e0f2fe;
    border: 1.5px solid #0284c7;
    color: #0369a1;
}
.flow-box-danger {
    background: #fef2f2;
    border: 1.5px solid #ef4444;
    color: #b91c1c;
}
.flow-sub {
    font-weight: normal;
    font-size: 7.2pt;
    color: #555555;
    display: block;
    margin-top: 2pt;
}
.flow-sub-box {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 3pt;
    padding: 3pt;
    margin-top: 4pt;
    font-weight: normal;
    font-size: 7.5pt;
}
.flow-arrow {
    text-align: center;
    font-size: 11pt;
    color: #64748b;
}
"""

def preprocess_markdown(content, chapter_num):
    # 0. Clean emojis that render as tofu/empty squares in DejaVu font
    content = content.replace("🤔 ", "").replace("💡 ", "").replace("⚠️ ", "Note: ")

    # 1. Transform mermaid code blocks to styled HTML flowcharts
    content = convert_mermaid_blocks(content, chapter_num)

    # 2. Transform math
    content = convert_math_to_html(content)

    # 3. Transform <details><summary> into styled solution boxes (parsing inner markdown!)
    def replace_details(match):
        summary = match.group(1).strip()
        body = match.group(2).strip()
        body_clean = re.sub(r'([^\n\s])\n(\d+\.\s)', r'\1\n\n\2', body)
        body_html = markdown.markdown(body_clean, extensions=['extra', 'tables', 'fenced_code'])
        return f'<div class="solution-box"><strong class="title">{summary}</strong>\n{body_html}\n</div>'
    content = re.sub(r'<details>\s*<summary>(.*?)</summary>(.*?)</details>', replace_details, content, flags=re.DOTALL)

    # 4. Wrap Pause & Think sections into styled callout boxes (parsing inner markdown!)
    def wrap_pause(match):
        inner = match.group(0)
        cleaned = re.sub(r'^>\s?', '', inner, flags=re.MULTILINE)
        cleaned = re.sub(r'(###\s+[^\n]+)\n([^\n\s])', r'\1\n\n\2', cleaned)
        cleaned = re.sub(r'([^\n\s])\n(\d+\.\s)', r'\1\n\n\2', cleaned)
        inner_html = markdown.markdown(cleaned, extensions=['extra', 'tables', 'fenced_code'])
        return f'<div class="pause-box">\n{inner_html}\n</div>'
    content = re.sub(r'(> ### Pause & Think.*?)(?=\n\n(?:<div class="solution-box"|---|\Z))', wrap_pause, content, flags=re.DOTALL)

    # 5. Inject Diagrams after relevant sections
    if chapter_num == 1:
        arch_img = f'\n\n<img src="{docs_dir}/diagrams/arch_overview.png" class="diagram"/>\n<div class="caption">Figure 1.1: Three-Stage Procedural Engine Audio Architecture</div>\n\n'
        content = re.sub(r'(## 1\.1 DSP From Zero:.*?\n)', r'\1' + arch_img, content, count=1)

        lp_img = f'\n\n<img src="{docs_dir}/diagrams/ch1_lowpass_response.png" class="diagram"/>\n<div class="caption">Figure 1.2: 2nd-Order vs. Cascaded 4th-Order (-24 dB/oct) Low-Pass Filter Response & Web Audio Q Conventions</div>\n\n'
        content = re.sub(r'(### The Suspension Analogy:.*?\n+)', r'\1' + lp_img, content, count=1)

        fmt_img = f'\n\n<img src="{docs_dir}/diagrams/ch1_formant_concept.png" class="diagram"/>\n<div class="caption">Figure 1.3: Source-Filter Model (Stratified Harmonic Orders × Wide-Q Body Dome & Zing Formant)</div>\n\n'
        content = re.sub(r'(## 1\.3 What Is a Formant Filter\?.*?\n)', r'\1' + fmt_img, content, count=1)

        cam_img = f'\n\n<img src="{docs_dir}/diagrams/ch1_nonlinear_cam_and_orders.png" class="diagram"/>\n<div class="caption">Figure 1.4: Convex Cam-Crossover Curve (u_RPM^2.8) & Stratified Engine-Order Gain Envelopes Across RPM</div>\n\n'
        content = re.sub(r'(### Nonlinear Cam-Crossover Curves.*?\n)', r'\1' + cam_img, content, count=1)

    elif chapter_num == 2:
        wv_img = f'\n\n<img src="{docs_dir}/diagrams/ch2_blowdown_wavelet.png" class="diagram"/>\n<div class="caption">Figure 2.1: Single-Cylinder Exhaust Blowdown Pressure Wavelet w(t) (Zero Net DC Offset)</div>\n\n'
        content = re.sub(r'(<div class="math-block"><code>w\(u\).*?</div>\n)', r'\1' + wv_img, content, count=1)

        fire_img = f'\n\n<img src="{docs_dir}/diagrams/ch2_firing_orders.png" class="diagram"/>\n<div class="caption">Figure 2.2: Cross-Plane V8 Uneven Bank Spacing vs. Flat-6 Even Spacing Across 720° Cycle</div>\n\n'
        content = re.sub(r'(## 2\.5 Firing Orders, Bank Geometry.*?\n)', r'\1' + fire_img, content, count=1)

        wg_img = f'\n\n<img src="{docs_dir}/diagrams/ch2_waveguide_loop.png" class="diagram"/>\n<div class="caption">Figure 2.3: 1D Acoustic Digital Waveguide with Inverting Open Tailpipe Reflection</div>\n\n'
        content = re.sub(r'(## 2\.6 1D Acoustic Waveguides:.*?\n)', r'\1' + wg_img, content, count=1)

    return content

def render_html_to_pdf(output_html, output_pdf, full_html):
    if weasyprint is not None:
        doc = weasyprint.HTML(string=full_html, base_url=docs_dir)
        doc.write_pdf(output_pdf)
        return

    project_root = os.path.dirname(docs_dir)
    node_script = """
const { chromium } = require('@playwright/test');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve(process.argv[1]), { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '@page { @bottom-left { content: none !important; } @bottom-right { content: none !important; } }' });
  await page.pdf({
    path: path.resolve(process.argv[2]),
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', right: '15mm', bottom: '18mm', left: '15mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="width:100%; font-family: sans-serif; font-size: 8pt; color: #777777; padding: 0 15mm; display: flex; justify-content: space-between;"><span>Procedural Engine Sound DSP &amp; Acoustics — Parking Simulator</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>'
  });
  await browser.close();
})();
"""
    subprocess.run(
        ["node", "-e", node_script, output_html, output_pdf],
        cwd=project_root,
        check=True
    )

def compile_pdf(input_md, output_pdf, chapter_num):
    with open(input_md, 'r', encoding='utf-8') as f:
        raw_md = f.read()

    processed_md = preprocess_markdown(raw_md, chapter_num)
    html_body = markdown.markdown(processed_md, extensions=['extra', 'tables', 'fenced_code'])

    full_html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
{css}
</style>
</head>
<body>
{html_body}
</body>
</html>
"""
    print(f"Generating {output_pdf}...")
    output_html = output_pdf.replace('.pdf', '.html')
    with open(output_html, 'w', encoding='utf-8') as f_out:
        f_out.write(full_html)
    render_html_to_pdf(output_html, output_pdf, full_html)
    print(f"Done: {output_pdf}")

if __name__ == '__main__':
    compile_pdf(f"{docs_dir}/chapter_01_tier1_formants_and_drivetrain.md", f"{docs_dir}/chapter_01_tier1_formants_and_drivetrain.pdf", 1)
    compile_pdf(f"{docs_dir}/chapter_02_tier2_pulses_and_waveguides.md", f"{docs_dir}/chapter_02_tier2_pulses_and_waveguides.pdf", 2)

    print("Compiling combined volume...")
    with open(f"{docs_dir}/chapter_01_tier1_formants_and_drivetrain.md") as f1, open(f"{docs_dir}/chapter_02_tier2_pulses_and_waveguides.md") as f2:
        combined_md = preprocess_markdown(f1.read(), 1) + "\n\n<div style='page-break-before: always;'></div>\n\n" + preprocess_markdown(f2.read(), 2)

    full_combined_html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
{css}
</style>
</head>
<body>
{markdown.markdown(combined_md, extensions=['extra', 'tables', 'fenced_code'])}
</body>
</html>
"""
    combined_html_path = f"{docs_dir}/procedural_engine_sound_guide_complete.html"
    combined_pdf_path = f"{docs_dir}/procedural_engine_sound_guide_complete.pdf"
    with open(combined_html_path, "w", encoding="utf-8") as f_comb:
        f_comb.write(full_combined_html)
    render_html_to_pdf(combined_html_path, combined_pdf_path, full_combined_html)
    print("Done: procedural_engine_sound_guide_complete.pdf")
