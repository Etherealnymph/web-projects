export const GRID = 20;
export const snap = (v) => Math.round(v / GRID) * GRID;
export const isHighVoltNet = (n) => /^(vdd|vcc|avdd|dvdd|vdd33)$/i.test(n || "");
export const isLowVoltNet = (n) => /^(0|gnd|vss|avss|dvss)$/i.test(n || "");
export const isNegVoltNet = (n) => /^(vee|avee|dvee|vneg|avneg|dvneg|v_neg|neg_v|-\d+(?:\.\d+)?v?)$/i.test(n || "");

const BUILTIN_TSMC_PDK = {
  id: "pdk_tsmc018_rf",
  name: "TSMC 0.18um RF (rf018.scs)",
  fileName: "rf018.scs",
  nmosModels: [
    { name: "nch", desc: "1.8V Core NMOS (L:0.18~20u, W:0.22~900u)", defaultParams: "w=10u l=1u" },
    { name: "nch3", desc: "3.3V I/O NMOS (L:0.35~20u, W:0.22~900u)", defaultParams: "w=10u l=1u" },
    { name: "nanch", desc: "1.8V Native NMOS (L:0.5~20u)", defaultParams: "w=10u l=1u" },
    { name: "nanch3", desc: "3.3V Native NMOS (L:1.2~20u)", defaultParams: "w=10u l=1.5u" },
    { name: "mench", desc: "1.8V Medium-Vt NMOS (L:0.3~10u)", defaultParams: "w=10u l=1u" },
    { name: "mench3", desc: "3.3V Medium-Vt NMOS (L:0.6~10u)", defaultParams: "w=10u l=1u" },
    { name: "nmos_rf", desc: "1.8V RF NMOS Subckt (BSIM3v3 + 寄生网络)", defaultParams: "lr=0.18u wr=1.5u nr=16" },
    { name: "nmos_rf33", desc: "3.3V RF NMOS Subckt (BSIM3v3 + 寄生网络)", defaultParams: "lr=0.35u wr=1.5u nr=16" },
    { name: "nmos_rf_mis", desc: "1.8V RF Mismatch NMOS", defaultParams: "lr=0.18u wr=1.5u nr=16" }
  ],
  pmosModels: [
    { name: "pch", desc: "1.8V Core PMOS (L:0.18~20u, W:0.22~900u)", defaultParams: "w=20u l=1u" },
    { name: "pch3", desc: "3.3V I/O PMOS (L:0.30~20u, W:0.22~900u)", defaultParams: "w=20u l=1u" },
    { name: "mepch", desc: "1.8V Medium-Vt PMOS (L:0.25~10u)", defaultParams: "w=20u l=1u" },
    { name: "pmos_rf", desc: "1.8V RF PMOS with DNW Subckt", defaultParams: "lr=0.18u wr=1.5u nr=16" },
    { name: "pmos_rf_nw", desc: "1.8V RF PMOS without DNW Subckt", defaultParams: "lr=0.18u wr=1.5u nr=16" },
    { name: "pmos_rf33", desc: "3.3V RF PMOS with DNW Subckt", defaultParams: "lr=0.35u wr=1.5u nr=16" },
    { name: "pmos_rf_mis", desc: "1.8V RF Mismatch PMOS", defaultParams: "lr=0.18u wr=1.5u nr=16" }
  ],
  equivSubckts: {
    nmos_rf: `subckt nmos_rf ( d g s b )\nrg ( g gi ) resistor r=3.5\nrs ( s si ) resistor r=1.2\nrd ( d di ) resistor r=1.2\ncgs_m ( gi si ) capacitor c=25f\ncgd_m ( gi di ) capacitor c=8f\ncds_m ( si di ) capacitor c=10f\nrb ( b bi ) resistor r=12\ncb ( b bi ) capacitor c=13f\nm0 ( di gi si bi ) nch l=0.18u w=24u\nends nmos_rf`,
    pmos_rf: `subckt pmos_rf ( d g s b )\nrg ( g gi ) resistor r=4.2\nrs ( s si ) resistor r=1.5\nrd ( d di ) resistor r=1.5\ncgs_m ( gi si ) capacitor c=28f\ncgd_m ( gi di ) capacitor c=9f\ncds_m ( si di ) capacitor c=12f\nrb ( b bi ) resistor r=15\ncb ( b bi ) capacitor c=1.4f\nm0 ( di gi si bi ) pch l=0.18u w=24u\nends pmos_rf`,
    spiral_s2_std: `subckt spiral_s2_std ( top bottom gnode )\nc12 ( top bottom ) capacitor c=15f\nr1 ( top n1 ) resistor r=1.8\nl1 ( n1 n3 ) inductor l=1.5n\nl2 ( n3 n2 ) inductor l=1.5n\nr2 ( n2 bottom ) resistor r=1.8\ncox1 ( top sub1 ) capacitor c=30f\ncox2 ( bottom sub2 ) capacitor c=30f\ncsub1 ( sub1 gnode ) capacitor c=20f\nrsub1 ( sub1 gnode ) resistor r=450\ncsub2 ( sub2 gnode ) capacitor c=20f\nrsub2 ( sub2 gnode ) resistor r=450\nends spiral_s2_std`,
    mimcap_shield: `subckt mimcap_shield ( top bottom shield )\nltop ( top n1 ) inductor l=12p\nrtop ( n1 n2 ) resistor r=0.25\ncmim ( n2 n3 ) capacitor c=105f\nrbot ( n3 n4 ) resistor r=0.35\nlbot ( n4 bottom ) inductor l=15p\ncox ( n3 shield ) capacitor c=4.5f\nends mimcap_shield`
  }
};

let savedPdks = JSON.parse((typeof localStorage !== "undefined" ? localStorage.getItem("spectre_eda_pdks") : null) || "null") || [BUILTIN_TSMC_PDK];
let activePdkId = savedPdks[0].id;
let frozenSubcktLib = JSON.parse((typeof localStorage !== "undefined" ? localStorage.getItem("spectre_eda_subckt_lib") : null) || "[]");

function getActivePdk() {
  return savedPdks.find(p => p.id === activePdkId) || savedPdks[0];
}

function parsePdkLibraryText(text, fileName) {
  const nmosSet = new Map();
  const pmosSet = new Map();
  const equivSubckts = {};

  const modelRegex = /model\s+(\S+)\s+bsim\S*\s*\{[\s\S]*?type\s*=\s*([np])/gi;
  let m;
  while ((m = modelRegex.exec(text)) !== null) {
    const mName = m[1];
    const mType = m[2].toLowerCase();
    if (mType === "n" && !nmosSet.has(mName)) {
      nmosSet.set(mName, { name: mName, desc: `工艺库 NMOS 模型 (${fileName})`, defaultParams: "w=10u l=1u" });
    } else if (mType === "p" && !pmosSet.has(mName)) {
      pmosSet.set(mName, { name: mName, desc: `工艺库 PMOS 模型 (${fileName})`, defaultParams: "w=20u l=1u" });
    }
  }

  const subRegex = /(?:inline\s+)?subckt\s+(\S+)\s*\(([^)]*)\)([\s\S]*?)ends\s+\1/gi;
  let sm;
  while ((sm = subRegex.exec(text)) !== null) {
    const sName = sm[1];
    equivSubckts[sName] = sm[0];
    if (/^nmos/i.test(sName) && !nmosSet.has(sName)) {
      nmosSet.set(sName, { name: sName, desc: `RF/子电路 NMOS (${fileName})`, defaultParams: "lr=0.18u wr=1.5u nr=16" });
    } else if (/^pmos/i.test(sName) && !pmosSet.has(sName)) {
      pmosSet.set(sName, { name: sName, desc: `RF/子电路 PMOS (${fileName})`, defaultParams: "lr=0.18u wr=1.5u nr=16" });
    }
  }

  return {
    id: `pdk_${Date.now()}`,
    name: `${fileName} (自定义工艺库)`,
    fileName,
    rawText: text,
    nmosModels: nmosSet.size ? Array.from(nmosSet.values()) : BUILTIN_TSMC_PDK.nmosModels,
    pmosModels: pmosSet.size ? Array.from(pmosSet.values()) : BUILTIN_TSMC_PDK.pmosModels,
    equivSubckts
  };
}
export { BUILTIN_TSMC_PDK, parsePdkLibraryText };
