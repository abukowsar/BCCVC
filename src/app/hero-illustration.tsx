const tiles = [
  { x: 60, y: 90, label: "ঢাকা", skin: "#f2c9a0", shirt: "#0a917f", bg: "#dff3ee", speaker: true },
  { x: 183, y: 90, label: "চট্টগ্রাম", skin: "#d9a57a", shirt: "#3d6bd8", bg: "#e5ecfb" },
  { x: 306, y: 90, label: "রাজশাহী", skin: "#e8b88f", shirt: "#e0873a", bg: "#fdf0e3" },
  { x: 60, y: 180, label: "খুলনা", skin: "#c98f63", shirt: "#7a5bd1", bg: "#eee8fb" },
  { x: 183, y: 180, label: "সিলেট", skin: "#f0c49c", shirt: "#12806f", bg: "#e2f4ef" },
  { x: 306, y: 180, label: "রংপুর", skin: "#dcaa80", shirt: "#c2477a", bg: "#fbe6ee" },
];
const TILE_W = 114;
const TILE_H = 82;

export default function HeroIllustration({ liveTitle }: { liveTitle?: string }) {
  return <svg className="lp-art" viewBox="0 0 520 440" role="img" aria-label="সারাদেশের দপ্তর ভিডিও কনফারেন্সে যুক্ত">
    <defs>
      <linearGradient id="lpArtBlob" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d7f1ea" /><stop offset="1" stopColor="#eef6f5" /></linearGradient>
      <linearGradient id="lpArtScreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#173f50" /><stop offset="1" stopColor="#0b222d" /></linearGradient>
    </defs>

    <path d="M262 18c104-6 214 52 236 150 22 100-44 214-160 244-118 30-250-10-298-104C-8 212 34 92 118 48 160 26 210 21 262 18Z" fill="url(#lpArtBlob)" />
    <g className="lp-art-network" stroke="#8fd3c3" strokeWidth="1.5" strokeDasharray="4 6" fill="none">
      <path d="M26 128 C 10 200, 30 280, 70 330" /><path d="M494 110 C 516 180, 506 260, 470 316" /><path d="M120 22 C 200 0, 320 0, 400 26" />
    </g>
    {[[26, 128], [70, 330], [494, 110], [470, 316], [120, 22], [400, 26]].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" fill="#fff" stroke="#2fb39a" strokeWidth="2.5" />)}

    <rect x="226" y="330" width="68" height="44" fill="#9fb3b8" />
    <rect x="176" y="368" width="168" height="12" rx="6" fill="#7f969c" />
    <g className="lp-art-screen">
      <rect x="40" y="52" width="440" height="284" rx="20" fill="url(#lpArtScreen)" />
      <circle cx="64" cy="71" r="4.5" fill="#ef6b5b" /><circle cx="80" cy="71" r="4.5" fill="#f2b441" /><circle cx="96" cy="71" r="4.5" fill="#42c5a9" />
      <rect x="360" y="63" width="100" height="16" rx="8" fill="rgba(255,255,255,.08)" />
      <text x="410" y="75" textAnchor="middle" className="lp-art-caption">VC-2026-0911-A</text>

      {tiles.map((tile) => {
        const cx = tile.x + TILE_W / 2;
        return <g key={tile.label}>
          <rect x={tile.x} y={tile.y} width={TILE_W} height={TILE_H} rx="10" fill={tile.bg} />
          <path d={`M${cx - 26} ${tile.y + TILE_H} Q${cx - 26} ${tile.y + 52} ${cx} ${tile.y + 52} Q${cx + 26} ${tile.y + 52} ${cx + 26} ${tile.y + TILE_H} Z`} fill={tile.shirt} />
          <circle cx={cx} cy={tile.y + 34} r="14" fill={tile.skin} />
          <path d={`M${cx - 14} ${tile.y + 32} Q${cx} ${tile.y + 12} ${cx + 14} ${tile.y + 32} Q${cx} ${tile.y + 24} ${cx - 14} ${tile.y + 32} Z`} fill="#2b2320" />
          <rect x={tile.x + 6} y={tile.y + TILE_H - 20} width="62" height="15" rx="7.5" fill="rgba(11,34,45,.72)" />
          <text x={tile.x + 12} y={tile.y + TILE_H - 9} className="lp-art-label">{tile.label}</text>
          {tile.speaker && <rect className="lp-art-speaker" x={tile.x - 2} y={tile.y - 2} width={TILE_W + 4} height={TILE_H + 4} rx="12" fill="none" stroke="#42c5a9" strokeWidth="3" />}
        </g>;
      })}

      <circle cx="210" cy="298" r="15" fill="rgba(255,255,255,.12)" />
      <rect x="206" y="289" width="8" height="12" rx="4" fill="#fff" /><path d="M202 298a8 8 0 0 0 16 0M210 306v4" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="250" cy="298" r="15" fill="rgba(255,255,255,.12)" />
      <rect x="240" y="292" width="14" height="12" rx="3" fill="#fff" /><path d="M254 296l7-4v12l-7-4Z" fill="#fff" />
      <circle cx="290" cy="298" r="15" fill="#e0564a" />
      <path d="M281 300c6-5 12-5 18 0" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>

    <g className="lp-art-float">
      <rect x="352" y="4" width="152" height="54" rx="14" fill="#fff" />
      <circle cx="376" cy="31" r="11" fill="#e3f3ef" /><circle className="lp-art-pulse" cx="376" cy="31" r="5" fill="#2fb39a" />
      <text x="396" y="27" className="lp-art-card-title">{liveTitle ? "এখন লাইভ" : "লাইভ সভা নেই"}</text>
      <text x="396" y="44" className="lp-art-card-sub">{liveTitle ? (liveTitle.length > 16 ? `${liveTitle.slice(0, 15)}…` : liveTitle) : "পরবর্তী সভার অপেক্ষায়"}</text>
    </g>
    <g className="lp-art-float delay">
      <rect x="0" y="270" width="160" height="58" rx="14" fill="#fff" />
      <rect x="16" y="304" width="5" height="8" rx="1.5" fill="#2fb39a" /><rect x="24" y="298" width="5" height="14" rx="1.5" fill="#2fb39a" /><rect x="32" y="292" width="5" height="20" rx="1.5" fill="#2fb39a" /><rect x="40" y="286" width="5" height="26" rx="1.5" fill="#2fb39a" />
      <text x="56" y="296" className="lp-art-card-title">৬৪ জেলা</text>
      <text x="56" y="314" className="lp-art-card-sub">সংযোগ সক্রিয়</text>
    </g>
  </svg>;
}
