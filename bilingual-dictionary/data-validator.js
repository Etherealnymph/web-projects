// 数据校验脚本：检查 data-common-*.js 的结构、词表覆盖、IPA 合法字符、重复词。
const fs = require("fs");
const path = require("path");
const DIR = __dirname;

// 预期词表（与各子代理任务一致）
const EXPECTED = {
  COMMON_A: "able about above accept accident achieve across act action active activity add address adult advantage advice afraid after afternoon again against age ago agree air airport all allow almost alone along already also although always amazing among angry animal answer any anyone anything anywhere appear apple apply area argue arm army around arrive art article artist ask attack attention aunt autumn available average avoid awake away".split(" "),
  COMMON_B: "be back bad bag ball banana bank base basic bath beach bear because become bed before begin behind bell belong below between beyond big bike bird birthday bit black block blood blow blue board boat body book bored boring borrow boss both bother bottle bottom box boy brave bread break breakfast breath breathe bridge bright bring brother brown brush build building burn bus business busy buy".split(" "),
  COMMON_C: "cake call calm camera camp cancel cancer candy car card care careful carry case cat catch cause celebrate cell center century certain chair challenge chance character charge cheap check cheese chicken child chocolate church circle city class clean clear clever climb clock close clothes cloud cloudy club coffee cold collect college color come comfort comfortable common communicate community company compare compete competition complain complete computer concentrate condition confident connect consider contain continue control conversation cook cookie cool corner correct cost count country couple course cousin cover crazy create crime cross crowd cry culture cup curious cut cute".split(" "),
  COMMON_D: "dance danger dangerous dark date daughter day dead deal death decide decision deep delicious describe design desk detail develop dictionary die difference different difficult dinner direction dirty do discover discuss disease dish distance doctor dog dollar door double doubt down draw dress drink drive driver drop dry during duty".split(" "),
  COMMON_E: "each early earn earth east easy eat edge education effort egg else email empty encourage end enemy energy enjoy enough enter environment equal especially even evening event ever every everybody everyone everything everywhere exact exam example excellent except excited exciting exercise expect expensive experience explain eye".split(" "),
  COMMON_F: "face fact fail fair fall family famous fan far farm fast fat father favorite fear feed feel feeling few field fight fill film final find fine finger finish fire first fish fit five fix flat floor flower fly follow food foot football force foreign forest forget forgive form formal forward four free freeze fresh Friday front fruit full fun funny future".split(" "),
  COMMON_GH: "game garden gas gate general get gift girl give glass go goal gold good government grade grass great green ground group grow guess guest guide gun hair half hall hand hang happen happy hard hate have head health healthy hear heart heat heavy height hello help hide high history hit hold holiday honest horse hospital hot hotel hour house how however huge human hundred hungry hurry hurt husband".split(" "),
  COMMON_IJKL: "ice idea if important improve in include income increase indeed information inside instead intelligent interest interesting international internet into introduce invent invite iron island it its job join joke juice jump just keep key kick kid kill kind king kiss kitchen knee knife knock know knowledge land language laptop large last late laugh law lazy lead leader learn least leave left leg lend less lesson let letter level library lie light like line listen little live local lock long look lose loss lot loud low luck lucky lunch".split(" "),
  COMMON_MNO: "machine mail main major make man manage many map market marry match matter may maybe meal mean meaning meat medicine meet meeting member memory mention menu milk mind minute mirror miss mistake mix model modern mom moment Monday money monkey month moon more morning most mother mountain mouse mouth move movie much music must my name natural nature near necessary neck need never new news next nice night nine no noise nor north nose not nothing now number object ocean off offer office officer often oil ok old on once one only open opinion or orange order organize other our out outside over own owner".split(" "),
  COMMON_P: "page pain paint pair paper parent park part party pass past path patient pay peace pen pencil people perfect perhaps period person personal pet phone photo piano pick picture piece pig pink place plan plane plant plate play player please pleasure point police polite pool poor popular possible practice prefer prepare present president press pretty prevent price pride problem protect proud prove provide public pull push put".split(" "),
  COMMON_QR: "quality question quick quiet quit quite radio rain rather reach read ready real realize really reason receive recent record red reduce regular relax remain remember remind remove repeat report respect rest restaurant result return rice rich ride right ring rise river road robot rock role room round rule run rush".split(" "),
  COMMON_S: "sad safe same save say school science sea search season seat second secret see seem sell send sense serious seven share she sheep ship shirt shoe shop short should shout show shut sick side simple since sing single sister sit six size skill skin sky sleep slow small smart smell smile smoke snow so social soft soldier solve some somebody someone something sometimes son song soon sorry sound south speak special speed spell spend sport spring stand star start stay step still stop story street strong student study succeed such suddenly suggest sugar summer sun sunny sure surprise sweet swim".split(" "),
  COMMON_TUVWYZ: "table take talk tall taste taxi tea teach teacher team tell ten test than thank that the their them then there these they thin thing think this though three through throw tired to today too tool tooth top town train travel tree trip trouble true trust truth try turn two ugly umbrella uncle under understand until up us use used useful usual usually vacation value vegetable very video view village visit voice wait wake walk wall want war warm wash watch water way we wear weather Wednesday week weekend weight welcome well west wet what when where which while white who whole why wife will win wind window winter wish with without woman wonderful word work worry would write wrong year yellow yes yesterday yet you young your yours yourself zero zoo".split(" "),
  COMMON_EECS: "semiconductor|MOSFET|BJT|diode|LED|photodiode|resistor|capacitor|inductor|sensor|actuator|relay|transformer|antenna|wafer|die|package|pin|socket|probe|analog|voltage|current|resistance|impedance|capacitance|inductance|ground|supply|reference|bias|amplifier|op-amp|gain|feedback|bandwidth|offset|noise|distortion|linearity|saturation|comparator|mixer|filter|oscillator|phase|loop|stability|regulator|LDO|buck|boost|ADC|DAC|sample|quantization|resolution|SNR|ESD|digital|logic|gate|flip-flop|latch|register|counter|decoder|encoder|multiplexer|demultiplexer|adder|ALU|combinational|sequential|synchronous|asynchronous|clock|reset|bit|byte|word|bus|address|memory|SRAM|DRAM|cache|ROM|EEPROM|flash|FIFO|pipeline|hazard|instruction|RISC|CISC|CPU|GPU|DSP|MCU|SoC|FPGA|ASIC|CPLD|SPI|I2C|UART|USB|GPIO|PWM|DMA|CAN|Ethernet|RS-232|JTAG|HDMI|MIPI|PCIe|DDR|protocol|handshake|interrupt|ISR|schematic|netlist|layout|floorplan|placement|routing|synthesis|simulation|verification|testbench|coverage|DRC|LVS|tapeout|mask|process|node|library|timing|constraint|STA|DFT|EDA|SPICE|corner|PVT|ECO|firmware|hardware|software|RTOS|bootloader|debug|debugger|oscilloscope|multimeter|datasheet|errata|benchmark|prototype|watchdog|polling|stack|heap|power|efficiency|ripple|dropout|load|input|output|switching|linear|amplitude|bandgap|Bode plot|body effect|buffer|cascode|channel length modulation|charge pump|clipping|closed-loop gain|CMRR|common-mode|compensation|correlated double sampling|crossover distortion|crystal|current limit|current mirror|current sink|current source|cutoff|delta-sigma|depletion region|differential|differential amplifier|differentiator|DNL|dominant pole|drain current|duty cycle|Early effect|ENOB|flash ADC|flicker noise|frequency|frequency divider|frequency response|full-scale|gain margin|gate oxide|hysteresis|impedance matching|INL|instrumentation amplifier|integrator|jitter|latch-up|level shifter|line regulation|load regulation|loading effect|loop filter|LSB|Miller effect|MSB|noise figure|open-loop gain|overdrive|phase detector|phase margin|phase noise|pipeline ADC|PLL|pole|power amplifier|preamplifier|PSRR|sample-and-hold|SAR|settling time|SFDR|shot noise|SINAD|slew rate|soft-start|subthreshold|successive approximation|switched capacitor|THD|thermal noise|thermal shutdown|threshold|transconductance|transient response|transimpedance amplifier|triode region|unity-gain frequency|UVLO|VCO|voltage divider|voltage follower|waveform|weak inversion|zero".split("|")
};

const VALID_DOM = new Set(["analog","digital","interface","device","eda","system","power"]);

const IPA_OK = new Set("ɑɒɔəɜɪʊʌæeiouaːˈˌ() pbtdkɡg fvθðszʃʒhtʃdʒmnŋlrjw".split(""));

let total = 0, problems = 0, dupes = 0, missing = 0;
const seen = new Map();
const report = [];

function check(arr, name) {
  const expect = EXPECTED[name];
  if (!expect) { report.push(`!! ${name}: 无预期词表`); return; }
  const words = arr.map(e => e[0]);
  const dup = words.filter((w, i) => words.indexOf(w) !== i);
  if (dup.length) { dupes += dup.length; report.push(`!! ${name}: 重复词 ${[...new Set(dup)].join(",")}`); }
  for (const e of arr) {
    total++;
    const word = e[0], pos = e[1], ipaUS = e[2], ipaUK = e[3], senses = e[4],
          inflOv = e[5] === undefined ? null : e[5],
          related = e[6] === undefined ? null : e[6],
          note = e[7] === undefined ? null : e[7];
    const loc = `${name}:${word}`;
    if (!Array.isArray(e) || (e.length !== 8 && e.length !== 7 && e.length !== 9)) { report.push(`!! ${loc}: 数组长度应为7/8/9，实际${e.length}`); problems++; continue; }
    if (typeof word !== "string" || !word) { report.push(`!! ${loc}: word 缺失`); problems++; }
    if (typeof pos !== "string" || !pos) { report.push(`!! ${loc}: pos 缺失`); problems++; }
    for (const [k, v] of [["ipaUS", ipaUS], ["ipaUK", ipaUK]]) {
      if (typeof v !== "string" || !v) { report.push(`!! ${loc}: ${k} 缺失`); problems++; continue; }
      const bad = v.replace(/[ˈˌː]/g, "").split("").filter(c => !IPA_OK.has(c));
      if (bad.length) { report.push(`!! ${loc}: ${k} 含非法字符 [${bad.join("")}] -> ${v}`); problems++; }
    }
    if (!Array.isArray(senses) || !senses.length) { report.push(`!! ${loc}: senses 缺失`); problems++; }
    else {
      senses.forEach((s, i) => {
        if (!Array.isArray(s) || s.length < 3 || !s[0] || !s[1] || !s[2]) {
          report.push(`!! ${loc}: sense${i} 缺 pos/cn/en`); problems++;
        }
      });
    }
    if (inflOv !== null && !Array.isArray(inflOv)) { report.push(`!! ${loc}: inflOv 应为 null 或数组`); problems++; }
    if (related !== null && !Array.isArray(related)) { report.push(`!! ${loc}: related 应为 null 或数组`); problems++; }
    if (note !== null && typeof note !== "string") { report.push(`!! ${loc}: note 应为 null 或字符串`); problems++; }
    const dom = e[8] === undefined ? null : e[8];
    if (dom !== null && !VALID_DOM.has(dom)) { report.push(`!! ${loc}: dom 非法 [${dom}]`); problems++; }
    if (name === "COMMON_EECS" && !dom) { report.push(`!! ${loc}: EECS 词条缺 dom`); problems++; }
  }
  // 词表覆盖
  const set = new Set(words);
  const miss = expect.filter(w => !set.has(w));
  const extra = words.filter(w => !expect.includes(w));
  if (miss.length) { missing += miss.length; report.push(`!! ${name}: 缺少 ${miss.join(",")}`); }
  if (extra.length) report.push(`!! ${name}: 多余词 ${extra.join(",")}`);
  report.push(`ok ${name}: ${words.length} 词 (预期 ${expect.length}, 缺 ${miss.length})`);
}

for (let i = 1; i <= 13; i++) {
  const f = path.join(DIR, `data-common-${i}.js`);
  if (!fs.existsSync(f)) { report.push(`!! 缺少文件 data-common-${i}.js`); continue; }
  global.window = {};
  try { require(f); } catch (err) { report.push(`!! data-common-${i}.js 解析失败: ${err.message}`); continue; }
  const key = Object.keys(global.window).find(k => k.startsWith("COMMON_"));
  if (!key) { report.push(`!! data-common-${i}.js 未定义 COMMON_*`); continue; }
  check(global.window[key], key);
}

// EECS 专业词表
global.window = {};
try {
  require(path.join(DIR, "data-eecs.js"));
  if (global.window.COMMON_EECS) check(global.window.COMMON_EECS, "COMMON_EECS");
} catch (err) {
  report.push(`!! data-eecs.js 解析失败: ${err.message}`);
}

console.log(report.join("\n"));
console.log(`\n总计: ${total} 词, 问题 ${problems}, 重复 ${dupes}, 缺词 ${missing}`);
process.exitCode = problems || dupes || missing ? 1 : 0;
