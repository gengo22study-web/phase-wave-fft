import { useState, useEffect, useRef } from "react";

/* =====================================================
   位相円
===================================================== */
function PhaseCircle({ phase }) {
  const cx = 460;
  const cy = 80;
  const r = 35;
  const x = cx + r * Math.cos(phase);
  const y = cy - r * Math.sin(phase);

  return (
    <svg width="520" height="160">
      <text x="20" y="24">進行波の位相 φ</text>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#666" />
      <line x1={cx} y1={cy} x2={x} y2={y} stroke="#0066cc" strokeWidth={3} />
      <circle cx={x} cy={y} r={4} fill="#cc0000" />
      <text x={cx - 22} y={cy + r + 18} fontSize={12}>位相 φ</text>
    </svg>
  );
}

/* =====================================================
   音圧
===================================================== */
const P0 = 2e-5; // 20 μPa
const dbToPa = db => P0 * Math.pow(10, db / 20);

/* =====================================================
   FFT（教材用・自前実装）
===================================================== */
function complex(re, im) {
  return { re, im };
}

function cAdd(a, b) {
  return { re: a.re + b.re, im: a.im + b.im };
}

function cSub(a, b) {
  return { re: a.re - b.re, im: a.im - b.im };
}

function cMul(a, b) {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re
  };
}

// 再帰FFT（Cooley–Tukey）
function fft(signal) {
  const N = signal.length;
  if (N <= 1) return signal;

  const even = fft(signal.filter((_, i) => i % 2 === 0));
  const odd  = fft(signal.filter((_, i) => i % 2 !== 0));

  const result = new Array(N);
  for (let k = 0; k < N / 2; k++) {
    const angle = -2 * Math.PI * k / N;
    const w = complex(Math.cos(angle), Math.sin(angle));
    const t = cMul(w, odd[k]);

    result[k] = cAdd(even[k], t);
    result[k + N / 2] = cSub(even[k], t);
  }
  return result;
}

function generateSignal(freq, phase, fs = 44100, N = 1024) {
  const s = [];
  for (let n = 0; n < N; n++) {
    s.push(
      complex(
        Math.sin(2 * Math.PI * freq * n / fs + phase),
        0
      )
    );
  }
  return s;
}

/* =====================================================
   メイン：位相・進行波・FFT
===================================================== */
function PhaseWave() {
  const [freq, setFreq] = useState(0.5);
  const [db, setDb] = useState(40);
  const [playing, setPlaying] = useState(false);
  const [realMode, setRealMode] = useState(false);

  const phaseRef = useRef(0);
  const [, forceUpdate] = useState(0);

  const baseFreq = freq;
  const displayFreq = baseFreq * 1000;
  const calcFreq = realMode ? displayFreq : baseFreq;
  const omega = 2 * Math.PI * calcFreq;

  /* ---------- アニメーション ---------- */
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let id;
    const speed = realMode ? 0.002 : 0.6;

    const tick = now => {
      const dt = (now - last) / 1000;
      last = now;
      phaseRef.current =
        (phaseRef.current + omega * dt * speed) % (2 * Math.PI);
      forceUpdate(v => v + 1);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [omega, playing, realMode]);

  const phase = phaseRef.current;

  /* ---------- 進行波 ---------- */
  const ampVis = 2 + (db / 100) * 88;
  const k = realMode ? 0.0015 * displayFreq : 0.15 * baseFreq;

  const wave = [];
  for (let x = 0; x <= 300; x += 2) {
    wave.push(`${20 + x},${150 - ampVis * Math.sin(phase + k * x)}`);
  }

  /* ---------- FFT ---------- */
  const N = 1024;
  const fs = 44100;
  const signal = generateSignal(displayFreq, phase, fs, N);
  const spectrum = fft(signal);

  const mag = spectrum.map(
    c => Math.sqrt(c.re * c.re + c.im * c.im)
  );
  const phaseSpec = spectrum.map(
    c => Math.atan2(c.im, c.re)
  );

  return (
    <div style={{ textAlign: "center" }}>
      <h2>位相・進行波・FFT（振幅＋位相）</h2>

      <PhaseCircle phase={phase} />

      {/* ---- 進行波 ---- */}
      <svg width={520} height={240}>
        <line x1={20} y1={150} x2={320} y2={150}
              stroke="#999" strokeDasharray="4,4" />
        <polyline points={wave.join(" ")}
                  fill="none" stroke="green" strokeWidth={2} />
      </svg>

      {/* ---- 周波数 ---- */}
      周波数 f =
      <input
        type="range"
        min={0.1}
        max={1.0}
        step={0.1}
        value={freq}
        onChange={e => setFreq(Number(e.target.value))}
        style={{ width: 200, margin: "0 8px" }}
      />
      <b>{displayFreq.toFixed(0)} Hz</b>

      <div style={{ marginTop: 8 }}>
        <button onClick={() => setRealMode(m => !m)}>
          {realMode ? "視覚化モード" : "実周波数モード"}
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={() => setPlaying(p => !p)}>
          {playing ? "停止" : "再生"}
        </button>
      </div>

      {/* ---- FFT 振幅 ---- */}
      <h3>FFT 振幅スペクトル</h3>
      <svg width={520} height={160}>
        {mag.slice(0, N / 4).map((m, i) => {
          const x = 20 + i;
          const y = 140 - m * 0.3;
          return (
            <line
              key={i}
              x1={x}
              y1={140}
              x2={x}
              y2={y}
              stroke="#0066cc"
            />
          );
        })}
      </svg>

      {/* ---- FFT 位相 ---- */}
      <h3>FFT 位相スペクトル（−π ～ π）</h3>
      <svg width={520} height={160}>
        <line x1={20} y1={80} x2={300} y2={80} stroke="#999" />
        {phaseSpec.slice(0, N / 4).map((p, i) => {
          const x = 20 + i;
          const y = 80 - (p / Math.PI) * 60;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={1.5}
              fill="#cc0000"
            />
          );
        })}
      </svg>
    </div>
  );
}

/* =====================================================
   App
===================================================== */
export default function App() {
  return (
    <div style={{ fontFamily: "sans-serif" }}>
      <PhaseWave />
    </div>
  );
}