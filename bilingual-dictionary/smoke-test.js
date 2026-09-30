// Smoke test for the dictionary: stub browser APIs, load all data files, run build + renders.
const fs = require("fs");
const os = require("os");
const path = require("path");
const DIR = "D:\\Code\\bilingual-dictionary";

const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("no script"); process.exit(1); }

function makeEl() {
  return {
    innerHTML: "", textContent: "", style: {}, dataset: {},
    classList: { add(){}, remove(){}, toggle(){} },
    addEventListener(){}, setAttribute(){}, getAttribute(){ return null; },
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    scrollIntoView(){}, blur(){}, focus(){}
  };
}
const elements = {};
global.document = {
  documentElement: makeEl(),
  querySelector(sel) { if (!elements[sel]) elements[sel] = makeEl(); return elements[sel]; },
  querySelectorAll(){ return []; },
  addEventListener(){}
};
global.window = { addEventListener(){}, scrollTo(){} };
global.location = { hash: "" };
global.localStorage = { getItem(){ return null; }, setItem(){} };
global.matchMedia = () => ({ matches: false });
global.speechSynthesis = { cancel(){}, speak(){} };
global.SpeechSynthesisUtterance = function(){};

// 先加载全部数据文件（定义 window.COMMON_*）
const dataFiles = fs.readdirSync(DIR).filter(f => /^(data-common-\d+|data-eecs)\.js$/.test(f)).sort();
for (const f of dataFiles) require(path.join(DIR, f));
console.log("loaded data files:", dataFiles.join(", "));

// Append exports so require() can hand back internals.
const src = m[1] + "\nmodule.exports = { WORDS, DERIVED, INDEX, KEYMAP, route, renderFull, renderDerived, renderHome, renderNotFound };";
const tmp = path.join(os.tmpdir(), "dict_script.js");
fs.writeFileSync(tmp, src, "utf8");
const { WORDS, DERIVED, INDEX, KEYMAP, route, renderFull, renderDerived, renderHome, renderNotFound } = require(tmp);

const assert = (cond, msg) => { if (!cond) { console.error("FAIL: " + msg); process.exitCode = 1; } else console.log("ok: " + msg); };
const infl = w => w.inflections.map(i => i.label + ":" + i.forms);

const total = Object.keys(WORDS).length;
const featCount = Object.values(WORDS).filter(w => w.feat).length;
assert(total >= 1260, "headwords loaded: " + total);
assert(featCount === 19, "featured headwords: " + featCount);
assert(Object.keys(DERIVED).length > 4000, "derived forms indexed: " + Object.keys(DERIVED).length);

// EECS 专业词条
const eecsCount = Object.values(WORDS).filter(w => w.dom).length;
assert(eecsCount === 270, "EECS domain words: " + eecsCount);
for (const w of ["ADC", "DAC", "op-amp", "MOSFET", "amplifier", "FPGA", "UART", "SPI", "I2C", "JTAG", "SPICE", "SoC", "PLL", "VCO", "bandgap", "slew rate", "current mirror", "thermal noise", "phase margin", "ENOB", "delta-sigma", "hysteresis"])
  assert(WORDS[w], "EECS word present: " + w);
assert(WORDS.ADC.dom === "analog" && WORDS.FPGA.dom === "digital", "EECS dom tags set");
assert(WORDS.firmware.dom === "system" && WORDS.buck.dom === "analog" && WORDS.tapeout.dom === "eda", "more dom tags");
assert(WORDS.PLL.dom === "analog" && WORDS.UVLO.dom === "power" && WORDS["charge pump"].dom === "power", "new analog/power dom tags");
// 专业词与通用词合并义项
assert(WORDS.current.senses.some(s => s.cn.includes("电流")), "current merged 电流 sense");
assert(WORDS.power.senses.some(s => s.cn.includes("电源")), "power merged 电源 sense");
assert(WORDS.power.quotes.length > 0 && WORDS.power.feat, "power keeps featured quotes after merge");
assert(WORDS.clock.senses.some(s => s.cn.includes("时钟")), "clock merged 时钟 sense");
assert(WORDS.gate.senses.some(s => s.cn.includes("逻辑门")), "gate merged 逻辑门 sense");
// EECS 变形
assert(infl(WORDS.reset).some(s => s === "过去式:reset"), "reset past reset");
assert(infl(WORDS.debug).some(s => s === "过去式:debugged"), "debug past debugged");
assert(infl(WORDS.amplifier).some(s => s === "复数:amplifiers"), "amplifier plural amplifiers");
assert(!infl(WORDS.firmware).some(s => s === "复数"), "firmware has no plural");

// 精选词条相关
assert(DERIVED["dreams"] && DERIVED["dreams"].some(l => l.rel === "复数"), "dreams -> 复数");
assert(DERIVED["dreamt"] && DERIVED["dreamt"].some(l => l.rel === "过去式"), "dreamt -> 过去式");
assert(DERIVED["lives"] && DERIVED["lives"].some(l => l.base === "life" && l.rel === "复数"), "lives -> life 复数");
assert(DERIVED["belief"] && DERIVED["belief"].some(l => l.base === "believe"), "belief -> believe");
// more/most 是真实词条和相关词，不应被任意形容词的比较级污染
assert(!DERIVED["more"].some(l => l.rel === "比较级"), "more has no bogus 比较级 entries");
assert(!DERIVED["most"].some(l => l.rel === "最高级"), "most has no bogus 最高级 entries");

// 自动词形变化引擎检查
assert(infl(WORDS.cat).some(s => s === "复数:cats"), "cat plural cats: " + infl(WORDS.cat).join(" "));
assert(infl(WORDS.go).some(s => s === "过去式:went"), "go past went");
assert(infl(WORDS.happy).some(s => s === "比较级:happier"), "happy comparative happier");
assert(infl(WORDS.child).some(s => s === "复数:children"), "child plural children");
assert(infl(WORDS.study).some(s => s === "过去式:studied"), "study past studied");
assert(infl(WORDS.stop).some(s => s === "过去式:stopped"), "stop past stopped");
assert(infl(WORDS.be).some(s => s === "第三人称单数:is"), "be 3rd person is");
assert(infl(WORDS.foot).some(s => s === "复数:feet"), "foot plural feet");
assert(infl(WORDS.good).some(s => s === "比较级:better"), "good comparative better");
assert(infl(WORDS.busy).some(s => s === "比较级:busier"), "busy comparative busier");
assert(infl(WORDS.cute).some(s => s === "比较级:cuter"), "cute comparative cuter (e-ending)");
assert(infl(WORDS.nice).some(s => s === "最高级:nicest"), "nice superlative nicest (e-ending)");
assert(infl(WORDS.safe).some(s => s === "比较级:safer"), "safe comparative safer (e-ending)");
assert(infl(WORDS.journey).some(s => s === "复数:journeys"), "journey plural journeys");
assert(infl(WORDS.be).some(s => s === "第三人称单数:is" && s === "第三人称单数:is"), "be 3rd person is");
assert(infl(WORDS.be).some(s => s === "过去式:was"), "be past was");
assert(infl(WORDS.do).some(s => s === "过去式:did"), "do past did");
assert(infl(WORDS.do).some(s => s === "第三人称单数:does"), "do 3rd person does");
assert(!WORDS.news.inflections.some(i => i.label === "复数"), "news has no plural (uncountable)");
for (const d of ["cats", "went", "happier", "children", "studied", "stopped", "is", "feet", "better", "busier", "eaten", "running"])
  assert(DERIVED[d] && DERIVED[d].length, "derived link exists: " + d);
assert(DERIVED["is"].some(l => l.base === "be"), "is -> be");

assert(INDEX.length === total + Object.keys(DERIVED).length, "index covers all words: " + INDEX.length);

// 渲染：精选词条
const full = renderFull(WORDS.dream, "dream");
assert(full.includes("I have a dream") && full.includes("Martin Luther King"), "dream full page has MLK quote + source");
assert(full.includes('href="#/dreams"') && full.includes('href="#/dreamt"'), "inflection links present");
assert(full.includes('data-speak="dream"') && full.includes("en-GB") && full.includes("en-US"), "IPA speak buttons present (US+UK)");
assert(full.includes("/driːm/"), "IPA rendered");
assert(full.includes("sweet dreams"), "collocation chips rendered");
assert(full.includes("详细释义") && full.includes("词形变化") && full.includes("相关词汇"), "all sections present");
assert(full.includes("精选"), "featured badge shown");

// 渲染：常用词条（无名言区，有自动变形链接）
const bfull = renderFull(WORDS.banana, "banana");
assert(bfull.includes("/bəˈnænə/") && bfull.includes("香蕉"), "banana IPA + 中文 rendered");
assert(bfull.includes('href="#/bananas"'), "banana plural link present");
assert(!bfull.includes("例句 · 名言"), "common word has no quotes section");
assert(bfull.includes("复数"), "banana inflections shown");

// 渲染：EECS 专业词条（领域徽章 + 缩写全称）
const adcfull = renderFull(WORDS.ADC, "ADC");
assert(adcfull.includes("模数转换器") && adcfull.includes("Analog-to-Digital Converter"), "ADC full name expanded");
assert(adcfull.includes("Analog-to-Digital Converter（模数转换器）"), "ADC word-full line shown");
assert(adcfull.includes("模拟"), "ADC domain badge shown");
assert(!adcfull.includes("例句 · 名言"), "ADC has no quotes section");
const adcZh = adcfull.includes("/ˌeɪ diː ˈsiː/"), adcIpa = adcfull.includes("data-speak=\"ADC\"");
assert(adcZh && adcIpa, "ADC IPA + speak button");

// 全称提取与显示
assert(WORDS.ASIC.full === "Application-Specific Integrated Circuit", "ASIC full name");
assert(WORDS.I2C.full === "Inter-Integrated Circuit", "I2C full name");
assert(WORDS["op-amp"].full === "operational amplifier", "op-amp full name");
assert(WORDS["RS-232"].full === "Recommended Standard 232", "RS-232 full name");
assert(!WORDS.banana.full, "common word has no full name");
assert(Object.values(WORDS).filter(w => w.full && !w.dom).length === 0, "no false full names on common words");
const asicfull = renderFull(WORDS.ASIC, "ASIC");
assert(asicfull.includes("Application-Specific Integrated Circuit（专用集成电路）"), "ASIC word-full line shown");

// 搜索排序：大写缩写词按字典序排第一
const q1 = "asic";
const h1 = INDEX.filter(i => {
  const w = i.word.toLowerCase();
  return w.includes(q1) || i.zh.includes(q1) || i.en.toLowerCase().includes(q1);
}).map(i => ({ w: i.word.toLowerCase(), word: i.word }))
  .sort((a, b) => (a.w === q1 ? 0 : a.w.startsWith(q1) ? 1 : 2) - (b.w === q1 ? 0 : b.w.startsWith(q1) ? 1 : 2) || a.w.localeCompare(b.w));
assert(h1[0] && h1[0].w === "asic", "search 'asic' ranks ASIC first: " + h1.map(h => h.word).join(","));
const q2 = "spi";
const h2 = INDEX.filter(i => {
  const w = i.word.toLowerCase();
  return w.includes(q2) || i.zh.includes(q2) || i.en.toLowerCase().includes(q2);
}).map(i => i.word.toLowerCase())
  .sort((a, b) => (a === q2 ? 0 : a.startsWith(q2) ? 1 : 2) - (b === q2 ? 0 : b.startsWith(q2) ? 1 : 2) || a.localeCompare(b));
assert(h2[0] === "spi", "search 'spi' ranks SPI first");

// 渲染：自动生成的变形词页
const dcats = renderDerived("cats");
assert(dcats.includes('href="#/cat"') && dcats.includes("复数"), "derived page cats -> cat");
const dwent = renderDerived("went");
assert(dwent.includes('href="#/go"') && dwent.includes("过去式"), "derived page went -> go");

const derived = renderDerived("lives");
assert(derived.includes('href="#/life"') && derived.includes("复数"), "derived page links back to life");

const home = renderHome();
assert(home.includes("card-grid") && home.includes("dream") && home.includes("banana"), "home page renders cards");

const notfound = renderNotFound("xyzzy");
assert(notfound.includes("未收录"), "not-found page renders");

// 大小写不敏感路由（ASIC/I2C/MOSFET 等缩写词）
assert(KEYMAP["asic"] === "ASIC" && KEYMAP["i2c"] === "I2C" && KEYMAP["mosfets"] === "MOSFETs", "KEYMAP resolves lowercase -> real key");
assert(DERIVED["ASICs"] && DERIVED["ASICs"].some(l => l.base === "ASIC"), "ASICs derived exists");
function routeTo(hash) {
  global.location.hash = hash;
  route();
  return elements["#detail"] ? elements["#detail"].innerHTML : "";
}
assert(routeTo("#/ASIC").includes("专用集成电路"), "route #/ASIC opens ASIC page");
assert(routeTo("#/asic").includes("专用集成电路"), "route #/asic opens ASIC page (case-insensitive)");
assert(routeTo("#/I2C").includes("I²C") || routeTo("#/I2C").includes("I2C"), "route #/I2C opens I2C page");
assert(routeTo("#/asics").includes("ASIC") && routeTo("#/asics").includes("复数"), "route #/asics opens derived page");
assert(routeTo("#/mosfets").includes("MOSFET"), "route #/mosfets opens MOSFET derived page");
assert(routeTo("#/xyzzy").includes("未收录"), "route unknown shows not-found");

// 数据完整性
let bad = [];
for (const [head, w] of Object.entries(WORDS)) {
  if (!w.ipa || !w.ipa.us || !w.ipa.uk) bad.push(head + ":ipa");
  if (!Array.isArray(w.senses) || !w.senses.length) bad.push(head + ":senses");
  if (!Array.isArray(w.quotes)) bad.push(head + ":quotes-type");
  if (w.feat && (!Array.isArray(w.quotes) || !w.quotes.length)) bad.push(head + ":quotes-empty");
  w.senses.forEach((s, i) => { if (!s.pos || !s.cn || !s.en) bad.push(head + ":sense" + i); });
  w.quotes.forEach((q, i) => { if (!q.en || !q.zh || !q.src || !q.type) bad.push(head + ":quote" + i); });
  (w.inflections || []).forEach((it, i) => { if (!it.label || !it.forms) bad.push(head + ":infl" + i); });
  (w.related || []).forEach((r, i) => { if (!r.word || !r.note) bad.push(head + ":rel" + i); });
}
assert(!bad.length, "all word fields complete" + (bad.length ? " -> " + bad.join(",").slice(0, 300) : ""));

// 死链检查
let dead = [];
for (const [tok, list] of Object.entries(DERIVED)) {
  for (const l of list) if (!WORDS[l.base]) dead.push(tok + "->" + l.base);
}
assert(!dead.length, "all derived links resolve to a base word" + (dead.length ? " -> " + dead.join(",").slice(0, 300) : ""));

// 搜索
const hits = INDEX.filter(i => i.word === "dream" || i.zh.includes("香蕉"));
assert(hits.some(h => h.word === "dream"), "search finds headword dream");
assert(hits.some(h => h.zh.includes("香蕉")), "search finds banana by 中文");
const enHits = INDEX.filter(i => i.word.toLowerCase().includes("happy"));
assert(enHits.some(h => h.word === "happy"), "search finds happy");

console.log(process.exitCode ? "SMOKE TEST FAILED" : "SMOKE TEST PASSED");
