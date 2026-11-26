/* Haus Visualisierung – Stile (CSS) und Logo. */

import { HV_BLUR, hvThemeCss } from "./grundlagen.js";

/* ------------------------------------------------------------------------ */
/*  Stile                                                                    */
/* ------------------------------------------------------------------------ */
const STYLES = `
:host{display:block;height:100%;
  --hv-accent:var(--primary-color,#5aa0ff);--hv-text:#eef2f8;--hv-dim:rgba(238,242,248,.64);--hv-faint:rgba(238,242,248,.38);
  --hv-glass:rgba(16,22,34,.58);--hv-surface:rgba(255,255,255,.055);--hv-surface-2:rgba(255,255,255,.1);--hv-line:rgba(255,255,255,.09);
  --hv-warm:#ffc457;--hv-alert:#ff6b5b;--hv-ok:#4fd18b;--hv-cool:#63c7ff;--hv-heat:#ff8a3d;--hv-r:20px;
  color:var(--hv-text);font-family:var(--ha-font-family-body,var(--paper-font-body1_-_font-family,Roboto,system-ui,sans-serif));
  -webkit-font-smoothing:antialiased}
:host(.card){height:auto;--hv-text:var(--primary-text-color);--hv-dim:var(--secondary-text-color);--hv-faint:var(--disabled-text-color);
  --hv-surface:rgba(127,127,127,.1);--hv-surface-2:rgba(127,127,127,.18);--hv-line:var(--divider-color,rgba(127,127,127,.2));
  --hv-glass:rgba(127,127,127,.05);--hv-lower:rgba(127,127,127,.1);--hv-pill:rgba(127,127,127,.14);--hv-out:rgba(110,200,120,.1)}
*{box-sizing:border-box}[hidden]{display:none!important}
button{font:inherit;color:inherit;border:0;background:none;cursor:pointer;padding:0}
ha-icon{--mdc-icon-size:20px;display:inline-flex;align-items:center;justify-content:center;flex:none;width:var(--mdc-icon-size);height:var(--mdc-icon-size);line-height:0;vertical-align:middle}
.app{position:relative;display:flex;height:calc(100vh - var(--hv-top,0px));height:calc(100dvh - var(--hv-top,0px));overflow:hidden}
.rail{height:100%}
.bg{position:absolute;inset:0;z-index:0;background:var(--hv-bg,radial-gradient(1100px 650px at 12% -8%,#2a3e66 0%,transparent 62%),radial-gradient(900px 600px at 108% 6%,#3a2a58 0%,transparent 55%),radial-gradient(800px 500px at 60% 120%,#123a3a 0%,transparent 60%),linear-gradient(160deg,#0c111d,#111a2c 50%,#0a0e17));background-size:cover;background-position:center}
.glass{background:var(--hv-glass);border:1px solid var(--hv-line);border-radius:var(--hv-r)}
.blur .glass,.blur .rail{-webkit-backdrop-filter:blur(18px) saturate(140%);backdrop-filter:blur(18px) saturate(140%)}

/* Navigation */
.rail{position:relative;z-index:2;width:88px;flex:none;display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 0 12px;background:rgba(8,12,20,.55);border-right:1px solid var(--hv-line);overflow-y:auto;scrollbar-width:none}
.logo{display:flex;flex-direction:column;align-items:center;gap:2px;margin-bottom:12px}
.logo svg{width:40px;height:40px}.logo small{font-size:10px;color:var(--hv-faint);letter-spacing:.04em}
.nav{width:72px;padding:9px 0 7px;border-radius:16px;display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--hv-dim);font-size:11px;line-height:1.1;text-align:center;transition:background .2s,color .2s}
.nav:hover{background:rgba(255,255,255,.05)}
.nav.active{background:rgba(255,255,255,.1);color:var(--hv-text)}.nav.active ha-icon{color:var(--hv-accent)}
.nav ha-icon{--mdc-icon-size:22px}
.rail hr{width:44px;border:0;border-top:1px solid var(--hv-line);margin:8px 0}
.rail .grow{flex:1}
.main{position:relative;z-index:1;flex:1;overflow-y:auto;overflow-x:hidden;padding:22px 28px 48px}
.wrap{width:100%;margin:0}

/* Kopfzeile */
.top{display:flex;align-items:flex-end;gap:18px;flex-wrap:wrap}
.menu{display:none;width:40px;height:40px;border-radius:12px;align-items:center;justify-content:center;background:var(--hv-surface)}
.greet{font-size:14px;color:var(--hv-dim)}
.clock{font-size:46px;font-weight:300;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.date{font-size:14px;color:var(--hv-dim);margin-top:4px}
.top .sp{flex:1}
.weather{display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:18px}
.weather ha-icon{--mdc-icon-size:30px;color:var(--hv-warm)}.weather .wt{font-size:24px;font-weight:300}.weather .wc{font-size:12px;color:var(--hv-dim)}
.persons{display:flex;gap:6px}
.person{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-size:14px;font-weight:600;background:var(--hv-surface-2);border:2px solid rgba(255,255,255,.15);overflow:hidden;opacity:.6}
.person.home{border-color:var(--hv-ok);opacity:1}.person img{width:100%;height:100%;object-fit:cover}
.notice{margin:0 0 14px;padding:10px 14px;border-radius:14px;background:rgba(255,196,87,.14);border:1px solid rgba(255,196,87,.35);font-size:13px}

/* Status-Chips */
.chips{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 20px}
.chip{display:flex;align-items:center;gap:8px;padding:6px 14px 6px 6px;border-radius:999px;background:var(--hv-glass);border:1px solid var(--hv-line);font-size:13px;transition:transform .15s}
.chip:active{transform:scale(.97)}
.chip .ic{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--hv-surface-2)}
.chip .ic ha-icon{--mdc-icon-size:17px}
.chip.warm .ic{background:rgba(255,196,87,.2);color:var(--hv-warm)}.chip.alert .ic{background:rgba(255,107,91,.2);color:var(--hv-alert)}
.chip.ok .ic{background:rgba(79,209,139,.18);color:var(--hv-ok)}.chip.heat .ic{background:rgba(255,138,61,.2);color:var(--hv-heat)}
.chip.dim{color:var(--hv-dim)}
.chip.alert{border-color:rgba(255,107,91,.35)}

/* Hausschnitt */
.house{position:relative;margin:0 auto}
.roof{position:relative;height:110px;margin:0 2px -1px;cursor:pointer}
.roof>svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.roof .shape{fill:rgba(255,255,255,.045);stroke:var(--hv-line);stroke-width:1.2;vector-effect:non-scaling-stroke}
.roof .pv{fill:rgba(99,150,255,.16);stroke:rgba(140,180,255,.35);stroke-width:1;vector-effect:non-scaling-stroke;transition:fill .6s}
.roof .pvl{stroke:rgba(140,180,255,.25);stroke-width:1;vector-effect:non-scaling-stroke}
.roof.producing .pv{fill:rgba(120,180,255,.42);filter:drop-shadow(0 0 6px rgba(120,180,255,.55))}
.roof .sun{position:absolute;left:6%;top:-6px;color:var(--hv-faint);transition:color .6s}
.roof .sun ha-icon{--mdc-icon-size:30px}
.roof.producing .sun{color:var(--hv-warm);filter:drop-shadow(0 0 10px rgba(255,196,87,.7))}
.energy{position:absolute;left:0;right:0;bottom:10px;display:flex;justify-content:center;gap:8px;flex-wrap:wrap;padding:0 18%}
.ep{display:flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;background:var(--hv-pill,rgba(0,0,0,.38));border:1px solid var(--hv-line);font-size:12px;color:var(--hv-dim);white-space:nowrap}
.ep b{color:var(--hv-text);font-weight:600;font-variant-numeric:tabular-nums}.ep ha-icon{--mdc-icon-size:16px}
.ep-pv ha-icon{color:var(--hv-warm)}.ep-battery ha-icon{color:var(--hv-ok)}.ep-power ha-icon{color:var(--hv-cool)}
.roof .rtitle{position:absolute;left:0;right:0;top:60px;text-align:center;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--hv-faint)}
.frame{border:1px solid var(--hv-line);border-radius:0 0 6px 6px;overflow:hidden}
.frame.lower{border-radius:0 0 22px 22px;border-top:0;background:var(--hv-lower,rgba(0,0,0,.22))}
.floor{display:flex;background:var(--hv-glass)}
.floor+.floor{border-top:1px dashed var(--hv-line)}
.flabel{width:60px;flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:12px 0;border-right:1px solid var(--hv-line);color:var(--hv-dim)}
.fname{writing-mode:vertical-rl;transform:rotate(180deg);font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:600;color:var(--hv-text);white-space:nowrap;max-height:180px;overflow:hidden;text-overflow:ellipsis}
.fstat{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11px;font-variant-numeric:tabular-nums}
.fl-lw{display:flex;flex-direction:column;align-items:center;gap:1px}.fl-lw ha-icon{--mdc-icon-size:16px}.fl-lw.on{color:var(--hv-warm)}
.rooms{flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(172px,1fr));gap:12px;padding:14px}
.ground{position:relative;height:16px;margin:0 -18px}
.ground::before{content:"";position:absolute;left:0;right:0;top:6px;height:4px;border-radius:2px;background:linear-gradient(90deg,transparent,rgba(110,200,120,.55) 12%,rgba(110,200,120,.55) 88%,transparent)}
.outdoor{margin-top:22px}
.outdoor .floor{border-radius:22px;border:1px solid rgba(110,200,120,.22);background:linear-gradient(180deg,var(--hv-out,rgba(40,80,50,.28)),var(--hv-glass))}
.outdoor .flabel{border-right-color:rgba(110,200,120,.2)}
.secttitle{display:flex;align-items:center;gap:10px;margin:28px 2px 12px;font-size:15px;font-weight:600}
.secttitle ha-icon{color:var(--hv-dim)}.secttitle .sp{flex:1}

/* Raumkachel */
.room{position:relative;min-height:132px;border-radius:18px;padding:12px 13px;background:linear-gradient(160deg,rgba(255,255,255,.09),rgba(255,255,255,.025));border:1px solid var(--hv-line);overflow:hidden;cursor:pointer;display:flex;flex-direction:column;transition:box-shadow .5s,border-color .5s,transform .15s}
:host(.card) .room{background:var(--hv-surface)}
.room:active{transform:scale(.985)}
.room .pic{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.5}
.room .pic::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,12,20,.25),rgba(8,12,20,.88))}
.room::before{content:"";position:absolute;left:-20%;right:-20%;top:-60%;height:130%;background:radial-gradient(closest-side,rgba(255,196,87,.32),transparent);opacity:0;transition:opacity .6s;pointer-events:none}
.room.lit{border-color:rgba(255,196,87,.42);box-shadow:0 10px 30px -14px rgba(255,196,87,.55)}
.room.lit::before{opacity:1}
.room-head{position:relative;display:flex;align-items:center;gap:7px}
.room-head .ri{--mdc-icon-size:18px;color:var(--hv-dim)}.room.lit .ri{color:var(--hv-warm)}
.rname{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.room-alerts{margin-left:auto;display:flex;align-items:center;gap:4px}
.al{display:flex;align-items:center;gap:1px;font-size:11px}.al ha-icon{--mdc-icon-size:16px}
.al-win{color:var(--hv-alert)}.al-heat{color:var(--hv-heat)}
.pulse{display:block;width:8px;height:8px;border-radius:50%;background:var(--hv-accent);box-shadow:0 0 0 0 rgba(90,160,255,.6);animation:pulse 2s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(90,160,255,.55)}70%{box-shadow:0 0 0 8px rgba(90,160,255,0)}100%{box-shadow:0 0 0 0 rgba(90,160,255,0)}}
.room-clim{position:relative;margin-top:auto;display:flex;align-items:baseline;gap:10px;padding-top:10px}
.rt{font-size:28px;font-weight:300;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.rh{font-size:12px;color:var(--hv-dim)}
.room-foot{position:relative;display:flex;gap:6px;margin-top:8px;min-height:0}
.mini{white-space:nowrap;display:flex;align-items:center;gap:4px;padding:4px 9px;border-radius:999px;background:rgba(0,0,0,.28);border:1px solid var(--hv-line);font-size:11.5px;color:var(--hv-dim);font-variant-numeric:tabular-nums}
:host(.card) .mini{background:var(--hv-surface)}
.mini ha-icon{--mdc-icon-size:15px}.mini.on{background:rgba(255,196,87,.18);color:var(--hv-warm);border-color:rgba(255,196,87,.38)}

/* Seiten */
.ptitle{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px}
.ptitle h1{margin:0;font-size:30px;font-weight:400;letter-spacing:-.01em}
.ptitle .psub{color:var(--hv-dim);font-size:14px}.ptitle .sp{flex:1}
.pbtn{display:inline-flex;align-items:center;gap:7px;padding:9px 15px;border-radius:12px;background:var(--hv-surface-2);border:1px solid var(--hv-line);font-size:13px;white-space:nowrap}
.pbtn:hover{background:rgba(255,255,255,.15)}.pbtn.on{background:rgba(255,196,87,.2);color:var(--hv-warm);border-color:rgba(255,196,87,.38)}
.pbtn.primary{background:var(--hv-accent);color:#fff;border-color:transparent}
.pbtn ha-icon{--mdc-icon-size:18px}
.iconbtn{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(0,0,0,.3);border:1px solid var(--hv-line)}
.fhead{display:flex;align-items:center;gap:10px;margin:26px 2px 12px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--hv-dim);font-weight:600}
.fhead .sp{flex:1;height:1px;background:var(--hv-line)}
.fhead .pbtn{letter-spacing:0;text-transform:none;font-weight:400}

/* Raumseite */
.hero{position:relative;overflow:hidden;padding:16px 20px 18px;min-height:190px;display:flex;flex-direction:column;margin-bottom:18px}
.hero .pic{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.55}
.hero .pic::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,12,20,.9),rgba(8,12,20,.45) 60%,rgba(8,12,20,.7))}
.hero>*{position:relative}
.hero-top{display:flex;align-items:center;gap:10px}.hero-top .crumb{font-size:13px;color:var(--hv-dim);letter-spacing:.1em;text-transform:uppercase}.hero-top .sp{flex:1}
.hero-main{display:flex;align-items:flex-end;gap:18px;flex-wrap:wrap;margin-top:auto;padding-top:22px}
.hero h1{margin:0;font-size:38px;font-weight:400;letter-spacing:-.01em;display:flex;align-items:center;gap:12px}
.hero h1 ha-icon{--mdc-icon-size:34px;color:var(--hv-dim)}
.hero-clim{display:flex;gap:16px;margin-top:6px;color:var(--hv-dim);font-size:15px;font-variant-numeric:tabular-nums}.hero-clim .ht{color:var(--hv-text);font-size:22px;font-weight:300}
.hero-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
.badge{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;font-size:12px;background:var(--hv-surface-2)}
.badge ha-icon{--mdc-icon-size:15px}.badge.alert{background:rgba(255,107,91,.2);color:#ffb0a6}.badge.acc{background:rgba(90,160,255,.2)}.badge.heat{background:rgba(255,138,61,.2);color:#ffc29a}
.hero-acts{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto}

.sections{columns:360px;column-gap:16px}
.sgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr));gap:16px;align-items:start}
.sgrid>*{min-width:0}
.sgrid .section{margin-bottom:0}
.narrow .sgrid{grid-template-columns:minmax(0,1fr)}
.section{break-inside:avoid;margin-bottom:16px;display:inline-block;width:100%}
.shead{display:flex;align-items:center;gap:10px;padding:13px 16px 4px}
.shead ha-icon{color:var(--hv-dim);--mdc-icon-size:19px}
.shead .st{font-size:15px;font-weight:600}.shead .gc{font-size:12px;color:var(--hv-dim)}.shead .sp{flex:1}
.shead.alert .gc{color:var(--hv-alert)}
.gbtn{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:10px;background:var(--hv-surface-2);font-size:12px}
.gbtn ha-icon{--mdc-icon-size:16px}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(146px,1fr));gap:8px;padding:8px 12px 14px}

/* Kacheln */
.tile{position:relative;display:flex;flex-direction:column;gap:3px;padding:11px 12px 12px;border-radius:16px;background:var(--hv-surface);border:1px solid transparent;cursor:pointer;overflow:hidden;min-height:84px;user-select:none;-webkit-user-select:none;transition:background .25s,border-color .25s,transform .12s}
.tile:active{transform:scale(.98)}
.tile.wide{grid-column:span 2}
.tile.on{background:var(--hv-surface-2)}
.tile.unavail{opacity:.42}
.trow{position:relative;z-index:1;display:flex;align-items:center;gap:8px;margin-bottom:5px}
.tic{width:36px;height:36px;flex:none;border-radius:12px;display:grid;place-items:center;background:var(--hv-surface-2);transition:background .25s,color .25s}
.tname{position:relative;z-index:1;font-size:13px;font-weight:500;line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.tsub{position:relative;z-index:1;font-size:11px;color:var(--hv-faint)}
.tstate,.tmeta{position:relative;z-index:1;font-size:12px;color:var(--hv-dim);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tmeta{color:var(--hv-text)}
.tbig{margin-left:auto;font-size:20px;font-weight:300;font-variant-numeric:tabular-nums;white-space:nowrap}
.sp{flex:1}
.fill{position:absolute;left:0;top:0;bottom:0;width:0;pointer-events:none;transition:width .45s ease}
.tile.light .fill{background:linear-gradient(90deg,rgba(255,196,87,.24),rgba(255,196,87,.07))}
.tile.light.on{border-color:rgba(255,196,87,.32)}
.tile.light.on .tic{color:var(--lc,var(--hv-warm));background:rgba(255,196,87,.18)}
.tile.switch.on .tic{color:var(--hv-accent);background:rgba(90,160,255,.2)}
.tile.cover .cfill{background:linear-gradient(90deg,rgba(99,199,255,.16),rgba(99,199,255,.04))}
.tile.cover.on .tic{color:var(--hv-cool);background:rgba(99,199,255,.18)}
.tile.climate.heating .tic{color:var(--hv-heat);background:rgba(255,138,61,.2)}
.tile.climate.heating{border-color:rgba(255,138,61,.3)}
.tile.media.on .tic{color:var(--hv-accent);background:rgba(90,160,255,.2)}
.tile.alert{border-color:rgba(255,107,91,.42)}
.tile.alert .tic{color:var(--hv-alert);background:rgba(255,107,91,.2)}
.tile.presence.on .tic{color:var(--hv-accent);background:rgba(90,160,255,.2)}
.tile.scene .tic{color:#c79bff}
.tile.flash{animation:flash .7s}
@keyframes flash{0%{background:rgba(199,155,255,.35)}100%{background:var(--hv-surface)}}
.tile.batt .bar{position:relative;z-index:1;height:5px;border-radius:3px;background:var(--hv-surface-2);overflow:hidden;margin-top:6px}
.tile.batt .bar i{display:block;height:100%;background:var(--hv-ok);border-radius:3px}
.tile.batt.low .bar i{background:var(--hv-warm)}.tile.batt.crit .bar i{background:var(--hv-alert)}
.tile.batt.crit .tic{color:var(--hv-alert)}.tile.batt.low .tic{color:var(--hv-warm)}
.ctrls{position:relative;z-index:1;display:flex;gap:6px;margin-top:8px}
.btn{flex:1;height:34px;border-radius:10px;background:rgba(255,255,255,.08);display:grid;place-items:center;transition:background .15s}
:host(.card) .btn{background:var(--hv-surface-2)}
.btn:hover{background:rgba(255,255,255,.16)}.btn:active{background:rgba(255,255,255,.24)}
.btn.sm{flex:none;width:34px;height:34px}
.btn ha-icon{--mdc-icon-size:18px}
.crow{position:relative;z-index:1;display:flex;align-items:center;gap:6px;margin-top:6px}
.ttarget{min-width:52px;text-align:center;font-size:16px;font-variant-numeric:tabular-nums}
.lockbtn{position:relative;z-index:1;flex:none;margin-top:8px;height:32px;padding:0 12px;font-size:12px}
.slider{position:relative;z-index:2;width:100%;margin:8px 0 0;height:22px;accent-color:var(--hv-warm);cursor:pointer}
.tile.camera{padding:0;min-height:0}
.cam{position:relative;aspect-ratio:16/9;background:#05070c}
.cam img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity .3s}
.cam img.ready{opacity:1}
.camname{position:absolute;left:10px;bottom:8px;display:flex;align-items:center;gap:6px;font-size:12px;padding:4px 9px;border-radius:999px;background:rgba(0,0,0,.55)}
.camname ha-icon{--mdc-icon-size:15px}
.empty{padding:40px 20px;text-align:center;color:var(--hv-dim)}
.empty ha-icon{--mdc-icon-size:42px;display:block;margin:0 auto 10px;color:var(--hv-faint)}

/* Einstellungen */
.set{padding:18px 20px;margin-bottom:16px}
.set h2{margin:0 0 4px;font-size:17px;font-weight:600;display:flex;align-items:center;gap:8px}
.set h2 ha-icon{color:var(--hv-accent)}
.set p.hint{margin:0 0 14px;color:var(--hv-dim);font-size:13px;line-height:1.45}
.srow{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--hv-line);flex-wrap:wrap}
.srow:first-of-type{border-top:0}
.srow .lbl{flex:1;min-width:160px;font-size:14px}.srow .lbl small{display:block;color:var(--hv-dim);font-size:12px;margin-top:2px}
.srow.sub{padding-left:34px}
.srow.hiddenarea .lbl{opacity:.45;text-decoration:line-through}
.inp{background:rgba(0,0,0,.3);border:1px solid var(--hv-line);border-radius:10px;color:var(--hv-text);padding:9px 11px;font:inherit;font-size:13px;min-width:0}
.inp.w{width:280px;max-width:100%}.inp.s{width:90px}
.sbtn{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--hv-surface-2)}
.sbtn:hover{background:rgba(255,255,255,.18)}.sbtn:disabled{opacity:.28;cursor:default;background:var(--hv-surface)}.sbtn.on{color:var(--hv-accent)}.sbtn.danger:hover{background:rgba(255,107,91,.3)}
.sbtn ha-icon{--mdc-icon-size:18px}
.pins{display:flex;flex-wrap:wrap;gap:6px;width:100%;padding-left:34px}
.simlist{margin:4px 0 0;padding:0;list-style:none;display:grid;gap:2px;font-size:12px;color:var(--hv-dim)}.simlist b{font-variant-numeric:tabular-nums;margin-right:6px;color:inherit;font-weight:600}.simlist .err{color:#ff8a7a}
.pin{display:inline-flex;align-items:center;gap:4px;padding:4px 4px 4px 10px;border-radius:999px;background:var(--hv-surface-2);font-size:12px}
.pin button{width:22px;height:22px;border-radius:50%;display:grid;place-items:center}.pin button:hover{background:rgba(255,107,91,.35)}
.pin ha-icon{--mdc-icon-size:14px}
/* Einstellungen: Reiter und Sortieren */
.stabs{margin:-6px 0 14px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
.stabs::-webkit-scrollbar{display:none}
.stab{flex:none;padding:8px 15px;font-size:13.5px;position:relative}
.stab i{display:none;width:7px;height:7px;border-radius:50%;background:var(--hv-warm);margin-left:2px}
.stab.dirty i{display:inline-block}
.sjump{display:flex;flex-wrap:wrap;gap:6px;margin:-4px 0 14px}
.sjump .altab{flex:none}
.sjumpsel{display:none;width:100%;margin:-4px 0 14px}
.narrow .sjump{display:none}.narrow .sjumpsel{display:block}
.set[data-jump]{scroll-margin-top:12px}
/* Einstellungen: klappbare Abschnitte mit Kurzinfo und Markierungen, „Erweitert“, gekürzte Hinweise, Suche */
.set h2 .shd{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;cursor:pointer;border-radius:8px;flex-wrap:wrap}
.set h2 .shd:focus-visible{outline:2px solid var(--hv-accent);outline-offset:4px}
.set h2 .ssum{margin-left:auto;font-size:12.5px;font-weight:400;color:var(--hv-dim);text-align:right}
.set h2 .chev{--mdc-icon-size:20px;color:var(--hv-faint);transition:transform .2s}
.set:not(.zu) h2 .chev{transform:rotate(180deg)}
.set h2 .sdot{display:none;flex:none;width:8px;height:8px;border-radius:50%;background:var(--hv-warm)}
.set.dirty h2 .sdot{display:inline-block}
.set h2 .smark{display:inline-flex}.set h2 .smark ha-icon{--mdc-icon-size:18px}
.set h2 .smark.warn ha-icon{color:var(--hv-warm)}.set h2 .smark.info ha-icon{color:var(--hv-dim)}
.set.zu{padding-top:14px;padding-bottom:14px}.set.zu h2{margin:0}
.set.zu>:not(h2){display:none!important}
.sadv{border-top:1px solid var(--hv-line)}
.sadv>summary{display:flex;align-items:center;gap:6px;padding:9px 0;cursor:pointer;list-style:none;font-size:13px;color:var(--hv-dim)}
.sadv>summary::-webkit-details-marker{display:none}
.sadv>summary ha-icon{--mdc-icon-size:16px}
.sadv>.srow:first-of-type{border-top:1px solid var(--hv-line)}
.hint.hlong .hrest{display:none}.hint.hlong.open .hrest{display:inline}
.hmore{all:unset;cursor:pointer;color:var(--hv-accent);white-space:nowrap}.hmore:focus-visible{outline:2px solid var(--hv-accent)}
.stools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:-4px 0 12px}
.ssearch{flex:1;min-width:200px;display:flex;align-items:center;position:relative}
.ssearch ha-icon{position:absolute;left:10px;--mdc-icon-size:18px;color:var(--hv-faint);pointer-events:none}
.ssearch .inp{width:100%;padding-left:34px}
.sresbox{display:grid;gap:4px;margin:-4px 0 14px}.sresbox:empty{display:none}
.sfind{all:unset;box-sizing:border-box;display:block;padding:8px 12px;border-radius:10px;background:var(--hv-surface);cursor:pointer}
.sfind:hover,.sfind:focus-visible{background:var(--hv-surface-2)}
.sfind b{display:block;font-weight:500;font-size:14px}.sfind small{color:var(--hv-dim);font-size:12px}
.snone{margin:2px;color:var(--hv-dim);font-size:13px}
.hit{animation:hvhit 2.2s ease}.srow.hit{border-radius:8px}
@keyframes hvhit{0%,55%{box-shadow:0 0 0 2px var(--hv-accent);background:rgba(120,170,255,.12)}100%{box-shadow:none;background:transparent}}
.drag{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:32px;margin:0 -2px 0 -6px;border-radius:8px;color:var(--hv-faint);cursor:grab;touch-action:none}
.drag:hover,.drag:focus-visible{color:var(--hv-text);background:var(--hv-surface)}
.drag ha-icon{--mdc-icon-size:20px}
.fl-title .drag{width:24px;height:24px;margin:0 -4px 0 -4px}.fl-title .drag ha-icon{--mdc-icon-size:18px}
.sortl{position:relative}
.sortl>.sitem+.sitem>.srow:first-child,.sortl>.srow.sitem+.srow.sitem{border-top:1px solid var(--hv-line)}
.sitem.dragging{position:relative;z-index:5;cursor:grabbing;border-radius:12px;background:rgba(30,40,60,.92);box-shadow:0 10px 30px rgba(0,0,0,.45);transition:none}
.sitem.dragging>.srow{border-top-color:transparent!important}
.pin.sitem{cursor:grab;touch-action:pan-y;user-select:none}
.pin.sitem.dragging{background:rgba(124,196,255,.3)}
.actcard.dragging{background:rgba(30,40,60,.95)}
.sorting .sitem:not(.dragging){transition:transform .12s}
.flb+.flb{margin-top:4px}
.techfound{color:var(--hv-text)!important;background:var(--hv-surface);border-radius:10px;padding:7px 10px}
.techman{gap:10px}.tml{display:flex;flex-direction:column;gap:3px}.tml small{font-size:11px;color:var(--hv-dim)}
.fl-title{margin:14px 0 2px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--hv-dim);display:flex;align-items:center;gap:8px}
.tgl{position:relative;width:44px;height:26px;flex:none}
.tgl input{opacity:0;width:0;height:0}
.tgl span{position:absolute;inset:0;border-radius:13px;background:var(--hv-surface-2);transition:background .2s;cursor:pointer}
.tgl span::after{content:"";position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .2s}
.tgl input:checked+span{background:var(--hv-accent)}.tgl input:checked+span::after{transform:translateX(18px)}
.savebar{position:sticky;bottom:12px;display:flex;gap:10px;align-items:center;justify-content:flex-end;padding:12px 16px;margin-top:8px;z-index:3}
.savebar .msg{flex:1;color:var(--hv-dim);font-size:13px}
.savebar .where{flex:1;min-width:0;color:var(--hv-dim);font-size:12px}.savebar.dirty .msg{flex:0 1 auto;color:var(--hv-text);font-weight:600}
.savebar .pbtn:disabled{opacity:.45;cursor:default}
.instant{display:inline-flex;align-items:center;gap:2px;margin-left:6px;padding:1px 7px 1px 4px;border-radius:999px;font-size:11px;font-weight:500;line-height:16px;vertical-align:middle;white-space:nowrap;color:#ffc457;background:rgba(255,196,87,.12);border:1px solid rgba(255,196,87,.3)}
.instant ha-icon{--mdc-icon-size:12px}.savehint{margin:-4px 0 10px}
.toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);padding:10px 16px;border-radius:12px;background:rgba(20,24,34,.95);border:1px solid var(--hv-line);font-size:13px;z-index:20;box-shadow:0 10px 30px rgba(0,0,0,.4)}

/* ====== Kompakt-Modus ====== */
.dense .main{padding:14px 20px 32px}
.dense:not(.narrow) .rail{width:66px;padding-top:10px}
.dense:not(.narrow) .nav{width:50px;padding:11px 0;gap:0}
.dense:not(.narrow) .nav span{display:none}
.dense .logo{margin-bottom:8px}.dense .logo svg{width:34px;height:34px}
.dtop{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:12px}
.dtop .clockbox{display:flex;flex-direction:column;line-height:1.05;min-width:90px}
.dtop .clock{font-size:30px}.dtop .date{font-size:11.5px;margin-top:3px;white-space:nowrap}
.dtop .chips{margin:0;gap:6px;flex:0 1 auto}
.dtop .chip{padding:3px 11px 3px 3px;font-size:12.5px;gap:6px}.dtop .chip .ic{width:24px;height:24px}.dtop .chip .ic ha-icon{--mdc-icon-size:15px}
.dtop .weather{padding:5px 12px 5px 8px;border-radius:999px;gap:6px}.dtop .weather ha-icon{--mdc-icon-size:22px}.dtop .weather .wt{font-size:16px}
.dtop .person{width:32px;height:32px;font-size:12px}
.roofc{position:relative;height:40px;margin:0 2px -1px;cursor:pointer}
.roofc>svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.roofc .shape{fill:rgba(255,255,255,.04);stroke:var(--hv-line);stroke-width:1.2;vector-effect:non-scaling-stroke}
.roofc .energy{bottom:6px;padding:0 10%;gap:6px}
.roofc .sun{position:absolute;left:5%;bottom:6px;color:var(--hv-faint);transition:color .6s}.roofc .sun ha-icon{--mdc-icon-size:20px}
.roofc.producing .sun{color:var(--hv-warm);filter:drop-shadow(0 0 8px rgba(255,196,87,.7))}
.dense .ep{padding:3px 10px;font-size:11.5px;background:rgba(10,14,22,.7)}
.dense .flabel{width:38px;gap:6px;padding:8px 0}
.dense .fname{font-size:11px;letter-spacing:.12em}
.dense .fl-t{display:none}
.fbody{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;padding:10px}
.dense .rooms{padding:0;gap:8px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.dense .room{min-height:0;padding:9px 11px 9px;border-radius:14px}
.dense .room-head .ri{--mdc-icon-size:16px}.dense .rname{font-size:13px}
.dense .room-clim{padding-top:4px;gap:8px}.dense .rt{font-size:23px}
.dense .room-foot{margin-top:5px}.dense .room-foot:not(:has(:not([hidden]))){display:none}
.dense .mini.ml:not(.on){padding:4px 6px}
.rchips{display:flex;flex-wrap:wrap;gap:6px}
.rchip{position:relative;display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:3px 4px 3px 10px;border-radius:11px;background:var(--hv-surface);border:1px solid var(--hv-line);cursor:pointer;transition:border-color .4s,background .4s}
.rchip:not(:has(.ml)){padding-right:11px}
.rchip .ri{--mdc-icon-size:16px;color:var(--hv-dim)}
.rchip .rname{font-size:12.5px;font-weight:500}
.rchip .rt{font-size:12px;color:var(--hv-dim);font-weight:400;letter-spacing:0}
.rchip .room-alerts{margin-left:0}.rchip .room-alerts:not(:has(:not([hidden]))){display:none}
.rchip .mini{padding:3px 6px;background:transparent;border-color:transparent}.rchip .mini.on{background:rgba(255,196,87,.18);border-color:rgba(255,196,87,.38)}
.rchip.lit{border-color:rgba(255,196,87,.42);background:rgba(255,196,87,.09)}.rchip.lit .ri{color:var(--hv-warm)}
.dense .outdoor{margin-top:12px}.dense .outdoor .floor{border-radius:16px;align-items:center}
.dense .outdoor .flabel{width:auto;padding:0 2px 0 14px;border-right:0}
.dense .outdoor .fname{writing-mode:horizontal-tb;transform:none}
.dense .outdoor .fstat{display:none}
.dense .ground{height:12px}.dense .ground::before{top:4px}
.dense .frame.lower{border-radius:0 0 16px 16px}
.house.tabs .flabel{display:none}
.house.tabs .frame{border-radius:0 0 16px 16px}.house.tabs .frame.out .floor{background:linear-gradient(180deg,var(--hv-out,rgba(40,80,50,.28)),var(--hv-glass))}
.ftabs{display:flex;gap:6px;overflow-x:auto;margin:8px 0;scrollbar-width:none}
.ftab{padding:6px 14px;border-radius:999px;background:var(--hv-surface);border:1px solid var(--hv-line);font-size:13px;white-space:nowrap;color:var(--hv-dim)}
.ftab.active{background:var(--hv-surface-2);color:var(--hv-text);border-color:rgba(255,255,255,.28)}
.house.tabs .roofc{margin-bottom:0}
.dense .secttitle{margin:18px 2px 8px;font-size:14px}
.rows.favrows{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px;padding:10px}

.hero.slim{min-height:0;padding:9px 12px;margin-bottom:10px;border-radius:16px}
.hrow{position:relative;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.hero.slim h1{font-size:22px;gap:8px;white-space:nowrap}.hero.slim h1 ha-icon{--mdc-icon-size:22px}
.hero.slim .hero-clim{margin:0;font-size:13px;gap:8px;align-items:baseline}.hero.slim .hero-clim .ht{font-size:17px}
.hero.slim .crumb{font-size:11px;letter-spacing:.12em;color:var(--hv-faint)}
.hero.slim .hero-badges{margin:0}
.hero.slim .iconbtn{width:34px;height:34px;border-radius:10px}
.hero.slim .pbtn{padding:6px 10px;font-size:12.5px;border-radius:10px}
.schip{display:inline-flex;align-items:center;gap:5px;padding:5px 11px 5px 8px;border-radius:999px;background:rgba(199,155,255,.13);color:#dcc8ff;font-size:12px;border:1px solid rgba(199,155,255,.24)}
.schip ha-icon{--mdc-icon-size:15px}.schip.flash{animation:flash .7s}
.vstrip{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
.vchip{display:inline-flex;align-items:center;gap:6px;padding:3px 11px 3px 3px;border-radius:999px;background:var(--hv-glass);border:1px solid var(--hv-line);font-size:12.5px;color:var(--hv-dim)}
.vchip .tic{width:24px;height:24px;border-radius:50%}.vchip .tic ha-icon{--mdc-icon-size:15px}
.vchip .tname{display:inline;font-size:12.5px;font-weight:400;-webkit-line-clamp:unset}
.vchip .tval,.vchip .tstate{position:static;color:var(--hv-text);font-weight:500;font-size:12.5px}
.vchip .tval:empty,.vchip .tstate:empty{display:none}
.vchip.on .tic{color:var(--hv-accent);background:rgba(90,160,255,.2)}
.vchip.alert{border-color:rgba(255,107,91,.45)}.vchip.alert .tic{color:var(--hv-alert);background:rgba(255,107,91,.2)}
.vchip.unavail{opacity:.45}

.dense .sections{column-gap:12px}.dense .section{margin-bottom:12px;border-radius:16px}
.dense .sgrid{gap:12px}
.dense .shead{padding:9px 12px 2px}.dense .shead .st{font-size:14px}
summary.shead{list-style:none;cursor:pointer;padding-bottom:9px}
summary.shead::-webkit-details-marker{display:none}
details[open]>summary.shead{padding-bottom:2px}
.chev{transition:transform .2s}details[open] .chev{transform:rotate(180deg)}
.rows{display:flex;flex-direction:column;gap:5px;padding:6px 8px 8px}
.tile.row{flex-direction:row;align-items:center;gap:9px;min-height:46px;padding:5px 8px 5px 5px;border-radius:12px;touch-action:pan-y}
.tile.row .tic{width:34px;height:34px;border-radius:10px}
.tn{position:relative;z-index:1;flex:1;min-width:0;display:flex;flex-direction:column}
.tile.row .tname{font-size:13px;-webkit-line-clamp:1;display:block;white-space:nowrap;text-overflow:ellipsis}
.tile.row .tsub{font-size:11px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tile.row .tmeta{font-size:11.5px;color:var(--hv-dim)}
.tile.row .tstate{flex:none;font-size:12px}
.tile.row .tval{position:relative;z-index:1;font-size:15px;font-weight:300;font-variant-numeric:tabular-nums;white-space:nowrap}
.rbtns{position:relative;z-index:1;display:flex;align-items:center;gap:4px;flex:none}
.rbtns .btn{width:30px;height:30px;flex:none;border-radius:9px}
.rbtns .ttarget{min-width:44px;text-align:center;font-size:14px;font-variant-numeric:tabular-nums}
.tile.row .pill{position:relative;z-index:1;width:34px;height:20px;border-radius:10px;background:var(--hv-surface-2);flex:none;transition:background .2s}
.tile.row .pill::after{content:"";position:absolute;left:3px;top:3px;width:14px;height:14px;border-radius:50%;background:#c9d1de;transition:transform .2s}
.tile.row.on .pill{background:var(--hv-accent)}.tile.row.on .pill::after{transform:translateX(14px);background:#fff}
.tile.row.switch .tstate,.tile.row.scene .tstate{display:none}
.tile.row.batt .bar{flex:0 0 64px;margin:0}
.tile.row .lockbtn{margin:0;height:30px;flex:none}
.tile.row.dragging,.tile.row.dragging .fill{transition:none}
.tile.row.dragging{border-color:rgba(255,196,87,.6)}
.tile.row.light[data-dim]{cursor:ew-resize}
.rlist{padding:4px 2px;columns:300px;column-gap:0}
.rgroup{break-inside:avoid;display:inline-block;width:100%}
.rsub{display:flex;align-items:center;gap:8px;padding:9px 12px 2px;font-size:13px}
.rsub ha-icon{--mdc-icon-size:17px;color:var(--hv-dim)}.rsub .st{font-weight:600;cursor:pointer}.rsub .gc{font-size:12px;color:var(--hv-dim)}
.rgroup .rows{display:flex;flex-direction:column;gap:5px;padding:5px 10px 8px}
.only-on .tile.row.light:not(.on){display:none}
.only-on .rgroup:not(:has(.tile.light.on)){display:none}
.only-on .rlist:not(:has(.tile.light.on)){display:none}
.only-on .fhead:has(+ .rlist:not(:has(.tile.light.on))){display:none}
/* Breite Monitore: Räume im Raster statt Mehrspaltensatz (der stapelte wenige Räume in 2 Spalten), große Räume doppelt breit */
@media (min-width:1200px){.rlist{columns:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));align-items:start}
.rgroup.big{grid-column:span 2}.rgroup.big .rows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
.sgrid>.section.big{grid-column:span 2}}
.ktable{padding:2px 0}
.ktable.withspark .khead,.ktable.withspark .krow{grid-template-columns:minmax(150px,230px) 70px 96px minmax(170px,440px) minmax(250px,1fr)}
.kspark{position:relative;display:flex;align-items:center;gap:8px;height:44px;min-width:0;cursor:crosshair;touch-action:pan-y}
.kspark .spw{position:relative;flex:1;min-width:60px;height:38px;display:block}
.kspark svg{display:block;width:100%;height:100%;overflow:visible}
.kspark .spnight rect{fill:rgba(140,160,230,.07)}.kspark .sptick line{stroke:rgba(255,255,255,.07);stroke-width:1;vector-effect:non-scaling-stroke}
.kspark .spband{fill:rgba(79,209,139,.09)}
.kspark .spov{fill:none;stroke:#ff6b5b;stroke-width:2.2;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.kspark .spdot{position:absolute;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;border-radius:50%;background:#e26a1c;box-shadow:0 0 0 2px rgba(10,14,23,.85);pointer-events:none}
.kspark.k-h .spdot{background:#2a9ad8}.kspark.k-h.over .spdot{background:#ff6b5b}
.kspark .spl{fill:none;stroke:#e26a1c;stroke-width:1.8;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.kspark .spset{fill:none;stroke:var(--hv-faint);stroke-width:1;stroke-dasharray:3 3;vector-effect:non-scaling-stroke}
.kspark .sprg{flex:none;display:flex;flex-direction:column;line-height:1.25;font-size:11px;color:var(--hv-dim);font-variant-numeric:tabular-nums;min-width:62px}
.kspark .spv{font-size:12.5px;font-weight:600;color:var(--hv-text)}.kspark.k-h.over .spv{color:#ff8a7d}
.kspark.empty .sprg::after{content:"–"}.kspark.none{cursor:default}
.sptip{position:absolute;bottom:calc(100% + 2px);transform:translateX(-50%);display:none;padding:3px 8px;border-radius:8px;background:rgba(10,14,23,.94);border:1px solid var(--hv-line);font-size:11.5px;white-space:nowrap;pointer-events:none;z-index:3;font-variant-numeric:tabular-nums}
.sptip.on{display:block}
.room .kspark{margin:2px 0 4px;position:relative;z-index:1}.room .kspark .spv{display:none}
.narrow .krow .kna{display:none}
.ctrend{padding:12px 16px 10px;margin-bottom:16px}
.ctwrap{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr));gap:0 16px}.dense .ctwrap{gap:0 12px}
.ctband{fill:rgba(79,209,139,.08)}.ctlim{fill:none;stroke:var(--hv-warm);stroke-width:1;stroke-dasharray:5 4;vector-effect:non-scaling-stroke;opacity:.8}
.ctlimt{position:absolute;right:4px;transform:translateY(-120%);font-size:10.5px;color:var(--hv-warm);opacity:.9;pointer-events:none}
.cts.hot b{color:var(--hv-warm)}.cts.vent b{font-size:15px;line-height:1.45}.cts.vent.gut b{color:var(--hv-ok)}.cts.vent.nicht b{color:var(--hv-warm)}
.weather .wf{font-size:12px;color:var(--hv-dim);white-space:nowrap}.weather .wf:empty{display:none}.narrow .weather .wf,.dtop:not(.hk) .weather .wf,.hbar .weather .wf{display:none}
.weather.hint{box-shadow:inset 0 0 0 1px rgba(255,196,87,.45)}
.termin{display:flex;align-items:center;gap:8px;padding:8px 14px 8px 10px;border-radius:999px;font-size:14px;max-width:min(320px,40vw);min-width:0;flex:0 1 auto;color:inherit}
.termin[hidden]{display:none}.termin ha-icon{--mdc-icon-size:20px;color:var(--tc,var(--hv-dim));flex:none}
.termin .tmt{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.termin.hot{box-shadow:inset 0 0 0 1.5px var(--tc,#ffc457);font-weight:600}
.dtop .termin,.hbar .termin{padding:5px 12px 5px 8px;font-size:13px}
.narrow .termin:not(.hot){display:none}.narrow .termin{padding:5px 8px}.narrow .termin .tmt{display:none}
.shade{padding:14px 16px;margin-bottom:18px}.shd{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.shd h3{margin:0;font-size:15px;font-weight:600;display:flex;align-items:center;gap:8px}.shd h3 ha-icon{--mdc-icon-size:20px;color:var(--hv-warm)}
.shsun{display:inline-flex;align-items:center;gap:6px;color:var(--hv-dim);font-size:12px}.shsun ha-icon{--mdc-icon-size:16px}
.fcs{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:8px}.narrow .fcs{gap:5px}.narrow .fc small{font-size:10.5px}
.fc{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 4px;border-radius:12px;background:var(--hv-surface-2);min-width:0}
.fc small{font-size:11.5px;color:var(--hv-dim);white-space:nowrap}.fc b{font-size:16px;font-weight:600}.fc ha-icon{--mdc-icon-size:24px;color:var(--hv-dim)}
.fc.hot b,.fc.hot ha-icon{color:var(--hv-warm)}.fcnone{color:var(--hv-dim)}
.swarns{display:flex;flex-direction:column;gap:8px;margin:4px 0 10px}.swarns:empty{display:none}
.swarn{border-radius:12px;background:rgba(255,196,87,.12);padding:9px 12px}.swarn.info{background:var(--hv-surface-2)}.swarn.severe{background:rgba(255,92,92,.16)}
.swarn .swh{display:flex;align-items:center;gap:12px;list-style:none}.swarn summary{cursor:pointer}.swarn summary::-webkit-details-marker{display:none}
.swarn .swh>div{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.swarn b{font-size:14px;font-weight:600}.swarn small{font-size:12px;color:var(--hv-dim)}
.swarn .swh>ha-icon{--mdc-icon-size:22px;color:var(--hv-warm);flex:none}.swarn.severe .swh>ha-icon{color:var(--hv-alert)}.swarn.info .swh>ha-icon{color:var(--hv-dim)}
.swarn p{margin:8px 0 0 34px;font-size:13px;line-height:1.4;color:var(--hv-dim)}.swarn p.tip{color:var(--hv-text)}
.shints{display:flex;flex-direction:column;gap:8px;margin-top:10px}.shints:empty{display:none}
.shint{display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:12px;background:var(--hv-surface-2)}
.shint>div{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.shint b{font-size:14px;font-weight:600}.shint small{font-size:12px;color:var(--hv-dim)}
.shint>ha-icon{--mdc-icon-size:22px;color:var(--hv-dim);flex:none}.shint.jetzt>ha-icon,.shint.heute>ha-icon{color:var(--hv-warm)}.shint.calm>ha-icon{color:var(--hv-ok)}
.shint.jetzt{background:rgba(255,196,87,.12)}
.fcast{padding:10px 12px 12px;margin-bottom:12px}.fcast.side{margin-bottom:0;border-radius:16px}
.fch{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;min-height:30px}
.fcnow{display:flex;align-items:baseline;gap:7px;background:none;border:0;color:inherit;font:inherit;padding:2px 4px;margin:-2px -4px;border-radius:10px;cursor:pointer}
.fcnow ha-icon{--mdc-icon-size:22px;color:var(--hv-dim);align-self:center}.fcnow b{font-size:17px;font-weight:600}.fcnow small{font-size:12.5px;color:var(--hv-dim)}
.fcpv{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--hv-dim)}.fcpv:empty{display:none}.fcpv b{color:var(--hv-text);font-weight:600}
.fcpv ha-icon{--mdc-icon-size:18px;color:var(--hv-warm)}
.fcast .fc{padding:6px 2px;gap:2px}.fcast .fc ha-icon{--mdc-icon-size:22px}.fcast .fc b{font-size:15px}
.fpv{display:flex;align-items:center;gap:2px;font-style:normal;font-size:11px;color:var(--hv-dim);white-space:nowrap}.fpv ha-icon{--mdc-icon-size:12px!important;color:var(--hv-faint)!important}
.fpv.hi,.fpv.hi ha-icon{color:var(--hv-warm)!important}
.fcast.side .fch{margin-bottom:6px}.fcast.side .fcpv{flex-basis:100%}.fcast.side .fcs{gap:4px}.fcast.side .fc small{font-size:10.5px}
.fchint:empty{display:none}.fchint{margin-top:8px}
.fchb{display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;border:0;border-radius:10px;background:rgba(255,196,87,.12);color:inherit;font:inherit;font-size:12.5px;text-align:left;cursor:pointer}
.fchb>span{flex:1;min-width:0}.fchb ha-icon{--mdc-icon-size:18px;color:var(--hv-warm);flex:none}.fchb ha-icon:last-child{color:var(--hv-dim)}
.appl{padding:10px 12px 12px;margin-bottom:12px}.appl.side{margin-bottom:0;border-radius:16px}
.aplh{display:flex;align-items:center;gap:8px;margin-bottom:6px;min-height:26px}.aplh>ha-icon{--mdc-icon-size:20px;color:var(--hv-dim)}.aplh b{font-size:15px;font-weight:600}
.aplsum{font-size:12.5px;color:var(--hv-dim)}.appl.done .aplsum{color:var(--hv-ok);font-weight:600}
.apls{display:flex;flex-direction:column;gap:4px}
.apl{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:12px;background:var(--hv-surface-2)}
.aplic{display:flex;align-items:center;justify-content:center;width:34px;height:34px;flex:none;border:0;border-radius:10px;background:none;color:var(--hv-dim);cursor:pointer}
.aplic ha-icon{--mdc-icon-size:22px}.apl.laeuft .aplic{color:var(--hv-accent)}.apl.fertig .aplic{color:var(--hv-ok)}
.apl.laeuft .aplic ha-icon{animation:aplspin 3s linear infinite}@keyframes aplspin{0%,80%{transform:rotate(0)}100%{transform:rotate(360deg)}}
.apln{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}.apln b{font-size:14px;font-weight:600}.apln small{font-size:12px;color:var(--hv-dim);overflow-wrap:anywhere}
.apl.fertig .aplst{color:var(--hv-ok);font-weight:600}.apl.laeuft .aplst{color:var(--hv-text)}
.aplack{flex:none}
.apltip:empty{display:none}.apltip{margin-top:8px}
.apltp{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:10px;background:var(--hv-surface-2);font-size:12.5px}
.apltp ha-icon{--mdc-icon-size:18px;color:var(--hv-dim);flex:none}.apltp.pv{background:rgba(255,196,87,.12)}.apltp.pv ha-icon{color:var(--hv-warm)}
@media (prefers-reduced-motion:reduce){.apl.laeuft .aplic ha-icon{animation:none}}
.set p.hint.warn{color:var(--hv-warm)}
.svcal{display:flex;gap:10px 22px;flex-wrap:wrap;justify-content:center;margin-top:12px;font-size:clamp(14px,2vw,19px);color:rgba(233,238,247,.8)}.svcal:empty{display:none}
.svcal span{display:inline-flex;align-items:center;gap:8px}.svcal ha-icon{--mdc-icon-size:1.2em;color:rgba(233,238,247,.55)}
.svcal .svwaste ha-icon{color:var(--tc)}.svcal .svwaste.hot{padding:6px 14px;border-radius:999px;background:rgba(255,255,255,.07);box-shadow:inset 0 0 0 1.5px var(--tc);color:#fff;font-weight:600}
.svhint{font-size:clamp(14px,2vw,19px);color:#ffc277}.svhint:empty{display:none}.svhint span{display:inline-flex;align-items:center;gap:8px}.svhint ha-icon{--mdc-icon-size:1.2em}
.cktog{display:inline-flex;align-items:center;gap:6px}.cktog small{font-size:11.5px;color:var(--hv-dim);margin-right:2px}
.kspark.k-h .spl{stroke:#2a9ad8}.kspark.k-h .spset{stroke:var(--hv-warm);opacity:.7}
.khum{display:flex;flex-direction:column;min-width:0;line-height:1.2}.rdp{font-size:11px;color:var(--hv-faint);white-space:nowrap;font-variant-numeric:tabular-nums}
.room-clim:has(.rdp){flex-wrap:wrap}.room-clim .rdp{flex-basis:100%;margin:0}
.cty span{white-space:nowrap}.k-h .ctc{margin-left:42px}.narrow .k-h .ctc{margin-left:38px}
.dense .ctrend{padding:9px 12px 8px;margin-bottom:12px;border-radius:16px}
.ctl{display:inline-flex;align-items:baseline;gap:6px;font-size:13px;color:var(--hv-dim)}
.ctl i{width:14px;height:3px;border-radius:2px;align-self:center}.ctl.in i{background:#e26a1c}.ctl.out i{background:#2a9ad8}
.ctl b{color:var(--hv-text);font-weight:500;font-size:15px;font-variant-numeric:tabular-nums}
.ctstats{display:flex;flex-wrap:wrap;gap:6px 22px;margin:0 0 10px}
.cts{display:flex;flex-direction:column;min-width:0}.cts small{font-size:11px;color:var(--hv-dim)}
.cts b{font-size:18px;font-weight:400;font-variant-numeric:tabular-nums}.cts em{font-style:normal;font-size:11.5px;color:var(--hv-faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ctc{height:140px;margin:0 40px 18px 34px}.dense .ctc{height:110px}
.ctp{fill:none;stroke-width:2;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
.ctp.in{stroke:#e26a1c}.ctp.out{stroke:#2a9ad8}
.ctgrid line{stroke:var(--hv-line);stroke-width:1;vector-effect:non-scaling-stroke}
.cty span{position:absolute;right:calc(100% + 6px);white-space:nowrap;transform:translateY(-50%);font-size:10.5px;color:var(--hv-faint);font-variant-numeric:tabular-nums}
.ctend{position:absolute;left:calc(100% + 6px);transform:translateY(-50%);font-size:11px;color:var(--hv-text);font-variant-numeric:tabular-nums;white-space:nowrap}
.trcur i.cin{background:#e26a1c}.trcur i.cout{background:#2a9ad8}
.trtip .tk{display:inline-flex;align-items:center;gap:5px;color:var(--hv-dim)}.trtip .tk i{width:8px;height:8px;border-radius:50%}.trtip .tk.in i{background:#e26a1c}.trtip .tk.out i{background:#2a9ad8}
.trtip .tk b{color:var(--hv-text);font-weight:500}
.ctrend.nodata .ctc{height:48px}.ctrend.nodata .cty,.ctrend.nodata .trx,.ctrend.nodata .ctend{display:none}
.narrow .ktable.withspark .krow{grid-template-columns:1fr auto auto}.narrow .krow .kspark{grid-column:1/-1;order:5}
.narrow .ctc{margin:0 34px 18px 30px}
.khead,.krow{display:grid;grid-template-columns:minmax(150px,230px) 70px 96px 1fr;align-items:center;gap:10px;padding:6px 14px}
.khead{font-size:10.5px;color:var(--hv-faint);letter-spacing:.1em;text-transform:uppercase;padding-top:10px;padding-bottom:2px}
.krow+.krow{border-top:1px solid var(--hv-line)}
.kname{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:500;cursor:pointer}.kname ha-icon{--mdc-icon-size:18px;color:var(--hv-dim)}
.krow .rt{font-size:18px;font-weight:300}.krow .rh{font-size:13px;color:var(--hv-dim)}
.kna{color:var(--hv-faint)}
.tile.row.kcell{background:none;border:0;min-height:0;padding:0}
.tile.row.kcell .tstate{min-width:56px}
.secsum{display:flex;align-items:center;gap:14px;padding:12px 16px;margin-bottom:12px;border-color:rgba(79,209,139,.3)}
.secsum .ssic{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:rgba(79,209,139,.18);color:var(--hv-ok)}
.secsum .ssic ha-icon{--mdc-icon-size:26px}
.secsum .sst{font-size:18px;font-weight:500}.secsum .ssd{font-size:12.5px;color:var(--hv-dim);margin-top:2px}
.secsum.bad{border-color:rgba(255,107,91,.45)}.secsum.bad .ssic{background:rgba(255,107,91,.2);color:var(--hv-alert)}
.dense .ptitle{margin-bottom:10px}.dense .ptitle h1{font-size:24px}
.dense .fhead{margin:16px 2px 8px}
.narrow .khead{display:none}.narrow .krow{grid-template-columns:1fr auto auto}.narrow .krow .kcell,.narrow .krow .kna{grid-column:1/-1}
.narrow.dense .dtop .chips{order:5;width:100%}
.narrow .hero.slim h1{font-size:19px}
.narrow .hero.slim .pn,.narrow .hero.slim .sp{display:none}\n.narrow .hrow{gap:6px}.narrow .schip{padding:5px 9px 5px 7px}.narrow .hero.slim .pbtn{padding:6px 8px}
.narrow .roofc{height:auto;padding-top:16px}
.narrow .roofc .energy{position:relative;bottom:auto;padding:0 4% 6px}
.narrow .roofc .sun{bottom:auto;top:2px}

/* ====== Übersicht-Varianten ====== */
.cfhead{display:flex;align-items:center;gap:10px;padding:10px 14px 0}
.cfn{font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:600}
.cfhead .fstat{flex-direction:row;gap:12px;font-size:12px;color:var(--hv-dim)}
.cfhead .fl-lw{flex-direction:row;gap:3px}
.dense .cfhead .fl-t{display:inline}
.cockpit{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:12px;align-items:start}
.cmain{display:flex;flex-direction:column;gap:12px;min-width:0}
.cfloor{border-radius:16px}
.cfloor .fbody{padding:10px 12px 12px}
.cfloor.out,.fcol.out{border-color:rgba(110,200,120,.22);background:linear-gradient(180deg,var(--hv-out,rgba(40,80,50,.28)),var(--hv-glass))}
.cside{display:flex;flex-direction:column;gap:12px;position:sticky;top:0}
.cside .secsum{margin:0;border-radius:16px;padding:12px 14px}
.cside .secsum .ssic{width:38px;height:38px;border-radius:12px}.cside .secsum .sst{font-size:16px}
.qhead{display:flex;align-items:center;gap:8px;padding:11px 14px 4px;font-size:13px;font-weight:600}
.qhead ha-icon{--mdc-icon-size:17px;color:var(--hv-dim)}
.ecard,.qcard{border-radius:16px;padding-bottom:8px}
.ecard{cursor:pointer}
.ecard .sun{color:var(--hv-faint);transition:color .6s}.ecard.producing .sun{color:var(--hv-warm);filter:drop-shadow(0 0 8px rgba(255,196,87,.7))}
.ecard .sun ha-icon{--mdc-icon-size:18px;color:inherit}
.erow{display:flex;align-items:center;gap:10px;padding:6px 14px;font-size:13px;color:var(--hv-dim)}
.erow b{margin-left:auto;font-size:17px;font-weight:400;color:var(--hv-text);font-variant-numeric:tabular-nums}
.erow ha-icon{--mdc-icon-size:18px}.erow.ep-pv ha-icon{color:var(--hv-warm)}.erow.ep-battery ha-icon{color:var(--hv-ok)}.erow.ep-power ha-icon{color:var(--hv-cool)}
.qbtns{display:flex;flex-direction:column;gap:6px;padding:6px 10px}
.qbtn{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:11px;background:var(--hv-surface);font-size:13px;text-align:left}
.qbtn:hover{background:var(--hv-surface-2)}.qbtn ha-icon{--mdc-icon-size:18px;color:var(--hv-dim)}
.qscenes{display:flex;flex-wrap:wrap;gap:6px;padding:4px 10px 4px}
.cside .rows{padding:4px 8px}
.ebar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 10px;border-radius:14px;margin-bottom:12px}
.ebar-e{display:flex;align-items:center;gap:6px;flex-wrap:wrap;cursor:pointer}
.ebar .sun{color:var(--hv-faint);display:flex;transition:color .6s}.ebar .sun ha-icon{--mdc-icon-size:20px}
.ebar-e.producing .sun{color:var(--hv-warm);filter:drop-shadow(0 0 8px rgba(255,196,87,.7))}
.pbtn.sm{padding:5px 10px;font-size:12px;border-radius:999px}.pbtn.sm ha-icon{--mdc-icon-size:16px}
.fcols{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;align-items:start}
.fcol{border-radius:16px;padding-bottom:6px}
.rrows{display:flex;flex-direction:column;padding:6px 6px 2px}
.rrow{position:relative;display:flex;align-items:center;gap:8px;min-height:42px;padding:4px 6px 4px 8px;border-radius:10px;cursor:pointer;border-left:3px solid transparent;transition:background .3s,border-color .4s}
.rrow:hover{background:var(--hv-surface)}
.rrow+.rrow{margin-top:2px}
.rrow .tdot{width:8px;height:8px;border-radius:50%;flex:none}
.rrow .ri{--mdc-icon-size:17px;color:var(--hv-dim)}
.rrow .rname{font-size:13.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:0 1 auto}
.rrow .rt{font-size:16px;font-weight:300;letter-spacing:0}.rrow .rh{font-size:11.5px;color:var(--hv-dim);min-width:30px}
.rrow .room-alerts{margin-left:2px}
.rrow .mini{padding:3px 7px;background:transparent;border-color:transparent}
.rrow .mini.on{background:rgba(255,196,87,.18);border-color:rgba(255,196,87,.38)}
.rrow .mlph{width:30px}
.rrow.lit{border-left-color:var(--hv-warm);background:rgba(255,196,87,.07)}.rrow.lit .ri{color:var(--hv-warm)}
.factive{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.factive .room{min-height:120px}
.ract{position:relative;font-size:12px;color:var(--hv-dim);margin-top:4px;line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.room.lit .ract{color:#ffe2a8}
.secttitle .gc{font-size:12px;font-weight:400;color:var(--hv-dim)}
.calm{display:flex;align-items:center;gap:14px;padding:18px 20px;border-radius:16px}
.calm ha-icon{--mdc-icon-size:30px;color:var(--hv-cool)}.calm b{display:block;font-size:17px;font-weight:500}.calm small{color:var(--hv-dim);font-size:13px}
.fcalm{border-radius:16px;padding:6px 12px}
.crow2{display:flex;align-items:center;gap:12px;padding:6px 0}
.crow2+.crow2{border-top:1px solid var(--hv-line)}
.cfl{width:44px;flex:none;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--hv-dim);font-weight:600}
.narrow .cockpit{grid-template-columns:1fr}.narrow .cside{order:-1;position:static}
.narrow .crow2{flex-direction:column;align-items:flex-start;gap:6px}

/* ====== Warnungen ====== */
.acard{border-radius:16px;overflow:hidden;margin-bottom:12px}
.cside .acard{margin-bottom:0}
.acard.slim.ok{display:none}
.acard.fokus.ok .ahead{padding:8px 12px;gap:10px}.acard.fokus.ok .ssic{width:30px;height:30px;border-radius:10px}.acard.fokus.ok .ssic ha-icon{--mdc-icon-size:18px}
.acard.fokus.ok .sst{font-size:14px}.acard.fokus.ok .ssd{display:none}
.room.rwarn{border-color:rgba(255,160,70,.6);box-shadow:0 0 0 1px rgba(255,160,70,.25) inset}
.room.ralarm{border-color:rgba(255,107,91,.75);box-shadow:0 0 0 1px rgba(255,107,91,.35) inset,0 10px 30px -14px rgba(255,107,91,.6)}
.room.rwarn .ract{color:#ffc08a}.room.ralarm .ract{color:#ffb0a6}
.ahead{display:flex;align-items:center;gap:14px;width:100%;padding:12px 14px;text-align:left}
.ahead[data-act="noop"]{cursor:default}
.ah{display:flex;flex-direction:column;min-width:0}
.acard .ssic{width:40px;height:40px;flex:none;border-radius:12px;display:grid;place-items:center}
.acard .ssic ha-icon{--mdc-icon-size:24px}
.acard .sst{font-size:16px;font-weight:500}.acard .ssd{font-size:12.5px;color:var(--hv-dim);margin-top:2px}.acard .ssd:empty{display:none}
.acard.ok{border-color:rgba(79,209,139,.3)}.acard.ok .ssic{background:rgba(79,209,139,.18);color:var(--hv-ok)}
.acard.info{border-color:rgba(99,199,255,.35)}.acard.info .ssic{background:rgba(99,199,255,.18);color:var(--hv-cool)}
.acard.warn{border-color:rgba(255,160,70,.45)}.acard.warn .ssic{background:rgba(255,160,70,.2);color:#ffa046}
.acard.alarm{border-color:rgba(255,107,91,.6)}.acard.alarm .ssic{background:rgba(255,107,91,.25);color:var(--hv-alert);animation:apulse 1.6s infinite}
@keyframes apulse{0%,100%{box-shadow:0 0 0 0 rgba(255,107,91,.5)}50%{box-shadow:0 0 0 6px rgba(255,107,91,0)}}
.alist{display:flex;flex-direction:column;gap:4px;padding:0 10px 10px}.alist:empty{display:none}
.acard.slim .alist,.acard.wide .alist{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
.aitem{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:10px;align-items:center;padding:7px 10px;border-radius:10px;background:var(--hv-surface);text-align:left;border-left:3px solid transparent}
.aitem ha-icon{grid-row:1/3;--mdc-icon-size:18px}
.aitem .at{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.aitem .ad{font-size:11.5px;color:var(--hv-dim)}.aitem .ad:empty{display:none}
.aitem.alarm{border-left-color:var(--hv-alert)}.aitem.alarm ha-icon{color:var(--hv-alert)}
.aitem.warn{border-left-color:#ffa046}.aitem.warn ha-icon{color:#ffa046}
.aitem.acked{opacity:.72;border-left-style:dashed}
.acard.acked .ssic{animation:none}
.amute{display:flex;align-items:center;gap:6px;justify-content:flex-start}.amute ha-icon{--mdc-icon-size:15px}
.aitem.info{border-left-color:var(--hv-cool)}.aitem.info ha-icon{color:var(--hv-cool)}
.amore{font-size:12px;color:var(--hv-dim);padding:2px 10px}
.kchip.warmalert{color:#ffc08a;border-color:rgba(255,160,70,.45);background:rgba(255,160,70,.12)}.kchip.warmalert ha-icon{color:#ffa046}
.chip.warmalert .ic{background:rgba(255,160,70,.2);color:#ffa046}.chip.warmalert{border-color:rgba(255,160,70,.4)}
.kpi.warmalert .kic{background:rgba(255,160,70,.2);color:#ffa046}.kpi.warmalert .kv{color:#ffc08a}
.emb{display:inline-flex;align-items:center;gap:8px;flex:none;cursor:pointer;font-size:12px;color:var(--hv-dim);margin:0 6px}
.emb .tgl span{pointer-events:none}
.rule{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 0;border-top:1px solid var(--hv-line)}
.rule .rl{font-size:12px;color:var(--hv-dim)}
.set .pbtn.sm{padding:5px 10px;font-size:12px}

/* ====== Klingel-Overlay ====== */
.bellbg{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(4,6,12,.62);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:mfade .2s ease}
.bell{width:min(980px,100%);max-height:100%;display:flex;flex-direction:column;border-radius:22px;overflow:hidden;background:rgba(14,19,30,.95);border-color:rgba(255,196,87,.45);box-shadow:0 24px 80px rgba(0,0,0,.6);animation:mpop .22s ease}
.bell.again{animation:bshake .5s}
@keyframes bshake{20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
.bhead{display:flex;align-items:center;gap:12px;padding:12px 14px}
.bic{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:rgba(255,196,87,.2);color:var(--hv-warm);animation:bring 1.2s ease-in-out infinite}
.bic ha-icon{--mdc-icon-size:26px}
@keyframes bring{0%,100%{transform:rotate(0)}10%{transform:rotate(-14deg)}20%{transform:rotate(12deg)}30%{transform:rotate(-8deg)}40%{transform:rotate(0)}}
.bt{font-size:19px;font-weight:500}.bs{font-size:12.5px;color:var(--hv-dim)}
.bcount{font-size:12px;color:var(--hv-dim);font-variant-numeric:tabular-nums;margin-right:4px}
.bcam{position:relative;aspect-ratio:16/9;background:#05070c;min-height:0}
.bimg{width:100%;height:100%;object-fit:contain;display:block;opacity:0;transition:opacity .3s}.bimg.ready{opacity:1}
.blive{position:absolute;inset:0;display:none}.bell.islive .blive{display:block}.bell.islive .bimg{visibility:hidden}
.blive ha-camera-stream{display:block;width:100%;height:100%}
.bnone{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--hv-dim);font-size:13px}.bnone ha-icon{--mdc-icon-size:40px}
.bacts{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 14px}
.bacts .pbtn{padding:10px 14px}
.bunlock[data-armed="1"]{background:rgba(255,107,91,.25);border-color:rgba(255,107,91,.6);color:#ffb0a6}
.narrow .bellbg{padding:8px}.narrow .bt{font-size:17px}

/* ====== Abfrage-Dialog ====== */
.mbg{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(4,6,12,.55);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);animation:mfade .15s ease}
.modal{width:min(380px,100%);padding:22px 22px 18px;border-radius:20px;text-align:center;background:rgba(18,24,38,.94);box-shadow:0 20px 60px rgba(0,0,0,.5);animation:mpop .18s ease}
.mic{width:52px;height:52px;margin:0 auto 12px;border-radius:16px;display:grid;place-items:center;background:var(--hv-surface-2);color:var(--hv-warm)}
.mic ha-icon{--mdc-icon-size:28px}
.mt{font-size:18px;font-weight:500;line-height:1.3}.mx{margin-top:6px;font-size:13.5px;color:var(--hv-dim)}
.mb{display:flex;gap:10px;margin-top:18px}.mb .pbtn{flex:1;justify-content:center;padding:11px 14px;font-size:14px}
@keyframes mfade{from{opacity:0}}@keyframes mpop{from{opacity:0;transform:scale(.95)}}
.tchips{display:flex;flex-wrap:wrap;gap:6px}
.tchip{display:inline-flex;align-items:center;gap:6px;padding:6px 12px 6px 9px;border-radius:999px;background:var(--hv-surface);border:1px solid var(--hv-line);font-size:12.5px;cursor:pointer}
.tchip input{display:none}.tchip ha-icon{--mdc-icon-size:16px;color:var(--hv-dim)}
.tchip.on{background:rgba(90,160,255,.18);border-color:rgba(90,160,255,.5)}.tchip.on ha-icon{color:var(--hv-accent)}

/* ====== Kopfzeilen-Varianten ====== */
.dtop{flex-wrap:wrap}
.app:not(.narrow) .dtop,.app:not(.narrow) .hbar{flex-wrap:nowrap}
.app:not(.narrow) .dtop .chips{flex-wrap:wrap}
.dtop .chips{flex:1 1 auto;min-width:0}
.hright{display:flex;align-items:center;gap:10px;margin-left:auto;flex:none}
.persons.stack{gap:0}
.persons.stack .person{margin-left:-9px;box-shadow:0 0 0 2px rgba(8,12,20,.9)}
.persons.stack .person:first-child{margin-left:0}
.hk .kchips{display:flex;align-items:center;gap:6px;flex:1 1 auto;min-width:0;overflow-x:auto;scrollbar-width:none}
.kchip{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 13px 0 10px;border-radius:999px;background:var(--hv-glass);border:1px solid var(--hv-line);font-size:14px;font-weight:500;font-variant-numeric:tabular-nums;flex:none;transition:transform .15s}
.kchip:active{transform:scale(.96)}
.kchip ha-icon{--mdc-icon-size:18px;color:var(--hv-dim)}
.kchip.iconly{padding:0 9px}
.kchip.warm,.kchip.warm ha-icon{color:var(--hv-warm)}
.kchip.alert{color:#ffb0a6;border-color:rgba(255,107,91,.45);background:rgba(255,107,91,.12)}.kchip.alert ha-icon{color:var(--hv-alert)}
.kchip.ok ha-icon{color:var(--hv-ok)}.kchip.heat ha-icon{color:var(--hv-heat)}.kchip.heat{color:#ffc29a}
.kchip.dim{color:var(--hv-dim)}
.hs .hsatz{flex:1 1 260px;min-width:0}
.hs .greet{font-size:12px;color:var(--hv-dim)}
.htext{font-size:15px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hs .alerts{flex:none;margin:0}
.hbar{display:flex;align-items:stretch;flex-wrap:wrap;padding:6px 8px;border-radius:16px;margin-bottom:12px}
.hbar .clockbox{display:flex;flex-direction:column;justify-content:center;line-height:1.05;padding:2px 16px 2px 8px;border-right:1px solid var(--hv-line)}
.hbar .clock{font-size:28px}.hbar .date{font-size:11.5px;margin-top:3px;color:var(--hv-dim);white-space:nowrap}
.kpis{display:flex;flex:1 1 auto;min-width:0;overflow-x:auto;scrollbar-width:none}
.kpi{display:grid;grid-template-columns:auto auto;grid-template-rows:auto auto;column-gap:9px;align-items:center;padding:4px 16px;border-right:1px solid var(--hv-line);text-align:left;flex:none;border-radius:0}
.kpi:hover{background:rgba(255,255,255,.04)}
.kic{grid-row:1/3;width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:var(--hv-surface-2)}
.kic ha-icon{--mdc-icon-size:18px}
.kv{font-size:19px;line-height:1.1;font-variant-numeric:tabular-nums}.kl{font-size:11px;color:var(--hv-dim);white-space:nowrap}
.kpi.warm .kic{background:rgba(255,196,87,.2);color:var(--hv-warm)}.kpi.alert .kic{background:rgba(255,107,91,.2);color:var(--hv-alert)}.kpi.alert .kv{color:#ffb0a6}
.kpi.ok .kic{background:rgba(79,209,139,.18);color:var(--hv-ok)}.kpi.heat .kic{background:rgba(255,138,61,.2);color:var(--hv-heat)}.kpi.dim .kv{color:var(--hv-dim)}
.hbar .hright{padding-left:12px}
.hbar .weather{padding:5px 12px 5px 8px;border-radius:999px;gap:6px}.hbar .weather ha-icon{--mdc-icon-size:22px}.hbar .weather .wt{font-size:16px}
.hbar .person{width:32px;height:32px;font-size:12px}
.narrow .dtop .chips,.narrow .hk .kchips,.narrow .hs .alerts{order:5;width:100%;flex-basis:100%}
.narrow .hk .kchips{flex-wrap:wrap;overflow:visible}
.narrow .hs .hsatz{order:4;flex-basis:100%}.narrow .hs .htext{white-space:normal}
.narrow .hbar .kpis{order:5;flex-basis:100%;border-top:1px solid var(--hv-line);margin-top:6px;padding-top:4px}
.narrow .hbar .kpis{-webkit-mask-image:linear-gradient(90deg,#000 85%,transparent);mask-image:linear-gradient(90deg,#000 85%,transparent)}
.narrow .hbar .clockbox{border-right:0}
.narrow .kpi{padding:4px 12px}

/* ====== Eingebettete Panels ====== */
.main.ext{padding:0}
.main.ext .wrap{height:100%}
.lmode{width:auto;min-width:150px}
.extwrap.themed{${hvThemeCss(false)}}
.app.blur .extwrap.themed{--ha-card-backdrop-filter:${HV_BLUR}}
.extwrap.themed>:not(.extload):not(.empty):not(iframe){background:transparent!important;--primary-background-color:transparent}
.extwrap{position:relative;height:100%;min-height:100%;contain:layout;isolation:isolate;overflow-x:hidden}
.extwrap>:not(.extload):not(.empty){display:block;height:100%;min-height:100%}
.extframe{width:100%;border:0;background:transparent}
.extload{display:flex;align-items:center;justify-content:center;gap:10px;height:100%;color:var(--hv-dim)}
.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}

/* WebKit (iPhone/iPad): Schrift nicht automatisch vergrößern, Texte kürzen statt Symbole zu verschieben */
:host{-webkit-text-size-adjust:100%;text-size-adjust:100%}
.room-head .rname{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.room-head .ri,.room-alerts,.al,.mini,.rchip .ri,.rchip .mini{flex:none}
.room-clim{min-width:0;flex-wrap:nowrap;white-space:nowrap}
.room-foot{flex-wrap:wrap}
.rchip .rname{white-space:nowrap}

/* Schmal (Handy, kleines Tablet) */
.narrow.app{flex-direction:column}
.narrow .rail{height:auto !important;position:fixed;z-index:10;left:var(--hv-rail-left,0px);width:var(--hv-rail-width,100%);bottom:0;height:auto;flex-direction:row;padding:6px 6px calc(6px + env(safe-area-inset-bottom));border-right:0;border-top:1px solid var(--hv-line);overflow-x:auto;overflow-y:hidden;justify-content:flex-start;background:rgba(8,12,20,.86);-webkit-backdrop-filter:blur(18px) saturate(140%);backdrop-filter:blur(18px) saturate(140%)}
.app.narrow .main{padding-bottom:calc(84px + env(safe-area-inset-bottom))}
.narrow .toast{bottom:calc(86px + env(safe-area-inset-bottom))}
.narrow .savebar{bottom:calc(76px + env(safe-area-inset-bottom))}.narrow .savebar .where{display:none}.narrow .savebar .msg{min-width:0;font-size:12px}.narrow .savebar.dirty .msg{flex:1}
.narrow .rail .logo,.narrow .rail hr,.narrow .rail .grow{display:none}
.narrow .nav{width:auto;min-width:64px;padding:7px 8px 5px;flex:none}
.narrow .main{padding:14px 12px 28px}
.narrow .menu{display:flex}
.narrow .clock{font-size:36px}
.narrow .rooms{grid-template-columns:repeat(auto-fill,minmax(146px,1fr));gap:9px;padding:10px}
.narrow .flabel{width:34px}.narrow .fstat{display:none}
.narrow .roof{height:120px}.narrow .energy{padding:0 4%}
.narrow .hero h1{font-size:30px}
.narrow .sections{columns:1}
.narrow .tiles{grid-template-columns:repeat(2,minmax(0,1fr))}
/* ---------- Hausmodus ---------- */
.hmode{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px 0 9px;border-radius:999px;background:var(--hv-surface);border:1px solid var(--hv-line);font-size:12.5px;white-space:nowrap;flex:none}
.hmode ha-icon{--mdc-icon-size:17px}
.hmode[data-mode=nacht]{background:rgba(154,134,255,.16);border-color:rgba(154,134,255,.35)}.hmode[data-mode=nacht] ha-icon{color:#b8a8ff}
.hmode[data-mode=abwesend]{background:rgba(255,160,70,.14);border-color:rgba(255,160,70,.35)}.hmode[data-mode=abwesend] ha-icon{color:#ffa046}
.hmode[data-mode=urlaub]{background:rgba(99,199,255,.14);border-color:rgba(99,199,255,.35)}.hmode[data-mode=urlaub] ha-icon{color:var(--hv-cool)}
.hmode[data-mode=zuhause] ha-icon{color:var(--hv-ok)}
.narrow .hmode .hml{display:none}.narrow .hmode{padding:0;width:34px;justify-content:center}
.hmnow{font-weight:500;font-size:13px}
.hmseg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.hmb{display:flex;flex-direction:column;align-items:center;gap:4px;padding:9px 2px 7px;border-radius:12px;background:var(--hv-surface);border:1px solid var(--hv-line);font-size:11.5px;color:var(--hv-dim);min-width:0}
.hmb span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hmb ha-icon{--mdc-icon-size:20px}
.hmb.on{color:var(--hv-text);border-color:rgba(124,196,255,.5);background:rgba(124,196,255,.14)}
.hmcard.m-nacht .hmb.on{background:rgba(154,134,255,.18);border-color:rgba(154,134,255,.5)}.hmcard.m-nacht .hmb.on ha-icon{color:#b8a8ff}
.hmcard.m-abwesend .hmb.on{background:rgba(255,160,70,.16);border-color:rgba(255,160,70,.5)}.hmcard.m-abwesend .hmb.on ha-icon{color:#ffa046}
.hmcard.m-urlaub .hmb.on{background:rgba(99,199,255,.16);border-color:rgba(99,199,255,.5)}.hmcard.m-urlaub .hmb.on ha-icon{color:var(--hv-cool)}
.hmcard.m-zuhause .hmb.on ha-icon{color:var(--hv-ok)}
.hminfo{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--hv-text);margin-top:8px}
.hminfo ha-icon{--mdc-icon-size:15px;color:var(--hv-dim);flex:none}.hminfo.dim{color:var(--hv-dim)}.hminfo.warn{color:#ffc890}
.mchips{display:inline-flex;gap:3px;flex:none}
.mchip{width:28px;height:26px;border-radius:8px;display:grid;place-items:center;background:var(--hv-surface);border:1px solid var(--hv-line);color:var(--hv-faint)}
.mchip ha-icon{--mdc-icon-size:15px}.mchip.on{color:var(--hv-text);background:rgba(124,196,255,.16);border-color:rgba(124,196,255,.4)}
.mlegend{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;margin:2px 0 6px;color:var(--hv-dim)}.mlegend small{color:var(--hv-dim)}
.mlist{display:inline-flex;flex-wrap:wrap;gap:4px 12px}.mleg{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--hv-text)}.mleg ha-icon{--mdc-icon-size:15px;color:var(--hv-dim)}
.mchips.wrap{flex-wrap:wrap;flex:0 1 auto}.mchip.lbl{width:auto;padding:0 8px;gap:4px;display:inline-flex;align-items:center;font-size:12px}
/* ---------- Aktionen ---------- */
.actcard{border:1px solid var(--hv-line);border-radius:14px;padding:8px 10px;margin:8px 0;background:var(--hv-surface)}
.actcard.off{opacity:.55}
.actrow{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.actrow.sub{margin-top:6px;padding-top:6px;border-top:1px dashed var(--hv-line)}
.actrow .inp.xs{width:64px}.actrow select.wide{max-width:230px}
.actg{display:inline-flex;align-items:center;gap:6px}.actg small{color:var(--hv-dim);font-size:11.5px}
.lvchips{display:inline-flex;gap:6px;flex-wrap:wrap}
.alsu em.esc{color:#ffb3a8}
.alstat.esc{color:#ffb3a8}.alstat.esc ha-icon{color:var(--hv-alert)}
.lgrow.eskaliert ha-icon{color:var(--hv-alert)}.lgrow.aktion ha-icon{color:#c79bff}
.alstatrow .t small{display:block;color:var(--hv-dim);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.alstatrow.sus .n{color:#ffa046}
/* ---------- Alarmmanager ---------- */
.nav{position:relative}
.nbadge{position:absolute;top:4px;left:calc(50% + 6px);min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#ffa046;color:#1a1206;font:600 10px/16px var(--hv-font, inherit);font-style:normal;text-align:center;display:none}
.nbadge.on{display:block}.nbadge.alarm{background:var(--hv-alert);color:#fff;animation:apulse 1.6s infinite}
.altabs{display:flex;gap:6px;flex-wrap:wrap}
.altab{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:999px;background:var(--hv-surface);border:1px solid var(--hv-line);color:var(--hv-dim);font-size:13px}
.altab ha-icon{--mdc-icon-size:16px}.altab.sm{padding:5px 11px;font-size:12px}
.altab.on{background:rgba(124,196,255,.16);border-color:rgba(124,196,255,.4);color:var(--hv-text)}
.algrid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr) minmax(0,.85fr);gap:14px;align-items:start}
.algrid.proto{grid-template-columns:minmax(0,2fr) minmax(0,1fr)}
.alside{display:flex;flex-direction:column;gap:14px;min-width:0}
.alcol{border-radius:16px;padding:10px 12px 12px;min-width:0}
.alh{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500;padding:2px 2px 8px}
.alh ha-icon{--mdc-icon-size:18px;color:var(--hv-dim)}.alh .cnt{color:var(--hv-dim);font-weight:400}
.alh.sub{margin-top:10px;padding-top:10px;border-top:1px solid var(--hv-line);font-size:13px}
.alrow{position:relative;overflow:hidden;border-radius:12px;margin-bottom:6px;cursor:pointer;touch-action:pan-y}
.alin{position:relative;z-index:1;display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:12px;background:var(--hv-surface);border:1px solid var(--hv-line);border-left:3px solid transparent;transform:translateX(var(--sx,0));transition:transform .2s}
.alrow.swiping .alin{transition:none}
.alrow.alarm .alin{border-left-color:var(--hv-alert);background:rgba(255,107,91,.1)}
.alrow.warn .alin{border-left-color:#ffa046}
.alrow.info .alin{border-left-color:var(--hv-cool)}
.alrow.sel .alin{border-color:rgba(124,196,255,.55);box-shadow:0 0 0 1px rgba(124,196,255,.35) inset}
.alrow.st-quittiert .alin{border-left-style:dashed;opacity:.85}
.alrow.st-stumm .alin{opacity:.6;border-left-color:var(--hv-line)}
.alic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;flex:none;background:var(--hv-surface-2)}
.alic ha-icon{--mdc-icon-size:19px}
.alrow.alarm .alic{background:rgba(255,107,91,.22);color:var(--hv-alert)}.alrow.alarm.st-neu .alic{animation:apulse 1.6s infinite}
.alrow.warn .alic{background:rgba(255,160,70,.18);color:#ffa046}.alrow.info .alic{background:rgba(99,199,255,.16);color:var(--hv-cool)}
.altx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.alti{font-size:13.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.alsu{font-size:11.5px;color:var(--hv-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.alsu em{font-style:normal;color:var(--hv-text)}
.alq{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;flex:none;background:var(--hv-surface-2);border:1px solid var(--hv-line)}
.alq ha-icon{--mdc-icon-size:18px}.alq:hover{background:rgba(79,209,139,.2);color:var(--hv-ok)}
.alsw{position:absolute;top:0;bottom:0;display:flex;align-items:center;gap:6px;padding:0 16px;font-size:12.5px;font-weight:500;opacity:0;transition:opacity .15s}
.alsw ha-icon{--mdc-icon-size:18px}
.alsw.ack{left:0;right:50%;background:rgba(79,209,139,.25);color:var(--hv-ok);border-radius:12px 0 0 12px}
.alsw.mute{right:0;left:50%;justify-content:flex-end;background:rgba(160,170,190,.22);color:var(--hv-text);border-radius:0 12px 12px 0}
.alsw{visibility:hidden}.alrow.swiping .alsw{visibility:visible;opacity:.6}.alrow.go-ack .alsw.ack,.alrow.go-mute .alsw.mute{opacity:1}
.alok{display:flex;flex-direction:column;align-items:center;gap:4px;padding:26px 10px;color:var(--hv-dim);font-size:12.5px}
.alok ha-icon{--mdc-icon-size:38px;color:var(--hv-ok);margin-bottom:4px}.alok b{color:var(--hv-text);font-size:15px;font-weight:500}
.alhint{font-size:11.5px;color:var(--hv-faint);padding:6px 4px 0}
.alnone{font-size:12.5px;color:var(--hv-dim);padding:10px 4px}
.aldetail{position:relative;display:flex;flex-direction:column;gap:12px;padding:14px}
.aldetail.alarm{border-color:rgba(255,107,91,.45)}.aldetail.warn{border-color:rgba(255,160,70,.35)}
.alempty{align-items:center;justify-content:center;min-height:200px;color:var(--hv-dim);font-size:13px}.alempty ha-icon{--mdc-icon-size:30px}
.alclose{position:absolute;top:10px;right:10px;width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:var(--hv-surface)}
.aldh{display:flex;gap:12px;align-items:center;padding-right:30px}
.aldh .ssic{width:46px;height:46px;flex:none;border-radius:14px;display:grid;place-items:center;background:var(--hv-surface-2)}
.aldh .ssic ha-icon{--mdc-icon-size:26px}
.aldetail.alarm .ssic{background:rgba(255,107,91,.22);color:var(--hv-alert)}.aldetail.warn .ssic{background:rgba(255,160,70,.18);color:#ffa046}.aldetail.info .ssic{background:rgba(99,199,255,.16);color:var(--hv-cool)}
.aldt{min-width:0}.alt{font-size:16px;font-weight:500;line-height:1.3}
.ald{font-size:12px;color:var(--hv-dim);margin-top:3px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.lvl{font-size:11px;padding:2px 8px;border-radius:999px;background:var(--hv-surface-2)}
.lvl.alarm{background:rgba(255,107,91,.22);color:#ffb3a8}.lvl.warn{background:rgba(255,160,70,.2);color:#ffc890}.lvl.info{background:rgba(99,199,255,.18);color:#a8dcff}
.alinfo{display:flex;flex-direction:column;gap:6px;font-size:13px}
.alinfo>div{display:flex;gap:8px;align-items:flex-start}.alinfo ha-icon{--mdc-icon-size:17px;color:var(--hv-dim);flex:none}
.alstat.st-neu{color:#ffc890}.alstat.st-neu ha-icon{color:#ffa046}.alstat.st-quittiert ha-icon{color:var(--hv-ok)}
.albtns{display:flex;flex-wrap:wrap;gap:6px}.albtns .pbtn{padding:8px 12px;font-size:12.5px}
.albtns.sec:empty{display:none}
.alsub{font-size:12px;color:var(--hv-dim);border-top:1px solid var(--hv-line);padding-top:10px}
.lglist{display:flex;flex-direction:column}
.lgrow{display:flex;align-items:flex-start;gap:8px;padding:6px 2px;border-bottom:1px solid rgba(255,255,255,.05);font-size:12.5px}
.lgrow:last-child{border-bottom:0}
.lgrow .lgt{flex:none;width:40px;color:var(--hv-dim);font-variant-numeric:tabular-nums}
.lgrow ha-icon{--mdc-icon-size:15px;flex:none;margin-top:1px;color:var(--hv-dim)}
.lgrow.neu.alarm ha-icon{color:var(--hv-alert)}.lgrow.neu.warn ha-icon{color:#ffa046}.lgrow.neu.info ha-icon{color:var(--hv-cool)}
.lgrow.behoben ha-icon,.lgrow.quittiert ha-icon{color:var(--hv-ok)}
.lgx{display:flex;flex-direction:column;min-width:0}.lgx b{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lgx span{color:var(--hv-dim)}
.lgday{font-size:11.5px;font-weight:500;color:var(--hv-dim);text-transform:none;padding:10px 2px 4px}
.lgday:first-child{padding-top:0}
.alkpi{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.alkpi .k{display:flex;flex-direction:column;align-items:center;padding:8px 4px;border-radius:12px;background:var(--hv-surface)}
.alkpi b{font-size:20px;font-weight:400}.alkpi span{font-size:11px;color:var(--hv-dim)}
.alkpi .alarm.n b{color:var(--hv-alert)}.alkpi .warn.n b{color:#ffa046}.alkpi .info.n b{color:var(--hv-cool)}
.alarmo{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;border-radius:12px;background:var(--hv-surface);text-align:left;margin-bottom:6px}
.alarmo ha-icon{--mdc-icon-size:20px}.alarmo .an{flex:1;min-width:0;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.alarmo .as{font-size:12px;color:var(--hv-dim)}
.alarmo.st-disarmed ha-icon{color:var(--hv-dim)}.alarmo.st-triggered{background:rgba(255,107,91,.2)}.alarmo.st-triggered ha-icon{color:var(--hv-alert)}
.alarmo[class*="st-armed"] ha-icon{color:var(--hv-ok)}
.alfilter{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:-4px 0 12px}
.alstatrow{display:flex;align-items:center;gap:8px;padding:7px 4px;border-bottom:1px solid rgba(255,255,255,.05);font-size:12.5px}
.alstatrow .n{flex:none;width:34px;font-variant-numeric:tabular-nums;color:var(--hv-dim)}
.alstatrow .t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.alstatrow .fa{font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(255,160,70,.2);color:#ffc890}
.alstatrow.alarm .n{color:var(--hv-alert)}
@media (max-width:1180px){.algrid{grid-template-columns:minmax(0,1.2fr) minmax(0,1fr)}.alside{grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}}
.narrow .algrid,.narrow .algrid.proto{grid-template-columns:minmax(0,1fr)}
.narrow .alside{display:flex}
.narrow .ptitle .altab span{display:inline}
/* Handy: Karten nie breiter als der Bildschirm; lange Zustände zweizeilig statt den Namen zu verdrängen */
.narrow .section,.narrow .rows,.narrow .tile.row{min-width:0;max-width:100%}
.narrow .tile.row .tstate{max-width:46%;white-space:normal;text-align:right;line-height:1.25;overflow-wrap:anywhere}
.narrow .tile.row .tn{flex:1 1 0}
.narrow .tile.row.lock .tstate{display:none}
.narrow .ground{margin:0 -8px}
/* Handy: Navigation passt immer in die Breite; bei vielen Einträgen nur Symbole, Beschriftung am aktiven Eintrag */
.narrow .rail{justify-content:space-between;gap:2px}
.narrow .nav{flex:1 1 0;min-width:52px;max-width:104px;padding:7px 2px 5px}
.narrow .nav span{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px}
.narrow .rail.many .nav{min-width:0;padding:9px 0 7px}
.narrow .rail.many .nav span{display:none}
.narrow .rail.many .nav.active{flex-grow:2.2}
.narrow .rail.many .nav.active span{display:block}
/* Handy: Personen nebeneinander statt überlappend */
.narrow .persons.stack{gap:4px}.narrow .persons.stack .person{margin-left:0;box-shadow:none}
/* Handy: Energieleiste als festes Raster – nichts rutscht beim Umbrechen nach rechts */
.narrow .ebar{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:8px}
.narrow .ebar>.sp,.narrow .ebar .sun{display:none}
.narrow .ebar-e{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.narrow .ebar .ep{min-width:0;overflow:hidden;padding:6px 10px}
.narrow .ebar .ep b{margin-left:auto}
.narrow .ebar .schip,.narrow .ebar .pbtn{display:flex;justify-content:center;min-width:0;overflow:hidden;padding:8px 10px;font-size:12.5px;border-radius:12px}
.narrow .ebar .schip span,.narrow .ebar .pbtn span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* Wandpanel: Bildschirmschoner */
.saver{position:fixed;inset:0;z-index:40;background:#05070c;display:flex;align-items:center;justify-content:center;cursor:none;animation:mfade .6s ease;user-select:none}
.svbox{display:flex;flex-direction:column;align-items:center;gap:10px;transition:transform 2s ease;color:#e9eef7;text-align:center;padding:24px}
.svclock{font-size:clamp(72px,18vw,180px);font-weight:200;letter-spacing:-.02em;line-height:1;font-variant-numeric:tabular-nums}
.saver[data-clock=m] .svclock{font-size:clamp(56px,13vw,130px)}.saver[data-clock=s] .svclock{font-size:clamp(40px,8vw,84px)}
.svdate{font-size:clamp(16px,2.6vw,26px);color:rgba(233,238,247,.7)}
.svrow{display:flex;gap:26px;flex-wrap:wrap;justify-content:center;margin-top:14px;font-size:clamp(16px,2.4vw,24px);color:rgba(233,238,247,.85)}
.svrow span,.svstat span{display:inline-flex;align-items:center;gap:8px}
.svrow ha-icon{--mdc-icon-size:1.3em;color:rgba(233,238,247,.6)}
.svstat{margin-top:16px;font-size:clamp(14px,2vw,19px)}
.svstat span{padding:8px 16px;border-radius:999px;background:rgba(255,255,255,.06)}
.svstat .ok{color:#7fdcaa}.svstat .alarm{color:#fff;background:rgba(255,80,60,.35);animation:svpulse 1.6s ease-in-out infinite}.svstat .warn{color:#ffc277}.svstat .info{color:#8fd0ff}
@keyframes svpulse{50%{background:rgba(255,80,60,.6)}}
.saver.night .svbox{opacity:.4}
.saver.black .svbox{opacity:0}
.walldev.on .lbl{color:var(--hv-ok)}
/* Technik: Heizung und Wallbox */
.tech{padding:12px 16px 14px;margin-bottom:16px}
.dense .tech{padding:10px 12px 12px;margin-bottom:12px;border-radius:16px}
.techh{display:flex;align-items:center;gap:8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--hv-dim);margin-bottom:10px}
.techh ha-icon{--mdc-icon-size:17px;color:var(--hv-heat)}.wb .techh ha-icon{color:var(--hv-ok)}
.techs{margin-left:auto;letter-spacing:0;text-transform:none;font-size:13px;color:var(--hv-text);font-variant-numeric:tabular-nums}
.heatgrid{display:grid;grid-template-columns:minmax(170px,.8fr) minmax(170px,.8fr) minmax(300px,2fr);gap:12px}
.heatgrid[data-n="2"]{grid-template-columns:minmax(170px,1fr) minmax(300px,2fr)}
.heatgrid[data-n="1"]{grid-template-columns:minmax(0,1fr)}
.hpanel{background:var(--hv-surface);border:1px solid var(--hv-line);border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;min-width:0}
.hpt{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600}.hpt ha-icon{--mdc-icon-size:17px;color:var(--hv-dim)}
.hpt .chip{margin-left:auto;font-size:11px;font-weight:500;padding:2px 8px;border-radius:999px;background:var(--hv-surface-2);color:var(--hv-dim)}
.hpt .chip.on{background:rgba(255,138,61,.2);color:#ffb27a}
.hpf{font-size:12px;color:var(--hv-dim);font-variant-numeric:tabular-nums}.hpf b{color:var(--hv-text);font-weight:500}
.hpf .lnk{color:var(--hv-text);text-decoration:underline dotted;text-underline-offset:3px}
.tkwrap{position:relative;display:flex;gap:10px;align-items:stretch;flex:1;min-height:150px}
.tkwrap svg{width:62px;flex:none;height:150px}
.tkls{position:relative;flex:1}
.tkl{position:absolute;left:0;transform:translateY(-50%);display:flex;align-items:baseline;gap:6px;text-align:left;white-space:nowrap}
.tkl b{font-size:17px;font-weight:400;font-variant-numeric:tabular-nums}.tkl small{font-size:11.5px;color:var(--hv-dim)}
.stv{display:flex;align-items:center;gap:10px;text-align:left}
.stv .flame{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:var(--hv-surface-2);color:var(--hv-faint)}
.stv .flame ha-icon{--mdc-icon-size:28px}
.stv b{font-size:26px;font-weight:300;font-variant-numeric:tabular-nums}.stv small{display:block;font-size:12px;color:var(--hv-dim)}
.stove.burn .flame{background:rgba(255,120,50,.22);color:#ff9a4d;animation:hvflame 1.6s ease-in-out infinite}
.stove.warm .flame{color:#ffb27a}
@keyframes hvflame{0%,100%{box-shadow:0 0 0 0 rgba(255,120,50,.0)}50%{box-shadow:0 0 18px 2px rgba(255,120,50,.35)}}
.pump{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px;font-size:12.5px;color:var(--hv-dim);text-align:left}
.pump span{display:flex;align-items:center;gap:4px}.pump ha-icon{--mdc-icon-size:16px}
.pump i{height:6px;border-radius:3px;background:var(--hv-surface-2);overflow:hidden}.pump em{display:block;height:100%;background:var(--hv-cool);border-radius:3px}
.pump.run em{background:repeating-linear-gradient(90deg,var(--hv-cool) 0 10px,#9adcff 10px 20px);background-size:40px 100%;animation:hvpump 1s linear infinite}
.pump b{color:var(--hv-text);font-weight:500;font-variant-numeric:tabular-nums}
@keyframes hvpump{to{background-position:40px 0}}
.flowto{display:flex;align-items:center;gap:2px;color:var(--hv-cool)}.flowto ha-icon{--mdc-icon-size:18px}
.hkv{display:flex;gap:6px 16px;flex-wrap:wrap}
.hkv>*{display:flex;flex-direction:column;text-align:left}.hkv small{font-size:11px;color:var(--hv-dim)}
.hkv b{font-size:18px;font-weight:400;font-variant-numeric:tabular-nums}
.hkv .dev.ok b{color:var(--hv-ok)}.hkv .dev.mid b{color:var(--hv-warm)}.hkv .dev.bad b{color:var(--hv-alert)}
.hcc{position:relative;height:150px;margin:2px 30px 16px;cursor:crosshair;touch-action:pan-y}
.dense .hcc{height:120px}
.hcc svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.hcp{fill:none;stroke:var(--hv-heat);stroke-width:2.2;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.hcm{stroke:var(--hv-faint);stroke-dasharray:4 4;stroke-width:1;vector-effect:non-scaling-stroke}
.hcl{stroke:var(--hv-cool);stroke-dasharray:3 5;stroke-width:1.2;vector-effect:non-scaling-stroke;opacity:.8}
.hcg{stroke:var(--hv-line);stroke-width:1;vector-effect:non-scaling-stroke}
.hcn{stroke:rgba(255,255,255,.3);stroke-width:1;vector-effect:non-scaling-stroke}
.hcpt{position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;pointer-events:none}
.hcpt.soll{background:var(--hv-heat);box-shadow:0 0 0 3px rgba(255,138,61,.25)}
.hcpt.ist{border:2px solid #fff;width:16px;height:16px;margin:-8px 0 0 -8px}
.hcy{position:absolute;right:calc(100% + 6px);font-size:10.5px;color:var(--hv-faint);font-variant-numeric:tabular-nums}.hcy.hi{top:0}.hcy.lo{bottom:0}
.hcx{position:absolute;top:calc(100% + 3px);font-size:10.5px;color:var(--hv-faint);transform:translateX(-50%)}
.hcx[style*="left:0"]{transform:none}.hcx[style*="right:0"]{transform:none}
.hctip{position:absolute;top:-4px;transform:translate(-50%,-100%);display:none;padding:4px 9px;border-radius:9px;background:rgba(10,14,23,.92);border:1px solid var(--hv-line);font-size:12px;white-space:nowrap;pointer-events:none;z-index:2}
.hctip.on{display:block}.hctip b{font-weight:500}
.wbmain{display:grid;grid-template-columns:minmax(180px,1fr) minmax(200px,1.4fr) minmax(110px,.6fr);gap:12px;align-items:stretch}
.wbmain>button{background:var(--hv-surface);border:1px solid var(--hv-line);border-radius:14px;padding:10px 12px;text-align:left;min-width:0}
.wbpow{display:flex;align-items:center;gap:12px}
.wbic{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:var(--hv-surface-2);color:var(--hv-faint);flex:none}
.wbic ha-icon{--mdc-icon-size:26px}
.wb.charging .wbic{background:rgba(79,209,139,.2);color:var(--hv-ok);animation:hvcharge 2s ease-in-out infinite}
@keyframes hvcharge{50%{box-shadow:0 0 16px 2px rgba(79,209,139,.35)}}
.wbpow b{font-size:26px;font-weight:300;font-variant-numeric:tabular-nums}.wbpow small{display:block;font-size:12px;color:var(--hv-dim)}
.wbcar{display:flex;flex-direction:column;justify-content:center;gap:8px}
.wbct{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.wbct ha-icon{--mdc-icon-size:20px;color:var(--hv-dim);align-self:center}
.wbct b{font-size:20px;font-weight:400;font-variant-numeric:tabular-nums}.wbct small{font-size:12px;color:var(--hv-dim)}
.socbar{position:relative;height:8px;border-radius:4px;background:var(--hv-surface-2)}
.socbar em{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#3fbf7f,var(--hv-ok))}
.socbar u{position:absolute;top:-4px;bottom:-4px;width:2px;margin-left:-1px;background:#fff;border-radius:1px}
.wbses{display:flex;flex-direction:column;justify-content:center}.wbses small{font-size:11.5px;color:var(--hv-dim)}.wbses b{font-size:18px;font-weight:400;font-variant-numeric:tabular-nums}
.wbmodes{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:10px}
.wblim{display:inline-flex;align-items:center;gap:6px;margin-left:auto;font-size:13px}.wblim small{color:var(--hv-dim)}.wblim b{min-width:42px;text-align:center;font-variant-numeric:tabular-nums}
.narrow .heatgrid,.narrow .heatgrid[data-n]{grid-template-columns:minmax(0,1fr)}
.narrow .techs{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.narrow .wbmain{grid-template-columns:repeat(2,minmax(0,1fr))}.narrow .wbpow,.narrow .wbcar{grid-column:1/-1}
.narrow .wblim{margin-left:0}
@media (max-width:1100px){.heatgrid{grid-template-columns:repeat(2,minmax(0,1fr))}.heatgrid .curve{grid-column:1/-1}.heatgrid[data-n="1"] .curve{grid-column:auto}}
/* Verlauf 24 h */
.trend{padding:12px 16px 10px;margin-bottom:16px}
.dense .trend{padding:9px 12px 8px;margin-bottom:12px;border-radius:16px}
.trh{display:flex;align-items:center;gap:6px 16px;flex-wrap:wrap;margin-bottom:8px}
.trt{display:flex;align-items:center;gap:6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--hv-dim);margin-right:auto}
.trt ha-icon{--mdc-icon-size:16px}
.trl{display:inline-flex;align-items:baseline;gap:6px;font-size:13px;color:var(--hv-dim);padding:2px 4px;border-radius:8px;font-variant-numeric:tabular-nums}
.trl:hover{background:var(--hv-surface)}
.trl i{width:10px;height:3px;border-radius:2px;align-self:center}.trl.t i{background:var(--hv-heat)}.trl.h i{background:var(--hv-cool)}
.trl b{color:var(--hv-text);font-weight:500;font-size:15px}.trl small{font-size:11.5px;color:var(--hv-faint)}
.trc{position:relative;height:120px;margin:0 34px 18px;touch-action:pan-y;cursor:crosshair}
.dense .trc{height:92px}
.trc svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.trgrid line{stroke:var(--hv-line);stroke-width:1;vector-effect:non-scaling-stroke}
.trp{fill:none;stroke-width:2;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
.trp.t{stroke:var(--hv-heat)}.trp.h{stroke:var(--hv-cool);stroke-width:1.6;opacity:.9}
.ty{position:absolute;white-space:nowrap;font-size:10.5px;font-variant-numeric:tabular-nums;color:var(--hv-faint);line-height:1}
.ty.t{right:calc(100% + 6px)}.ty.h{left:calc(100% + 6px)}.ty.hi{top:2px}.ty.lo{bottom:2px}
.ty.t{color:rgba(255,138,61,.75)}.ty.h{color:rgba(99,199,255,.75)}
.trx{position:absolute;left:0;right:0;top:calc(100% + 4px);height:12px;font-size:10.5px;color:var(--hv-faint)}
.trx span{position:absolute;transform:translateX(-50%);white-space:nowrap}.trx .now{right:0;transform:none}
.trcur{position:absolute;top:0;bottom:0;width:1px;background:rgba(255,255,255,.35);display:none;pointer-events:none}
.trcur.on{display:block}
.trcur i{position:absolute;left:-4px;width:9px;height:9px;margin-top:-4.5px;border-radius:50%;border:2px solid #0c111d}
.trcur i.t{background:var(--hv-heat)}.trcur i.h{background:var(--hv-cool)}
.trtip{position:absolute;top:-6px;transform:translate(-50%,-100%);display:none;gap:8px;align-items:baseline;padding:4px 9px;border-radius:9px;background:rgba(10,14,23,.92);border:1px solid var(--hv-line);font-size:12px;white-space:nowrap;pointer-events:none;font-variant-numeric:tabular-nums;z-index:2}
.trtip.on{display:flex}.trtip span{color:var(--hv-dim)}.trtip b.t{color:#ffb27a;font-weight:500}.trtip b.h{color:#8fd6ff;font-weight:500}
.trmsg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;color:var(--hv-dim);background:transparent}
.trend.nodata .trc{height:48px}.trend.nodata .ty,.trend.nodata .trx{display:none}
:host(.card) .trtip{background:var(--card-background-color,#222)}
.narrow .trc{margin:0 30px 18px}
.narrow .trl small{display:none}
/* Energie */
.engrid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:16px;margin-bottom:16px}
.dense .engrid{gap:12px;margin-bottom:12px}
.eflow,.enside{padding:12px 16px 14px;min-width:0}
.dense .eflow,.dense .enside{padding:9px 12px 12px;border-radius:16px}
.efwrap{position:relative;height:350px;max-width:560px;margin:0 auto}
.dense .efwrap{height:330px}
.efwrap svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.eft{stroke:var(--hv-line);stroke-width:3;vector-effect:non-scaling-stroke;stroke-linecap:round}
.efd{stroke-width:6;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-dasharray:0 16;animation:hvflow 1.2s linear infinite}
.efd.pv{stroke:#ffc457}.efd.grid{stroke:#b39cff}.efd.bat{stroke:var(--hv-ok)}.efd.wb{stroke:var(--hv-cool)}
.efd.rev{animation-direction:reverse}.efd.off{display:none}
@keyframes hvflow{to{stroke-dashoffset:-16}}
@media (prefers-reduced-motion:reduce){.efd{animation:none;stroke-dasharray:none;stroke-width:3;opacity:.8}}
.enode{position:absolute;transform:translate(-50%,-50%);width:112px;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 6px;border-radius:16px;background:rgba(16,22,34,.88);border:1px solid var(--hv-line);text-align:center}
.enode:hover{border-color:rgba(255,255,255,.22)}
.enic{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--hv-surface-2);color:var(--hv-dim)}
.enic ha-icon{--mdc-icon-size:22px}
.enode b{font-size:17px;font-weight:400;font-variant-numeric:tabular-nums;white-space:nowrap}
.enode small{font-size:11.5px;color:var(--hv-dim);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.enode.pv .enic{color:#ffc457;background:rgba(255,196,87,.14)}.eflow.producing .enode.pv .enic{box-shadow:0 0 16px rgba(255,196,87,.35)}
.enode.grid .enic{color:#b39cff;background:rgba(179,156,255,.14)}
.enode.bat .enic{color:var(--hv-ok);background:rgba(79,209,139,.14)}
.enode.wb .enic{color:var(--hv-cool);background:rgba(99,199,255,.14)}
.enode.hub{width:128px;padding:10px 6px}.enode.hub .enic{width:48px;height:48px;color:var(--hv-text);background:rgba(255,255,255,.12)}.enode.hub b{font-size:20px}
.enside .trh+.ctstats{margin-bottom:14px}
.enside .cts b{font-size:20px}
.enhint{font-size:11.5px;color:var(--hv-faint)}
.ensplit{display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--hv-surface-2);margin:2px 0 6px}
.ensplit i{display:block;height:100%}.ensplit .own{background:var(--hv-ok)}.ensplit .imp{background:#b39cff}
.ensplitl{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:12px;color:var(--hv-dim)}
.ensplitl span{display:inline-flex;align-items:center;gap:6px}.ensplitl i{width:9px;height:9px;border-radius:50%}
.ensplitl .own i{background:var(--hv-ok)}.ensplitl .imp i{background:#b39cff}
.ctl.pv i{background:#ffc457}.ctl.use i{background:#63c7ff}.ctl.grid i{background:#b39cff}
.enp{fill:none;stroke-width:2;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
.enp.pv{stroke:#ffc457}.enp.use{stroke:#63c7ff}.enp.grid{stroke:#b39cff;stroke-width:1.6;opacity:.9}
.ena.pv{fill:rgba(255,196,87,.14);stroke:none}
.enzero{stroke:rgba(255,255,255,.3);stroke-width:1;vector-effect:non-scaling-stroke}
.trcur i.pv{background:#ffc457}.trcur i.use{background:#63c7ff}.trcur i.grid{background:#b39cff}
.trtip .tk.pv i{background:#ffc457}.trtip .tk.use i{background:#63c7ff}.trtip .tk.grid i{background:#b39cff}
.entrend.nodata .enc{height:48px}
/* Zeitraum der Verläufe: 24 h, Woche, Monat, Jahr */
.rng{display:inline-flex;gap:4px;flex-wrap:wrap}.rng .altab.sm{padding:3px 10px;font-size:11.5px}
.narrow .rng{order:9;flex-basis:100%}
.trbr{flex-basis:100%;height:0}.narrow .trbr{display:none}
.entrend.long .enc{margin-left:40px}
.enbars rect.pv{fill:#ffc457;opacity:.9}.enbars rect.use{fill:#63c7ff;opacity:.85}
.entrend.long .trc{cursor:default}.entrend.long .trcur{background:rgba(255,255,255,.18)}
.enper{margin-bottom:12px}
.enprice{padding:12px 16px 14px;margin-bottom:16px;min-width:0}
.dense .enprice{padding:9px 12px 12px;margin-bottom:12px;border-radius:16px}
.enprice .trh+.ctstats{margin-bottom:12px}.enprice .cts b{font-size:20px}
.enprice .cts.plv.billig b,.enprice .cts.saved b{color:var(--hv-ok)}.enprice .cts.plv.teuer b{color:var(--hv-alert)}.enprice .cts.best b{color:var(--hv-ok)}
.enpbars{position:relative;margin:2px 0 14px;padding-bottom:18px}
.enpb{position:relative;height:64px;border-bottom:1px solid var(--hv-line)}
.enpb i{position:absolute;bottom:0;display:block;box-sizing:border-box;border-left:1px solid transparent;border-right:1px solid transparent;background-clip:padding-box;border-radius:2px 2px 0 0;opacity:.55}
.enpb i.billig{background-color:var(--hv-ok)}.enpb i.mittel{background-color:#9aa6b8}.enpb i.teuer{background-color:var(--hv-alert)}
.enpb i.best{opacity:1}.enpb i.now{opacity:1;box-shadow:0 0 0 1px var(--hv-text)}
.enpx{position:absolute;left:0;right:0;bottom:0;height:16px;font-size:11px;color:var(--hv-faint)}
.enpx span{position:absolute;transform:translateX(-50%);white-space:nowrap}.enpx span:first-child{transform:none}
.wbprice:empty{display:none}
.wbprice{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:10px;font-size:12.5px;color:var(--hv-dim)}
.wbp{display:inline-flex;align-items:center;gap:5px;min-width:0}.wbp ha-icon{--mdc-icon-size:16px}.wbp b{color:var(--hv-text);font-weight:500}
.wbp.plv.billig b,.wbp.best b,.wbp.own{color:var(--hv-ok)}.wbp.plv.teuer b{color:var(--hv-alert)}
/* Rückblick: Monat gegen Vormonat und Vorjahr, Rekorde */
.rback{padding:12px 16px 14px;margin-bottom:16px;min-width:0}
.dense .rback{padding:9px 12px 12px;margin-bottom:12px;border-radius:16px}
.rbnav{display:inline-flex;align-items:center;gap:8px}.rbnav b{font-weight:500;font-size:13.5px;min-width:9em;text-align:center}
.rbnav .pbtn.sm{padding:4px 6px}.rbnav .pbtn:disabled{opacity:.35;cursor:default}
.rbr{display:grid;grid-template-columns:minmax(0,1fr) repeat(3,minmax(0,170px));gap:4px 12px;align-items:baseline;padding:6px 0;border-top:1px solid var(--hv-line)}
.rbhd{border-top:0;padding-top:0;align-items:end}
.rbc{display:flex;flex-direction:column;align-items:flex-end;min-width:0;text-align:right}
.rbc small{font-size:11px;color:var(--hv-dim)}.rbc span{font-size:12px;color:var(--hv-faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.rbc b{font-size:16px;font-weight:400;font-variant-numeric:tabular-nums}
.rbc em{font-style:normal;font-size:11px;color:var(--hv-faint);white-space:nowrap;font-variant-numeric:tabular-nums}
.rbc em.good{color:var(--hv-ok)}.rbc em.bad{color:var(--hv-warm)}
.rbc.part b{color:var(--hv-faint)}
.rbl{display:flex;flex-direction:column;min-width:0;font-size:13px}.rbl small{font-size:11px;color:var(--hv-faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rbsec{margin:10px 0 2px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--hv-dim)}
.rbtab .rbsec:first-of-type{margin-top:4px}
.rbmsg{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--hv-dim);padding:6px 0}
.rbrecw{margin-top:12px}.rbrec .cts.pv b{color:#ffc457}.rbrec .cts.warm b{color:var(--hv-warm)}.rbrec .cts.cold b{color:#63c7ff}
.rbnote:empty{display:none}.rbnote{margin-top:6px}
.narrow .rbr{gap:2px 8px}.narrow .rbc b{font-size:14px}.narrow .rbl{font-size:12px}
.narrow .engrid{grid-template-columns:minmax(0,1fr)}
.narrow .efwrap{height:310px}
.narrow .enode{width:92px;padding:6px 4px}.narrow .enode.hub{width:104px}
.narrow .enic{width:34px;height:34px}.narrow .enode b{font-size:15px}
@media (max-width:1100px){.engrid{grid-template-columns:minmax(0,1fr)}}
/* Wartungsplaner */
.wgrid{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;max-width:980px}
.wgrid .section{margin-bottom:0}
.wlist{padding:4px 8px 10px}
.wrow{display:flex;align-items:center;gap:12px;padding:10px 8px;border-top:1px solid var(--hv-line)}
.wrow:first-child{border-top:0}
.wic{flex:0 0 auto;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--hv-surface-2);color:var(--hv-dim)}
.wrow.due .wic{background:rgba(255,160,70,.18);color:#ffa046}.wrow.soon .wic{color:var(--hv-warm)}
.wtx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.wtx b{font-weight:600;font-size:14.5px;overflow:hidden;text-overflow:ellipsis}
.wtx small{font-size:12px;color:var(--hv-dim);overflow:hidden;text-overflow:ellipsis}
.wrow.due .wdue{color:#ffa046;font-weight:600}.wrow.soon .wdue{color:var(--hv-warm)}
.wnote{font-style:italic}
.wbar{display:block;height:4px;border-radius:2px;background:var(--hv-surface-2);margin-top:5px;overflow:hidden;max-width:320px}
.wbar i{display:block;height:100%;border-radius:2px;background:var(--hv-ok)}
.wrow.soon .wbar i{background:var(--hv-warm)}.wrow.due .wbar i{background:#ffa046}
.wbtns{flex:0 0 auto;display:flex;gap:6px;align-items:center}
.wrow.due .wdone{background:var(--hv-accent);border-color:transparent;color:#fff}
.narrow .wrow{flex-wrap:wrap}.narrow .wbtns{width:100%;justify-content:flex-end}
.aurow[hidden],.auempty[hidden]{display:none}.aurow:not(.on) .wtx b{color:var(--hv-dim)}.aurow.on .wic{color:var(--hv-accent)}
.ausearch{width:100%;box-sizing:border-box}.auempty{padding:0 16px 12px}
.aubody{padding:4px 16px 14px}.auform .srow{flex-wrap:wrap;gap:8px}.auform .shead .sbtn{margin-left:auto}.auform .srow .lbl{flex:0 0 110px;min-width:0}
.wtask .wsi{color:var(--hv-dim);display:inline-flex}
`;

const LOGO = `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="hvg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7cc4ff"/><stop offset="1" stop-color="#9a86ff"/></linearGradient></defs>
<path d="M5.5 22.5 24 7l18.5 15.5" fill="none" stroke="url(#hvg)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M11 20v19a2.5 2.5 0 0 0 2.5 2.5h21A2.5 2.5 0 0 0 37 39V20" fill="none" stroke="url(#hvg)" stroke-width="3.4" stroke-linejoin="round"/>
<path d="M11 30.5h26" stroke="url(#hvg)" stroke-width="2" opacity=".55"/>
<rect x="15.5" y="22.5" width="7" height="5" rx="1.3" fill="#ffc457"/><rect x="25.5" y="22.5" width="7" height="5" rx="1.3" fill="url(#hvg)" opacity=".45"/>
<rect x="15.5" y="33.5" width="7" height="5" rx="1.3" fill="url(#hvg)" opacity=".45"/><rect x="25.5" y="33.5" width="7" height="5" rx="1.3" fill="#ffc457"/></svg>`;

export { LOGO, STYLES };
