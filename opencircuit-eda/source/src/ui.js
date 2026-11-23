import {
  GRID, snap, isHighVoltNet, isLowVoltNet, isNegVoltNet,
  BUILTIN_TSMC_PDK, parsePdkLibraryText
} from './pdk-parser.js';
import {
  detectHdlLanguage, parseVerilogToDesign, parseVhdlToDesign,
  parseSpectreNetlist, classifyElement, detectSubcktSymbolShape
} from './netlist.js';
import {
  layoutSubckt, getElementBoxSize, computePinPositions,
  routeSchematic, simplifyPath
} from './router.js';
import {
  EDA_SCHEMA_VERSION, maskApiKey, showToast as showClassicNotification, parseEngineeringValue,
  solveLinearSystem, solveComplexLinearSystem, buildMnaSystem, solveMnaDc,
  simulateDC, simulateTran, simulateAC
} from './simulator.js';


let savedPdks = JSON.parse(localStorage.getItem("spectre_eda_pdks") || "null") || [BUILTIN_TSMC_PDK];
let activePdkId = savedPdks[0].id;
let frozenSubcktLib = JSON.parse(localStorage.getItem("spectre_eda_subckt_lib") || "[]");

function getActivePdk() {
  return savedPdks.find(p => p.id === activePdkId) || savedPdks[0];
}


/* ============================================================================
 * 2. 默认示例网表（含运算放大器符号、逻辑门、电感、多端未连线标签等）
 * ============================================================================ */
const DEFAULT_BANDGAP_NETLIST = `// ============================================================
// Phase I: 带隙 + 100uA 电流源 + RF电感滤波（全器件）
// 工艺: TSMC 0.18um RF   电源: 1.8V
// ============================================================
simulator lang=spectre
include "rf018.scs" section=tt

inline subckt err_n in_p in_n out vdd vss
    M1 (z   in_p tail vss) nch w=40u l=2u
    M2 (z2  in_n tail vss) nch w=40u l=2u
    M3 (z2  z2    vdd vdd) pch w=20u l=4u
    M4 (z   z2    vdd vdd) pch w=20u l=4u
    M0 (tail vbn vss vss)  nch w=20u l=1u
    M5 (out z  vdd vdd) pch w=40u l=2u
    M6 (out vbn vss vss) nch w=40u l=2u
    Cc (z out) capacitor c=1p
ends err_n

inline subckt err_p in_p in_n out vdd vss
    M1 (x   in_p tail vdd) pch w=40u l=2u
    M2 (out in_n tail vdd) pch w=40u l=2u
    M3 (x   x    0 0)      nch w=20u l=4u
    M4 (out x    0 0)      nch w=20u l=4u
    M0 (tail vbp vdd vdd)  pch w=10u l=1u
ends err_p

inline subckt bandgap vref iref vdd vss
    // 带隙核心支路
    MP1 (a    vg vdd vdd) pch w=40u l=2u
    MP2 (b    vg vdd vdd) pch w=40u l=2u
    MP3 (vref vg vdd vdd) pch w=40u l=2u
    R1  (b e2) resistor r=5k
    Q1  (vss vss a)  pnp2 m=1
    Q2  (vss vss e2) pnp2 m=8
    R2  (vref e3) resistor r=48k
    Q3  (vss vss e3) pnp2 m=1

    // 误差放大器（自动识别运放符号，双击进入内部等效电路）
    XA1 (b a vg vdd vss) err_n

    // V-I 支路与电感滤波
    MPA (ia vg3 vdd vdd) pch w=40u l=2u
    R3  (ia vss) resistor r=12.95k
    XA2 (ia vref vg3 vdd vss) err_p
    Lfilt (iref iref_out) inductor l=2.5n
    Mb  (iref ia vss vss) nch w=10u l=1u

    // 偏置源
    Ibn (vdd vbn) isource dc=20u
    Mbn (vbn vbn vss vss) nch w=10u l=1u
    Ibp (vdd vbp) isource dc=20u
    Mbp (vbp vbp vdd vdd) pch w=10u l=1u
ends bandgap

XDUT (vref iref vdd 0) bandgap
Vdd (vdd 0) vsource dc=1.8
Rload (vref 0) resistor r=1e9
`;

const DEFAULT_RF_LNA_NETLIST = `// ============================================================
// RF LNA & 逻辑使能控制（含 spiral_s2_std / nmos_rf / 逻辑门）
// ============================================================
simulator lang=spectre

subckt inv_gate in out vdd vss
    MP (out in vdd vdd) pch w=4u l=0.18u
    MN (out in vss vss) nch w=2u l=0.18u
ends inv_gate

subckt nand2_gate a b out vdd vss
    MP1 (out a vdd vdd) pch w=4u l=0.18u
    MP2 (out b vdd vdd) pch w=4u l=0.18u
    MN1 (out a mid vss) nch w=4u l=0.18u
    MN2 (mid b vss vss) nch w=4u l=0.18u
ends nand2_gate

subckt rf_lna_stage rfin rfout en vdd vss
    // 级联射频低噪声放大器（双击 M1_rf 或 Lload 可查看器件内部等效电路）
    Lin   (rfin gate_n) inductor l=1.8n
    M1_rf (mid_n gate_n src_n vss) nmos_rf lr=0.18u wr=1.5u nr=16
    Ldeg  (src_n vss) inductor l=0.4n
    Lload (vdd rfout 0) spiral_s2_std nr=3 rad=60u w=15u
    Cac   (mid_n rfout) capacitor c=2p

    // 逻辑门控制
    XINV  (en en_b vdd vss) inv_gate
    XNAND (en en_b ctrl_out vdd vss) nand2_gate
ends rf_lna_stage
`;

let workspaceFiles = [
  {
    id: "file_1",
    path: "Analog_IP/Bandgap/bandgap_ref.scs",
    name: "bandgap_ref.scs",
    content: DEFAULT_BANDGAP_NETLIST,
    dirty: false,
    parsedDesign: null,
    activeSubckt: "bandgap",
    hierarchyStack: ["bandgap"],
    layoutsBySubckt: {},
    undoStack: [],
    redoStack: []
  },
  {
    id: "file_2",
    path: "RF_FrontEnd/LNA/rf_lna_stage.scs",
    name: "rf_lna_stage.scs",
    content: DEFAULT_RF_LNA_NETLIST,
    dirty: false,
    parsedDesign: null,
    activeSubckt: "rf_lna_stage",
    hierarchyStack: ["rf_lna_stage"],
    layoutsBySubckt: {},
    undoStack: [],
    redoStack: []
  }
];

const DEFAULT_VERILOG_SAMPLE = `// ============================================================
// Verilog HDL 图形化示例：4位算术逻辑与同步寄存器单元
// ============================================================
module alu_reg_unit (
    input  wire clk,
    input  wire rst,
    input  wire sel,
    input  wire a,
    input  wire b,
    output wire y_comb,
    output reg  q_out
);
    wire n_and, n_xor, n_mux;

    and  U_AND (n_and, a, b);
    xor  U_XOR (n_xor, a, b);
    not  U_INV (y_comb, n_and);

    assign n_mux = sel ? n_xor : n_and;

    always @(posedge clk or posedge rst) begin
        if (rst)
            q_out <= 1'b0;
        else
            q_out <= n_mux;
    end
endmodule
`;

const DEFAULT_VHDL_SAMPLE = `-- ============================================================
-- VHDL 图形化示例：组合逻辑门控与 D 触发器同步器
-- ============================================================
entity sync_logic_ctrl is
    port (
        clk   : in  std_logic;
        en    : in  std_logic;
        d_in  : in  std_logic;
        sel   : in  std_logic;
        q_reg : out std_logic;
        y_out : out std_logic
    );
end entity sync_logic_ctrl;

architecture rtl of sync_logic_ctrl is
    signal s_nand, s_or, s_mux : std_logic;
begin
    s_nand <= d_in nand en;
    s_or   <= d_in or en;
    y_out  <= not s_nand;
    s_mux  <= s_or when sel = '1' else s_nand;

    process(clk)
    begin
        if rising_edge(clk) then
            q_reg <= s_mux;
        end if;
    end process;
end architecture rtl;
`;

workspaceFiles.push(
  {
    id: "file_3",
    path: "Digital_HDL/alu_reg_unit.v",
    name: "alu_reg_unit.v",
    content: DEFAULT_VERILOG_SAMPLE,
    dirty: false,
    parsedDesign: null,
    activeSubckt: "alu_reg_unit",
    hierarchyStack: ["alu_reg_unit"],
    layoutsBySubckt: {},
    undoStack: [],
    redoStack: []
  },
  {
    id: "file_4",
    path: "Digital_HDL/sync_logic_ctrl.vhd",
    name: "sync_logic_ctrl.vhd",
    content: DEFAULT_VHDL_SAMPLE,
    dirty: false,
    parsedDesign: null,
    activeSubckt: "sync_logic_ctrl",
    hierarchyStack: ["sync_logic_ctrl"],
    layoutsBySubckt: {},
    undoStack: [],
    redoStack: []
  }
);

let expandedFolders = new Set(["Analog_IP", "Analog_IP/Bandgap", "RF_FrontEnd", "RF_FrontEnd/LNA", "Digital_HDL"]);
let openTabIds = ["file_1", "file_2", "file_3", "file_4"];
let activeFileId = "file_1";

let viewVisibility = {
  powerLabels: true,
  portLabels: true,
  instNames: true,
  instParams: true,
  dcOp: false,
  floatingIsland: true
};

// 悬浮移动岛按钮配置
const ISLAND_CATALOG = [
  { id: "gen", label: "▶ 生成", action: () => parseAndRender() },
  { id: "move", label: "✋ 挪动", action: () => setEditMode("move"), mode: "move" },
  { id: "wire", label: "🔌 连线", action: () => setEditMode("wire"), mode: "wire" },
  { id: "undo", label: "↩ 撤销", action: () => undoEdit() },
  { id: "redo", label: "↪ 重做", action: () => redoEdit() },
  { id: "check", label: "✔ 检查连线", action: () => runConnectivityCheck() },
  { id: "fit", label: "⟲ 适应", action: () => resetZoom() },
  { id: "clear", label: "✖ 清高亮", action: () => clearAllHighlights() }
];
let enabledIslandBtns = ["gen", "move", "wire", "undo", "check", "fit"];

// 快捷键配置
const DEFAULT_SHORTCUTS = {
  undo: { label: "撤销 (Undo)", keys: "Ctrl+Z" },
  redo: { label: "重做 (Redo)", keys: "Ctrl+Y" },
  save: { label: "保存文件 (Save)", keys: "Ctrl+S" },
  saveAs: { label: "另存为 (Save As)", keys: "Ctrl+Shift+S" },
  openFile: { label: "打开文件", keys: "Ctrl+O" },
  openFolder: { label: "打开文件夹", keys: "Ctrl+Shift+O" },
  fitView: { label: "适应画布 (Fit View)", keys: "F" },
  modeMove: { label: "挪动调整 (Move)", keys: "M" },
  modeWire: { label: "连接引脚 (Wire)", keys: "W" },
  clearHighlight: { label: "清除高亮", keys: "Escape" },
  delete: { label: "删除选中元件", keys: "Delete" },
  selectAll: { label: "全选元件", keys: "Ctrl+A" },
  generate: { label: "运行生成", keys: "F5" },
  checkConn: { label: "检查连接线", keys: "F7" },
  editParams: { label: "配置元件参数", keys: "Q" },
  rotate: { label: "顺时针旋转 90°", keys: "R" },
  rotateCCW: { label: "逆时针旋转 90°", keys: "Shift+Alt+R" },
  flipX: { label: "水平对称 (左右镜像)", keys: "X" },
  flipY: { label: "垂直对称 (上下镜像)", keys: "Y" },
  placeResistor: { label: "放置电阻 (R)", keys: "Shift+R" },
  placeCapacitor: { label: "放置电容 (C)", keys: "Shift+C" },
  placeInductor: { label: "放置电感 (L)", keys: "Shift+L" },
  placeNmos: { label: "放置 NMOS", keys: "Shift+N" },
  placePmos: { label: "放置 PMOS", keys: "Shift+P" },
  placeVsource: { label: "放置电压源", keys: "Shift+V" },
  placeIsource: { label: "放置电流源", keys: "Shift+I" },
  placeTermVdd: { label: "放置红空圆 (VDD)", keys: "Shift+D" },
  placeTermGnd: { label: "放置实心黑圆 (GND)", keys: "Shift+G" },
  placeTermNeg: { label: "放置空黑圆 (VEE)", keys: "Shift+O" }
};
let _loadedSc = JSON.parse(localStorage.getItem("spectre_eda_shortcuts") || "null") || {};
let shortcuts = Object.assign(JSON.parse(JSON.stringify(DEFAULT_SHORTCUTS)), _loadedSc);

function getActiveFile() { return workspaceFiles.find(f => f.id === activeFileId) || workspaceFiles[0]; }
function getCurrentLayout() { const f = getActiveFile(); return f ? f.layoutsBySubckt[f.activeSubckt] : null; }

/* ============================================================================
 * 3. 区域顺序变换、收起/展开、拖拽拉伸
 * ============================================================================ */
let paneOrder = ["files", "code", "canvas"];

function applyPaneOrder() {
  const main = document.getElementById("workspace-main");
  const paneEls = {
    files: document.getElementById("pane-files"),
    code: document.getElementById("pane-code"),
    canvas: document.getElementById("pane-canvas")
  };
  const resizers = Array.from(main.querySelectorAll(".resizer"));
  main.innerHTML = "";
  paneOrder.forEach((key, idx) => {
    main.appendChild(paneEls[key]);
    if (idx < paneOrder.length - 1) {
      const rz = resizers[idx] || document.createElement("div");
      rz.className = "resizer";
      rz.dataset.left = `pane-${key}`;
      rz.dataset.right = `pane-${paneOrder[idx + 1]}`;
      main.appendChild(rz);
    }
  });
}

function setPaneOrder(newOrder) {
  paneOrder = newOrder;
  applyPaneOrder();
  closeAllMenus();
}

function movePane(key, dir) {
  const idx = paneOrder.indexOf(key);
  const targetIdx = idx + dir;
  if (idx === -1 || targetIdx < 0 || targetIdx >= paneOrder.length) return;
  const copy = [...paneOrder];
  [copy[idx], copy[targetIdx]] = [copy[targetIdx], copy[idx]];
  setPaneOrder(copy);
}

function togglePaneCollapse(paneId) {
  const el = document.getElementById(paneId);
  if (el) el.classList.toggle("collapsed");
}

let activeResizer = null;
document.addEventListener("mousedown", (e) => {
  if (e.target.classList.contains("resizer")) {
    const leftPane = document.getElementById(e.target.dataset.left);
    const rightPane = document.getElementById(e.target.dataset.right);
    if (!leftPane || !rightPane) return;
    activeResizer = {
      el: e.target,
      leftPane,
      rightPane,
      startX: e.clientX,
      leftStartW: leftPane.getBoundingClientRect().width,
      rightStartW: rightPane.getBoundingClientRect().width
    };
    e.target.classList.add("dragging");
  }
});

window.addEventListener("mousemove", (e) => {
  if (!activeResizer) return;
  const dx = e.clientX - activeResizer.startX;
  const { leftPane, rightPane, leftStartW, rightStartW } = activeResizer;
  if (leftPane.id !== "pane-canvas" && !leftPane.classList.contains("collapsed")) {
    leftPane.style.width = `${Math.max(150, Math.min(720, leftStartW + dx))}px`;
  } else if (rightPane.id !== "pane-canvas" && !rightPane.classList.contains("collapsed")) {
    rightPane.style.width = `${Math.max(150, Math.min(720, rightStartW - dx))}px`;
  }
});

window.addEventListener("mouseup", () => {
  if (activeResizer) {
    activeResizer.el.classList.remove("dragging");
    activeResizer = null;
  }
});

/* ============================================================================
 * 4. 菜单栏、工艺库管理、放置元件与子电路导出配置
 * ============================================================================ */
function initMenus() {
  let menuCloseTimer = null;
  const openMenuRoot = (root) => {
    if (menuCloseTimer) { clearTimeout(menuCloseTimer); menuCloseTimer = null; }
    closeAllMenus();
    if (root.dataset.menu === "view") rebuildHierarchySubmenu();
    if (root.dataset.menu === "place") rebuildPlaceMenus();
    if (root.querySelector(".menu-dropdown")) root.classList.add("open");
  };
  document.querySelectorAll(".menu-root").forEach(root => {
    root.addEventListener("mouseenter", () => {
      openMenuRoot(root);
    });
    root.addEventListener("mouseleave", () => {
      menuCloseTimer = setTimeout(() => closeAllMenus(), 180);
    });
  });
  document.querySelectorAll(".menu-root > .menu-root-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const root = btn.parentElement;
      openMenuRoot(root);
    });
  });
  window.addEventListener("click", () => { closeAllMenus(); closeLayerQuickMenu(); });
  updateShortcutHints();
  updateVisibilityChecks();
  renderFloatingIsland();
  updatePdkBadge();
}

function closeAllMenus() { document.querySelectorAll(".menu-root").forEach(r => r.classList.remove("open")); }

function toggleLayer(key, ev) {
  if (ev) ev.stopPropagation();
  viewVisibility[key] = !viewVisibility[key];
  updateVisibilityChecks();
  rerenderOnly();
}

function updateVisibilityChecks() {
  ["powerLabels", "portLabels", "instNames", "instParams", "dcOp", "floatingIsland"].forEach(k => {
    const el = document.getElementById(`chk-${k}`);
    if (el) el.textContent = viewVisibility[k] ? "✓" : " ";
  });
  document.getElementById("floating-island").style.display = viewVisibility.floatingIsland ? "flex" : "none";
}

function rebuildHierarchySubmenu() {
  const subMenu = document.getElementById("menu-hierarchy-sub");
  subMenu.innerHTML = "";
  const f = getActiveFile();
  if (!f || !f.parsedDesign) return;
  Object.keys(f.parsedDesign.subckts).forEach(k => {
    const sub = f.parsedDesign.subckts[k];
    if (sub.elements.length === 0) return;
    const item = document.createElement("div");
    item.className = "menu-item";
    const isCur = f.activeSubckt === k;
    const label = k === "__TOP__" ? sub.name : `${k} (${sub.elements.length} 器件)`;
    item.innerHTML = `<span><i class="check-col">${isCur ? "✓" : " "}</i>${escapeHtml(label)}</span>`;
    item.onclick = () => { switchSubckt(k, true); closeAllMenus(); };
    subMenu.appendChild(item);
  });
}

function rebuildPlaceMenus() {
  const pdk = getActivePdk();
  const nmosSub = document.getElementById("place-nmos-sub");
  const pmosSub = document.getElementById("place-pmos-sub");
  const subcktSub = document.getElementById("place-subckt-sub");
  nmosSub.innerHTML = "";
  pmosSub.innerHTML = "";
  subcktSub.innerHTML = "";

  pdk.nmosModels.forEach(m => {
    const div = document.createElement("div");
    div.className = "menu-item";
    div.innerHTML = `<span>${escapeHtml(m.name)}</span><span class="shortcut-hint">${escapeHtml(m.defaultParams)}</span>`;
    div.onclick = () => { closeAllMenus(); openPlaceDialog("nmos", m.name, m.defaultParams); };
    nmosSub.appendChild(div);
  });

  pdk.pmosModels.forEach(m => {
    const div = document.createElement("div");
    div.className = "menu-item";
    div.innerHTML = `<span>${escapeHtml(m.name)}</span><span class="shortcut-hint">${escapeHtml(m.defaultParams)}</span>`;
    div.onclick = () => { closeAllMenus(); openPlaceDialog("pmos", m.name, m.defaultParams); };
    pmosSub.appendChild(div);
  });

  const f = getActiveFile();
  const availSubckts = [];
  if (f && f.parsedDesign) {
    Object.values(f.parsedDesign.subckts).forEach(s => {
      if (s.name && !s.name.startsWith("顶层")) availSubckts.push({ name: s.name, ports: s.ports, source: "当前网表" });
    });
  }
  frozenSubcktLib.forEach(s => {
    if (!availSubckts.some(a => a.name === s.name)) availSubckts.push({ name: s.name, ports: s.ports, source: "已固化库" });
  });
  Object.keys(pdk.equivSubckts || {}).forEach(k => {
    if (!availSubckts.some(a => a.name === k)) {
      const m = pdk.equivSubckts[k].match(/subckt\s+\S+\s*\(([^)]*)\)/i);
      const ports = m ? m[1].trim().split(/\s+/).filter(Boolean) : ["p1", "p2"];
      availSubckts.push({ name: k, ports, source: "PDK模型" });
    }
  });

  if (availSubckts.length === 0) {
    subcktSub.innerHTML = `<div class="menu-item" style="color:#94a3b8;">暂无可用子电路</div>`;
  } else {
    availSubckts.forEach(s => {
      const div = document.createElement("div");
      div.className = "menu-item";
      div.innerHTML = `<span>${escapeHtml(s.name)}</span><span class="shortcut-hint">[${escapeHtml(s.source)}]</span>`;
      div.onclick = () => {
        closeAllMenus();
        openPlaceDialog("subckt_inst", s.name, "", s.ports.join(" "));
      };
      subcktSub.appendChild(div);
    });
  }
}

/* 工艺库管理与固化 */
function updatePdkBadge() {
  const pdk = getActivePdk();
  document.getElementById("current-pdk-badge").textContent = `符号库 · ${pdk.name}`;
}

function openPdkModal() {
  const sel = document.getElementById("saved-pdk-select");
  sel.innerHTML = "";
  savedPdks.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });
  sel.value = activePdkId;
  renderPdkSummary();
  document.getElementById("pdk-modal").style.display = "flex";
}

function selectSavedPdk(id) {
  activePdkId = id;
  updatePdkBadge();
  renderPdkSummary();
}

function renderPdkSummary() {
  const pdk = getActivePdk();
  document.getElementById("pdk-summary-box").innerHTML = `
    <b>绘图符号库：</b>${escapeHtml(pdk.name)}<br>
    <b>NMOS 名称映射 (${pdk.nmosModels.length})：</b>${pdk.nmosModels.map(m => escapeHtml(m.name)).join(", ")}<br>
    <b>PMOS 名称映射 (${pdk.pmosModels.length})：</b>${pdk.pmosModels.map(m => escapeHtml(m.name)).join(", ")}<br>
    <b>内置等效电路子电路：</b>${Object.keys(pdk.equivSubckts || {}).map(escapeHtml).join(", ") || "无"}
  `;
}

document.getElementById("pdk-file-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const content=String(ev.target.result);
    const folder=getActiveFile()?.path.split('/').slice(0,-1).join('/');
    const path=folder ? folder+'/'+file.name : file.name;
    const existing=workspaceFiles.find(f=>f.path===path);
    if (existing && existing.content !== content) {
      showToast("同路径已有不同文件，请在工作台中导入并选择保存位置", "warn");
      return;
    }
    if (!existing) workspaceFiles.push(classicSourceFile(path,content));
    renderFileTree();
    const newPdk = parsePdkLibraryText(content, file.name);
    savedPdks.push(newPdk);
    activePdkId = newPdk.id;
    localStorage.setItem("spectre_eda_pdks", JSON.stringify(savedPdks));
    updatePdkBadge();
    openPdkModal();
    document.getElementById("mode-tip").textContent = `已保存模型原文 ${path} 并加载其绘图名称；仿真时从入口使用 include 或 lib 引用`;
  };
  reader.readAsText(file);
  e.target.value = "";
});

function freezePdkToLocal() {
  const pdk = getActivePdk();
  localStorage.setItem("spectre_eda_pdks", JSON.stringify(savedPdks));
  const frozenObj = {
    folder: "pdk_libs",
    fileName: pdk.fileName || `${pdk.id}.scs`,
    pdkData: pdk
  };
  const targetFileName = `pdk_libs_${pdk.fileName || "custom_pdk.scs"}.json`;
  downloadBlob(new Blob([JSON.stringify(frozenObj, null, 2)], { type: "application/json;charset=utf-8" }), targetFileName);
  document.getElementById("mode-tip").textContent = `已将工艺库「${pdk.name}」固化至本地，请保存至 HTML 同目录 pdk_libs 文件夹`;
}

let subcktModalMode = "export";

function freezeCurrentSubcktToLib() {
  const f = getActiveFile();
  if (!f || !f.parsedDesign) return;
  const sub = f.parsedDesign.subckts[f.activeSubckt];
  const hasConfiguredPins = sub && f.activeSubckt !== "__TOP__" && sub.ports && sub.ports.length > 0 && sub.portDirs && Object.keys(sub.portDirs).length > 0;
  if (!hasConfiguredPins) {
    openCreateSubcktModal("freeze");
    document.getElementById("mode-tip").textContent = "当前子电路尚未配置引脚，请先按导出子电路流程配置引脚后再固化";
    return;
  }
  const codeBlock = extractSubcktCode(f.content, f.activeSubckt) || generateSubcktCodeFromLayout(f.activeSubckt, sub.ports, getCurrentLayout());
  frozenSubcktLib = frozenSubcktLib.filter(item => item.name !== f.activeSubckt);
  frozenSubcktLib.push({ name: f.activeSubckt, ports: sub.ports, portDirs: sub.portDirs, code: codeBlock, layoutSnapshot: JSON.parse(JSON.stringify(getCurrentLayout())) });
  try { localStorage.setItem("spectre_eda_subckt_lib", JSON.stringify(frozenSubcktLib)); } catch (e) {}
  downloadBlob(new Blob([codeBlock], { type: "text/plain;charset=utf-8" }), `${f.activeSubckt}_frozen.scs`);
  document.getElementById("mode-tip").textContent = `子电路 ${f.activeSubckt} 已固化到库并下载备份`;
}

function extractSubcktCode(text, subName) {
  const reg = new RegExp(`(?:inline\\s+)?subckt\\s+${subName}\\b[\\s\\S]*?ends\\s+${subName}\\b`, "i");
  const m = text.match(reg);
  return m ? m[0] : null;
}

/* 交互式跟随鼠标连续放置元件（免参数询问，左键确认并继续，右键/Esc 退出） */
let pendingPlaceConfig = null;
let placingTool = null;
let _placeAutoSeq = 1;

function getDefaultPlaceSpec(type, modelName, defaultParams = "", defaultNodes = "") {
  const seq = _placeAutoSeq++;
  let prefix = "X", nodes = defaultNodes, params = defaultParams;

  if (type === "nmos") { prefix = "MN"; nodes = defaultNodes || `d_${seq} g_${seq} s_${seq} b_${seq}`; params = defaultParams || "w=10u l=1u"; }
  else if (type === "pmos") { prefix = "MP"; nodes = defaultNodes || `d_${seq} g_${seq} s_${seq} b_${seq}`; params = defaultParams || "w=20u l=1u"; }
  else if (type === "resistor") { prefix = "R"; nodes = defaultNodes || `p_${seq} n_${seq}`; params = defaultParams || "r=10k"; }
  else if (type === "inductor") { prefix = "L"; nodes = defaultNodes || `p_${seq} n_${seq}`; params = defaultParams || "l=2n"; }
  else if (type === "capacitor") { prefix = "C"; nodes = defaultNodes || `p_${seq} n_${seq}`; params = defaultParams || "c=1p"; }
  else if (type === "tline") { prefix = "T"; nodes = defaultNodes || `in_${seq} g1_${seq} out_${seq} g2_${seq}`; params = defaultParams || "z0=50 td=1n"; }
  else if (type === "npn") { prefix = "Q"; nodes = defaultNodes || `c_${seq} b_${seq} e_${seq}`; params = defaultParams || "bf=200"; }
  else if (type === "pnp") { prefix = "Q"; nodes = defaultNodes || `c_${seq} b_${seq} e_${seq}`; params = defaultParams || "bf=120"; }
  else if (type === "vsource") { prefix = "V"; nodes = `vp_${seq} vn_${seq}`; params = defaultParams || "dc=1.8"; }
  else if (type === "isource") { prefix = "I"; nodes = `ip_${seq} in_${seq}`; params = defaultParams || "dc=20u"; }
  else if (type === "vsin") { prefix = "VS"; nodes = `vp_${seq} vn_${seq}`; params = defaultParams || "dc=0 ampl=1 freq=1M"; }
  else if (type === "vpulse") { prefix = "VP"; nodes = `vp_${seq} vn_${seq}`; params = defaultParams || "val0=0 val1=1.8 period=10n"; }
  else if (type === "vsweep") { prefix = "VSW"; nodes = `vp_${seq} vn_${seq}`; params = defaultParams || "fstart=1k fstop=1G ampl=1"; }
  else if (type === "vcvs") { prefix = "E"; nodes = defaultNodes || `op_${seq} on_${seq} ip_${seq} in_${seq}`; params = defaultParams || "gain=10"; }
  else if (type === "vccs") { prefix = "G"; nodes = defaultNodes || `op_${seq} on_${seq} ip_${seq} in_${seq}`; params = defaultParams || "gm=1m"; }
  else if (type === "cccs") { prefix = "F"; nodes = defaultNodes || `op_${seq} on_${seq} ip_${seq} in_${seq}`; params = defaultParams || "gain=1"; }
  else if (type === "ccvs") { prefix = "H"; nodes = defaultNodes || `op_${seq} on_${seq} ip_${seq} in_${seq}`; params = defaultParams || "rm=1k"; }
  else if (type === "term_vdd") { prefix = "VDD"; nodes = "vdd"; params = ""; }
  else if (type === "term_gnd") { prefix = "GND"; nodes = "0"; params = ""; }
  else if (type === "term_neg") { prefix = "VEE"; nodes = "vee"; params = ""; }
  else if (["gate_and", "gate_nand", "gate_or", "gate_nor", "gate_xor", "gate_xnor"].includes(type)) { prefix = type.replace("gate_", "").toUpperCase(); nodes = defaultNodes || `a_${seq} b_${seq} y_${seq}`; params = ""; }
  else if (type === "gate_inv" || type === "gate_buf") { prefix = type === "gate_inv" ? "INV" : "BUF"; nodes = defaultNodes || `a_${seq} y_${seq}`; params = ""; }
  else if (type === "mux2") { prefix = "MUX"; nodes = defaultNodes || `d0_${seq} d1_${seq} sel_${seq} y_${seq}`; params = ""; }
  else if (type === "dff") { prefix = "DFF"; nodes = defaultNodes || `d_${seq} clk_${seq} q_${seq}`; params = ""; }
  else if (type === "subckt_inst") { prefix = "X"; nodes = defaultNodes || `in_${seq} out_${seq} p3_${seq} p4_${seq}`; params = defaultParams || ""; }

  return { prefix, nodes, params };
}

function generateUniqueInstName(prefix, layout) {
  const used = new Set((layout?.elements || []).map(e => e.name));
  let idx = 1;
  while (used.has(`${prefix}${idx}`)) idx++;
  return `${prefix}${idx}`;
}

function openPlaceDialog(type, modelName, defaultParams = "", defaultNodes = "") {
  startInteractivePlace(type, modelName, defaultParams, defaultNodes);
}

function startInteractivePlace(type, modelName, defaultParams = "", defaultNodes = "") {
  placingTool = {
    type,
    modelName,
    defaultParams,
    defaultNodes,
    rotation: 0,
    flipX: false,
    flipY: false,
    mouseX: null,
    mouseY: null
  };
  document.getElementById("canvas-body").style.cursor = "crosshair";
  document.getElementById("mode-tip").textContent =
    `放置模式 [${modelName}]：移动鼠标定位，左键点击连续放置 | R 旋转 / X 水平对称 / Y 垂直对称 | 右键或 Esc 退出`;
  renderPlaceGhost();
}

function cancelInteractivePlace() {
  if (!placingTool) return;
  placingTool = null;
  document.getElementById("canvas-body").style.cursor = "";
  const gl = document.getElementById("place-ghost-layer");
  if (gl) gl.remove();
  document.getElementById("mode-tip").textContent =
    "挪动模式：Ctrl+点击多选，左键框选批量移动，双击子电路/SPICE器件查看内部等效电路";
}

function renderPlaceGhost() {
  const vp = document.getElementById("viewport");
  if (!vp) return;
  let gl = document.getElementById("place-ghost-layer");
  if (gl) gl.remove();
  if (!placingTool || placingTool.mouseX === null || placingTool.mouseY === null) return;

  const f = getActiveFile();
  const spec = getDefaultPlaceSpec(placingTool.type, placingTool.modelName, placingTool.defaultParams, placingTool.defaultNodes);
  _placeAutoSeq--;
  const nodes = spec.nodes.trim().split(/\s+/).filter(Boolean);
  const params = {};
  const pmReg = /(\S+?)=([^\s]+)/g;
  let pm;
  while ((pm = pmReg.exec(spec.params)) !== null) params[pm[1]] = pm[2];

  const ghostEl = classifyElement(`${spec.prefix}?`, nodes, placingTool.modelName, params, 0, f?.parsedDesign?.subckts || {});
  if (ghostEl.type === "subckt_inst") {
    ghostEl.symbolShape = detectSubcktSymbolShape(ghostEl.model, f?.parsedDesign?.subckts?.[ghostEl.model]);
  }
  ghostEl.x = placingTool.mouseX;
  ghostEl.y = placingTool.mouseY;
  ghostEl.rotation = placingTool.rotation;
  ghostEl.flipX = placingTool.flipX;
  ghostEl.flipY = placingTool.flipY;
  const box = getElementBoxSize(ghostEl);
  ghostEl.w = box.w;
  ghostEl.h = box.h;
  computePinPositions(ghostEl);

  const svgNS = "http://www.w3.org/2000/svg";
  const createEl = (tag, attrs = {}, text = null) => {
    const el = document.createElementNS(svgNS, tag);
    for (let [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (text !== null) el.textContent = text;
    return el;
  };
  gl = createEl("g", { id: "place-ghost-layer", opacity: "0.65", style: "pointer-events:none;" });
  gl.appendChild(createEl("rect", {
    x: ghostEl.x - ghostEl.w / 2 - 8, y: ghostEl.y - ghostEl.h / 2 - 8,
    width: ghostEl.w + 16, height: ghostEl.h + 16, rx: 6,
    fill: "rgba(56, 189, 248, 0.12)", stroke: "#0284c7", "stroke-width": 1.5, "stroke-dasharray": "4,3"
  }));
  drawDeviceSymbol(gl, ghostEl, createEl, false);
  vp.appendChild(gl);
}

function placeElementAtCursor(x, y) {
  const f = getActiveFile();
  const layout = getCurrentLayout();
  if (!f || !layout || !placingTool) return;

  const spec = getDefaultPlaceSpec(placingTool.type, placingTool.modelName, placingTool.defaultParams, placingTool.defaultNodes);
  const instName = generateUniqueInstName(spec.prefix, layout);
  const nodes = spec.nodes.trim().split(/\s+/).filter(Boolean);
  const paramStr = spec.params.trim();

  const params = {};
  const paramRegex = /(\S+?)=([^\s]+)/g;
  let pm;
  while ((pm = paramRegex.exec(paramStr)) !== null) params[pm[1]] = pm[2];

  pushUndoSnapshot();
  const newEl = classifyElement(instName, nodes, placingTool.modelName, params, 0, f.parsedDesign ? f.parsedDesign.subckts : {});
  if (newEl.type === "subckt_inst") {
    newEl.symbolShape = detectSubcktSymbolShape(newEl.model, f.parsedDesign ? f.parsedDesign.subckts[newEl.model] : null);
  }
  newEl.x = snap(x);
  newEl.y = snap(y);
  newEl.rotation = placingTool.rotation || 0;
  newEl.flipX = !!placingTool.flipX;
  newEl.flipY = !!placingTool.flipY;
  const box = getElementBoxSize(newEl);
  newEl.w = box.w;
  newEl.h = box.h;
  computePinPositions(newEl);
  layout.elements.push(newEl);

  if (!["term_vdd", "term_gnd", "term_neg"].includes(newEl.type)) {
    const spiceLine = classicElementLine(newEl, f);
    insertDeviceLineToNetlist(f, spiceLine);
  }
  rerenderOnly();
  document.getElementById("mode-tip").textContent =
    `已放置 ${instName} (${placingTool.modelName}) · 可继续左键连续放置，右键或 Esc 退出`;
}

function confirmPlaceDevice() {
  if (placingTool) placeElementAtCursor(placingTool.mouseX ?? 260, placingTool.mouseY ?? 220);
}

function isSpiceFile(f) {
  return !/\.scs$/i.test(f.name) && !/^\s*simulator\s+lang=spectre/im.test(f.content);
}
function classicElementLine(el, f) {
  const nets=el.pins.map(p=>p.net).join(' ');
  const params=el.params || {};
  const pairs=Object.entries(params).map(([k,v])=>`${k}=${v}`).join(' ');
  if (!isSpiceFile(f)) return `${el.name} (${nets}) ${el.model} ${pairs}`.trimEnd();
  const key={resistor:'r',inductor:'l',capacitor:'c',vsource:'dc',isource:'dc'}[el.type];
  if (key) {
    const tail=Object.entries(params).filter(([k])=>k!==key).map(([k,v])=>`${k}=${v}`).join(' ');
    return `${el.name} ${nets} ${params[key] || '0'} ${tail}`.trimEnd();
  }
  return `${el.name} ${nets} ${el.model} ${pairs}`.trimEnd();
}
function applyClassicSource(f, text) {
  f.content=text;
  f.dirty=true;
  f.parsedDesign=parseSpectreNetlist(text,f.name);
  for (const [name,layout] of Object.entries(f.layoutsBySubckt)) {
    const defs=f.parsedDesign.subckts[name]?.elements || [];
    const linesByName=new Map(defs.map(el=>[el.name,el.line]));
    for (const el of layout.elements) el.line=linesByName.get(el.name) || 0;
  }
  realDeviceLineMap=f.parsedDesign.lineMap;
  document.getElementById('netlist-input').value=text;
  renderFileTabs();
  refreshEditorGutter();
}
function insertDeviceLineToNetlist(f,lineText) {
  const lines=f.content.split('\n');
  let pos;
  if (f.activeSubckt && f.activeSubckt!=='__TOP__') {
    const first=f.parsedDesign.subckts[f.activeSubckt]?.line;
    pos=lines.findIndex((s,i)=>i>=first && /^\s*\.?ends\b/i.test(s));
  } else pos=lines.findIndex(s=>/^\s*\.end\b/i.test(s));
  lines.splice(pos<0?lines.length:pos,0,lineText);
  applyClassicSource(f,lines.join('\n'));
}

/* 导出创建子电路：Input / Output / InOut 端口配置 + 画布点击选择 + 固化到本地 */
let subcktExportPorts = [];
let pickingPortFromCanvas = false;

function openCreateSubcktModal(mode = "export") {
  const f = getActiveFile();
  const layout = getCurrentLayout();
  if (!f || !layout) return;

  subcktModalMode = mode;
  const titleEl = document.querySelector("#subckt-export-modal .modal-header span");
  const confirmBtn = document.querySelector("#subckt-export-modal .modal-footer .q-btn.primary");
  const freezeChk = document.getElementById("chk-freeze-subckt-local");
  if (mode === "freeze") {
    if (titleEl) titleEl.textContent = "📌 固化当前子电路到库 · 请先配置引脚";
    if (confirmBtn) confirmBtn.textContent = "保存引脚配置并固化到库";
    if (freezeChk) freezeChk.checked = true;
    document.getElementById("export-subckt-name").value = f.activeSubckt === "__TOP__" ? "top_subckt" : f.activeSubckt;
  } else {
    if (titleEl) titleEl.textContent = "📦 创建并导出子电路 (Subckt)";
    if (confirmBtn) confirmBtn.textContent = "生成并导出子电路";
    document.getElementById("export-subckt-name").value = f.activeSubckt === "__TOP__" ? "top_subckt" : `${f.activeSubckt}_block`;
  }
  const nets = new Set();
  layout.elements.forEach(el => el.pins.forEach(p => { if (p.net) nets.add(p.net); }));

  const sel = document.getElementById("add-port-net-select");
  sel.innerHTML = "";
  nets.forEach(n => {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n;
    sel.appendChild(opt);
  });

  subcktExportPorts = [];
  const sub = f.parsedDesign && f.parsedDesign.subckts[f.activeSubckt];
  if (sub && sub.ports && sub.ports.length > 0) {
    sub.ports.forEach(p => {
      const dir = /out|ref|q/i.test(p) ? "output" : (/vdd|vss|0|gnd/i.test(p) ? "inout" : "input");
      subcktExportPorts.push({ name: p, dir });
    });
  } else {
    nets.forEach(n => {
      const dir = /out|ref/i.test(n) ? "output" : (/vdd|vss|0|gnd/i.test(n) ? "inout" : "input");
      subcktExportPorts.push({ name: n, dir });
    });
  }

  renderSubcktPortsList();
  document.getElementById("subckt-export-modal").style.display = "flex";
}

function renderSubcktPortsList() {
  const box = document.getElementById("subckt-ports-list");
  box.innerHTML = "";
  if (subcktExportPorts.length === 0) {
    box.innerHTML = `<div style="color:#94a3b8;font-size:12px;">尚未添加外部端口，请从上方下拉框或点击画布标签添加。</div>`;
    return;
  }
  subcktExportPorts.forEach((p, idx) => {
    const row = document.createElement("div");
    row.className = "port-config-row";
    row.innerHTML = `
      <span style="font-family:Consolas,monospace;font-weight:bold;color:#38bdf8;">${escapeHtml(p.name)}</span>
      <div style="display:flex;align-items:center;gap:6px;">
        <select data-port-dir="" style="background:#14151b;border:1px solid #475569;color:#fff;padding:3px 6px;border-radius:4px;font-size:12px;">
          <option value="input" ${p.dir === "input" ? "selected" : ""}>输入 (Input)</option>
          <option value="output" ${p.dir === "output" ? "selected" : ""}>输出 (Output)</option>
          <option value="inout" ${p.dir === "inout" ? "selected" : ""}>输入输出 (InOut)</option>
        </select>
        <button class="q-btn" style="padding:2px 6px;" data-port-remove="">✕</button>
      </div>
    `;
    row.querySelector("[data-port-dir]").onchange=e=>{p.dir=e.target.value;};
    row.querySelector("[data-port-remove]").onclick=()=>{subcktExportPorts.splice(idx,1);renderSubcktPortsList();};
    box.appendChild(row);
  });
}

function addPortFromSelect() {
  const val = document.getElementById("add-port-net-select").value;
  if (!val || subcktExportPorts.some(p => p.name === val)) return;
  subcktExportPorts.push({ name: val, dir: /out|ref/i.test(val) ? "output" : "input" });
  renderSubcktPortsList();
}

function pickPortFromCanvas() {
  closeModal("subckt-export-modal");
  pickingPortFromCanvas = true;
  document.getElementById("mode-tip").textContent = "🎯 端口拾取模式：请直接点击原理图上的端口标签或器件引脚将其加入子电路端口";
}

function generateSubcktCodeFromLayout(subName, portNames, layout) {
  const lines = [`// Subcircuit generated by Spectre EDA`, `inline subckt ${subName} ${portNames.join(" ")}`];
  if (layout && layout.elements) {
    layout.elements.forEach(el => {
      const nodesStr = el.pins.map(p => p.net).join(" ");
      const paramsStr = Object.entries(el.params).map(([k, v]) => `${k}=${v}`).join(" ");
      lines.push(`    ${el.name} (${nodesStr}) ${el.model} ${paramsStr}`.trim());
    });
  }
  lines.push(`ends ${subName}`);
  return lines.join("\n");
}

function confirmCreateSubckt() {
  const subName = document.getElementById("export-subckt-name").value.trim() || "custom_subckt";
  const freezeLocal = document.getElementById("chk-freeze-subckt-local").checked;
  const layout = getCurrentLayout();
  const portNames = subcktExportPorts.map(p => p.name);
  const portDirsMap = {};
  subcktExportPorts.forEach(p => { portDirsMap[p.name] = p.dir; });

  const code = generateSubcktCodeFromLayout(subName, portNames, layout);
  const subPkg = {
    name: subName,
    ports: portNames,
    portDirs: portDirsMap,
    code,
    layoutSnapshot: JSON.parse(JSON.stringify(layout))
  };

  const f = getActiveFile();
  if (f && f.parsedDesign && f.parsedDesign.subckts[f.activeSubckt]) {
    f.parsedDesign.subckts[f.activeSubckt].ports = [...portNames];
    f.parsedDesign.subckts[f.activeSubckt].portDirs = { ...portDirsMap };
  }

  if (freezeLocal || subcktModalMode === "freeze") {
    frozenSubcktLib = frozenSubcktLib.filter(s => s.name !== subName);
    frozenSubcktLib.push(subPkg);
    try { localStorage.setItem("spectre_eda_subckt_lib", JSON.stringify(frozenSubcktLib)); } catch (e) {}
  }

  const fileOutName = subcktModalMode === "freeze" ? `${subName}_frozen.scs` : `${subName}.scs`;
  downloadBlob(new Blob([code], { type: "text/plain;charset=utf-8" }), fileOutName);
  closeModal("subckt-export-modal");
  document.getElementById("mode-tip").textContent = subcktModalMode === "freeze"
    ? `已完成引脚配置并将子电路 ${subName} 固化到库`
    : `已导出子电路 ${subName}.scs${freezeLocal ? " 并同时固化到本地库" : ""}`;
}

function closeModal(id) { document.getElementById(id).style.display = "none"; }

/* ============================================================================
 * 5. 悬浮移动岛 (可拖拽移动 + 自定义按钮 + 隐藏)
 * ============================================================================ */
function renderFloatingIsland() {
  const container = document.getElementById("island-buttons");
  container.innerHTML = "";
  ISLAND_CATALOG.forEach(item => {
    if (!enabledIslandBtns.includes(item.id)) return;
    const btn = document.createElement("button");
    btn.className = "island-btn" + (item.mode && item.mode === editMode ? " active" : "");
    btn.textContent = item.label;
    btn.onclick = (e) => { e.stopPropagation(); item.action(); };
    container.appendChild(btn);
  });
}

function toggleIslandMinimize(minimize, ev) {
  if (ev) ev.stopPropagation();
  if (!minimize && islandDragMoved) { islandDragMoved = false; return; }
  const el = document.getElementById("floating-island");
  if (!el) return;
  if (minimize) el.classList.add("island-minimized");
  else el.classList.remove("island-minimized");
}

let placeIslandVisible = false;
function togglePlaceIsland(ev, forceState = null) {
  if (ev) ev.stopPropagation();
  placeIslandVisible = forceState !== null ? forceState : !placeIslandVisible;
  const el = document.getElementById("place-island");
  const chk = document.getElementById("chk-placeIsland");
  if (el) el.style.display = placeIslandVisible ? "flex" : "none";
  if (chk) chk.textContent = placeIslandVisible ? "✓" : " ";
  closeAllMenus();
}

function quickPlacePdkMos(kind) {
  const pdk = getActivePdk();
  const list = kind === "nmos" ? pdk.nmosModels : pdk.pmosModels;
  const m = list[0] || { name: kind === "nmos" ? "nch" : "pch", defaultParams: "w=10u l=1u" };
  openPlaceDialog(kind, m.name, m.defaultParams);
}

function quickPlaceFirstSubckt() {
  const f = getActiveFile();
  if (f && f.parsedDesign) {
    const subs = Object.values(f.parsedDesign.subckts).filter(s => s.name && !s.name.startsWith("顶层") && s.name !== f.activeSubckt);
    if (subs.length > 0) {
      openPlaceDialog("subckt_inst", subs[0].name, "", subs[0].ports.join(" "));
      return;
    }
  }
  openPlaceDialog("subckt_inst", "my_subckt", "", "in out vdd vss");
}

function toggleFloatingIsland(ev) {
  if (ev) ev.stopPropagation();
  viewVisibility.floatingIsland = !viewVisibility.floatingIsland;
  updateVisibilityChecks();
}

function openIslandConfigModal() {
  const list = document.getElementById("island-config-list");
  list.innerHTML = `<div style="color:#94a3b8;font-size:12px;">勾选需要在悬浮移动岛中显示的常用功能按钮：</div>`;
  ISLAND_CATALOG.forEach(item => {
    const row = document.createElement("label");
    row.className = "sc-row";
    row.style.cursor = "pointer";
    const checked = enabledIslandBtns.includes(item.id);
    row.innerHTML = `<span>${item.label}</span><input type="checkbox" ${checked ? "checked" : ""}>`;
    row.querySelector("input").onchange = (e) => {
      if (e.target.checked && !enabledIslandBtns.includes(item.id)) enabledIslandBtns.push(item.id);
      else if (!e.target.checked) enabledIslandBtns = enabledIslandBtns.filter(x => x !== item.id);
      renderFloatingIsland();
    };
    list.appendChild(row);
  });
  document.getElementById("island-modal").style.display = "flex";
}

function hideIslandFromModal() {
  viewVisibility.floatingIsland = false;
  updateVisibilityChecks();
  closeModal("island-modal");
}

let islandDrag = null;
let islandDragMoved = false;
const islandEl = document.getElementById("floating-island");
islandEl.addEventListener("mousedown", (e) => {
  const isMin = islandEl.classList.contains("island-minimized");
  if (!isMin && e.target.tagName === "BUTTON") return;
  e.stopPropagation();
  islandDragMoved = false;
  const rect = islandEl.getBoundingClientRect();
  const parentRect = document.getElementById("canvas-body").getBoundingClientRect();
  islandDrag = { startX: e.clientX, startY: e.clientY, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top, parentRect, isMin };
});
window.addEventListener("mousemove", (e) => {
  if (!islandDrag) return;
  if (Math.hypot(e.clientX - islandDrag.startX, e.clientY - islandDrag.startY) > 4) {
    islandDragMoved = true;
  }
  const maxW = islandDrag.isMin ? 44 : 120;
  const x = Math.max(8, Math.min(islandDrag.parentRect.width - maxW, e.clientX - islandDrag.parentRect.left - islandDrag.offsetX));
  const y = Math.max(8, Math.min(islandDrag.parentRect.height - 40, e.clientY - islandDrag.parentRect.top - islandDrag.offsetY));
  islandEl.style.left = `${x}px`;
  islandEl.style.top = `${y}px`;
  islandEl.style.transform = "none";
});
let placeIslandDrag = null;
const placeIslandEl = document.getElementById("place-island");
if (placeIslandEl) {
  placeIslandEl.addEventListener("mousedown", (e) => {
    if (e.target.tagName === "BUTTON") return;
    e.stopPropagation();
    const rect = placeIslandEl.getBoundingClientRect();
    const parentRect = document.getElementById("canvas-body").getBoundingClientRect();
    placeIslandDrag = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top, parentRect };
  });
}
window.addEventListener("mousemove", (e) => {
  if (!placeIslandDrag) return;
  const x = Math.max(8, Math.min(placeIslandDrag.parentRect.width - 120, e.clientX - placeIslandDrag.parentRect.left - placeIslandDrag.offsetX));
  const y = Math.max(8, Math.min(placeIslandDrag.parentRect.height - 40, e.clientY - placeIslandDrag.parentRect.top - placeIslandDrag.offsetY));
  placeIslandEl.style.left = `${x}px`;
  placeIslandEl.style.top = `${y}px`;
  placeIslandEl.style.bottom = "auto";
  placeIslandEl.style.transform = "none";
});
window.addEventListener("mouseup", () => { islandDrag = null; placeIslandDrag = null; });

/* ============================================================================
 * 6. Spectre 解析器（含电感 inductor、逻辑门、运放及 SPICE 等效电路识别）
 * ============================================================================ */
let realDeviceLineMap = new Map();

function buildSpiceModelEquivSubckt(mName, mType, params) {
  const t = mType.toUpperCase();
  const p = params || {};
  if (t === "NPN" || t === "PNP") {
    const rb = p.RB || p.rb || "10";
    const rc = p.RC || p.rc || "1";
    const re = p.RE || p.re || "1";
    const cje = p.CJE || p.cje || "2p";
    const cjc = p.CJC || p.cjc || "1p";
    const bf = p.BF || p.bf || "200";
    return `subckt ${mName} ( c b e )\nRb ( b bi ) resistor r=${rb}\nRc ( c ci ) resistor r=${rc}\nRe ( e ei ) resistor r=${re}\nCje ( bi ei ) capacitor c=${cje}\nCjc ( bi ci ) capacitor c=${cjc}\nQ_core ( ci bi ei ) ${t.toLowerCase()} bf=${bf}\nends ${mName}`;
  }
  if (t === "NMOS" || t === "PMOS") {
    const ch = t === "NMOS" ? "nch" : "pch";
    return `subckt ${mName} ( d g s b )\nRg ( g gi ) resistor r=${p.RG || "5"}\nCgs ( gi s ) capacitor c=${p.CGSO || "15f"}\nCgd ( gi d ) capacitor c=${p.CGDO || "5f"}\nM_core ( d gi s b ) ${ch} w=10u l=1u\nends ${mName}`;
  }
  if (t === "D") {
    return `subckt ${mName} ( a k )\nRs ( a n1 ) resistor r=${p.RS || "1"}\nCj ( n1 k ) capacitor c=${p.CJO || "1p"}\nends ${mName}`;
  }
  return null;
}

/* ============================================================================
 * 9. SVG 渲染（电感符号、运放三角、逻辑门、最高/最低电压圆点连线图例、双击 SPICE 等效电路）
 * ============================================================================ */
let highlightedLines = new Set();
let checkedDeviceNames = new Set();
let selectedDeviceNames = new Set();
let errorPinKeys = new Set();
let warnPinKeys = new Set();
let editMode = "move";
let pendingWirePin = null;
let draggingTarget = null;
let didMoveDuringDrag = false;
let marqueeRect = null;
let selectedWireIndices = new Set();
let lastRoutedWires = [];
let _openNetSeq = 1;

function renderSVG(layout, routed, subckt) {
  const vp = document.getElementById("viewport");
  vp.innerHTML = "";

  const svgNS = "http://www.w3.org/2000/svg";
  const createEl = (tag, attrs = {}, text = null) => {
    const el = document.createElementNS(svgNS, tag);
    for (let [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (text !== null) el.textContent = text;
    return el;
  };

  // 世界坐标背景网格（跟随原理图缩放同步放大缩小）
  vp.appendChild(createEl("rect", {
    id: "world-grid-rect",
    x: -2000, y: -2000, width: layout.width + 4000, height: layout.height + 4000,
    fill: "url(#world-grid-major)"
  }));

  vp.appendChild(createEl("rect", {
    x: 20, y: 20, width: layout.width - 40, height: layout.height - 40,
    fill: "none", stroke: "#94a3b8", "stroke-width": 1.5
  }));

  // 原理图空白处将 VDD 标签连向空白圆点，将 GND 标签连向黑色圆点
  const legendX = 40, legendY = layout.height - 56;
  const legendG = createEl("g");
  legendG.appendChild(createEl("rect", {
    x: legendX, y: legendY - 22, width: 575, height: 34, rx: 5,
    fill: "#f8fafc", stroke: "#cbd5e1", "stroke-width": 1.2
  }));
  legendG.appendChild(createEl("text", { x: legendX + 12, y: legendY - 1, fill: "#dc2626", "font-size": "11.5", "font-weight": "bold" }, "VDD"));
  legendG.appendChild(createEl("line", { x1: legendX + 39, y1: legendY - 5, x2: legendX + 66, y2: legendY - 5, stroke: "#dc2626", "stroke-width": 1.8 }));
  legendG.appendChild(createEl("circle", { cx: legendX + 71, cy: legendY - 5, r: 5, fill: "#ffffff", stroke: "#dc2626", "stroke-width": 2 }));
  legendG.appendChild(createEl("text", { x: legendX + 82, y: legendY - 1, fill: "#334155", "font-size": "11" }, currentLang === "en" ? "Max Voltage" : "最高电压"));

  legendG.appendChild(createEl("text", { x: legendX + 150, y: legendY - 1, fill: "#0f172a", "font-size": "11.5", "font-weight": "bold" }, "GND / VSS"));
  legendG.appendChild(createEl("line", { x1: legendX + 210, y1: legendY - 5, x2: legendX + 237, y2: legendY - 5, stroke: "#0f172a", "stroke-width": 1.8 }));
  legendG.appendChild(createEl("circle", { cx: legendX + 242, cy: legendY - 5, r: 5, fill: "#0f172a", stroke: "#0f172a", "stroke-width": 1.5 }));
  legendG.appendChild(createEl("text", { x: legendX + 253, y: legendY - 1, fill: "#334155", "font-size": "11" }, currentLang === "en" ? "GND / Min V" : "地/最低电压"));

  legendG.appendChild(createEl("text", { x: legendX + 338, y: legendY - 1, fill: "#0f172a", "font-size": "11.5", "font-weight": "bold" }, "VEE (<GND)"));
  legendG.appendChild(createEl("line", { x1: legendX + 408, y1: legendY - 5, x2: legendX + 435, y2: legendY - 5, stroke: "#0f172a", "stroke-width": 1.8 }));
  legendG.appendChild(createEl("circle", { cx: legendX + 440, cy: legendY - 5, r: 5, fill: "#ffffff", stroke: "#0f172a", "stroke-width": 2 }));
  legendG.appendChild(createEl("text", { x: legendX + 451, y: legendY - 1, fill: "#334155", "font-size": "11" }, currentLang === "en" ? "Neg V (<GND)" : "低于GND负电压"));
  vp.appendChild(legendG);

  const hlNets = new Set();
  layout.elements.forEach(e => {
    if (checkedDeviceNames.has(e.name) || selectedDeviceNames.has(e.name)) {
      e.pins.forEach(p => hlNets.add(p.net));
    }
  });

  lastRoutedWires = routed.wires;
  // 引线层
  const wireLayer = createEl("g");
  routed.wires.forEach((w, wIdx) => {
    const d = w.points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const isWireSel = selectedWireIndices.has(wIdx);
    const isHl = hlNets.has(w.net);
    const hit = createEl("path", { d, fill: "none", stroke: "transparent", "stroke-width": 12, style: "cursor:pointer" });
    hit.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (placingTool) return;
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) {
        if (selectedWireIndices.has(wIdx)) selectedWireIndices.delete(wIdx);
        else selectedWireIndices.add(wIdx);
      } else {
        selectedDeviceNames.clear();
        selectedWireIndices.clear();
        selectedWireIndices.add(wIdx);
      }
      const tipMsg = currentLang === "en" ? `🔌 Wire Net: ${w.net}` : `🔌 电线端口/网络名称: ${w.net}`;
      const modeTipEl = document.getElementById("mode-tip");
      if (modeTipEl) modeTipEl.textContent = tipMsg;
      showToast(tipMsg, "info", 2000);
      if (editMode === "move") {
        pushUndoSnapshot();
        didMoveDuringDrag = false;
        const pt = clientToSvg(e.clientX, e.clientY);
        const curOff = layout.wireOffsets[wIdx] || { dx: 0, dy: 0 };
        draggingTarget = { kind: "wire", wIdx, startSvg: pt, orig: { ...curOff } };
      }
      rerenderOnly();
    });
    if (isWireSel) {
      wireLayer.appendChild(createEl("path", {
        d, fill: "none", stroke: "rgba(239, 68, 68, 0.28)", "stroke-width": 7,
        "stroke-linejoin": "miter", "stroke-linecap": "round"
      }));
    }
    wireLayer.appendChild(createEl("path", {
      d, fill: "none",
      stroke: isWireSel ? "#ef4444" : (isHl ? "#d97706" : "#0f52ba"),
      "stroke-width": isWireSel ? 3.2 : (isHl ? 3 : 1.8),
      "stroke-linejoin": "miter",
      "stroke-linecap": "square"
    }));
    wireLayer.appendChild(hit);
  });
  vp.appendChild(wireLayer);

  // T 型连接点层
  const juncLayer = createEl("g");
  const seenJunc = new Set();
  routed.junctions.forEach(j => {
    const key = `${j.x},${j.y}`;
    if (seenJunc.has(key)) return;
    seenJunc.add(key);
    const isHl = hlNets.has(j.net);
    juncLayer.appendChild(createEl("circle", { cx: j.x, cy: j.y, r: isHl ? 4.2 : 3.5, fill: isHl ? "#d97706" : "#0f52ba" }));
  });
  vp.appendChild(juncLayer);

  // 元件层
  const devLayer = createEl("g");
  layout.elements.forEach(el => {
    const isChecked = checkedDeviceNames.has(el.name);
    const isSelected = selectedDeviceNames.has(el.name);
    const isHl = isChecked || isSelected;

    const g = createEl("g", { style: `cursor:${editMode === "move" ? "grab" : "pointer"}` });

    g.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();

      const nowMs = Date.now();
      if (window._lastDevClick && window._lastDevClick.name === el.name && (nowMs - window._lastDevClick.ts) < 380) {
        window._lastDevClick = null;
        openEquivalentCircuitForDevice(el);
        return;
      }
      window._lastDevClick = { name: el.name, ts: nowMs };

      if (pickingSchematicPortMode) {
        const firstSigPin = el.pins.find(p => p.net && !isHighVoltNet(p.net) && !isLowVoltNet(p.net)) || el.pins[0];
        if (firstSigPin && firstSigPin.net) handleSchematicPortPicked(firstSigPin.net);
        return;
      }
      if (pickingPortFromCanvas) {
        const firstPin = el.pins[0];
        if (firstPin && !subcktExportPorts.some(p => p.name === firstPin.net)) {
          subcktExportPorts.push({ name: firstPin.net, dir: "input" });
        }
        pickingPortFromCanvas = false;
        renderSubcktPortsList();
        document.getElementById("subckt-export-modal").style.display = "flex";
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (selectedDeviceNames.has(el.name)) selectedDeviceNames.delete(el.name);
        else selectedDeviceNames.add(el.name);
      } else {
        if (!selectedDeviceNames.has(el.name)) {
          selectedDeviceNames.clear();
          selectedDeviceNames.add(el.name);
        }
      }

      highlightedLines.clear();
      layout.elements.forEach(item => {
        if ((selectedDeviceNames.has(item.name) || checkedDeviceNames.has(item.name)) && item.line) {
          highlightedLines.add(item.line);
        }
      });
      refreshEditorGutter();

      if (editMode === "move" && selectedDeviceNames.size > 0) {
        pushUndoSnapshot();
        didMoveDuringDrag = false;
        const pt = clientToSvg(e.clientX, e.clientY);
        const items = layout.elements
          .filter(item => selectedDeviceNames.has(item.name))
          .map(item => ({ el: item, origX: item.x, origY: item.y }));
        draggingTarget = { kind: "multi_el", startSvg: pt, items };
      }
      rerenderOnly();
    });

    g.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      openEquivalentCircuitForDevice(el);
    });

    g.addEventListener("contextmenu", (e) => {
      if (placingTool) return;
      e.preventDefault();
      e.stopPropagation();
      selectedDeviceNames.clear();
      selectedDeviceNames.add(el.name);
      rerenderOnly();
      openEditParamModal(el);
    });

    if (isHl) {
      g.appendChild(createEl("rect", {
        x: el.x - el.w / 2 - 12,
        y: el.y - el.h / 2 - 12,
        width: el.w + 24,
        height: el.h + 24,
        rx: 8,
        fill: isChecked ? "rgba(250, 204, 21, 0.24)" : "rgba(59, 130, 246, 0.14)",
        stroke: isChecked ? "#d97706" : "#2563eb",
        "stroke-width": isChecked ? 2.5 : 2,
        "stroke-dasharray": "6,3"
      }));
    }

    drawDeviceSymbol(g, el, createEl, isChecked);
    el.pins.forEach(p => {
      if (errorPinKeys.has(`${el.name}.${p.name}`)) {
        g.appendChild(createEl("circle", {
          cx: p.x, cy: p.y, r: 9,
          fill: "rgba(239, 68, 68, 0.25)", stroke: "#dc2626", "stroke-width": 2.4, "stroke-dasharray": "3,2"
        }));
      } else if (warnPinKeys.has(`${el.name}.${p.name}`)) {
        g.appendChild(createEl("circle", {
          cx: p.x, cy: p.y, r: 9,
          fill: "rgba(245, 158, 11, 0.24)", stroke: "#d97706", "stroke-width": 2.2, "stroke-dasharray": "3,2"
        }));
      }
    });

    if (editMode === "wire") {
      el.pins.forEach(p => {
        const isPending = pendingWirePin && pendingWirePin.el.name === el.name && pendingWirePin.pin.name === p.name;
        const dot = createEl("circle", {
          cx: p.x, cy: p.y, r: isPending ? 6.5 : 5,
          fill: isPending ? "#ef4444" : "#10b981",
          stroke: "#ffffff", "stroke-width": 1.5, style: "cursor:crosshair"
        });
        dot.addEventListener("mousedown", (ev) => {
          ev.stopPropagation();
          handlePinClickForWire(el, p);
        });
        g.appendChild(dot);
      });
    }

    devLayer.appendChild(g);
  });
  vp.appendChild(devLayer);

  // 电源圆点 / 端口标签层
  const symLayer = createEl("g");
  routed.symbols.forEach(sym => {
    if ((sym.type === "vdd_dot" || sym.type === "gnd_dot" || sym.type === "neg_dot") && !viewVisibility.powerLabels) return;
    if (sym.type === "port" && !viewVisibility.portLabels) return;

    const g = createEl("g", { style: `cursor:${editMode === "move" ? "move" : "pointer"}` });
    g.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      if (pickingPortFromCanvas) {
        if (!subcktExportPorts.some(p => p.name === sym.net)) {
          subcktExportPorts.push({ name: sym.net, dir: sym.type === "port" && sym.dir === "right" ? "output" : "input" });
        }
        pickingPortFromCanvas = false;
        renderSubcktPortsList();
        document.getElementById("subckt-export-modal").style.display = "flex";
        return;
      }
      if (pickingSchematicPortMode) {
        handleSchematicPortPicked(sym.net);
        return;
      }
      if (bottomDockOpen && (activeDockTab === "scope" || activeDockTab === "spectrum") && !isHighVoltNet(sym.net) && !isLowVoltNet(sym.net)) {
        selectProbePortFromSchematic(sym.net);
      }
      if (editMode !== "move") return;
      pushUndoSnapshot();
      didMoveDuringDrag = false;
      const pt = clientToSvg(e.clientX, e.clientY);
      const curOff = layout.symbolOffsets[sym.id] || { dx: 0, dy: 0 };
      draggingTarget = { kind: "sym", symId: sym.id, startSvg: pt, orig: { ...curOff } };
    });
    drawNetSymbol(g, sym, createEl);
    symLayer.appendChild(g);
  });
  vp.appendChild(symLayer);

  // 静态工作点标注层 (节点电压 + 各电线支路电流 + 器件工作区)
  if (viewVisibility.dcOp) {
    const dcOp = computeDcOperatingPoint(layout, getActiveFile());
    const dcLayer = createEl("g");
    const annotatedNets = new Set();
    layout.elements.forEach(el => {
      el.pins.forEach(p => {
        if (!p.net || annotatedNets.has(p.net)) return;
        if (isHighVoltNet(p.net) || isLowVoltNet(p.net)) return;
        annotatedNets.add(p.net);
        const v = dcOp.nodeVoltages[p.net];
        if (v === undefined) return;
        const txt = `${p.net}: ${v.toFixed(2)}V`;
        const bw = Math.max(54, txt.length * 6.5 + 10);
        const bx = p.x - bw / 2, by = p.y - 22;
        dcLayer.appendChild(createEl("rect", {
          x: bx, y: by, width: bw, height: 15, rx: 3,
          fill: "rgba(15, 23, 42, 0.88)", stroke: "#22c55e", "stroke-width": 1
        }));
        dcLayer.appendChild(createEl("text", {
          x: p.x, y: by + 11, "text-anchor": "middle",
          fill: "#4ade80", "font-size": "10", "font-weight": "bold", "font-family": "Consolas, monospace"
        }, txt));
      });
      const devOp = dcOp.deviceOps[el.name];
      if (devOp) {
        dcLayer.appendChild(createEl("text", {
          x: el.x, y: el.y + el.h / 2 + 12, "text-anchor": "middle",
          fill: "#0369a1", "font-size": "9.5", "font-weight": "bold", "font-family": "Consolas, monospace"
        }, devOp));
      }
    });
    vp.appendChild(dcLayer);
  }

  if (marqueeRect) {
    const rx = Math.min(marqueeRect.x1, marqueeRect.x2);
    const ry = Math.min(marqueeRect.y1, marqueeRect.y2);
    vp.appendChild(createEl("rect", {
      x: rx, y: ry,
      width: Math.abs(marqueeRect.x2 - marqueeRect.x1),
      height: Math.abs(marqueeRect.y2 - marqueeRect.y1),
      fill: "rgba(59, 130, 246, 0.14)", stroke: "#2563eb", "stroke-width": 1.5, "stroke-dasharray": "5,3"
    }));
  }

  document.getElementById("routing-metrics").textContent =
    `器件: ${layout.elements.length} | 连线: ${routed.wires.length} | 已选元件: ${selectedDeviceNames.size}${selectedWireIndices.size ? ` | 已选电线: ${selectedWireIndices.size}` : ""}`;
  updateFuncCard(layout);
  if (placingTool) renderPlaceGhost();
}

function drawDeviceSymbol(g, el, createEl, isHl) {
  const { x, y, type, name, params, model } = el;
  const stroke = isHl ? "#b45309" : "#1e293b";
  const rot = (((el.rotation || 0) % 360) + 360) % 360;
  const sx = el.flipX ? -1 : 1;
  const sy = el.flipY ? -1 : 1;
  const symG = (rot !== 0 || sx !== 1 || sy !== 1)
    ? createEl("g", { transform: `translate(${x}, ${y}) rotate(${rot}) scale(${sx}, ${sy}) translate(${-x}, ${-y})` })
    : g;
  if (symG !== g) g.appendChild(symG);
  const drawTarget = symG;
  const sw = isHl ? 2.5 : 2;
  const paramText = Object.entries(params)
    .filter(([k]) => ["w", "l", "r", "c", "dc", "m", "lr", "wr", "nr", "rad"].includes(k.toLowerCase()))
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");

  const drawHaloText = (tx, ty, text, fill, size, bold = false, anchor = "start") => {
    const attrs = {
      x: tx, y: ty, fill, "font-size": size, "text-anchor": anchor,
      "paint-order": "stroke", stroke: "rgba(255,255,255,0.92)", "stroke-width": "3px", "stroke-linejoin": "round"
    };
    if (bold) attrs["font-weight"] = "bold";
    drawTarget.appendChild(createEl("text", attrs, text));
  };

  if (type === "nmos" || type === "pmos") {
    drawTarget.appendChild(createEl("line", { x1: x - 40, y1: y, x2: x - 8, y2: y, stroke, "stroke-width": sw }));
    if (type === "pmos") g.appendChild(createEl("circle", { cx: x - 12, cy: y, r: 4, fill: "#ffffff", stroke, "stroke-width": sw }));
    drawTarget.appendChild(createEl("line", { x1: x - 6, y1: y - 18, x2: x - 6, y2: y + 18, stroke, "stroke-width": 2.4 }));
    drawTarget.appendChild(createEl("line", { x1: x + 2, y1: y - 18, x2: x + 2, y2: y + 18, stroke, "stroke-width": sw }));
    drawTarget.appendChild(createEl("polyline", { points: `${x + 2},${y - 14} ${x + 20},${y - 14} ${x + 20},${y - 40}`, fill: "none", stroke, "stroke-width": sw }));
    drawTarget.appendChild(createEl("polyline", { points: `${x + 2},${y + 14} ${x + 20},${y + 14} ${x + 20},${y + 40}`, fill: "none", stroke, "stroke-width": sw }));
    drawTarget.appendChild(createEl("line", { x1: x + 2, y1: y, x2: x + 20, y2: y, stroke, "stroke-width": 1.5 }));
    if (type === "nmos") g.appendChild(createEl("polygon", { points: `${x + 3},${y} ${x + 11},${y - 4} ${x + 11},${y + 4}`, fill: stroke }));
    else g.appendChild(createEl("polygon", { points: `${x + 13},${y} ${x + 5},${y - 4} ${x + 5},${y + 4}`, fill: stroke }));

    if (viewVisibility.instNames) drawHaloText(x + 26, y - 18, name, isHl ? "#b45309" : "#b91c1c", "12", true);
    if (viewVisibility.instParams && paramText) drawHaloText(x + 26, y + 26, paramText, "#15803d", "10.5");
  } else if (type === "pnp" || type === "npn") {
    drawTarget.appendChild(createEl("line", { x1: x - 40, y1: y, x2: x - 4, y2: y, stroke, "stroke-width": sw }));
    drawTarget.appendChild(createEl("line", { x1: x - 4, y1: y - 18, x2: x - 4, y2: y + 18, stroke, "stroke-width": 2.6 }));
    drawTarget.appendChild(createEl("polyline", { points: `${x - 4},${y - 8} ${x + 20},${y - 22} ${x + 20},${y - 40}`, fill: "none", stroke, "stroke-width": sw }));
    drawTarget.appendChild(createEl("polyline", { points: `${x - 4},${y + 8} ${x + 20},${y + 22} ${x + 20},${y + 40}`, fill: "none", stroke, "stroke-width": sw }));
    if (type === "pnp") g.appendChild(createEl("polygon", { points: `${x - 2},${y - 9} ${x + 7},${y - 10} ${x + 4},${y - 16}`, fill: stroke }));
    else g.appendChild(createEl("polygon", { points: `${x + 18},${y + 21} ${x + 9},${y + 20} ${x + 12},${y + 14}`, fill: stroke }));

    if (viewVisibility.instNames) drawHaloText(x + 26, y - 6, name, isHl ? "#b45309" : "#b91c1c", "12", true);
    if (viewVisibility.instParams) drawHaloText(x + 26, y + 10, `${model} ${paramText}`.trim(), "#15803d", "10.5");
  } else if (type === "resistor") {
    const pts = `${x},${y - 40} ${x},${y - 24} ${x - 8},${y - 20} ${x + 8},${y - 12} ${x - 8},${y - 4} ${x + 8},${y + 4} ${x - 8},${y + 12} ${x + 8},${y + 20} ${x},${y + 24} ${x},${y + 40}`;
    drawTarget.appendChild(createEl("polyline", { points: pts, fill: "none", stroke, "stroke-width": sw, "stroke-linejoin": "round" }));
    if (viewVisibility.instNames) drawHaloText(x + 13, y - 4, name, isHl ? "#b45309" : "#b91c1c", "12", true);
    if (viewVisibility.instParams && paramText) drawHaloText(x + 13, y + 11, paramText, "#15803d", "10.5");
  } else if (type === "inductor") {
    const d = `M ${x} ${y - 40} L ${x} ${y - 24}
               A 6 6 0 0 1 ${x} ${y - 12}
               A 6 6 0 0 1 ${x} ${y}
               A 6 6 0 0 1 ${x} ${y + 12}
               A 6 6 0 0 1 ${x} ${y + 24}
               L ${x} ${y + 40}`;
    drawTarget.appendChild(createEl("path", { d, fill: "none", stroke, "stroke-width": sw }));
    if (viewVisibility.instNames) drawHaloText(x + 13, y - 4, name, isHl ? "#b45309" : "#b91c1c", "12", true);
    if (viewVisibility.instParams && paramText) drawHaloText(x + 13, y + 11, paramText, "#15803d", "10.5");
  } else if (type === "capacitor") {
    drawTarget.appendChild(createEl("line", { x1: x - 40, y1: y, x2: x - 5, y2: y, stroke, "stroke-width": sw }));
    drawTarget.appendChild(createEl("line", { x1: x - 5, y1: y - 16, x2: x - 5, y2: y + 16, stroke, "stroke-width": 2.4 }));
    drawTarget.appendChild(createEl("line", { x1: x + 5, y1: y - 16, x2: x + 5, y2: y + 16, stroke, "stroke-width": 2.4 }));
    drawTarget.appendChild(createEl("line", { x1: x + 5, y1: y, x2: x + 40, y2: y, stroke, "stroke-width": sw }));
    if (viewVisibility.instNames) drawHaloText(x - 16, y - 22, name, isHl ? "#b45309" : "#b91c1c", "12", true);
    if (viewVisibility.instParams && paramText) drawHaloText(x - 16, y + 30, paramText, "#15803d", "10.5");
  } else if (["isource", "vsource", "vsin", "vpulse", "vsweep"].includes(type)) {
    drawTarget.appendChild(createEl("line", { x1: x, y1: y - 40, x2: x, y2: y - 18, stroke, "stroke-width": sw }));
    drawTarget.appendChild(createEl("circle", { cx: x, cy: y, r: 18, fill: "#ffffff", stroke, "stroke-width": sw }));
    drawTarget.appendChild(createEl("line", { x1: x, y1: y + 18, x2: x, y2: y + 40, stroke, "stroke-width": sw }));
    if (type === "isource") {
      drawTarget.appendChild(createEl("line", { x1: x, y1: y - 10, x2: x, y2: y + 8, stroke, "stroke-width": 1.8 }));
      drawTarget.appendChild(createEl("polygon", { points: `${x},${y + 11} ${x - 4},${y + 4} ${x + 4},${y + 4}`, fill: stroke }));
    } else if (type === "vsin") {
      drawTarget.appendChild(createEl("path", { d: `M ${x - 10} ${y} Q ${x - 5} ${y - 10} ${x} ${y} T ${x + 10} ${y}`, fill: "none", stroke: "#0284c7", "stroke-width": 2 }));
    } else if (type === "vpulse") {
      drawTarget.appendChild(createEl("polyline", { points: `${x - 11},${y + 5} ${x - 6},${y + 5} ${x - 6},${y - 6} ${x + 4},${y - 6} ${x + 4},${y + 5} ${x + 11},${y + 5}`, fill: "none", stroke: "#7c3aed", "stroke-width": 2 }));
    } else if (type === "vsweep") {
      drawTarget.appendChild(createEl("path", { d: `M ${x - 11} ${y + 3} Q ${x - 7} ${y - 8} ${x - 3} ${y + 3} Q ${x} ${y - 8} ${x + 3} ${y + 3} Q ${x + 5} ${y - 8} ${x + 8} ${y + 3}`, fill: "none", stroke: "#d97706", "stroke-width": 1.8 }));
      drawTarget.appendChild(createEl("line", { x1: x - 9, y1: y + 9, x2: x + 9, y2: y - 9, stroke: "#dc2626", "stroke-width": 1.3 }));
    } else {
      drawTarget.appendChild(createEl("text", { x: x - 4, y: y - 5, fill: stroke, "font-size": "13", "font-weight": "bold" }, "+"));
      drawTarget.appendChild(createEl("text", { x: x - 3, y: y + 13, fill: stroke, "font-size": "13", "font-weight": "bold" }, "-"));
    }
    const allP = Object.entries(params).map(([k, v]) => `${k}=${v}`).join(" ");
    if (viewVisibility.instNames) drawHaloText(x + 22, y - 4, name, isHl ? "#b45309" : "#b91c1c", "12", true);
    if (viewVisibility.instParams && (paramText || allP)) drawHaloText(x + 22, y + 11, paramText || allP, "#15803d", "10.5");
  } else if (["vcvs", "vccs", "cccs", "ccvs"].includes(type)) {
    const pts = `${x},${y - 22} ${x + 22},${y} ${x},${y + 22} ${x - 22},${y}`;
    drawTarget.appendChild(createEl("polygon", { points: pts, fill: "#ffffff", stroke, "stroke-width": sw }));
    drawTarget.appendChild(createEl("line", { x1: x, y1: y - 40, x2: x, y2: y - 22, stroke, "stroke-width": sw }));
    drawTarget.appendChild(createEl("line", { x1: x, y1: y + 22, x2: x, y2: y + 40, stroke, "stroke-width": sw }));
    drawTarget.appendChild(createEl("line", { x1: x - 40, y1: y, x2: x - 22, y2: y, stroke, "stroke-width": 1.4, "stroke-dasharray": "3,2" }));
    drawTarget.appendChild(createEl("line", { x1: x + 22, y1: y, x2: x + 40, y2: y, stroke, "stroke-width": 1.4, "stroke-dasharray": "3,2" }));
    drawTarget.appendChild(createEl("text", { x, y: y + 4, "text-anchor": "middle", fill: "#0284c7", "font-size": "10", "font-weight": "bold" }, type.toUpperCase()));
    if (viewVisibility.instNames) drawHaloText(x + 26, y - 10, name, isHl ? "#b45309" : "#b91c1c", "12", true);
    const allP = Object.entries(params).map(([k, v]) => `${k}=${v}`).join(" ");
    if (viewVisibility.instParams && allP) drawHaloText(x + 26, y + 16, allP, "#15803d", "10.5");
  } else if (type.startsWith("gate_") || type === "dff" || type === "mux2") {
    const gStroke = isHl ? "#b45309" : "#15803d";
    const gFill = isHl ? "#fef9c3" : "#f0fdf4";
    if (type === "dff") {
      drawTarget.appendChild(createEl("rect", { x: x - 34, y: y - 38, width: 68, height: 76, rx: 4, fill: gFill, stroke: gStroke, "stroke-width": sw }));
      el.pins.filter(p => p.dir === "left").forEach(p => {
        drawTarget.appendChild(createEl("text", { x: x - 28, y: p.y + 3.5, fill: "#1e293b", "font-size": "9.5", "font-weight": "bold" }, p.name));
      });
      drawTarget.appendChild(createEl("text", { x: x + 28, y: y + 4, "text-anchor": "end", fill: "#1e293b", "font-size": "11", "font-weight": "bold" }, "Q"));
      drawTarget.appendChild(createEl("text", { x, y: y - 24, "text-anchor": "middle", fill: "#15803d", "font-size": "10", "font-weight": "bold" }, el.params?.mode === "counter" ? "CNT/REG" : "DFF"));
    } else if (type === "mux2") {
      drawTarget.appendChild(createEl("polygon", { points: `${x - 26},${y - 36} ${x + 26},${y - 20} ${x + 26},${y + 20} ${x - 26},${y + 36}`, fill: gFill, stroke: gStroke, "stroke-width": sw }));
      drawTarget.appendChild(createEl("text", { x: x - 20, y: y - 16, fill: "#1e293b", "font-size": "10.5" }, "0"));
      drawTarget.appendChild(createEl("text", { x: x - 20, y: y + 24, fill: "#1e293b", "font-size": "10.5" }, "1"));
      drawTarget.appendChild(createEl("text", { x, y: y + 4, "text-anchor": "middle", fill: "#15803d", "font-size": "10", "font-weight": "bold" }, "MUX"));
    } else if (type === "gate_inv" || type === "gate_buf") {
      drawTarget.appendChild(createEl("polygon", { points: `${x - 24},${y - 22} ${x + 18},${y} ${x - 24},${y + 22}`, fill: gFill, stroke: gStroke, "stroke-width": sw }));
      if (type === "gate_inv") g.appendChild(createEl("circle", { cx: x + 23, cy: y, r: 4.5, fill: "#ffffff", stroke: gStroke, "stroke-width": sw }));
    } else if (type === "gate_or" || type === "gate_nor" || type === "gate_xor" || type === "gate_xnor") {
      const d = `M ${x - 28} ${y - 26} Q ${x - 14} ${y} ${x - 28} ${y + 26} Q ${x + 6} ${y + 26} ${x + 24} ${y} Q ${x + 6} ${y - 26} ${x - 28} ${y - 26} Z`;
      drawTarget.appendChild(createEl("path", { d, fill: gFill, stroke: gStroke, "stroke-width": sw }));
      if (type === "gate_xor" || type === "gate_xnor") {
        drawTarget.appendChild(createEl("path", { d: `M ${x - 34} ${y - 26} Q ${x - 20} ${y} ${x - 34} ${y + 26}`, fill: "none", stroke: gStroke, "stroke-width": sw }));
      }
      if (type === "gate_nor" || type === "gate_xnor") {
        drawTarget.appendChild(createEl("circle", { cx: x + 29, cy: y, r: 4.5, fill: "#ffffff", stroke: gStroke, "stroke-width": sw }));
      }
    } else {
      const d = `M ${x - 26} ${y - 26} L ${x} ${y - 26} A 26 26 0 0 1 ${x} ${y + 26} L ${x - 26} ${y + 26} Z`;
      drawTarget.appendChild(createEl("path", { d, fill: gFill, stroke: gStroke, "stroke-width": sw }));
      if (type === "gate_nand") g.appendChild(createEl("circle", { cx: x + 31, cy: y, r: 4.5, fill: "#ffffff", stroke: gStroke, "stroke-width": sw }));
    }
    el.pins.forEach(p => {
      if (p.dir === "left") {
        const tx = type === "dff" ? x - 34 : (type === "mux2" ? x - 26 : (type === "gate_inv" || type === "gate_buf" ? x - 24 : x - 26));
        drawTarget.appendChild(createEl("line", { x1: p.x, y1: p.y, x2: tx, y2: p.y, stroke: gStroke, "stroke-width": 1.8 }));
      } else if (p.dir === "right") {
        const sx = type === "dff" ? x + 34 : (type === "mux2" ? x + 26 : (type === "gate_inv" ? x + 27.5 : (type === "gate_buf" ? x + 18 : (["gate_nand", "gate_nor", "gate_xnor"].includes(type) ? x + 34 : x + 26))));
        drawTarget.appendChild(createEl("line", { x1: sx, y1: p.y, x2: p.x, y2: p.y, stroke: gStroke, "stroke-width": 1.8 }));
      } else if (p.dir === "bottom") {
        drawTarget.appendChild(createEl("line", { x1: p.x, y1: y + 28, x2: p.x, y2: p.y, stroke: gStroke, "stroke-width": 1.8 }));
      }
    });
    if (viewVisibility.instNames) drawHaloText(x, y - 42, name, gStroke, "11", true, "middle");
  } else if (type === "term_vdd") {
    drawTarget.appendChild(createEl("line", { x1: x, y1: y + 20, x2: x, y2: y + 5, stroke: "#dc2626", "stroke-width": 2 }));
    drawTarget.appendChild(createEl("circle", { cx: x, cy: y, r: 5.5, fill: "#ffffff", stroke: "#dc2626", "stroke-width": 2.2 }));
    if (viewVisibility.powerLabels) drawHaloText(x, y - 10, "VDD", "#dc2626", "10.5", true, "middle");
  } else if (type === "term_gnd") {
    drawTarget.appendChild(createEl("line", { x1: x, y1: y - 20, x2: x, y2: y - 5, stroke: "#0f172a", "stroke-width": 2 }));
    drawTarget.appendChild(createEl("circle", { cx: x, cy: y, r: 5.5, fill: "#0f172a", stroke: "#0f172a", "stroke-width": 1.8 }));
    if (viewVisibility.powerLabels) drawHaloText(x, y + 17, "GND", "#0f172a", "10.5", true, "middle");
  } else if (type === "term_neg") {
    drawTarget.appendChild(createEl("line", { x1: x, y1: y - 20, x2: x, y2: y - 5, stroke: "#0f172a", "stroke-width": 2 }));
    drawTarget.appendChild(createEl("circle", { cx: x, cy: y, r: 5.5, fill: "#ffffff", stroke: "#0f172a", "stroke-width": 2.2 }));
    if (viewVisibility.powerLabels) drawHaloText(x, y + 17, "VEE", "#0f172a", "10.5", true, "middle");
  } else if (type === "subckt_inst") {
    drawSubcktCustomSymbol(g, el, createEl, isHl, stroke, sw, drawHaloText);
  }
}

function drawSubcktCustomSymbol(g, el, createEl, isHl, stroke, sw, drawHaloText) {
  const { x, y, w, h, name, model, symbolShape } = el;
  const hw = w / 2, hh = h / 2;

  if (symbolShape === "opamp") {
    const polyPts = `${x - hw + 10},${y - hh + 8} ${x + hw - 10},${y} ${x - hw + 10},${y + hh - 8}`;
    g.appendChild(createEl("polygon", { points: polyPts, fill: isHl ? "#fef9c3" : "#eff6ff", stroke: isHl ? "#b45309" : "#1e3a8a", "stroke-width": sw }));
    g.appendChild(createEl("text", { x: x - hw + 16, y: y - 16, fill: "#1e3a8a", "font-size": "13", "font-weight": "bold" }, "+"));
    g.appendChild(createEl("text", { x: x - hw + 17, y: y + 24, fill: "#dc2626", "font-size": "14", "font-weight": "bold" }, "-"));
    if (viewVisibility.instNames) drawHaloText(x, y - hh - 4, `${name} (${model})`, "#1e3a8a", "11", true, "middle");
  } else if (symbolShape === "inv") {
    const polyPts = `${x - hw + 12},${y - 22} ${x + hw - 18},${y} ${x - hw + 12},${y + 22}`;
    g.appendChild(createEl("polygon", { points: polyPts, fill: "#f0fdf4", stroke: "#15803d", "stroke-width": sw }));
    g.appendChild(createEl("circle", { cx: x + hw - 13, cy: y, r: 4.5, fill: "#ffffff", stroke: "#15803d", "stroke-width": sw }));
    if (viewVisibility.instNames) drawHaloText(x, y - 28, name, "#15803d", "11", true, "middle");
  } else if (symbolShape === "nand" || symbolShape === "and") {
    const d = `M ${x - hw + 12} ${y - 24} L ${x} ${y - 24} A 24 24 0 0 1 ${x} ${y + 24} L ${x - hw + 12} ${y + 24} Z`;
    g.appendChild(createEl("path", { d, fill: "#f0fdf4", stroke: "#15803d", "stroke-width": sw }));
    if (symbolShape === "nand") {
      g.appendChild(createEl("circle", { cx: x + 29, cy: y, r: 4.5, fill: "#ffffff", stroke: "#15803d", "stroke-width": sw }));
    }
    if (viewVisibility.instNames) drawHaloText(x, y - 30, name, "#15803d", "11", true, "middle");
  } else {
    g.appendChild(createEl("rect", {
      x: x - hw, y: y - hh, width: w, height: h, rx: 4,
      fill: isHl ? "#fef9c3" : "#f1f5f9", stroke: isHl ? "#b45309" : "#0f172a", "stroke-width": sw
    }));
    g.appendChild(createEl("rect", { x: x - hw, y: y - hh, width: w, height: 22, rx: 3, fill: isHl ? "#d97706" : "#1e3a8a" }));
    const titleStr = viewVisibility.instNames ? `${name} (${model})` : `(${model})`;
    g.appendChild(createEl("text", { x: x, y: y - hh + 15, "text-anchor": "middle", fill: "#ffffff", "font-size": "11", "font-weight": "bold" }, titleStr));
    g.appendChild(createEl("text", { x: x, y: y + hh - 6, "text-anchor": "middle", fill: "#64748b", "font-size": "9.5" }, currentLang === "en" ? "Double-click for equiv." : "双击查看等效电路"));
  }

  el.pins.forEach(p => {
    if (p.dir === "left") {
      const targetX = x - hw + (["opamp", "inv", "nand", "and", "or", "nor"].includes(symbolShape) ? 12 : 0);
      g.appendChild(createEl("line", { x1: p.x, y1: p.y, x2: targetX, y2: p.y, stroke, "stroke-width": 1.8 }));
      if (symbolShape === "box") g.appendChild(createEl("text", { x: x - hw + 6, y: p.y + 4, fill: "#334155", "font-size": "10.5" }, p.name));
    } else if (p.dir === "right") {
      let startX = x + hw;
      if (symbolShape === "opamp") startX = x + hw - 10;
      else if (symbolShape === "nand" || symbolShape === "nor") startX = x + 33.5;
      else if (symbolShape === "and" || symbolShape === "or") startX = x + 24;
      else if (symbolShape === "inv") startX = x + hw - 8.5;
      g.appendChild(createEl("line", { x1: startX, y1: p.y, x2: p.x, y2: p.y, stroke, "stroke-width": 1.8 }));
      if (symbolShape === "box") g.appendChild(createEl("text", { x: x + hw - 6, y: p.y + 4, "text-anchor": "end", fill: "#334155", "font-size": "10.5" }, p.name));
    } else if (p.dir === "top") {
      let bodyY = y - hh;
      if (symbolShape === "opamp") bodyY = y - 21;
      else if (symbolShape === "inv") bodyY = y - 10;
      else if (["nand", "nor", "and", "or"].includes(symbolShape)) bodyY = y - 24;
      g.appendChild(createEl("line", { x1: p.x, y1: p.y, x2: p.x, y2: bodyY, stroke, "stroke-width": 1.8 }));
    } else if (p.dir === "bottom") {
      let bodyY = y + hh;
      if (symbolShape === "opamp") bodyY = y + 21;
      else if (symbolShape === "inv") bodyY = y + 10;
      else if (["nand", "nor", "and", "or"].includes(symbolShape)) bodyY = y + 24;
      g.appendChild(createEl("line", { x1: p.x, y1: bodyY, x2: p.x, y2: p.y, stroke, "stroke-width": 1.8 }));
    }
  });
}

function drawNetSymbol(g, sym, createEl) {
  const { type, net, x, y, drawX, drawY, dir } = sym;
  const px = drawX ?? x;
  const py = drawY ?? y;
  const color = "#0f52ba";

  if (px !== x || py !== y) {
    g.appendChild(createEl("polyline", {
      points: `${x},${y} ${px},${y} ${px},${py}`,
      fill: "none", stroke: color, "stroke-width": 1.5, "stroke-dasharray": "3,2"
    }));
  }

  if (type === "vdd_dot") {
    g.appendChild(createEl("circle", { cx: px, cy: py, r: 4.5, fill: "#ffffff", stroke: "#dc2626", "stroke-width": 2 }));
  } else if (type === "gnd_dot") {
    g.appendChild(createEl("circle", { cx: px, cy: py, r: 4.5, fill: "#0f172a", stroke: "#0f172a", "stroke-width": 1.5 }));
  } else if (type === "neg_dot") {
    g.appendChild(createEl("circle", { cx: px, cy: py, r: 4.5, fill: "#ffffff", stroke: "#0f172a", "stroke-width": 2 }));
  } else if (type === "port") {
    const isLeft = dir === "left";
    const isTop = dir === "top";
    const isBot = dir === "bottom";
    if (isTop) {
      g.appendChild(createEl("line", { x1: px, y1: py, x2: px, y2: py - 14, stroke: "#0284c7", "stroke-width": 1.8 }));
      g.appendChild(createEl("rect", { x: px - 24, y: py - 30, width: 48, height: 16, rx: 3, fill: "#e0f2fe", stroke: "#0284c7", "stroke-width": 1.2 }));
      g.appendChild(createEl("text", { x: px, y: py - 18, "text-anchor": "middle", fill: "#0369a1", "font-size": "10.5", "font-weight": "bold" }, net));
    } else if (isBot) {
      g.appendChild(createEl("line", { x1: px, y1: py, x2: px, y2: py + 14, stroke: "#0284c7", "stroke-width": 1.8 }));
      g.appendChild(createEl("rect", { x: px - 24, y: py + 14, width: 48, height: 16, rx: 3, fill: "#e0f2fe", stroke: "#0284c7", "stroke-width": 1.2 }));
      g.appendChild(createEl("text", { x: px, y: py + 26, "text-anchor": "middle", fill: "#0369a1", "font-size": "10.5", "font-weight": "bold" }, net));
    } else {
      const dx = isLeft ? -14 : 14;
      const boxW = Math.max(38, net.length * 7 + 12);
      const boxX = isLeft ? px + dx - boxW : px + dx;
      g.appendChild(createEl("line", { x1: px, y1: py, x2: px + dx, y2: py, stroke: "#0284c7", "stroke-width": 1.8 }));
      g.appendChild(createEl("rect", { x: boxX, y: py - 9, width: boxW, height: 18, rx: 3, fill: "#e0f2fe", stroke: "#0284c7", "stroke-width": 1.2 }));
      g.appendChild(createEl("text", { x: boxX + boxW / 2, y: py + 4, "text-anchor": "middle", fill: "#0369a1", "font-size": "10.5", "font-weight": "bold" }, net));
    }
  }
}

/* ============================================================================
 * 10. 双击 SPICE 器件/子电路等效电路图形化进入
 * ============================================================================ */
function openEquivalentCircuitForDevice(el) {
  const f = getActiveFile();
  const pdk = getActivePdk();
  if (!f) return;

  if (f.parsedDesign && f.parsedDesign.subckts[el.model]) {
    enterSubcktHierarchy(el.model, `${el.name} (${el.model})`);
    return;
  }

  const equivCode = (pdk.equivSubckts && pdk.equivSubckts[el.model]) || BUILTIN_TSMC_PDK.equivSubckts[el.model];
  if (equivCode) {
    const parsedEquiv = parseSpectreNetlist(equivCode);
    const subObj = parsedEquiv.subckts[el.model];
    if (subObj) {
      f.parsedDesign.subckts[el.model] = subObj;
      enterSubcktHierarchy(el.model, `${el.name} 内部等效电路 (${el.model})`);
      return;
    }
  }

  const spiceModelDef = f.parsedDesign && f.parsedDesign.spiceModels ? f.parsedDesign.spiceModels[el.model] : null;
  if (spiceModelDef) {
    const eqCode = buildSpiceModelEquivSubckt(el.model, spiceModelDef.modelType, spiceModelDef.params);
    if (eqCode) {
      const parsedEquiv = parseSpectreNetlist(eqCode);
      f.parsedDesign.subckts[el.model] = parsedEquiv.subckts[el.model];
      enterSubcktHierarchy(el.model, `${el.name} (${el.model}) SPICE模型等效电路`);
      return;
    }
  }

  if (el.type === "npn" || el.type === "pnp") {
    const eqSubName = `${el.model}_equiv`;
    const eqCode = buildSpiceModelEquivSubckt(eqSubName, el.type.toUpperCase(), el.params);
    if (eqCode) {
      const parsedEquiv = parseSpectreNetlist(eqCode);
      f.parsedDesign.subckts[eqSubName] = parsedEquiv.subckts[eqSubName];
      enterSubcktHierarchy(eqSubName, `${el.name} 教学等效电路`);
      return;
    }
  }

  if (el.type === "nmos" || el.type === "pmos") {
    const chType = el.type === "nmos" ? "nch" : "pch";
    const equivSubName = `${el.model}_equiv`;
    const equivSpice = `subckt ${equivSubName} ( d g s b )\nrg ( g gi ) resistor r=5\ncgs ( gi s ) capacitor c=15f\ncgd ( gi d ) capacitor c=5f\ncdb ( d b ) capacitor c=8f\ncsb ( s b ) capacitor c=8f\nm_core ( d gi s b ) ${chType} w=${el.params.w || "10u"} l=${el.params.l || "1u"}\nends ${equivSubName}`;
    const parsedEquiv = parseSpectreNetlist(equivSpice);
    f.parsedDesign.subckts[equivSubName] = parsedEquiv.subckts[equivSubName];
    enterSubcktHierarchy(equivSubName, `${el.name} 教学等效电路`);
  }
}

function enterSubcktHierarchy(subcktName, instLabel) {
  const f = getActiveFile();
  if (!f) return;
  if (!f.hierarchyStack) f.hierarchyStack = [f.activeSubckt];
  f.hierarchyStack.push(subcktName);
  switchSubckt(subcktName, false);
  document.getElementById("mode-tip").textContent = `已进入 ${instLabel} 内部等效原理图（点击左上角面包屑可返回上级）`;
}

function switchSubckt(subcktName, resetStack = true) {
  const f = getActiveFile();
  if (!f || !f.parsedDesign || !f.parsedDesign.subckts[subcktName]) return;
  f.activeSubckt = subcktName;
  if (resetStack) f.hierarchyStack = [subcktName];
  selectedDeviceNames.clear();
  checkedDeviceNames.clear();
  highlightedLines.clear();
  pendingWirePin = null;
  document.getElementById("check-banner").style.display = "none";

  if (!f.layoutsBySubckt[subcktName]) {
    f.layoutsBySubckt[subcktName] = layoutSubckt(f.parsedDesign.subckts[subcktName]);
  }
  updateBreadcrumbs();
  rerenderOnly();
  resetZoom();
}

let layerQuickMenuOpen = false;

function toggleLayerQuickMenu(ev) {
  if (ev) ev.stopPropagation();
  layerQuickMenuOpen = !layerQuickMenuOpen;
  renderLayerQuickMenu();
}

function closeLayerQuickMenu() {
  if (!layerQuickMenuOpen) return;
  layerQuickMenuOpen = false;
  const menu = document.getElementById("layer-quick-menu");
  if (menu) menu.classList.remove("open");
}

function renderLayerQuickMenu() {
  const menu = document.getElementById("layer-quick-menu");
  if (!menu) return;
  if (!layerQuickMenuOpen) {
    menu.classList.remove("open");
    return;
  }
  const f = getActiveFile();
  let html = `<div class="lq-section-title">电路层级切换</div>`;
  if (f && f.parsedDesign) {
    Object.keys(f.parsedDesign.subckts).forEach(k => {
      const sub = f.parsedDesign.subckts[k];
      if (sub.elements.length === 0) return;
      const isCur = f.activeSubckt === k;
      const label = k === "__TOP__" ? "Top-Level" : k;
      html += `<div class="lq-item" onclick="switchSubckt(${escapeHtml(JSON.stringify(k))}, true); closeLayerQuickMenu(); event.stopPropagation();">
        <span><i class="lq-check">${isCur ? "✓" : ""}</i>${escapeHtml(label)}</span>
        <span style="color:#64748b;font-size:11px;">${sub.elements.length} 器件</span>
      </div>`;
    });
  }
  html += `<div class="lq-sep"></div><div class="lq-section-title">显示图层</div>`;
  const layers = [
    ["powerLabels", "电源标签"],
    ["portLabels", "端口标签"],
    ["instNames", "元件名"],
    ["instParams", "元件参数"],
    ["floatingIsland", "悬浮移动岛"]
  ];
  layers.forEach(([key, label]) => {
    const fn = key === "floatingIsland" ? "toggleFloatingIsland(event)" : `toggleLayer('${key}', event)`;
    html += `<div class="lq-item" onclick="${fn}; renderLayerQuickMenu();">
      <span><i class="lq-check">${viewVisibility[key] ? "✓" : ""}</i>${escapeHtml(label)}</span>
    </div>`;
  });
  menu.innerHTML = html;
  menu.classList.add("open");
}

function updateBreadcrumbs() {
  const bar = document.getElementById("breadcrumb-bar");
  const f = getActiveFile();
  if (!f || !f.parsedDesign) { bar.innerHTML = ""; return; }
  const stack = f.hierarchyStack && f.hierarchyStack.length ? f.hierarchyStack : [f.activeSubckt];
  const crumbsHtml = stack.map((subKey, idx) => {
    const label = subKey === "__TOP__" ? "Top-Level" : subKey;
    if (idx === stack.length - 1) return `<b>${escapeHtml(label)}</b>`;
    return `<span class="crumb-link" onclick="jumpBreadcrumb(${idx})">${escapeHtml(label)}</span> <span>/</span>`;
  }).join(" ");
  bar.innerHTML = `<button type="button" class="layer-trigger" onclick="toggleLayerQuickMenu(event)" title="点击快速切换电路层级与显示图层">${currentLang === "en" ? "Layers ▾" : "图层 ▾"}</button> ${crumbsHtml} <div id="layer-quick-menu" onclick="event.stopPropagation()"></div>`;
  if (layerQuickMenuOpen) renderLayerQuickMenu();
}

function jumpBreadcrumb(idx) {
  const f = getActiveFile();
  if (!f || !f.hierarchyStack) return;
  f.hierarchyStack = f.hierarchyStack.slice(0, idx + 1);
  switchSubckt(f.hierarchyStack[idx], false);
}

/* ============================================================================
 * 11. 器件参数即时调节、连接线检查反馈、代码行精确对齐高亮
 * ============================================================================ */
function updateFuncCard(layout) {
  const card = document.getElementById("func-card");
  const activeName = Array.from(selectedDeviceNames)[0] || Array.from(checkedDeviceNames)[0] || null;
  if (!activeName) { card.style.display = "none"; return; }
  const el = layout.elements.find(e => e.name === activeName);
  if (!el) { card.style.display = "none"; return; }

  card.style.display = "block";
  document.getElementById("func-badge").textContent = `${el.type.toUpperCase()} · ${el.model}`;
  document.getElementById("func-title").textContent = selectedDeviceNames.size > 1
    ? `已选中 ${selectedDeviceNames.size} 个器件 (主选: ${el.name})`
    : `${el.name} (${el.model})`;
  document.getElementById("func-desc").textContent = "可直接修改下方元件参数并实时更新原理图与源码（双击器件可查看内部等效电路）：";

  const paramBox = document.getElementById("func-param-editor");
  paramBox.innerHTML = "";
  const entries = Object.entries(el.params);
  if (entries.length === 0) {
    paramBox.innerHTML = `<span style="color:#64748b;font-size:11px;">该模块无独立数值参数</span>`;
  } else {
    entries.forEach(([k, v]) => {
      const row = document.createElement("div");
      row.className = "param-edit-row";
      row.innerHTML = `<b>${escapeHtml(k)} =</b>`;
      const inp = document.createElement("input");
      inp.value = v;
      inp.onchange = () => {
        pushUndoSnapshot();
        el.params[k] = inp.value.trim();
        syncElementParamsToCode(el);
        rerenderOnly();
      };
      row.appendChild(inp);
      paramBox.appendChild(row);
    });
  }

  document.getElementById("func-pins").textContent = "引脚: " + el.pins.map(p => `${p.name}=${p.net}`).join(", ");
}

function syncElementParamsToCode() { syncLayoutToActiveNetlist(); }

function inspectSubcktConnectivity(subKey, layout, subDef) {
  const errs = [];
  const warns = [];
  const errDevs = new Set();
  const errPins = new Set();
  const errLines = new Set();
  const warnDevs = new Set();
  const warnPins = new Set();
  const warnLines = new Set();
  const netCounts = {};

  if (!layout || !layout.elements || layout.elements.length === 0) {
    return { subKey, errs, warns, errDevs, errPins, errLines, warnDevs, warnPins, warnLines, netCounts };
  }

  layout.elements.forEach(el => {
    el.pins.forEach(p => {
      if (!p.net || /^NC$/i.test(p.net)) {
        errs.push(`器件 ${el.name} 的引脚 ${p.name} 悬空未连接（无标签）。`);
        errDevs.add(el.name);
        errPins.add(`${el.name}.${p.name}`);
        if (el.line) errLines.add(el.line);
      } else {
        netCounts[p.net] = (netCounts[p.net] || 0) + 1;
      }
    });
  });

  const externalPorts = new Set(subDef && subDef.ports ? subDef.ports : []);
  layout.elements.forEach(el => {
    el.pins.forEach(p => {
      if (p.net && !isHighVoltNet(p.net) && !isLowVoltNet(p.net) && !isNegVoltNet(p.net) && netCounts[p.net] === 1 && !externalPorts.has(p.net)) {
        warns.push(`单端口已标注标签 "${p.net}"（${el.name}.${p.name}），请确认是否为外部引出端。`);
        warnDevs.add(el.name);
        warnPins.add(`${el.name}.${p.name}`);
        if (el.line) warnLines.add(el.line);
      }
    });
  });

  return { subKey, errs, warns, errDevs, errPins, errLines, warnDevs, warnPins, warnLines, netCounts };
}

function runConnectivityCheck() {
  const banner = document.getElementById("check-banner");
  const f = getActiveFile();
  const layout = getCurrentLayout();
  if (!f || !f.parsedDesign || !layout || layout.elements.length === 0) {
    banner.style.display = "";
    banner.className = "err";
    banner.innerHTML = `<span class="banner-close" onclick="this.parentElement.style.display='none'">✕</span><b>连接线检查失败：</b>当前原理图中没有器件。`;
    return;
  }

  const allSubKeys = Object.keys(f.parsedDesign.subckts).filter(k => f.parsedDesign.subckts[k].elements.length > 0);
  const checkOrder = [f.activeSubckt, ...allSubKeys.filter(k => k !== f.activeSubckt)];
  let firstErrorResult = null;
  let firstWarnResult = null;

  for (const sk of checkOrder) {
    if (!f.layoutsBySubckt[sk]) {
      f.layoutsBySubckt[sk] = layoutSubckt(f.parsedDesign.subckts[sk]);
    }
    const res = inspectSubcktConnectivity(sk, f.layoutsBySubckt[sk], f.parsedDesign.subckts[sk]);
    if (!firstErrorResult && res.errs.length > 0) firstErrorResult = res;
    if (!firstWarnResult && res.warns.length > 0) firstWarnResult = res;
  }

  if (firstErrorResult) {
    if (firstErrorResult.subKey !== f.activeSubckt) switchSubckt(firstErrorResult.subKey, true);
    checkedDeviceNames = new Set([...firstErrorResult.errDevs, ...firstErrorResult.warnDevs]);
    selectedDeviceNames = new Set(firstErrorResult.errDevs);
    errorPinKeys = new Set(firstErrorResult.errPins);
    warnPinKeys = new Set(firstErrorResult.warnPins);
    highlightedLines = new Set([...firstErrorResult.errLines, ...firstErrorResult.warnLines]);
    refreshEditorGutter();
    rerenderOnly();

    const layerLabel = firstErrorResult.subKey === "__TOP__" ? "Top-Level" : firstErrorResult.subKey;
    const warnHtml = firstErrorResult.warns.length ? `<div style="margin-top:6px;color:#b45309;"><b>⚠ 警告 (${firstErrorResult.warns.length})：</b><ul>${firstErrorResult.warns.map(w => `<li>${escapeHtml(w)}</li>`).join("")}</ul></div>` : "";
    banner.style.display = "";
    banner.className = "err";
    banner.innerHTML = `<span class="banner-close" onclick="this.parentElement.style.display='none'">✕</span><b>✘ [${escapeHtml(layerLabel)}] 发现 ${firstErrorResult.errs.length} 处连接线错误：</b><ul>${firstErrorResult.errs.map(e => `<li>${escapeHtml(e)}</li>`).join("")}</ul>${warnHtml}`;
    document.getElementById("mode-tip").textContent = `✘ 已跳转至报错图层 [${layerLabel}] 并高亮 ${firstErrorResult.errs.length} 处错误`;
    return;
  }

  if (firstWarnResult) {
    if (firstWarnResult.subKey !== f.activeSubckt) switchSubckt(firstWarnResult.subKey, true);
    checkedDeviceNames = new Set(firstWarnResult.warnDevs);
    selectedDeviceNames = new Set(firstWarnResult.warnDevs);
    errorPinKeys.clear();
    warnPinKeys = new Set(firstWarnResult.warnPins);
    highlightedLines = new Set(firstWarnResult.warnLines);
    refreshEditorGutter();
    rerenderOnly();

    const layerLabel = firstWarnResult.subKey === "__TOP__" ? "Top-Level" : firstWarnResult.subKey;
    banner.style.display = "";
    banner.className = "warn";
    banner.innerHTML = `<span class="banner-close" onclick="this.parentElement.style.display='none'">✕</span><b>⚠ [${escapeHtml(layerLabel)}] 发现 ${firstWarnResult.warns.length} 处单端标签警告（无断路错误）：</b><ul>${firstWarnResult.warns.map(w => `<li>${escapeHtml(w)}</li>`).join("")}</ul>`;
    document.getElementById("mode-tip").textContent = `⚠ [${layerLabel}] 存在 ${firstWarnResult.warns.length} 处单端口标签警告`;
    return;
  }

  checkedDeviceNames.clear();
  errorPinKeys.clear();
  warnPinKeys.clear();
  rerenderOnly();
  const curNets = Object.keys(inspectSubcktConnectivity(f.activeSubckt, layout, f.parsedDesign.subckts[f.activeSubckt]).netCounts).length;
  banner.style.display = "";
  banner.className = "ok";
  banner.innerHTML = `<span class="banner-close" onclick="this.parentElement.style.display='none'">✕</span><b>✔ 连接线检查通过：</b>共检查 ${allSubKeys.length} 个电路层级（当前 ${layout.elements.length} 个器件、${curNets} 个网络），所有连线完整有效。`;
  document.getElementById("mode-tip").textContent = "✔ 所有层级连接线检查通过";
}

function refreshEditorGutter() {
  const ta = document.getElementById("netlist-input");
  const gutter = document.getElementById("gutter-col");
  const overlay = document.getElementById("line-highlight-overlay");
  const lines = ta.value.split(/\r?\n/);

  gutter.innerHTML = "";
  overlay.innerHTML = "";

  const curSubKey = getActiveFile()?.activeSubckt || "__TOP__";
  const totalHighlighted = new Set([...highlightedLines]);
  realDeviceLineMap.forEach((info, lNo) => {
    const dName = typeof info === "string" ? info : info.name;
    const dSub = typeof info === "string" ? curSubKey : info.subckt;
    if (dSub === curSubKey && checkedDeviceNames.has(dName)) totalHighlighted.add(lNo);
  });

  const multiBar = document.getElementById("multi-hl-bar");
  if (totalHighlighted.size > 1) {
    multiBar.style.display = "flex";
    document.getElementById("multi-hl-count").textContent = `已高亮 ${totalHighlighted.size} 行器件代码`;
  } else {
    multiBar.style.display = "none";
  }

  lines.forEach((txt, idx) => {
    const lineNo = idx + 1;
    const isActiveLine = totalHighlighted.has(lineNo);
    const devInfo = realDeviceLineMap.get(lineNo);
    const devName = devInfo ? (typeof devInfo === "string" ? devInfo : devInfo.name) : null;
    const devSub = devInfo ? (typeof devInfo === "string" ? curSubKey : devInfo.subckt) : null;

    const row = document.createElement("div");
    row.className = "gutter-row" + (isActiveLine ? " active-line" : "");

    if (devName) {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = (devSub === curSubKey && checkedDeviceNames.has(devName)) || highlightedLines.has(lineNo);
      cb.addEventListener("change", () => {
        if (cb.checked) {
          if (devSub && devSub !== getActiveFile()?.activeSubckt) {
            switchSubckt(devSub, true);
          }
          checkedDeviceNames.add(devName);
          selectedDeviceNames.add(devName);
          highlightedLines.add(lineNo);
        } else {
          checkedDeviceNames.delete(devName);
          selectedDeviceNames.delete(devName);
          highlightedLines.delete(lineNo);
        }
        refreshEditorGutter();
        rerenderOnly();
      });
      row.appendChild(cb);
    } else {
      const sp = document.createElement("span");
      sp.className = "gutter-spacer";
      row.appendChild(sp);
    }

    const numSpan = document.createElement("span");
    numSpan.className = "gutter-num";
    numSpan.textContent = lineNo;
    numSpan.onclick = () => {
      if (highlightedLines.has(lineNo)) highlightedLines.delete(lineNo);
      else highlightedLines.add(lineNo);
      refreshEditorGutter();
    };
    row.appendChild(numSpan);
    gutter.appendChild(row);

    const hlDiv = document.createElement("div");
    hlDiv.className = "hl-line-row" + (isActiveLine ? " active" : "");
    overlay.appendChild(hlDiv);
  });

  const syn = document.getElementById("syntax-overlay");
  if (syn) {
    syn.innerHTML = lines.map(l => highlightSpectreLine(l)).join("\n");
  }

  syncEditorScroll();
}

function highlightSpectreLine(rawLine) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const trimmed = rawLine.trim();
  if (!trimmed) return "";
  if (/^(\/\/|\*)/.test(trimmed)) return `<span class="tok-comment">${esc(rawLine)}</span>`;

  // Split trailing comment (// or ;)
  let codePart = rawLine;
  let commentPart = "";
  const cmMatch = rawLine.match(/(\/\/.*|;.*)$/);
  if (cmMatch) {
    const idx = cmMatch.index;
    codePart = rawLine.slice(0, idx);
    commentPart = `<span class="tok-comment">${esc(cmMatch[0])}</span>`;
  }

  // Keywords: subckt / inline / ends / simulator / include / .MODEL / .SUBCKT / .ENDS
  if (/^\s*(inline\s+subckt|subckt|ends|simulator|include|\.(model|subckt|ends))/i.test(codePart)) {
    const formatted = esc(codePart)
      .replace(/(inline|subckt|ends|simulator|include)/gi, '<span class="tok-kw">$1</span>')
      .replace(/(\.(?:model|subckt|ends))/gi, '<span class="tok-dot">$1</span>')
      .replace(/([a-zA-Z_][\w.]*)=([^\s)]+)/g, '<span class="tok-param-k">$1</span>=<span class="tok-param-v">$2</span>');
    return formatted + commentPart;
  }

  // Instance line: Inst (nodes) model params...
  const instM = codePart.match(/^(\s*)(\S+)(\s*\([^)]*\))(\s+\S+)(.*)$/);
  if (instM) {
    const [, lead, inst, nodes, model, rest] = instM;
    const fmtRest = esc(rest).replace(/([a-zA-Z_][\w.]*)=([^\s]+)/g, '<span class="tok-param-k">$1</span>=<span class="tok-param-v">$2</span>');
    return `${esc(lead)}<span class="tok-inst">${esc(inst)}</span><span class="tok-nodes">${esc(nodes)}</span><span class="tok-model">${esc(model)}</span>${fmtRest}${commentPart}`;
  }

  // Fallback param highlighting
  const fmt = esc(codePart).replace(/([a-zA-Z_][\w.]*)=([^\s)]+)/g, '<span class="tok-param-k">$1</span>=<span class="tok-param-v">$2</span>');
  return fmt + commentPart;
}

function syncEditorScroll() {
  const ta = document.getElementById("netlist-input");
  document.getElementById("gutter-col").scrollTop = ta.scrollTop;
  const hl = document.getElementById("line-highlight-overlay");
  hl.scrollTop = ta.scrollTop;
  hl.scrollLeft = ta.scrollLeft;
  const syn = document.getElementById("syntax-overlay");
  if (syn) {
    syn.scrollTop = ta.scrollTop;
    syn.scrollLeft = ta.scrollLeft;
  }
}

function clearAllHighlights() {
  highlightedLines.clear();
  checkedDeviceNames.clear();
  selectedDeviceNames.clear();
  errorPinKeys.clear();
  refreshEditorGutter();
  rerenderOnly();
}

/* ============================================================================
 * 12. 画布交互（空白处点击取消代码与元件高亮、框选、缩放、平移）
 * ============================================================================ */
let transform = { x: 20, y: 20, k: 1 };
let isPanning = false;
let isMarqueeSelecting = false;
let panStart = { x: 0, y: 0 };
let spacePressed = false;

function clientToSvg(cx, cy) {
  const rect = document.getElementById("canvas-body").getBoundingClientRect();
  return { x: (cx - rect.left - transform.x) / transform.k, y: (cy - rect.top - transform.y) / transform.k };
}

function updateViewportTransform() {
  document.getElementById("viewport").setAttribute("transform", `translate(${transform.x}, ${transform.y}) scale(${transform.k})`);
}

const canvasBody = document.getElementById("canvas-body");
canvasBody.addEventListener("wheel", (e) => {
  e.preventDefault();
  const rect = canvasBody.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const factor = e.deltaY < 0 ? 1.12 : 0.89;
  const nextK = Math.min(4.0, Math.max(0.2, transform.k * factor));
  transform.x = mx - (mx - transform.x) * (nextK / transform.k);
  transform.y = my - (my - transform.y) * (nextK / transform.k);
  transform.k = nextK;
  updateViewportTransform();
}, { passive: false });

canvasBody.addEventListener("contextmenu", (e) => {
  if (placingTool) {
    e.preventDefault();
    cancelInteractivePlace();
  }
});

canvasBody.addEventListener("mousedown", () => {
  if (document.activeElement && ["TEXTAREA", "INPUT", "SELECT"].includes(document.activeElement.tagName)) {
    document.activeElement.blur();
  }
  canvasBody.focus({ preventScroll: true });
}, true);

canvasBody.addEventListener("mousedown", (e) => {
  if (e.button === 2 && placingTool) {
    e.preventDefault();
    cancelInteractivePlace();
    return;
  }
  if (e.button === 1 || (e.button === 0 && spacePressed)) {
    e.preventDefault();
    isPanning = true;
    panStart = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    return;
  }
  if (e.button === 0 && placingTool) {
    e.preventDefault();
    e.stopPropagation();
    const pt = clientToSvg(e.clientX, e.clientY);
    placeElementAtCursor(snap(pt.x), snap(pt.y));
    return;
  }
  if (e.button === 0) {
    if (!e.ctrlKey && !e.metaKey) {
      selectedDeviceNames.clear();
      selectedWireIndices.clear();
      highlightedLines.clear();
      refreshEditorGutter();
    }
    isMarqueeSelecting = true;
    const pt = clientToSvg(e.clientX, e.clientY);
    marqueeRect = { x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y };
    rerenderOnly();
  }
});

window.addEventListener("mousemove", (e) => {
  const layout = getCurrentLayout();
  if (placingTool && !isPanning && e.target && canvasBody.contains(e.target)) {
    const pt = clientToSvg(e.clientX, e.clientY);
    const sx = snap(pt.x), sy = snap(pt.y);
    if (placingTool.mouseX !== sx || placingTool.mouseY !== sy) {
      placingTool.mouseX = sx;
      placingTool.mouseY = sy;
      renderPlaceGhost();
    }
  }
  if (draggingTarget && layout) {
    const pt = clientToSvg(e.clientX, e.clientY);
    const dx = pt.x - draggingTarget.startSvg.x;
    const dy = pt.y - draggingTarget.startSvg.y;
    if (draggingTarget.kind === "multi_el") {
      const sdx = snap(dx), sdy = snap(dy);
      let changed = false;
      draggingTarget.items.forEach(item => {
        const nx = item.origX + sdx, ny = item.origY + sdy;
        if (nx !== item.el.x || ny !== item.el.y) {
          item.el.x = nx; item.el.y = ny; computePinPositions(item.el); changed = true;
        }
      });
      if (changed) { didMoveDuringDrag = true; rerenderOnly(); }
    } else if (draggingTarget.kind === "sym") {
      layout.symbolOffsets[draggingTarget.symId] = { dx: snap(draggingTarget.orig.dx + dx), dy: snap(draggingTarget.orig.dy + dy) };
      didMoveDuringDrag = true;
      rerenderOnly();
    } else if (draggingTarget.kind === "wire") {
      layout.wireOffsets[draggingTarget.wIdx] = { dx: snap(draggingTarget.orig.dx + dx), dy: snap(draggingTarget.orig.dy + dy) };
      didMoveDuringDrag = true;
      rerenderOnly();
    }
    return;
  }

  if (isMarqueeSelecting && marqueeRect && layout) {
    const pt = clientToSvg(e.clientX, e.clientY);
    marqueeRect.x2 = pt.x; marqueeRect.y2 = pt.y;
    const minX = Math.min(marqueeRect.x1, marqueeRect.x2), maxX = Math.max(marqueeRect.x1, marqueeRect.x2);
    const minY = Math.min(marqueeRect.y1, marqueeRect.y2), maxY = Math.max(marqueeRect.y1, marqueeRect.y2);
    layout.elements.forEach(el => {
      if (el.x >= minX && el.x <= maxX && el.y >= minY && el.y <= maxY) {
        selectedDeviceNames.add(el.name);
        if (el.line) highlightedLines.add(el.line);
      }
    });
    refreshEditorGutter();
    rerenderOnly();
    return;
  }

  if (isPanning) {
    transform.x = e.clientX - panStart.x;
    transform.y = e.clientY - panStart.y;
    updateViewportTransform();
  }
});


// 触摸屏适配（手机 / 平板单指平移/放置，双指捏合缩放）
let _touchPanStart = null;
let _touchPinchDist = null;
canvasBody.addEventListener("touchstart", (e) => {
  if (e.touches.length === 1) {
    const t = e.touches[0];
    if (placingTool) {
      const pt = clientToSvg(t.clientX, t.clientY);
      placeElementAtCursor(snap(pt.x), snap(pt.y));
      e.preventDefault();
      return;
    }
    _touchPanStart = { x: t.clientX - transform.x, y: t.clientY - transform.y };
  } else if (e.touches.length === 2) {
    _touchPanStart = null;
    _touchPinchDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
  }
}, { passive: false });

canvasBody.addEventListener("touchmove", (e) => {
  if (e.touches.length === 1 && _touchPanStart) {
    e.preventDefault();
    transform.x = e.touches[0].clientX - _touchPanStart.x;
    transform.y = e.touches[0].clientY - _touchPanStart.y;
    updateViewportTransform();
  } else if (e.touches.length === 2 && _touchPinchDist) {
    e.preventDefault();
    const d = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const rect = canvasBody.getBoundingClientRect();
    const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
    const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
    const nextK = Math.min(4.0, Math.max(0.2, transform.k * (d / _touchPinchDist)));
    transform.x = mx - (mx - transform.x) * (nextK / transform.k);
    transform.y = my - (my - transform.y) * (nextK / transform.k);
    transform.k = nextK;
    _touchPinchDist = d;
    updateViewportTransform();
  }
}, { passive: false });

canvasBody.addEventListener("touchend", () => {
  _touchPanStart = null;
  _touchPinchDist = null;
});

window.addEventListener("mouseup", () => {
  if (draggingTarget && !didMoveDuringDrag) getActiveFile()?.undoStack.pop();
  draggingTarget = null;
  isPanning = false;
  if (isMarqueeSelecting) {
    isMarqueeSelecting = false;
    marqueeRect = null;
    rerenderOnly();
  }
});

function resetZoom() {
  const layout = getCurrentLayout();
  const svg = document.getElementById("schematic-svg");
  if (!layout) return;
  const scale = Math.min((svg.clientWidth - 30) / layout.width, (svg.clientHeight - 30) / layout.height, 1.35);
  transform = { x: (svg.clientWidth - layout.width * scale) / 2, y: (svg.clientHeight - layout.height * scale) / 2, k: scale };
  updateViewportTransform();
}

/* ============================================================================
 * 13. 文件树、多开标签、撤销/重做、快捷键、初始化
 * ============================================================================ */
let customFolders = new Set();
let pendingNewProjMode = "file";

function openNewProjectItemModal(mode, baseFolder = "") {
  pendingNewProjMode = mode;
  const titleEl = document.getElementById("new-proj-modal-title");
  const lblEl = document.getElementById("new-proj-path-label");
  const inp = document.getElementById("new-proj-path-input");
  if (mode === "folder") {
    titleEl.textContent = currentLang === "en" ? "📁 New Project Folder" : "📁 新建工程文件夹";
    lblEl.textContent = currentLang === "en" ? "Folder Path (e.g. Digital_HDL/TestBench)" : "文件夹路径 (例如: Digital_HDL/TestBench)";
    inp.value = baseFolder ? `${baseFolder}/New_Folder` : `Project_${customFolders.size + 1}`;
  } else {
    titleEl.textContent = currentLang === "en" ? "📄 New Project File" : "📄 新建工程文件";
    lblEl.textContent = currentLang === "en" ? "File Path (.scs / .v / .vhd)" : "文件路径 (支持 .scs / .v / .vhd)";
    const idx = workspaceFiles.length + 1;
    inp.value = baseFolder ? `${baseFolder}/circuit_${idx}.scs` : `User_Designs/circuit_${idx}.scs`;
  }
  document.getElementById("new-proj-item-modal").style.display = "flex";
  setTimeout(() => inp.focus(), 40);
}

function confirmNewProjectItem() {
  const rawPath = document.getElementById("new-proj-path-input").value.trim().replace(/^\/+|\/+$/g, "");
  if (!rawPath) return;
  if (pendingNewProjMode === "folder") {
    const parts = rawPath.split("/");
    for (let i = 1; i <= parts.length; i++) {
      const fp = parts.slice(0, i).join("/");
      customFolders.add(fp);
      expandedFolders.add(fp);
    }
    closeModal("new-proj-item-modal");
    renderFileTree();
    return;
  }
  const parts = rawPath.split("/");
  const fileName = parts[parts.length - 1];
  for (let i = 1; i < parts.length; i++) expandedFolders.add(parts.slice(0, i).join("/"));
  let tmpl = `// New Spectre Netlist\nsimulator lang=spectre\n\nMP1 (out in vdd vdd) pch w=20u l=1u\nMN1 (out in 0 0) nch w=10u l=1u\n`;
  if (/\.(v|sv)$/i.test(fileName)) {
    const mName = fileName.replace(/\.[^.]+$/, "");
    tmpl = `module ${mName} (\n    input wire a,\n    input wire b,\n    output wire y\n);\n    and U1 (y, a, b);\nendmodule\n`;
  } else if (/\.(vhd|vhdl)$/i.test(fileName)) {
    const eName = fileName.replace(/\.[^.]+$/, "");
    tmpl = `entity ${eName} is\n    port (\n        a : in std_logic;\n        b : in std_logic;\n        y : out std_logic\n    );\nend ${eName};\n\narchitecture rtl of ${eName} is\nbegin\n    y <= a and b;\nend rtl;\n`;
  }
  const nf = {
    id: `file_${Date.now()}_${workspaceFiles.length + 1}`,
    path: rawPath, name: fileName, content: tmpl, dirty: true,
    parsedDesign: null, activeSubckt: "__TOP__", hierarchyStack: ["__TOP__"],
    layoutsBySubckt: {}, undoStack: [], redoStack: []
  };
  workspaceFiles.push(nf);
  closeModal("new-proj-item-modal");
  openFileInTab(nf.id);
}

function deleteWorkspaceFile(fileId, ev) {
  if (ev) ev.stopPropagation();
  if (workspaceFiles.length <= 1) {
    document.getElementById("mode-tip").textContent = currentLang === "en" ? "Cannot delete the last file" : "至少保留一个工程文件";
    return;
  }
  workspaceFiles = workspaceFiles.filter(f => f.id !== fileId);
  openTabIds = openTabIds.filter(id => id !== fileId);
  if (activeFileId === fileId) {
    activeFileId = openTabIds[0] || workspaceFiles[0].id;
    openFileInTab(activeFileId);
  } else {
    renderFileTabs();
    renderFileTree();
  }
}

function deleteWorkspaceFolder(folderPath, ev) {
  if (ev) ev.stopPropagation();
  const prefix = folderPath + "/";
  const remaining = workspaceFiles.filter(f => !f.path.startsWith(prefix));
  if (remaining.length === 0) {
    document.getElementById("mode-tip").textContent = currentLang === "en" ? "Cannot delete all files" : "不能删除全部工程文件";
    return;
  }
  workspaceFiles = remaining;
  openTabIds = openTabIds.filter(id => workspaceFiles.some(f => f.id === id));
  Array.from(customFolders).forEach(cf => { if (cf === folderPath || cf.startsWith(prefix)) customFolders.delete(cf); });
  if (!workspaceFiles.some(f => f.id === activeFileId)) {
    activeFileId = openTabIds[0] || workspaceFiles[0].id;
    openFileInTab(activeFileId);
  } else {
    renderFileTabs();
    renderFileTree();
  }
}

function saveWorkspaceFileById(fileId, ev) {
  if (ev) ev.stopPropagation();
  const f = workspaceFiles.find(x => x.id === fileId);
  if (!f) return;
  if (f.id === activeFileId) f.content = document.getElementById("netlist-input").value;
  f.dirty = false;
  renderFileTabs();
  renderFileTree();
  downloadBlob(new Blob([f.content], { type: "text/plain;charset=utf-8" }), f.name);
}

function saveWorkspaceFolder(folderPath, ev) {
  if (ev) ev.stopPropagation();
  const prefix = folderPath ? folderPath + "/" : "";
  const matched = workspaceFiles.filter(f => !folderPath || f.path.startsWith(prefix));
  const pkg = {
    folder: folderPath || "Spectre_EDA_Project",
    exportedAt: new Date().toISOString(),
    files: matched.map(f => ({
      path: f.path, name: f.name,
      content: f.id === activeFileId ? document.getElementById("netlist-input").value : f.content
    }))
  };
  matched.forEach(f => { f.dirty = false; });
  renderFileTabs();
  renderFileTree();
  const outName = (folderPath ? folderPath.replace(/\//g, "_") : "spectre_eda_project") + ".project.json";
  downloadBlob(new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json;charset=utf-8" }), outName);
}

let pendingRenameTarget = null;

function renameWorkspaceFile(fileId, ev) {
  if (ev) ev.stopPropagation();
  const f = workspaceFiles.find(x => x.id === fileId);
  if (!f) return;
  pendingRenameTarget = { kind: "file", id: fileId };
  document.getElementById("rename-modal-title").textContent = currentLang === "en" ? "✏ Rename File" : "✏ 重命名文件";
  document.getElementById("rename-item-label").textContent = currentLang === "en" ? "New File Name" : "新文件名";
  const inp = document.getElementById("rename-item-input");
  inp.value = f.name;
  document.getElementById("rename-item-modal").style.display = "flex";
  setTimeout(() => { inp.focus(); inp.select(); }, 40);
}

function renameWorkspaceFolder(folderPath, ev) {
  if (ev) ev.stopPropagation();
  pendingRenameTarget = { kind: "folder", path: folderPath };
  const parts = folderPath.split("/");
  document.getElementById("rename-modal-title").textContent = currentLang === "en" ? "✏ Rename Folder" : "✏ 重命名文件夹";
  document.getElementById("rename-item-label").textContent = currentLang === "en" ? "New Folder Name" : "新文件夹名";
  const inp = document.getElementById("rename-item-input");
  inp.value = parts[parts.length - 1];
  document.getElementById("rename-item-modal").style.display = "flex";
  setTimeout(() => { inp.focus(); inp.select(); }, 40);
}

function confirmRenameItem() {
  if (!pendingRenameTarget) return;
  const newName = document.getElementById("rename-item-input").value.trim().replace(/[\/\\]/g, "");
  if (!newName) return;

  if (pendingRenameTarget.kind === "file") {
    const f = workspaceFiles.find(x => x.id === pendingRenameTarget.id);
    if (f) {
      const idx = f.path.lastIndexOf("/");
      const dir = idx >= 0 ? f.path.slice(0, idx + 1) : "";
      f.name = newName;
      f.path = dir + newName;
      if (f.id === activeFileId) document.getElementById("editor-filename").textContent = f.path;
      showToast(`已重命名为 ${newName}`, "ok");
    }
  } else if (pendingRenameTarget.kind === "folder") {
    const oldPath = pendingRenameTarget.path;
    const idx = oldPath.lastIndexOf("/");
    const parent = idx >= 0 ? oldPath.slice(0, idx + 1) : "";
    const newPath = parent + newName;
    const oldPrefix = oldPath + "/";
    const newPrefix = newPath + "/";

    workspaceFiles.forEach(f => {
      if (f.path.startsWith(oldPrefix)) {
        f.path = newPrefix + f.path.slice(oldPrefix.length);
        if (f.id === activeFileId) document.getElementById("editor-filename").textContent = f.path;
      }
    });
    const nextCustom = new Set();
    customFolders.forEach(cf => {
      if (cf === oldPath) nextCustom.add(newPath);
      else if (cf.startsWith(oldPrefix)) nextCustom.add(newPrefix + cf.slice(oldPrefix.length));
      else nextCustom.add(cf);
    });
    customFolders = nextCustom;

    const nextExp = new Set();
    expandedFolders.forEach(ef => {
      if (ef === oldPath) nextExp.add(newPath);
      else if (ef.startsWith(oldPrefix)) nextExp.add(newPrefix + ef.slice(oldPrefix.length));
      else nextExp.add(ef);
    });
    expandedFolders = nextExp;
    showToast(`文件夹已重命名为 ${newName}`, "ok");
  }
  pendingRenameTarget = null;
  closeModal("rename-item-modal");
  renderFileTabs();
  renderFileTree();
}

function renderFileTree() {
  const container = document.getElementById("tree-container");
  container.innerHTML = "";
  const rootTree = { folders: Object.create(null), files: [] };

  const ensureFolder = (folderPath) => {
    const parts = folderPath.split("/").filter(Boolean);
    let curr = rootTree;
    for (let i = 0; i < parts.length; i++) {
      const fName = parts[i], fullPath = parts.slice(0, i + 1).join("/");
      if (!curr.folders[fName]) curr.folders[fName] = { name: fName, fullPath, folders: Object.create(null), files: [] };
      curr = curr.folders[fName];
    }
    return curr;
  };

  customFolders.forEach(fp => ensureFolder(fp));
  workspaceFiles.forEach(file => {
    const parts = file.path.split("/");
    const curr = parts.length > 1 ? ensureFolder(parts.slice(0, -1).join("/")) : rootTree;
    curr.files.push(file);
  });

  function renderNode(node, depth) {
    Object.values(node.folders).sort((a, b) => a.name.localeCompare(b.name)).forEach(folder => {
      const isExp = expandedFolders.has(folder.fullPath);
      const div = document.createElement("div");
      div.className = "tree-node";
      div.style.paddingLeft = `${10 + depth * 13}px`;
      div.innerHTML = `<span class="tree-node-label" ondblclick="renameWorkspaceFolder(${escapeHtml(JSON.stringify(folder.fullPath))}, event)"><span class="tree-arrow">${isExp ? "▾" : "▸"}</span><span>📁</span><span>${escapeHtml(folder.name)}</span></span>
        <span class="tree-node-actions">
          <button class="tree-act-btn" title="新建文件" onclick="openNewProjectItemModal('file', ${escapeHtml(JSON.stringify(folder.fullPath))})">+📄</button>
          <button class="tree-act-btn" title="重命名" onclick="renameWorkspaceFolder(${escapeHtml(JSON.stringify(folder.fullPath))}, event)">✏</button>
          <button class="tree-act-btn" title="保存文件夹" onclick="saveWorkspaceFolder(${escapeHtml(JSON.stringify(folder.fullPath))}, event)">💾</button>
          <button class="tree-act-btn del" title="删除文件夹" onclick="deleteWorkspaceFolder(${escapeHtml(JSON.stringify(folder.fullPath))}, event)">🗑</button>
        </span>`;
      div.onclick = (e) => {
        if (e.target.closest(".tree-node-actions")) return;
        if (expandedFolders.has(folder.fullPath)) expandedFolders.delete(folder.fullPath);
        else expandedFolders.add(folder.fullPath);
        renderFileTree();
      };
      container.appendChild(div);
      if (isExp) renderNode(folder, depth + 1);
    });
    node.files.forEach(file => {
      const div = document.createElement("div");
      div.className = "tree-node" + (file.id === activeFileId ? " active" : "");
      div.style.paddingLeft = `${10 + depth * 13}px`;
      div.innerHTML = `<span class="tree-node-label" ondblclick="renameWorkspaceFile('${file.id}', event)"><span class="tree-arrow"></span><span>📄</span><span>${escapeHtml(file.name)}${file.dirty ? " *" : ""}</span></span>
        <span class="tree-node-actions">
          <button class="tree-act-btn" title="重命名" onclick="renameWorkspaceFile('${file.id}', event)">✏</button>
          <button class="tree-act-btn" title="保存文件" onclick="saveWorkspaceFileById('${file.id}', event)">💾</button>
          <button class="tree-act-btn del" title="删除文件" onclick="deleteWorkspaceFile('${file.id}', event)">🗑</button>
        </span>`;
      div.onclick = (e) => {
        if (e.target.closest(".tree-node-actions")) return;
        openFileInTab(file.id);
      };
      container.appendChild(div);
    });
  }
  renderNode(rootTree, 0);
}

function renderFileTabs() {
  const tabsBar = document.getElementById("file-tabs");
  tabsBar.innerHTML = "";
  openTabIds.forEach(id => {
    const file = workspaceFiles.find(f => f.id === id);
    if (!file) return;
    const tab = document.createElement("div");
    tab.className = "file-tab" + (file.id === activeFileId ? " active" : "") + (file.dirty ? " dirty" : "");
    tab.innerHTML = `<span>📄 ${escapeHtml(file.name)}</span><span class="dirty-dot"></span><span class="tab-close">✕</span>`;
    tab.onclick = (e) => { if (e.target.classList.contains("tab-close")) closeFileTab(file.id); else openFileInTab(file.id); };
    tabsBar.appendChild(tab);
  });
}

function openFileInTab(fileId) {
  if (!openTabIds.includes(fileId)) openTabIds.push(fileId);
  activeFileId = fileId;
  const f = getActiveFile();
  document.getElementById("netlist-input").value = f.content;
  document.getElementById("editor-filename").textContent = f.path;
  selectedDeviceNames.clear();
  checkedDeviceNames.clear();
  highlightedLines.clear();
  document.getElementById("check-banner").style.display = "none";

  if (!f.parsedDesign) parseAndRender();
  else {
    realDeviceLineMap = f.parsedDesign.lineMap || new Map();
    refreshEditorGutter();
    updateBreadcrumbs();
    rerenderOnly();
  }
  renderFileTree();
  renderFileTabs();
}

function closeFileTab(fileId) {
  const idx = openTabIds.indexOf(fileId);
  if (idx === -1) return;
  openTabIds.splice(idx, 1);
  if (openTabIds.length === 0) { createNewNetlistFile(); return; }
  if (activeFileId === fileId) openFileInTab(openTabIds[Math.max(0, idx - 1)]);
  else renderFileTabs();
}

function createNewNetlistFile() {
  const idx = workspaceFiles.length + 1;
  const nf = {
    id: `file_${Date.now()}_${idx}`,
    path: `User_Designs/circuit_${idx}.scs`,
    name: `circuit_${idx}.scs`,
    content: `// 新建 Spectre 网表\nsimulator lang=spectre\n\nMP1 (out in vdd vdd) pch w=20u l=1u\nMN1 (out in 0 0) nch w=10u l=1u\nL1  (out out_rf) inductor l=2n\n`,
    dirty: true, parsedDesign: null, activeSubckt: "__TOP__", hierarchyStack: ["__TOP__"], layoutsBySubckt: {}, undoStack: [], redoStack: []
  };
  expandedFolders.add("User_Designs");
  workspaceFiles.push(nf);
  openFileInTab(nf.id);
}

function triggerOpenFile() { document.getElementById("open-file-input").click(); }
function triggerOpenFolder() { document.getElementById("open-folder-input").click(); }

document.getElementById("open-file-input").addEventListener("change", (e) => { handleImportedFiles(Array.from(e.target.files), false); e.target.value = ""; });
document.getElementById("open-folder-input").addEventListener("change", (e) => { handleImportedFiles(Array.from(e.target.files), true); e.target.value = ""; });

function handleImportedFiles(fileList, isFolder) {
  fileList.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const relPath = isFolder && file.webkitRelativePath ? file.webkitRelativePath : `Imported/${file.name}`;
      const parts = relPath.split("/");
      for (let i = 1; i < parts.length; i++) expandedFolders.add(parts.slice(0, i).join("/"));

      if (file.name.endsWith(".json")) {
        try {
          const obj = JSON.parse(text);
          if (obj && obj.pdkData) {
            savedPdks.push(obj.pdkData);
            activePdkId = obj.pdkData.id;
            localStorage.setItem("spectre_eda_pdks", JSON.stringify(savedPdks));
            updatePdkBadge();
            return;
          }
          if (obj && obj.content && obj.layoutsBySubckt) {
            const newId = `file_${Date.now()}_${idx}`;
            workspaceFiles.push({
              id: newId, path: obj.path || relPath, name: obj.name || file.name, content: obj.content,
              dirty: false, parsedDesign: parseSpectreNetlist(obj.content),
              activeSubckt: obj.activeSubckt || "__TOP__", hierarchyStack: obj.hierarchyStack || ["__TOP__"],
              layoutsBySubckt: obj.layoutsBySubckt, undoStack: [], redoStack: []
            });
            openFileInTab(newId);
            return;
          }
        } catch (err) {}
      }

      const newId = `file_${Date.now()}_${idx}`;
      workspaceFiles.push({
        id: newId, path: relPath, name: file.name, content: text, dirty: false,
        parsedDesign: null, activeSubckt: "__TOP__", hierarchyStack: ["__TOP__"], layoutsBySubckt: {}, undoStack: [], redoStack: []
      });
      if (idx === fileList.length - 1) openFileInTab(newId);
      renderFileTree();
    };
    reader.readAsText(file);
  });
}

function saveCurrentFile() {
  const f = getActiveFile();
  if (!f) return;
  f.content = document.getElementById("netlist-input").value;
  f.dirty = false;
  renderFileTabs(); renderFileTree();
  downloadBlob(new Blob([f.content], { type: "text/plain;charset=utf-8" }), f.name);
}

function saveAsCurrentFile() {
  const f = getActiveFile();
  if (!f) return;
  const base = f.name.replace(/(\.[^.]+)$/, "");
  const ext = (f.name.match(/(\.[^.]+)$/) || ["", ".scs"])[1];
  f.name = base + "_copy" + ext;
  f.path = (f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/") + 1) : "") + f.name;
  saveCurrentFile();
}

function exportProjectState() {
  const f = getActiveFile();
  if (!f) return;
  f.content = document.getElementById("netlist-input").value;
  const snapObj = { schemaVersion: EDA_SCHEMA_VERSION, path: f.path, name: f.name, content: f.content, activeSubckt: f.activeSubckt, hierarchyStack: f.hierarchyStack, layoutsBySubckt: f.layoutsBySubckt };
  downloadBlob(new Blob([JSON.stringify(snapObj, null, 2)], { type: "application/json;charset=utf-8" }), f.name.replace(/\.[^.]+$/, "") + ".eda.json");
}

function buildCleanExportSVG(transparentBg) {
  const layout = getCurrentLayout();
  const clone = document.getElementById("schematic-svg").cloneNode(true);
  const vp = clone.querySelector("#viewport");
  vp.setAttribute("transform", "translate(0,0) scale(1)");
  const gridRect = vp.querySelector("#world-grid-rect");
  if (gridRect) gridRect.remove();
  const w = layout ? layout.width : 1080, h = layout ? layout.height : 740;
  clone.setAttribute("width", w); clone.setAttribute("height", h); clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
  if (!transparentBg) {
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("width", w); bg.setAttribute("height", h); bg.setAttribute("fill", "#ffffff");
    vp.insertBefore(bg, vp.firstChild);
  }
  return { svgString: '<?xml version="1.0" standalone="no"?>\r\n' + new XMLSerializer().serializeToString(clone), w, h };
}

function exportSVG(transparentBg) {
  const { svgString } = buildCleanExportSVG(transparentBg);
  downloadBlob(new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }), `${getActiveFile().activeSubckt}${transparentBg ? "_transparent.svg" : ".svg"}`);
}

function exportRaster(format) {
  const { svgString, w, h } = buildCleanExportSVG(false);
  const canvas = document.createElement("canvas");
  canvas.width = w * 2; canvas.height = h * 2;
  const ctx = canvas.getContext("2d");
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }));
  img.onload = () => {
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url);
    canvas.toBlob(blob => downloadBlob(blob, `${getActiveFile().activeSubckt}.${format === "png" ? "png" : "jpg"}`), format === "png" ? "image/png" : "image/jpeg", 0.95);
  };
  img.src = url;
}

function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

function pushUndoSnapshot() {
  const f = getActiveFile(), layout = getCurrentLayout();
  if (!f || !layout) return;
  f.undoStack.push({ subckt: f.activeSubckt, content: f.content, snapshot: JSON.parse(JSON.stringify(layout)) });
  if (f.undoStack.length > 40) f.undoStack.shift();
  f.redoStack = [];
}

function undoEdit() {
  const f = getActiveFile();
  if (!f || f.undoStack.length === 0) return;
  const entry = f.undoStack.pop();
  const cur = f.layoutsBySubckt[entry.subckt];
  if (cur) f.redoStack.push({ subckt: entry.subckt, content: f.content, snapshot: JSON.parse(JSON.stringify(cur)) });
  f.layoutsBySubckt[entry.subckt] = entry.snapshot;
  if (entry.content!==undefined && entry.content!==f.content) applyClassicSource(f,entry.content);
  rerenderOnly();
}

function redoEdit() {
  const f = getActiveFile();
  if (!f || f.redoStack.length === 0) return;
  const entry = f.redoStack.pop();
  const cur = f.layoutsBySubckt[entry.subckt];
  if (cur) f.undoStack.push({ subckt: entry.subckt, content: f.content, snapshot: JSON.parse(JSON.stringify(cur)) });
  f.layoutsBySubckt[entry.subckt] = entry.snapshot;
  if (entry.content!==undefined && entry.content!==f.content) applyClassicSource(f,entry.content);
  rerenderOnly();
}

function selectAllDevices() {
  const layout = getCurrentLayout();
  if (!layout) return;
  selectedDeviceNames.clear();
  layout.elements.forEach(el => selectedDeviceNames.add(el.name));
  rerenderOnly();
}

function deleteSelectedDevices() {
  const layout = getCurrentLayout();
  const f = getActiveFile();
  if (!layout) return;
  const hasDevs = selectedDeviceNames.size > 0;
  const hasWires = selectedWireIndices.size > 0;
  if (!hasDevs && !hasWires) return;

  pushUndoSnapshot();

  if (hasWires && lastRoutedWires.length > 0) {
    selectedWireIndices.forEach(wIdx => {
      const w = lastRoutedWires[wIdx];
      if (!w || !w.points || w.points.length < 2) return;
      const endPt = w.points[w.points.length - 1];
      const newNet = `open_${_openNetSeq++}`;
      let changedPin = false;
      layout.elements.forEach(el => {
        el.pins.forEach(p => {
          if (p.net === w.net && Math.abs(p.x - endPt.x) <= 2 && Math.abs(p.y - endPt.y) <= 2) {
            p.net = newNet;
            changedPin = true;
          }
        });
      });
      if (!changedPin) {
        for (const el of layout.elements) {
          const matchPin = el.pins.find(p => p.net === w.net);
          if (matchPin) { matchPin.net = newNet; break; }
        }
      }
    });
    selectedWireIndices.clear();
  }

  if (hasDevs) {
    layout.elements = layout.elements.filter(e => !selectedDeviceNames.has(e.name));
    selectedDeviceNames.clear();
  }
  if (f) syncLayoutToActiveNetlist();
  rerenderOnly();
}

function rotateSelectedDevices(deltaDeg = 90) {
  if (placingTool) {
    placingTool.rotation = (((placingTool.rotation || 0) + deltaDeg) % 360 + 360) % 360;
    renderPlaceGhost();
    return;
  }
  const layout = getCurrentLayout();
  if (!layout || selectedDeviceNames.size === 0) {
    showToast("请先选中要旋转的元件", "warn");
    return;
  }
  pushUndoSnapshot();
  layout.elements.forEach(el => {
    if (selectedDeviceNames.has(el.name)) {
      el.rotation = (((el.rotation || 0) + deltaDeg) % 360 + 360) % 360;
      computePinPositions(el);
    }
  });
  rerenderOnly();
}

function flipSelectedDevices(axis = "x") {
  if (placingTool) {
    if (axis === "x") placingTool.flipX = !placingTool.flipX;
    else placingTool.flipY = !placingTool.flipY;
    renderPlaceGhost();
    return;
  }
  const layout = getCurrentLayout();
  if (!layout || selectedDeviceNames.size === 0) {
    showToast("请先选中要对称/镜像的元件", "warn");
    return;
  }
  pushUndoSnapshot();
  layout.elements.forEach(el => {
    if (selectedDeviceNames.has(el.name)) {
      if (axis === "x") el.flipX = !el.flipX;
      else el.flipY = !el.flipY;
      computePinPositions(el);
    }
  });
  rerenderOnly();
}


let editingParamEl = null;

function openEditParamModalForSelected() {
  const layout = getCurrentLayout();
  if (!layout || selectedDeviceNames.size === 0) {
    showToast("请先选中一个元件再配置参数", "warn");
    return;
  }
  const firstName = Array.from(selectedDeviceNames)[0];
  const el = layout.elements.find(e => e.name === firstName);
  if (el) openEditParamModal(el);
}

function openEditParamModal(el) {
  editingParamEl = el;
  document.getElementById("edit-param-title").textContent = `⚙ 配置元件参数 · ${el.name} (${el.model})`;
  document.getElementById("ep-inst-name").value = el.name;
  document.getElementById("ep-model-name").value = el.model;
  document.getElementById("ep-nodes-str").value = el.pins.map(p => p.net).join(" ");
  document.getElementById("ep-pins-hint").textContent = "引脚顺序: " + el.pins.map(p => p.name).join(" / ");
  document.getElementById("ep-params-str").value = Object.entries(el.params || {}).map(([k, v]) => `${k}=${v}`).join(" ");
  document.getElementById("edit-param-modal").style.display = "flex";
  setTimeout(() => document.getElementById("ep-params-str").focus(), 40);
}

function confirmEditParamModal() {
  const layout = getCurrentLayout();
  const f = getActiveFile();
  if (!editingParamEl || !layout || !f) return;

  pushUndoSnapshot();
  const oldName = editingParamEl.name;
  const newName = document.getElementById("ep-inst-name").value.trim() || oldName;
  const newModel = document.getElementById("ep-model-name").value.trim() || editingParamEl.model;
  const newNodes = document.getElementById("ep-nodes-str").value.trim().split(/\s+/).filter(Boolean);
  const paramStr = document.getElementById("ep-params-str").value.trim();

  const newParams = {};
  const pr = /(\S+?)=([^\s]+)/g;
  let pm;
  while ((pm = pr.exec(paramStr)) !== null) newParams[pm[1]] = pm[2];

  editingParamEl.name = newName;
  editingParamEl.model = newModel;
  editingParamEl.params = newParams;
  editingParamEl.pins.forEach((p, idx) => {
    if (newNodes[idx]) p.net = newNodes[idx];
  });
  editingParamEl.nodes = editingParamEl.pins.map(p => p.net);
  if (selectedDeviceNames.has(oldName)) {
    selectedDeviceNames.delete(oldName);
    selectedDeviceNames.add(newName);
  }
  computePinPositions(editingParamEl);
  syncLayoutToActiveNetlist();
  closeModal("edit-param-modal");
  rerenderOnly();
  showToast(`✔ 已更新 ${newName} 参数与连接`, "ok");
}

// Update the device cards touched by a graphical edit; the rest of the source deck
// can contain independent subcircuits, arbitrary waveform clauses and model cards.
function syncLayoutToActiveNetlist() {
  const f=getActiveFile(),layout=getCurrentLayout();
  if (!f || !layout) return;
  const original=f.parsedDesign.subckts[f.activeSubckt]?.elements || [];
  const lines=f.content.split('\n');
  const placed=new Map(layout.elements.filter(el=>el.line).map(el=>[el.line,el]));
  for (const previous of original) {
    const idx=previous.line-1, raw=lines[idx];
    if (!raw || raw.trimStart().split(/[\s(]+/)[0]!==previous.name) continue;
    const next=placed.get(previous.line);
    if (!next) {
      // Keep line indices stable for the other elements being edited in the same pass.
      lines[idx]='';
      for (let j=idx+1;j<lines.length && /^\s*\+/.test(lines[j]);j++) lines[j]='';
      continue;
    }
    const nodes=next.pins.map(p=>p.net).slice(0,previous.nodes.length);
    const pinsChanged=nodes.some((net,i)=>net!==previous.nodes[i]);
    const paramsChanged=JSON.stringify(next.params)!==JSON.stringify(previous.params);
    if (!pinsChanged && !paramsChanged && next.name===previous.name && next.model===previous.model) continue;
    const commentStart=raw.search(/\s(?:\/\/|;|\$)/);
    const body=commentStart<0?raw:raw.slice(0,commentStart), comment=commentStart<0?'':raw.slice(commentStart);
    const spectre=body.match(/^(\s*)\S+\s*\(([^)]*)\)\s*(\S+)(.*)$/);
    let tail;
    let head;
    if (spectre) {
      head=spectre[1]+next.name+' ('+nodes.join(' ')+') '+next.model;
      tail=spectre[4];
    } else {
      const parts=Array.from(body.matchAll(/\S+/g));
      if (parts.length<=nodes.length) continue;
      head=body.slice(0,parts[0].index)+[next.name,...nodes].join(' ');
      const offset=parts[nodes.length].index+parts[nodes.length][0].length;
      tail=body.slice(offset);
      // Preserve the exact stimulus/backend syntax after the original terminal list.
      if (next.model!==previous.model && !['resistor','capacitor','inductor','vsource','isource'].includes(next.type)) {
        tail=tail.replace(/^(\s*)\S+/,(_,space)=>space+next.model);
      }
    }
    if (paramsChanged) {
      const scalar=!spectre && {resistor:'r',capacitor:'c',inductor:'l',vsource:'dc',isource:'dc'}[next.type];
      for (const key of new Set([...Object.keys(previous.params),...Object.keys(next.params)])) {
        const value=next.params[key];
        if (previous.params[key]===value || !/^[\w.]+$/.test(key)) continue;
        const pattern=new RegExp('(^|\\s)'+key.replace(/\./g,'\\.')+'\\s*=\\s*[^\\s]+','i');
        if (pattern.test(tail)) tail=tail.replace(pattern,(_,space)=>value==null?'':space+key+'='+value);
        else if (key===scalar && value!=null) tail=tail.replace(/^(\s*(?:(?:dc|ac)\s+)?)\S+/i,(_,prefix)=>prefix+value);
        else if (value!=null) tail+=' '+key+'='+value;
      }
    }
    lines[idx]=head+tail+comment;
  }
  applyClassicSource(f,lines.join('\n'));
}

function compileSchematicToCode(targetLang = "spectre", silent = false) {
  const f = getActiveFile();
  const layout = getCurrentLayout();
  if (!f || !layout) return;

  const activeSub = f.activeSubckt || "__TOP__";
  const subDef = f.parsedDesign?.subckts?.[activeSub];
  const elems = layout.elements.filter(el => !["term_vdd", "term_gnd", "term_neg"].includes(el.type));
  let outCode = "";

  if (targetLang === "verilog") {
    const modName = activeSub === "__TOP__" ? (f.name.replace(/\.[^.]+$/, "") || "top_module") : activeSub;
    const ports = (subDef && subDef.ports && subDef.ports.length) ? subDef.ports : Array.from(new Set(elems.flatMap(e => e.pins.map(p => p.net)))).filter(n => !isLowVoltNet(n));
    const portDecls = ports.map(p => `    inout wire ${p}`).join(",\n");
    const bodyLines = elems.map(el => {
      if (el.type.startsWith("gate_")) {
        const gOp = el.type.replace("gate_", "").replace("inv", "not");
        const ins = el.pins.filter(p => p.name !== "Y").map(p => p.net);
        const out = (el.pins.find(p => p.name === "Y") || el.pins[el.pins.length - 1]).net;
        return `    ${gOp} ${el.name} (${out}, ${ins.join(", ")});`;
      }
      return `    ${el.model} ${el.name} (${el.pins.map(p => `.${p.name}(${p.net})`).join(", ")});`;
    });
    outCode = `// Compiled from Schematic by OpenCircuit EDA\nmodule ${modName} (\n${portDecls}\n);\n${bodyLines.join("\n")}\nendmodule\n`;
  } else if (targetLang === "vhdl") {
    const entName = activeSub === "__TOP__" ? (f.name.replace(/\.[^.]+$/, "") || "top_entity") : activeSub;
    const ports = (subDef && subDef.ports && subDef.ports.length) ? subDef.ports : Array.from(new Set(elems.flatMap(e => e.pins.map(p => p.net)))).filter(n => !isLowVoltNet(n));
    const portDecls = ports.map(p => `        ${p} : inout std_logic`).join(";\n");
    const bodyLines = elems.map(el => {
      if (el.type === "gate_inv") {
        const ins = el.pins.filter(p => p.name !== "Y").map(p => p.net);
        const out = (el.pins.find(p => p.name === "Y") || el.pins[el.pins.length - 1]).net;
        return `    ${out} <= not ${ins[0] || "a"};`;
      }
      if (el.type.startsWith("gate_")) {
        const op = el.type.replace("gate_", "");
        const ins = el.pins.filter(p => p.name !== "Y").map(p => p.net);
        const out = (el.pins.find(p => p.name === "Y") || el.pins[el.pins.length - 1]).net;
        return `    ${out} <= ${ins.join(` ${op} `)};`;
      }
      return `    -- ${el.name} (${el.model})`;
    });
    outCode = `-- Compiled from Schematic by OpenCircuit EDA\nentity ${entName} is\n    port (\n${portDecls}\n    );\nend entity ${entName};\n\narchitecture rtl of ${entName} is\nbegin\n${bodyLines.join("\n")}\nend architecture rtl;\n`;
  } else if (targetLang === "spice") {
    const lines = [`* Compiled SPICE Netlist from Schematic (${activeSub})`];
    elems.forEach(el => {
      const ns = el.pins.map(p => p.net).join(" ");
      const ps = Object.entries(el.params || {}).map(([k, v]) => `${k}=${v}`).join(" ");
      if (el.type === "resistor") lines.push(`${el.name} ${ns} ${el.params?.r || "1k"}`);
      else if (el.type === "capacitor") lines.push(`${el.name} ${ns} ${el.params?.c || "1p"}`);
      else if (el.type === "inductor") lines.push(`${el.name} ${ns} ${el.params?.l || "1n"}`);
      else if (el.type === "vsource") lines.push(`${el.name} ${ns} DC ${el.params?.dc || "1.8"}`);
      else if (el.type === "isource") lines.push(`${el.name} ${ns} DC ${el.params?.dc || "20u"}`);
      else lines.push(`${el.name} ${ns} ${el.model} ${ps}`.trim());
    });
    lines.push(".end\n");
    outCode = lines.join("\n");
  } else {
    // Spectre (.scs)
    const lines = [`// Compiled Spectre Netlist from Schematic`, `simulator lang=spectre`];
    const body = elems.map(el => {
      const ns = el.pins.map(p => p.net).join(" ");
      const ps = Object.entries(el.params || {}).map(([k, v]) => `${k}=${v}`).join(" ");
      return `    ${el.name} (${ns}) ${el.model} ${ps}`.trim();
    });
    if (activeSub !== "__TOP__") {
      const ports = (subDef && subDef.ports) ? subDef.ports.join(" ") : "";
      lines.push(`inline subckt ${activeSub} ${ports}`.trim());
      lines.push(...body);
      lines.push(`ends ${activeSub}`);
    } else {
      lines.push(...body.map(l => l.trim()));
    }
    outCode = lines.join("\n") + "\n";
  }

  f.content = outCode;
  f.dirty = true;
  const ta = document.getElementById("netlist-input");
  if (ta) ta.value = outCode;
  f.parsedDesign = parseSpectreNetlist(outCode, f.name);
  realDeviceLineMap = f.parsedDesign.lineMap;
  refreshEditorGutter();
  renderFileTabs();
  if (!silent) {
    showToast(`✔ 已将原理图编译为 ${targetLang.toUpperCase()} 代码`, "ok");
  }
}

function openVersionModal() {
  const m = document.getElementById("version-modal");
  if (m) m.style.display = "flex";
}

function setEditMode(mode) {
  editMode = mode;
  pendingWirePin = null;
  document.getElementById("chk-mode-move").textContent = mode === "move" ? "✓" : " ";
  document.getElementById("chk-mode-wire").textContent = mode === "wire" ? "✓" : " ";
  renderFloatingIsland();
  rerenderOnly();
}

function isAutoBlankNet(n) {
  return !n || /^(vp_|vn_|ip_|in_|p_|n_|a_|b_|y_|d0_|d1_|sel_|d_|clk_|q_|c_|e_|op_|on_|g1_|g2_|in_|out_|p3_|p4_|open_|net_)/i.test(n);
}

function handlePinClickForWire(el, pin) {
  const layout = getCurrentLayout();
  if (!layout) return;
  if (!pendingWirePin) { pendingWirePin = { el, pin }; rerenderOnly(); return; }
  const first = pendingWirePin; pendingWirePin = null;
  if (first.el.name === el.name && first.pin.name === pin.name) { rerenderOnly(); return; }
  pushUndoSnapshot();

  const nA = first.pin.net || "";
  const nB = pin.net || "";
  const isPwrA = isLowVoltNet(nA) || isHighVoltNet(nA) || isNegVoltNet(nA);
  const isPwrB = isLowVoltNet(nB) || isHighVoltNet(nB) || isNegVoltNet(nB);

  let targetNet = nA || nB || `net_${Date.now().toString().slice(-4)}`;
  if (isPwrB && !isPwrA) targetNet = nB;
  else if (isPwrA && !isPwrB) targetNet = nA;
  else if (!isAutoBlankNet(nB) && isAutoBlankNet(nA)) targetNet = nB;

  const replaceNets = new Set();
  if (nA && nA !== targetNet) replaceNets.add(nA);
  if (nB && nB !== targetNet) replaceNets.add(nB);

  first.pin.net = targetNet;
  pin.net = targetNet;
  layout.elements.forEach(other => other.pins.forEach(p => {
    if (replaceNets.has(p.net)) p.net = targetNet;
  }));

  syncLayoutToActiveNetlist();
  rerenderOnly();
  showToast(`✔ 已连接引脚至统一端口/网络: <b>${targetNet}</b>`, "ok", 2200);
}

let _rafRenderPending = false;
function rerenderOnly() {
  if (_rafRenderPending) return;
  _rafRenderPending = true;
  requestAnimationFrame(() => {
    _rafRenderPending = false;
    const f = getActiveFile(), layout = getCurrentLayout();
    if (!f || !layout) return;
    const subckt = f.parsedDesign.subckts[f.activeSubckt] || { name: "Schematic", elements: [] };
    renderSVG(layout, routeSchematic(layout), subckt);
  });
}

/* 快捷键录制与监听 */
function formatKeyEvent(e) {
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  let k = e.key || "";
  if (e.code && e.code.startsWith("Key")) {
    k = e.code.slice(3).toUpperCase();
  } else if (e.code && e.code.startsWith("Digit") && !e.shiftKey) {
    k = e.code.slice(5);
  } else if (k === "Process" || k === "Unidentified" || !k) {
    if (e.code) k = e.code;
  } else if (k.length === 1) {
    k = k.toUpperCase();
  }
  if (!["Control", "Shift", "Alt", "Meta", "ControlLeft", "ControlRight", "ShiftLeft", "ShiftRight", "AltLeft", "AltRight"].includes(k)) {
    parts.push(k);
  }
  return parts.join("+");
}

function updateShortcutHints() {
  document.querySelectorAll("[data-sc]").forEach(el => {
    const act = el.getAttribute("data-sc");
    if (shortcuts[act]) el.textContent = shortcuts[act].keys;
  });
}

let recordingAction = null;
function openShortcutModal() { recordingAction = null; renderShortcutModalList(); document.getElementById("shortcut-modal").style.display = "flex"; }
function resetDefaultShortcuts() { shortcuts = JSON.parse(JSON.stringify(DEFAULT_SHORTCUTS)); localStorage.setItem("spectre_eda_shortcuts", JSON.stringify(shortcuts)); updateShortcutHints(); renderShortcutModalList(); }
function renderShortcutModalList() {
  const list = document.getElementById("shortcut-list"); list.innerHTML = "";
  Object.entries(shortcuts).forEach(([act, info]) => {
    const row = document.createElement("div"); row.className = "sc-row";
    const isRec = recordingAction === act;
    row.innerHTML = `<span>${info.label}</span>`;
    const btn = document.createElement("button");
    btn.className = "sc-key-btn" + (isRec ? " recording" : "");
    btn.textContent = isRec ? "请按下组合键..." : info.keys;
    btn.onclick = () => { recordingAction = act; renderShortcutModalList(); };
    row.appendChild(btn); list.appendChild(row);
  });
}

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !["TEXTAREA", "INPUT", "SELECT"].includes(document.activeElement?.tagName)) spacePressed = true;
  if (recordingAction) {
    e.preventDefault();
    if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;
    shortcuts[recordingAction].keys = formatKeyEvent(e);
    localStorage.setItem("spectre_eda_shortcuts", JSON.stringify(shortcuts));
    recordingAction = null; updateShortcutHints(); renderShortcutModalList(); return;
  }
  const combo = formatKeyEvent(e);
  const eqSc = (scObj) => scObj && scObj.keys && scObj.keys.toLowerCase() === combo.toLowerCase();
  const inInput = ["TEXTAREA", "INPUT", "SELECT"].includes(document.activeElement?.tagName);
  const anyModalOpen = Array.from(document.querySelectorAll(".modal-backdrop")).some(m => m.style.display === "flex");
  if (anyModalOpen) {
    if (e.key === "Escape") document.querySelectorAll(".modal-backdrop").forEach(m => m.style.display = "none");
    return;
  }
  if (eqSc(shortcuts.save)) { e.preventDefault(); saveCurrentFile(); return; }
  if (eqSc(shortcuts.saveAs)) { e.preventDefault(); saveAsCurrentFile(); return; }
  if (eqSc(shortcuts.openFile)) { e.preventDefault(); triggerOpenFile(); return; }
  if (eqSc(shortcuts.openFolder)) { e.preventDefault(); triggerOpenFolder(); return; }
  if (eqSc(shortcuts.generate)) { e.preventDefault(); parseAndRender(); return; }
  if (eqSc(shortcuts.checkConn)) { e.preventDefault(); runConnectivityCheck(); return; }

  if (!inInput) {
    if (eqSc(shortcuts.undo)) { e.preventDefault(); undoEdit(); }
    else if (eqSc(shortcuts.redo)) { e.preventDefault(); redoEdit(); }
    else if (eqSc(shortcuts.fitView)) { e.preventDefault(); resetZoom(); }
    else if (eqSc(shortcuts.modeMove)) { e.preventDefault(); setEditMode("move"); }
    else if (eqSc(shortcuts.modeWire)) { e.preventDefault(); setEditMode("wire"); }
    else if (eqSc(shortcuts.clearHighlight) || e.key === "Escape") {
      e.preventDefault();
      if (placingTool) cancelInteractivePlace();
      else clearAllHighlights();
    }
    else if (eqSc(shortcuts.delete) || e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); deleteSelectedDevices(); }
    else if (eqSc(shortcuts.selectAll)) { e.preventDefault(); selectAllDevices(); }
    else if (combo.toLowerCase() === "ctrl+c") { e.preventDefault(); copySelectedDevices(); }
    else if (combo.toLowerCase() === "ctrl+v") { e.preventDefault(); pasteCopiedDevices(); }
    else if (eqSc(shortcuts.editParams)) { e.preventDefault(); openEditParamModalForSelected(); }
    else if (eqSc(shortcuts.rotate)) { e.preventDefault(); rotateSelectedDevices(90); }
    else if (eqSc(shortcuts.rotateCCW)) { e.preventDefault(); rotateSelectedDevices(-90); }
    else if (eqSc(shortcuts.flipX)) { e.preventDefault(); flipSelectedDevices("x"); }
    else if (eqSc(shortcuts.flipY)) { e.preventDefault(); flipSelectedDevices("y"); }
    else if (eqSc(shortcuts.placeResistor)) { e.preventDefault(); startInteractivePlace("resistor", "resistor"); }
    else if (eqSc(shortcuts.placeCapacitor)) { e.preventDefault(); startInteractivePlace("capacitor", "capacitor"); }
    else if (eqSc(shortcuts.placeInductor)) { e.preventDefault(); startInteractivePlace("inductor", "inductor"); }
    else if (eqSc(shortcuts.placeNmos)) { e.preventDefault(); quickPlacePdkMos("nmos"); }
    else if (eqSc(shortcuts.placePmos)) { e.preventDefault(); quickPlacePdkMos("pmos"); }
    else if (eqSc(shortcuts.placeVsource)) { e.preventDefault(); startInteractivePlace("vsource", "vsource", "dc=1.8"); }
    else if (eqSc(shortcuts.placeIsource)) { e.preventDefault(); startInteractivePlace("isource", "isource", "dc=20u"); }
    else if (eqSc(shortcuts.placeTermVdd)) { e.preventDefault(); startInteractivePlace("term_vdd", "term_vdd"); }
    else if (eqSc(shortcuts.placeTermGnd)) { e.preventDefault(); startInteractivePlace("term_gnd", "term_gnd"); }
    else if (eqSc(shortcuts.placeTermNeg)) { e.preventDefault(); startInteractivePlace("term_neg", "term_neg"); }
  }
}, true);
window.addEventListener("keyup", (e) => { if (e.code === "Space") spacePressed = false; });

function parseAndRender() {
  const f = getActiveFile();
  if (!f) return;
  const text = document.getElementById("netlist-input").value;
  f.content = text;
  f.parsedDesign = parseSpectreNetlist(text, f.name);
  realDeviceLineMap = f.parsedDesign.lineMap;
  f.undoStack = [];
  f.redoStack = [];
  f.layoutsBySubckt = {};

  highlightedLines.clear();
  checkedDeviceNames.clear();
  selectedDeviceNames.clear();
  document.getElementById("check-banner").style.display = "none";
  refreshEditorGutter();

  const keys = Object.keys(f.parsedDesign.subckts).filter(k => f.parsedDesign.subckts[k].elements.length > 0);
  if (!keys.includes(f.activeSubckt)) {
    f.activeSubckt = keys.includes("bandgap") ? "bandgap" : (keys[0] || "__TOP__");
    f.hierarchyStack = [f.activeSubckt];
  }

  document.getElementById("parse-stats").textContent = `${realDeviceLineMap.size} ${currentLang === "en" ? "devs" : "器件"}`;
  runNetlistLint(f);
  if (realDeviceLineMap.size === 0 && Object.values(f.parsedDesign.subckts).every(s => s.elements.length === 0)) {
    showToast(currentLang === "en" ? "No valid devices parsed. Check netlist syntax." : "未解析到有效器件或模块，请检查网表/HDL语法。", "warn");
  }
  switchSubckt(f.activeSubckt, false);
}

document.getElementById("netlist-input").addEventListener("input", () => {
  const f = getActiveFile();
  if (!f) return;
  f.content = document.getElementById("netlist-input").value;
  f.dirty = true;
  f.parsedDesign = parseSpectreNetlist(f.content,f.name);
  realDeviceLineMap = f.parsedDesign.lineMap;
  refreshEditorGutter();
  renderFileTabs();
  renderFileTree();
});
document.getElementById("netlist-input").addEventListener("scroll", syncEditorScroll);

function openContactAuthorModal() {
  const statusEl = document.getElementById("contact-status");
  if (statusEl) { statusEl.style.display = "none"; statusEl.textContent = ""; }
  document.getElementById("contact-author-modal").style.display = "flex";
}

let contactCountdownTimer = null;
const contactFormEl = document.getElementById("contact-author-form");
function triggerStandardFormSubmitFallback() {
  if (!contactFormEl) return;
  contactFormEl.setAttribute("target", "_blank");
  contactFormEl.submit();
}
if (contactFormEl) {
  contactFormEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("contact-submit-btn");
    const statusEl = document.getElementById("contact-status");
    const nameVal = document.getElementById("contact-name").value.trim();
    const emailVal = document.getElementById("contact-email").value.trim();
    const msgVal = document.getElementById("contact-message").value.trim();
    if (msgVal.length < 6) {
      statusEl.style.display = "block";
      statusEl.style.background = "#7f1d1d";
      statusEl.style.color = "#fecaca";
      statusEl.textContent = `✘ 留言内容不能少于 6 个字（当前仅 ${msgVal.length} 个字），请补充后再发送。`;
      document.getElementById("contact-message").focus();
      return;
    }
    if (contactCountdownTimer) clearInterval(contactCountdownTimer);
    let remainSec = 20;
    btn.disabled = true;
    btn.textContent = `发送中 (${remainSec}s)`;
    statusEl.style.display = "block";
    statusEl.style.background = "#1e293b";
    statusEl.style.color = "#7dd3fc";
    statusEl.textContent = `正在连接 FormSubmit 服务器发送邮件，剩余倒计时 ${remainSec} 秒...`;

    const controller = new AbortController();
    contactCountdownTimer = setInterval(() => {
      remainSec--;
      if (remainSec > 0) {
        btn.textContent = `发送中 (${remainSec}s)`;
        statusEl.textContent = `正在连接 FormSubmit 服务器发送邮件，剩余倒计时 ${remainSec} 秒...`;
      } else {
        clearInterval(contactCountdownTimer);
        controller.abort();
      }
    }, 1000);

    try {
      const resp = await fetch("https://formsubmit.co/ajax/2115487769@qq.com", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          name: nameVal,
          email: emailVal,
          message: msgVal,
          _subject: "Spectre EDA 工作台用户留言",
          _captcha: "false",
          _template: "table"
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data.success === "false" || data.success === false) {
        throw new Error(data.message || ("HTTP " + resp.status));
      }
      statusEl.style.background = "#064e3b";
      statusEl.style.color = "#a7f3d0";
      statusEl.innerHTML = `✔ FormSubmit 已接收请求！若作者邮箱首次使用 FormSubmit，需在收件箱/垃圾箱点击一次 FormSubmit 激活链接即可完成投递。`;
      contactFormEl.reset();
    } catch (err) {
      statusEl.style.background = "#451a03";
      statusEl.style.color = "#fde68a";
      statusEl.innerHTML = `⚠ 异步请求受限或超时，FormSubmit 需通过浏览器标准表单直连或邮件客户端投递：<div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;"><button type="button" class="q-btn primary" onclick="triggerStandardFormSubmitFallback()">🌐 新窗口直连 FormSubmit 提交</button><a class="q-btn" style="text-decoration:none;" href="mailto:2115487769@qq.com?subject=${encodeURIComponent('Spectre EDA 留言 - ' + nameVal)}&body=${encodeURIComponent(msgVal + '\n\n回复邮箱: ' + emailVal)}">📧 本地邮件客户端发送</a></div>`;
    } finally {
      clearInterval(contactCountdownTimer);
      btn.disabled = false;
      btn.textContent = "发送邮件";
    }
  });
}

let siteUptimeTimer = null;
function startSiteUptimeCounter() {
  const el = document.getElementById("site-uptime");
  if (!el) return;
  if (siteUptimeTimer) clearInterval(siteUptimeTimer);
  const startTs = new Date(2026, 10, 20, 0, 0, 0).getTime();
  const pad = (n) => String(n).padStart(2, "0");
  const update = () => {
    const diffSec = Math.max(0, Math.floor((Date.now() - startTs) / 1000));
    const days = Math.floor(diffSec / 86400);
    const hours = Math.floor((diffSec % 86400) / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;
    el.textContent = currentLang === "en" ? `Uptime: ${days}d ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s (since 2026-11-20)` : `网站已运行: ${days} 天 ${pad(hours)} 小时 ${pad(mins)} 分 ${pad(secs)} 秒 (自 2026.11.20 起)`;
  };
  update();
  siteUptimeTimer = setInterval(update, 1000);
}

/* ============================================================================
 * 14. AI 电路开发助手（配置引导 + 操作Skill + 网页功能Skill + 本地文件夹持久化）
 * ============================================================================ */
let aiConfig = { apiBase: "", apiKey: "", model: "" };
try {
  const savedCfg = JSON.parse(localStorage.getItem("spectre_eda_ai_config") || "null");
  if (savedCfg) aiConfig = savedCfg;
} catch (e) {}

let aiSessions = [];
try {
  aiSessions = JSON.parse(localStorage.getItem("spectre_eda_ai_sessions") || "[]");
} catch (e) {}
let activeAiSessionId = aiSessions.length ? aiSessions[0].id : null;
let aiDirHandle = null;
let aiSending = false;

const AI_WEB_APP_SKILL = `[网页功能 Skill - Spectre EDA 工作台]
1. 编辑器区：支持多文件树与标签页编辑 Spectre 网表(.scs/.cir/.sp)。
2. 原理图区：自动解析 subckt 与顶层网表，支持 NMOS/PMOS/BJT/R/L/C/电源/运放/逻辑门渲染、框选挪动、手动引脚连线、参数即时编辑。
3. 层级与检查：左上角“图层 ▾”可快速切换子电路与显示图层；“运行 -> 检查连接线”可跨层级检查悬空错误与单端标签警告并自动跳转高亮。
4. 固化与导出：支持导入/固化工艺库(.scs/.lib)、配置子电路 Input/Output/InOut 引脚并固化、导出 SVG/PNG/JPG/.eda.json。`;

const AI_OPERATION_SKILL = `[AI 操作 Skill]
1. 当为用户编写或修改 Spectre 电路网表时，请使用 \`\`\`spectre 代码块输出完整或子电路网表，用户可一键“应用到当前网表并生成原理图”或“保存文件到本地”。
2. 如需建议用户保存独立文件，请在代码块首行或前后标明建议文件名（例如 \`circuit_design.scs\`）。
3. 编写 Spectre 网表时请确保：每个器件实例格式为 \`实例名 (节点1 节点2 ...) 模型名 参数...\`，无悬空无标签引脚，电源统一使用 vdd/vss/0。`;

function persistAiSessions() {
  try { localStorage.setItem("spectre_eda_ai_sessions", JSON.stringify(aiSessions)); } catch (e) {}
  syncAiSessionsToFolder();
}

async function syncAiSessionsToFolder() {
  if (!aiDirHandle) return;
  try {
    const fileHandle = await aiDirHandle.getFileHandle("spectre_eda_ai_chats.json", { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(aiSessions, null, 2));
    await writable.close();
  } catch (e) {}
}

async function bindAiLocalFolder() {
  if (!window.showDirectoryPicker) {
    document.getElementById("mode-tip").textContent = "当前浏览器不支持目录直连，对话已自动保存在本地存储并支持一键导出 JSON";
    return;
  }
  try {
    aiDirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    document.getElementById("ai-folder-badge").textContent = `📁 ${aiDirHandle.name}`;
    try {
      const fh = await aiDirHandle.getFileHandle("spectre_eda_ai_chats.json");
      const file = await fh.getFile();
      const loaded = JSON.parse(await file.text());
      if (Array.isArray(loaded) && loaded.length > 0) {
        aiSessions = loaded;
        activeAiSessionId = aiSessions[0].id;
        renderAiHistoryList();
        renderAiMessages();
      }
    } catch (readErr) {
      await syncAiSessionsToFolder();
    }
  } catch (e) {}
}

function centerAiDialog() {
  const dlg = document.getElementById("ai-dialog");
  if (!dlg || dlg.classList.contains("maximized")) return;
  const w = dlg.offsetWidth || 680;
  const h = dlg.offsetHeight || 580;
  dlg.style.right = "auto";
  dlg.style.left = `${Math.max(12, Math.round((window.innerWidth - w) / 2))}px`;
  dlg.style.top = `${Math.max(40, Math.round((window.innerHeight - h) / 2))}px`;
}

function openAiDialog() {
  const dlg = document.getElementById("ai-dialog");
  const pill = document.getElementById("ai-minimized-pill");
  pill.style.display = "none";
  dlg.style.display = "flex";
  if (!aiConfig.apiKey || !aiConfig.apiBase) {
    toggleAiConfigView(true);
    centerAiDialog();
  } else {
    toggleAiConfigView(false);
    if (!activeAiSessionId || !aiSessions.some(s => s.id === activeAiSessionId)) {
      if (aiSessions.length) activeAiSessionId = aiSessions[0].id;
      else createNewAiSession();
    }
    renderAiHistoryList();
    renderAiMessages();
  }
}

function closeAiDialog() {
  document.getElementById("ai-dialog").style.display = "none";
  document.getElementById("ai-minimized-pill").style.display = "none";
}

function minimizeAiDialog() {
  document.getElementById("ai-dialog").style.display = "none";
  document.getElementById("ai-minimized-pill").style.display = "inline-flex";
}

function restoreAiDialog() {
  document.getElementById("ai-minimized-pill").style.display = "none";
  document.getElementById("ai-dialog").style.display = "flex";
}

function toggleMaximizeAiDialog() {
  const dlg = document.getElementById("ai-dialog");
  const btn = document.getElementById("ai-max-btn");
  dlg.classList.toggle("maximized");
  btn.textContent = dlg.classList.contains("maximized") ? "❐" : "□";
}

function toggleAiConfigView(showConfig) {
  const cfgView = document.getElementById("ai-config-view");
  const chatView = document.getElementById("ai-chat-view");
  if (showConfig) {
    document.getElementById("ai-cfg-base").value = aiConfig.apiBase || "https://api.deepseek.com/chat/completions";
    document.getElementById("ai-cfg-key").value = aiConfig.apiKey || "";
    document.getElementById("ai-cfg-model").value = aiConfig.model || "deepseek-chat";
    document.getElementById("ai-cfg-msg").style.display = "none";
    cfgView.style.display = "flex";
    chatView.style.display = "none";
  } else {
    cfgView.style.display = "none";
    chatView.style.display = "flex";
  }
}

function applyAiPreset(preset) {
  if (preset === "deepseek") {
    document.getElementById("ai-cfg-base").value = "https://api.deepseek.com/chat/completions";
    document.getElementById("ai-cfg-model").value = "deepseek-chat";
  } else if (preset === "openai") {
    document.getElementById("ai-cfg-base").value = "https://api.openai.com/v1/chat/completions";
    document.getElementById("ai-cfg-model").value = "gpt-4o-mini";
  }
}

function saveAiConfigAndEnter() {
  const base = document.getElementById("ai-cfg-base").value.trim();
  const key = document.getElementById("ai-cfg-key").value.trim();
  const model = document.getElementById("ai-cfg-model").value.trim();
  const msgEl = document.getElementById("ai-cfg-msg");
  if (!base || !key || !model) {
    msgEl.textContent = "请完整填写 API 地址、API Key 和模型名称。";
    msgEl.style.display = "block";
    return;
  }
  aiConfig = { apiBase: base, apiKey: key, model };
  try { localStorage.setItem("spectre_eda_ai_config", JSON.stringify(aiConfig)); } catch (e) {}
  toggleAiConfigView(false);
  if (!activeAiSessionId || !aiSessions.some(s => s.id === activeAiSessionId)) {
    if (aiSessions.length) activeAiSessionId = aiSessions[0].id;
    else createNewAiSession();
  }
  renderAiHistoryList();
  renderAiMessages();
}

function createNewAiSession() {
  const sess = {
    id: "chat_" + Date.now(),
    title: "新电路开发对话",
    createdAt: new Date().toLocaleString(),
    messages: [
      {
        role: "assistant",
        content: "你好！我已加载 **Spectre EDA 网页功能 Skill** 与 **AI 操作 Skill**。你可以让我分析当前网表、设计新电路并一键应用到画布或保存到本地。"
      }
    ]
  };
  aiSessions.unshift(sess);
  activeAiSessionId = sess.id;
  persistAiSessions();
  renderAiHistoryList();
  renderAiMessages();
}

function deleteAiSession(id, ev) {
  if (ev) ev.stopPropagation();
  aiSessions = aiSessions.filter(s => s.id !== id);
  if (activeAiSessionId === id) {
    activeAiSessionId = aiSessions.length ? aiSessions[0].id : null;
  }
  if (!activeAiSessionId) createNewAiSession();
  else {
    persistAiSessions();
    renderAiHistoryList();
    renderAiMessages();
  }
}

function clearAllAiSessions() {
  aiSessions = [];
  activeAiSessionId = null;
  createNewAiSession();
}

function exportAllAiSessions() {
  downloadBlob(new Blob([JSON.stringify(aiSessions, null, 2)], { type: "application/json;charset=utf-8" }), "spectre_eda_ai_chats.json");
}

function importAiSessionsFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (Array.isArray(data) && data.length > 0) {
        aiSessions = data;
        activeAiSessionId = aiSessions[0].id;
        persistAiSessions();
        renderAiHistoryList();
        renderAiMessages();
      }
    } catch (err) {}
  };
  reader.readAsText(file);
  e.target.value = "";
}

function renderAiHistoryList() {
  const list = document.getElementById("ai-history-list");
  if (!list) return;
  list.innerHTML = "";
  aiSessions.forEach(s => {
    const item = document.createElement("div");
    item.className = "ai-hist-item" + (s.id === activeAiSessionId ? " active" : "");
    item.innerHTML = `<span class="ai-hist-title" title="${escapeHtml(s.createdAt)}">${escapeHtml(s.title)}</span><button class="ai-hist-del" title="删除对话">🗑</button>`;
    item.onclick = () => { activeAiSessionId = s.id; renderAiHistoryList(); renderAiMessages(); };
    item.querySelector(".ai-hist-del").onclick = (ev) => deleteAiSession(s.id, ev);
    list.appendChild(item);
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
}
function showToast(message,type,duration) {
  showClassicNotification(escapeHtml(String(message).replace(/<\/?b>/gi,'')),type,duration);
}

function renderAiMessages() {
  const box = document.getElementById("ai-messages");
  if (!box) return;
  const sess = aiSessions.find(s => s.id === activeAiSessionId);
  if (!sess) { box.innerHTML = ""; return; }
  box.innerHTML = "";

  sess.messages.forEach((m, msgIdx) => {
    const div = document.createElement("div");
    div.className = "ai-msg " + m.role;
    if (m.role === "user") {
      div.textContent = m.content;
    } else {
      const parts = m.content.split(/(```[\s\S]*?```)/g);
      parts.forEach((part, pIdx) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const inner = part.slice(3, -3);
          const nlIdx = inner.indexOf("\n");
          const lang = nlIdx !== -1 ? inner.slice(0, nlIdx).trim() : "text";
          const codeBody = nlIdx !== -1 ? inner.slice(nlIdx + 1) : inner;
          const card = document.createElement("div");
          card.className = "ai-code-card";
          card.innerHTML = `<div class="ai-code-card-head"><span>${escapeHtml(lang || "netlist")}</span><div style="display:flex;gap:4px;"><button class="q-btn" style="padding:1px 6px;font-size:10.5px;">▶ 应用到网表</button><button class="q-btn" style="padding:1px 6px;font-size:10.5px;">💾 保存本地</button></div></div><pre>${escapeHtml(codeBody)}</pre>`;
          const btns = card.querySelectorAll("button");
          btns[0].onclick = () => applyAiCodeToEditor(codeBody);
          btns[1].onclick = () => saveAiCodeToLocalFile(codeBody, `ai_circuit_${msgIdx}_${pIdx}.scs`);
          div.appendChild(card);
        } else if (part.trim()) {
          const p = document.createElement("div");
          p.style.whiteSpace = "pre-wrap";
          p.textContent = part.trim();
          div.appendChild(p);
        }
      });
    }
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
}

function applyAiCodeToEditor(codeBody) {
  const f = getActiveFile();
  if (!f) return;
  f.content = codeBody;
  f.dirty = true;
  document.getElementById("netlist-input").value = codeBody;
  parseAndRender();
  renderFileTabs();
  renderFileTree();
  document.getElementById("mode-tip").textContent = "已将 AI 生成的网表应用到当前编辑器并生成原理图";
}

async function saveAiCodeToLocalFile(content, filename) {
  if (aiDirHandle) {
    try {
      const fh = await aiDirHandle.getFileHandle(filename, { create: true });
      const w = await fh.createWritable();
      await w.write(content);
      await w.close();
      document.getElementById("mode-tip").textContent = `AI 文件 ${filename} 已直接保存至绑定文件夹 ${aiDirHandle.name}`;
      return;
    } catch (e) {}
  }
  downloadBlob(new Blob([content], { type: "text/plain;charset=utf-8" }), filename);
}

function aiSaveCurrentNetlistLocal() {
  const f = getActiveFile();
  if (!f) return;
  saveAiCodeToLocalFile(document.getElementById("netlist-input").value, f.name);
}

function aiQuickPrompt(text) {
  document.getElementById("ai-user-input").value = text;
  sendAiMessage();
}

async function sendAiMessage() {
  if (aiSending) return;
  const input = document.getElementById("ai-user-input");
  const text = input.value.trim();
  if (!text) return;
  const sess = aiSessions.find(s => s.id === activeAiSessionId);
  if (!sess) return;

  if (sess.messages.length <= 1) sess.title = text.slice(0, 16);
  sess.messages.push({ role: "user", content: text });
  input.value = "";
  renderAiHistoryList();
  renderAiMessages();
  persistAiSessions();

  const f = getActiveFile();
  const sysPrompt = `${AI_WEB_APP_SKILL}\n\n${AI_OPERATION_SKILL}\n\n[当前工作台上下文]\n当前文件: ${f ? f.path : "无"}\n当前子电路层级: ${f ? f.activeSubckt : "无"}\n当前经典绘图符号库: ${getActivePdk().name}\n当前网表内容:\n\`\`\`spectre\n${f ? f.content.slice(0, 3500) : ""}\n\`\`\``;

  const btn = document.getElementById("ai-send-btn");
  aiSending = true;
  btn.disabled = true;
  btn.textContent = "思考中...";

  try {
    const payloadMsgs = [
      { role: "system", content: sysPrompt },
      ...sess.messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
    ];
    const resp = await fetch(aiConfig.apiBase, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${aiConfig.apiKey}`
      },
      body: JSON.stringify({ model: aiConfig.model, messages: payloadMsgs, temperature: 0.4 })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error?.message || ("HTTP " + resp.status));
    const reply = data.choices?.[0]?.message?.content || "（模型未返回文本内容）";
    sess.messages.push({ role: "assistant", content: reply });
  } catch (err) {
    sess.messages.push({ role: "assistant", content: `⚠ 请求失败：${err.message}\n请检查右上角 ⚙ 中的 API 地址、Key 或模型名是否正确。` });
  } finally {
    aiSending = false;
    btn.disabled = false;
    btn.textContent = "发送";
    persistAiSessions();
    renderAiMessages();
  }
}

const aiInputEl = document.getElementById("ai-user-input");
if (aiInputEl) {
  aiInputEl.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter") { e.preventDefault(); sendAiMessage(); }
  });
}

// 拖拽移动 AI 对话框
let aiDlgDrag = null;
const aiHdrEl = document.getElementById("ai-dialog-header");
if (aiHdrEl) {
  aiHdrEl.addEventListener("mousedown", (e) => {
  if (e.target.tagName === "BUTTON") return;
  const dlg = document.getElementById("ai-dialog");
  if (dlg.classList.contains("maximized")) return;
  const rect = dlg.getBoundingClientRect();
  aiDlgDrag = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
  });
}
window.addEventListener("mousemove", (e) => {
  if (!aiDlgDrag) return;
  const dlg = document.getElementById("ai-dialog");
  dlg.style.right = "auto";
  dlg.style.left = `${Math.max(0, Math.min(window.innerWidth - 180, e.clientX - aiDlgDrag.offsetX))}px`;
  dlg.style.top = `${Math.max(0, Math.min(window.innerHeight - 60, e.clientY - aiDlgDrag.offsetY))}px`;
});
window.addEventListener("mouseup", () => { aiDlgDrag = null; });

/* ============================================================================
 * 15. 汉英双语切换、白天/夜晚/跟随系统主题、内置终端、Tran/DC/AC 仿真与示波器/频谱仪
 * ============================================================================ */
let currentLang = "zh";
let currentTheme = "dark";
try {
  currentLang = localStorage.getItem("spectre_eda_lang") || "zh";
  currentTheme = localStorage.getItem("spectre_eda_theme") || "dark";
} catch (e) {}

function computeDcOperatingPoint(layout) {
  const unavailable={nodeVoltages:{},deviceOps:{},mosOps:{}};
  if (!layout?.elements.length) return unavailable;
  try {
    const solved=solveMnaDc(layout.elements,{returnFull:true,pdkParams:pdkSimParams});
    if (!solved.converged) return unavailable;
    const deviceOps={};
    for (const [name,op] of Object.entries(solved.mosOps)) {
      if (Number.isFinite(op.id)) deviceOps[name]=`Id≈${(op.id*1e6).toFixed(1)} µA (${op.region})`;
    }
    return {nodeVoltages:solved.nodeVoltages,deviceOps,mosOps:solved.mosOps};
  } catch { return unavailable; }
}

const I18N_DICT = {
  zh: {
    page_title: "Spectre EDA 原理图与工艺库集成工作台",
    top_file: "文件", top_export: "导出", top_freeze: "固化", top_edit: "编辑",
    top_view: "视图", top_run: "运行", top_place: "放置", top_ops: "操作", op_rot_cw: "↻ 顺时针旋转 90°", op_rot_ccw: "↺ 逆时针旋转 90°",
    op_flip_x: "⇄ 水平对称 (左右镜像)", op_flip_y: "⇅ 垂直对称 (上下镜像)", op_delete: "🗑 删除选中 (元件/电线)",
    p_term_vdd: "🔴 红空圆 (VDD 高电平)", p_term_gnd: "⚫ 实心黑圆 (GND 地)", p_term_neg: "⭕ 空黑圆 (VEE / 参考)",
    m_version: "ℹ 版本信息", mod_version_title: "ℹ OpenCircuit EDA 版本信息",
    top_design: "设计", top_ai: "🤖 AI", top_more: "更多",
    m_open_folder: "打开文件夹...", m_open_file: "打开文件...", m_save: "保存 (保存修改)", m_save_as: "另存为...",
    m_create_subckt: "📦 创建子电路 (配置端口方向)...", m_export_state: "💾 导出文件 (保留元件及位置)",
    m_export_svg: "导出默认 SVG 图片", m_export_svg_tr: "导出透明图片 (无背景)", m_export_png: "导出 PNG 图片", m_export_jpg: "导出 JPG 图片",
    m_pdk_mgr: "📚 工艺库管理与固化...", m_freeze_subckt: "📌 固化当前子电路到库",
    m_undo: "撤销", m_redo: "重做", m_del_dev: "删除选中元件", m_sel_all: "全选元件", m_shortcuts: "⌨ 自定义快捷键...",
    m_hierarchy: "层级视图 ▸", m_display: "显示 ▸",
    l_power: "电源标签", l_port: "端口标签", l_inst_name: "元件名", l_inst_param: "元件参数", l_dc_op: "工作点教学估算", l_island: "悬浮移动岛",
    m_pane_order: "区域顺序与布局 ▸",
    m_order_1: "文件区 → 代码区 → 原理图区", m_order_2: "代码区 → 文件区 → 原理图区",
    m_order_3: "原理图区 → 代码区 → 文件区", m_order_4: "文件区 → 原理图区 → 代码区",
    menu_theme: "主题模式 ▸", m_theme_dark: "🌙 夜晚模式 (Dark)", m_theme_light: "☀ 白天模式 (Light)", m_theme_sys: "🖥 跟随系统 (System)",
    menu_lang: "语言 / Language ▸", menu_clear_hl: "清除高亮", menu_fit: "适应画布",
    run_gen: "▶ 生成原理图", run_check: "✔ 检查连接线", run_tran: "⚡ Tran 瞬态仿真", run_dc: "📈 DC 直流扫描仿真", run_ac: "〰 AC 交流频率响应",
    run_scope: "📺 打开示波器 (Oscilloscope)", run_spec: "📊 打开频谱仪 (Spectrum)", run_term: "💻 打开终端 (Terminal)",
    p_island: "放置移动岛", p_nmos: "NMOS (当前工艺库) ▸", p_pmos: "PMOS (当前工艺库) ▸",
    p_res: "电阻 (R)", p_ind: "电感 (L)", p_cap: "电容 (C)", p_sources: "电源与激励源 ▸",
    p_vdc: "🔋 理想电压源 (DC Voltage)", p_idc: "⚡ 理想电流源 (DC Current)", p_vsin: "〰 正弦/交流源 (Sine / AC)",
    p_vpulse: "⎍ 脉冲源 (Pulse)", p_vsweep: "📈 扫频源 (Sweep / Chirp)",
    p_vcvs: "◇ 压控电压源 (VCVS)", p_vccs: "◇ 压控电流源 (VCCS)", p_cccs: "◇ 流控电流源 (CCCS)", p_ccvs: "◇ 流控电压源 (CCVS)",
    p_subckt: "子电路导入 ▸",
    d_move: "挪动调整", d_wire: "连接引脚",
    m_github: "🐙 Github主页", m_dev_info: "👤 开发者信息 ▸", m_author: "作者: Etherealnymph", m_other_proj: "🚀 作者其他项目", m_contact: "✉ 联系作者",
    quick_term: "💻 终端", quick_gen: "▶ 生成", quick_check: "✔ 检查连接线",
    tip_quick_term: "打开下方终端区域", tip_pdk_badge: "点击切换或导入工艺库",
    pane_files: "📁 文件", pane_files_short: "文件", pane_code_short: "网表源码", pane_canvas: "📐 原理图视图",
    status_ready: "就绪", btn_clear_all_hl: "✖ 取消全部高亮",
    tip_expand_files: "点击展开文件区", tip_collapse_files: "收起文件区", tip_new_file: "新建网表",
    tip_expand_code: "点击展开代码区", tip_collapse_code: "收起代码区", tip_move_left: "左移区域", tip_move_right: "右移区域",
    tip_place_island: "按住左侧圆点可拖动放置移动岛", tip_close_pi: "关闭放置移动岛",
    pi_label: "放置:", pi_res: "电阻 R", pi_ind: "电感 L", pi_cap: "电容 C", pi_vdc: "电压源", pi_idc: "电流源", pi_sweep: "扫频源", pi_subckt: "子电路",
    dock_tab_terminal: "💻 终端", dock_tab_scope: "📺 教学近似波形", dock_tab_spectrum: "📊 频谱仪", dock_tab_dcop: "📋 工作点报表", quick_labs: "🧪 实验预设", quick_share: "🔗 分享链接", dcop_tbl_title: "📋 直流工作点报表 (DC Operating Point & Small-Signal)", btn_export_csv: "💾 导出 CSV", run_dcop_tbl: "📋 工作点报表 (DC OP Table)", run_corner: "参数扰动演示（教学近似）", run_mc: "随机失配演示（教学近似）", p_tline: "传输线 (Tline)", p_analog_rf: "模拟与 BJT 模块 ▸", p_opamp: "运算放大器 (OpAmp)", m_copy_dev: "📋 复制选中元件", m_paste_dev: "📥 粘贴元件组", m_align_left: "⫷ 左对齐选中元件", m_align_top: "⊤ 顶对齐选中元件", m_export_pdf: "🖨 导出矢量 PDF (打印)", m_export_kicad: "🔌 导出 KiCad 兼容原理图", mod_labs_title: "🧪 交互式电路实验预设库 (Labs)", ai_q_explain: "📊 AI 解释当前仿真",
    tip_dock_collapse: "折叠/展开下方区域", tip_dock_close_all: "关闭下方区域",
    term_cwd_lbl: "默认工作目录：", term_copy_cd: "📋 复制本地 cd 命令", tip_term_copy_cd: "复制在系统终端进入 HTML 所在目录的命令",
    term_ph: "输入命令，如 help, pwd, ls, run tran, run dc, run ac, open scope, check...",
    btn_run_tran: "⚡ Tran", btn_run_dc: "📈 DC", btn_fft: "⚡ Tran FFT", btn_ac: "〰 AC 扫频",
    stim_type_lbl: "激励:", stim_none: "默认电源", stim_sine: "正弦激励 (Sine)", stim_pulse: "脉冲激励 (Pulse)", stim_step: "阶跃激励 (Step)", stim_chirp: "扫频激励 (Sweep)",
    stim_loc_lbl: "激励位置:", btn_pick_stim: "🎯 画布选激励点", stim_ampl_lbl: "幅值(V):", stim_freq_lbl: "频率(MHz):",
    btn_pick_probe: "🎯 原理图选端口", scope_xzoom: "X缩放:", scope_yzoom: "Y缩放:", btn_reset_zoom: "⟲ 复位", btn_new_term: "+ 新建终端", tip_new_folder: "新建工程文件夹", tip_save_proj: "保存整个工程", scope_cursor_idle: "移动鼠标查看交点读数", scope_ports_lbl: "观测端口:",
    spec_port_lbl: "响应端口:", spec_mode_lbl: "模式:", spec_opt_fft: "Tran FFT 频谱 (dBV)", spec_opt_ac: "AC 扫频幅频响应 (dB)", spec_cursor_idle: "移动鼠标查看频率/幅度",
    footer_brand: "OpenCircuit EDA (Spice-like) · Author: Etherealnymph",
    mod_pdk_title: "📚 经典绘图符号库", mod_pdk_list: "绘图符号与名称映射（内置教学符号及已保存符号）",
    mod_pdk_import: "📂 从本地导入工艺库文件 (.scs/.lib)", mod_pdk_freeze: "💾 固化当前工艺库 (保存至本地 pdk_libs/ 目录)", btn_ok: "确定",
    mod_place_inst: "元件实例名 (Instance Name)", mod_place_model: "模型名 (Model / Subckt)", mod_place_nodes: "连接网络 (空格分隔引脚网络，如: d g s b 或 p n)", mod_place_params: "元件参数 (如: w=20u l=1u 或 r=10k / l=5n / c=1p)",
    btn_cancel: "取消", btn_place_confirm: "放置到原理图",
    mod_island_title: "⚙ 自定义悬浮移动岛", btn_hide_island: "隐藏移动岛", btn_done: "完成",
    mod_sc_title: "⌨ 快捷键设置（点击按键可重新录制）", btn_reset_default: "恢复默认",
    ai_title: "🤖 OpenCircuit EDA AI 电路助手", ai_new_chat: "+ 新建对话", ai_import: "导入历史", ai_clear_all: "清空全部", ai_send: "发送",
    ai_local_cache: "本地缓存", ai_q_analyze: "分析当前电路", ai_q_gen: "生成新电路", ai_q_save: "💾 保存当前网表到本地",
    ai_input_ph: "输入电路设计需求（Ctrl+Enter 发送）...",
    ai_cfg_heading: "⚙ 首次使用请先配置 AI 模型接口",
    ai_cfg_desc: "配置后 AI 将自动加载电路设计助手技能，协助编写网表、排查连线、设计子电路并保存文件到本地。",
    ai_cfg_sec: "⚠ 安全提示：API Key 仅保存在本地浏览器 localStorage 并直连目标接口，请勿在公共设备保存，使用风险自担。",
    ai_cfg_preset_lbl: "快捷预设 (OpenAI / DeepSeek / 兼容接口)", ai_preset_custom: "自定义兼容接口 (OpenAI Format)",
    ai_cfg_base_lbl: "API 地址 (Chat Completions URL)", ai_cfg_key_lbl: "API Key (本地脱敏保护)",
    ai_cfg_model_lbl: "模型名称 (Model)", ai_cfg_model_ph: "deepseek-chat 或 gpt-4o-mini",
    ai_cfg_bind_dir: "📁 选择本地对话存储文件夹", ai_cfg_save_btn: "保存配置并开始对话",
    isl_gen: "▶ 生成", isl_move: "✋ 挪动", isl_wire: "🔌 连线", isl_undo: "↩ 撤销", isl_redo: "↪ 重做", isl_check: "✔ 检查连线", isl_fit: "⟲ 适应", isl_clear: "✖ 清高亮",
    tip_move_mode: "挪动模式：Ctrl+点击多选，左键框选批量移动，双击子电路/SPICE器件查看内部等效电路",
    tip_wire_mode: "连线模式：依次点击两个器件引脚即可建立连接"
  },
  en: {
    page_title: "Spectre EDA Schematic & PDK Integrated Workbench",
    top_file: "File", top_export: "Export", top_freeze: "Freeze", top_edit: "Edit",
    top_view: "View", top_run: "Run", top_place: "Place", top_ops: "Operation", op_rot_cw: "↻ Rotate 90° CW", op_rot_ccw: "↺ Rotate 90° CCW",
    op_flip_x: "⇄ Flip Horizontal", op_flip_y: "⇅ Flip Vertical", op_delete: "🗑 Delete Selected",
    p_term_vdd: "🔴 Red Hollow Circle (VDD)", p_term_gnd: "⚫ Solid Black Circle (GND)", p_term_neg: "⭕ Black Hollow Circle (VEE)",
    m_version: "ℹ Version Info", mod_version_title: "ℹ OpenCircuit EDA Version Info",
    top_design: "Design", top_ai: "🤖 AI", top_more: "More",
    m_open_folder: "Open Folder...", m_open_file: "Open File...", m_save: "Save", m_save_as: "Save As...",
    m_create_subckt: "📦 Create Subckt (Port Dir)...", m_export_state: "💾 Export Project (.eda.json)",
    m_export_svg: "Export SVG Image", m_export_svg_tr: "Export Transparent SVG", m_export_png: "Export PNG Image", m_export_jpg: "Export JPG Image",
    m_pdk_mgr: "📚 PDK Library & Freeze...", m_freeze_subckt: "📌 Freeze Current Subckt",
    m_undo: "Undo", m_redo: "Redo", m_del_dev: "Delete Selected", m_sel_all: "Select All", m_shortcuts: "⌨ Keyboard Shortcuts...",
    m_hierarchy: "Hierarchy View ▸", m_display: "Display Layers ▸",
    l_power: "Power Labels", l_port: "Port Labels", l_inst_name: "Instance Names", l_inst_param: "Parameters", l_dc_op: "Illustrative DC estimates", l_island: "Floating Island",
    m_pane_order: "Pane Layout Order ▸",
    m_order_1: "Files → Code → Schematic", m_order_2: "Code → Files → Schematic",
    m_order_3: "Schematic → Code → Files", m_order_4: "Files → Schematic → Code",
    menu_theme: "Theme Mode ▸", m_theme_dark: "🌙 Dark Mode", m_theme_light: "☀ Light Mode", m_theme_sys: "🖥 Follow System",
    menu_lang: "Language / 语言 ▸", menu_clear_hl: "Clear Highlights", menu_fit: "Fit Canvas",
    run_gen: "▶ Generate Schematic", run_check: "✔ Check Connectivity", run_tran: "⚡ Tran Simulation", run_dc: "📈 DC Sweep Simulation", run_ac: "〰 AC Frequency Response",
    run_scope: "📺 Open Oscilloscope", run_spec: "📊 Open Spectrum Analyzer", run_term: "💻 Open Terminal",
    p_island: "Place Floating Island", p_nmos: "NMOS (Active PDK) ▸", p_pmos: "PMOS (Active PDK) ▸",
    p_res: "Resistor (R)", p_ind: "Inductor (L)", p_cap: "Capacitor (C)", p_sources: "Sources & Stimuli ▸",
    p_vdc: "🔋 Ideal Voltage Source (DC)", p_idc: "⚡ Ideal Current Source (DC)", p_vsin: "〰 Sine / AC Source",
    p_vpulse: "⎍ Pulse Source", p_vsweep: "📈 Sweep / Chirp Source",
    p_vcvs: "◇ VCVS (Voltage-Controlled V)", p_vccs: "◇ VCCS (Voltage-Controlled I)", p_cccs: "◇ CCCS (Current-Controlled I)", p_ccvs: "◇ CCVS (Current-Controlled V)",
    p_subckt: "Import Subckt ▸",
    d_move: "Move / Arrange", d_wire: "Connect Pins",
    m_github: "🐙 GitHub Home", m_dev_info: "👤 Developer Info ▸", m_author: "Author: Etherealnymph", m_other_proj: "🚀 Other Projects", m_contact: "✉ Contact Author",
    quick_term: "💻 Terminal", quick_gen: "▶ Generate", quick_check: "✔ Check Wires",
    tip_quick_term: "Open bottom Terminal dock", tip_pdk_badge: "Click to switch or import PDK",
    pane_files: "📁 Files", pane_files_short: "Files", pane_code_short: "Source Code", pane_canvas: "📐 Schematic View",
    status_ready: "Ready", btn_clear_all_hl: "✖ Clear All Highlights",
    tip_expand_files: "Expand Explorer", tip_collapse_files: "Collapse Explorer", tip_new_file: "New Netlist",
    tip_expand_code: "Expand Code", tip_collapse_code: "Collapse Code", tip_move_left: "Move Left", tip_move_right: "Move Right",
    tip_place_island: "Drag grip to move Place Island", tip_close_pi: "Close Place Island",
    pi_label: "Place:", pi_res: "Res R", pi_ind: "Ind L", pi_cap: "Cap C", pi_vdc: "V Source", pi_idc: "I Source", pi_sweep: "Sweep", pi_subckt: "Subckt",
    dock_tab_terminal: "💻 Terminal", dock_tab_scope: "Approximate teaching traces", dock_tab_spectrum: "📊 Spectrum", dock_tab_dcop: "📋 DC OP Table", quick_labs: "🧪 Labs", quick_share: "🔗 Share URL", dcop_tbl_title: "📋 DC Operating Point & Small-Signal Table", btn_export_csv: "💾 Export CSV", run_dcop_tbl: "📋 DC Operating Point Table", run_corner: "Parameter perturbation demo (approximate)", run_mc: "Random mismatch demo (approximate)", p_tline: "Transmission Line (Tline)", p_analog_rf: "Analog & BJT Blocks ▸", p_opamp: "OpAmp (err_n)", m_copy_dev: "📋 Copy Selected", m_paste_dev: "📥 Paste Devices", m_align_left: "⫷ Align Left", m_align_top: "⊤ Align Top", m_export_pdf: "🖨 Export Vector PDF (Print)", m_export_kicad: "🔌 Export KiCad Schematic", mod_labs_title: "🧪 Interactive Circuit Labs", ai_q_explain: "📊 AI Explain Sim",
    tip_dock_collapse: "Collapse/Expand Bottom Dock", tip_dock_close_all: "Close Bottom Dock",
    term_cwd_lbl: "Working Dir: ", term_copy_cd: "📋 Copy cd Command", tip_term_copy_cd: "Copy cd command to HTML directory",
    term_ph: "Enter command: help, pwd, ls, run tran, run dc, run ac, open scope, check...",
    btn_run_tran: "⚡ Tran", btn_run_dc: "📈 DC", btn_fft: "⚡ Tran FFT", btn_ac: "〰 AC Sweep",
    stim_type_lbl: "Excitation:", stim_none: "Default Sources", stim_sine: "Sine Wave", stim_pulse: "Pulse Wave", stim_step: "Step", stim_chirp: "Freq Sweep",
    stim_loc_lbl: "Excitation Node:", btn_pick_stim: "🎯 Pick Excitation", stim_ampl_lbl: "Ampl(V):", stim_freq_lbl: "Freq(MHz):",
    btn_pick_probe: "🎯 Pick Port", scope_xzoom: "X-Zoom:", scope_yzoom: "Y-Zoom:", btn_reset_zoom: "⟲ Reset", btn_new_term: "+ New Term", tip_new_folder: "New Project Folder", tip_save_proj: "Save Project", scope_cursor_idle: "Hover for intersection", scope_ports_lbl: "Probe Ports:",
    spec_port_lbl: "Response Port:", spec_mode_lbl: "Mode:", spec_opt_fft: "Tran FFT Spectrum (dBV)", spec_opt_ac: "AC Magnitude Response (dB)", spec_cursor_idle: "Hover to read freq/mag",
    footer_brand: "Spectre EDA Schematic & PDK Workbench · Author: Etherealnymph",
    mod_pdk_title: "Classic drawing symbol libraries", mod_pdk_list: "Drawing symbols and model-name mappings",
    mod_pdk_import: "📂 Import Local PDK (.scs/.lib)", mod_pdk_freeze: "💾 Freeze Active PDK Locally", btn_ok: "OK",
    mod_place_inst: "Instance Name", mod_place_model: "Model / Subckt Name", mod_place_nodes: "Connected Nets (space-separated)", mod_place_params: "Parameters (e.g. w=20u l=1u or r=10k)",
    btn_cancel: "Cancel", btn_place_confirm: "Place on Schematic",
    mod_island_title: "⚙ Customize Floating Island", btn_hide_island: "Hide Island", btn_done: "Done",
    mod_sc_title: "⌨ Keyboard Shortcuts (Click to Record)", btn_reset_default: "Reset Default",
    ai_title: "🤖 OpenCircuit EDA AI Assistant", ai_new_chat: "+ New Chat", ai_import: "Import", ai_clear_all: "Clear All", ai_send: "Send",
    ai_local_cache: "Local Cache", ai_q_analyze: "Analyze Circuit", ai_q_gen: "Generate Circuit", ai_q_save: "💾 Save Netlist Locally",
    ai_input_ph: "Enter circuit design request (Ctrl+Enter to send)...",
    ai_cfg_heading: "⚙ Configure AI Model Endpoint",
    ai_cfg_desc: "Once configured, the AI assistant helps write netlists, debug connectivity, design subcircuits, and save files locally.",
    ai_cfg_sec: "⚠ Security Notice: Your API Key is stored locally in browser localStorage and sent directly to the endpoint. Use at your own risk.",
    ai_cfg_preset_lbl: "Quick Preset (OpenAI / DeepSeek / Compatible)", ai_preset_custom: "Custom OpenAI-Compatible Endpoint",
    ai_cfg_base_lbl: "API Endpoint (Chat Completions URL)", ai_cfg_key_lbl: "API Key (Masked Locally)",
    ai_cfg_model_lbl: "Model Name", ai_cfg_model_ph: "deepseek-chat or gpt-4o-mini",
    ai_cfg_bind_dir: "📁 Bind Local Chat Folder", ai_cfg_save_btn: "Save Config & Start Chat",
    isl_gen: "▶ Run", isl_move: "✋ Move", isl_wire: "🔌 Wire", isl_undo: "↩ Undo", isl_redo: "↪ Redo", isl_check: "✔ Check", isl_fit: "⟲ Fit", isl_clear: "✖ Clear",
    tip_move_mode: "Move Mode: Ctrl+Click multi-select, drag marquee to move, double-click block/SPICE for internal schematic",
    tip_wire_mode: "Wire Mode: Click two device pins sequentially to connect"
  }
};

function t(key, fallback) {
  const dict = I18N_DICT[currentLang] || I18N_DICT.zh;
  return dict[key] || fallback || key;
}

function setLanguageMode(lang) {
  currentLang = lang === "en" ? "en" : "zh";
  try { localStorage.setItem("spectre_eda_lang", currentLang); } catch (e) {}
  applyLanguage();
  closeAllMenus();
}

function toggleLanguageQuick() {
  setLanguageMode(currentLang === "zh" ? "en" : "zh");
}

function applyLanguage() {
  const dict = I18N_DICT[currentLang] || I18N_DICT.zh;
  document.documentElement.lang = currentLang === "en" ? "en" : "zh-CN";
  document.title = dict.page_title;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const k = el.getAttribute("data-i18n");
    if (dict[k]) el.textContent = dict[k];
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    const k = el.getAttribute("data-i18n-title");
    if (dict[k]) el.title = dict[k];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const k = el.getAttribute("data-i18n-placeholder");
    if (dict[k]) el.placeholder = dict[k];
  });
  const islMap = { gen: "isl_gen", move: "isl_move", wire: "isl_wire", undo: "isl_undo", redo: "isl_redo", check: "isl_check", fit: "isl_fit", clear: "isl_clear" };
  ISLAND_CATALOG.forEach(item => { if (islMap[item.id] && dict[islMap[item.id]]) item.label = dict[islMap[item.id]]; });
  renderFloatingIsland();
  renderBottomDockTabs();
  updateBreadcrumbs();
  rerenderOnly();
  const modeTipEl = document.getElementById("mode-tip");
  if (modeTipEl) modeTipEl.textContent = editMode === "wire" ? dict.tip_wire_mode : dict.tip_move_mode;
  const qGen = document.getElementById("btn-quick-gen");
  const qChk = document.getElementById("btn-quick-check");
  if (qGen) qGen.textContent = dict.quick_gen;
  if (qChk) qChk.textContent = dict.quick_check;
  const zhChk = document.getElementById("chk-lang-zh");
  const enChk = document.getElementById("chk-lang-en");
  if (zhChk) zhChk.textContent = currentLang === "zh" ? "✓" : " ";
  if (enChk) enChk.textContent = currentLang === "en" ? "✓" : " ";
}

function setThemeMode(mode) {
  currentTheme = ["dark", "light", "system"].includes(mode) ? mode : "dark";
  try { localStorage.setItem("spectre_eda_theme", currentTheme); } catch (e) {}
  applyTheme();
  closeAllMenus();
}

function cycleThemeQuick() {
  const order = ["dark", "light", "system"];
  setThemeMode(order[(order.indexOf(currentTheme) + 1) % order.length]);
}

function applyTheme() {
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const useLight = currentTheme === "light" || (currentTheme === "system" && !prefersDark);
  document.body.classList.toggle("theme-light", useLight);
  ["dark", "light", "system"].forEach(m => {
    const chk = document.getElementById(`chk-theme-${m}`);
    if (chk) chk.textContent = currentTheme === m ? "✓" : " ";
  });
}

if (window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (currentTheme === "system") applyTheme();
  });
}

/* --- 下方停靠区域管理 (终端 / 示波器 / 频谱仪) --- */
let openDockTabs = [];
let activeDockTab = null;
let bottomDockOpen = false;
let bottomDockCollapsed = false;
let bottomResizerDrag = null;

const bottomResizerEl = document.getElementById("bottom-resizer");
if (bottomResizerEl) {
  bottomResizerEl.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const dock = document.getElementById("bottom-dock");
    bottomResizerDrag = { startY: e.clientY, startH: dock.getBoundingClientRect().height };
    bottomResizerEl.classList.add("dragging");
  });
}
window.addEventListener("mousemove", (e) => {
  if (!bottomResizerDrag) return;
  const dock = document.getElementById("bottom-dock");
  const nextH = Math.max(150, Math.min(window.innerHeight * 0.68, bottomResizerDrag.startH - (e.clientY - bottomResizerDrag.startY)));
  dock.style.height = `${nextH}px`;
  if (activeDockTab === "scope") drawOscilloscope();
  if (activeDockTab === "spectrum") drawSpectrumAnalyzer();
});
window.addEventListener("mouseup", () => {
  if (bottomResizerDrag) {
    bottomResizerEl?.classList.remove("dragging");
    bottomResizerDrag = null;
  }
});

function openBottomDock(tabId) {
  if (!openDockTabs.includes(tabId)) openDockTabs.push(tabId);
  activeDockTab = tabId;
  bottomDockOpen = true;
  bottomDockCollapsed = false;
  document.getElementById("bottom-dock").style.display = "flex";
  document.getElementById("bottom-dock-body").style.display = "flex";
  document.getElementById("bottom-resizer").style.display = "block";
  document.getElementById("btn-dock-collapse").textContent = "▼";
  renderBottomDockTabs();
  switchBottomDockTab(tabId);
}

function switchBottomDockTab(tabId) {
  activeDockTab = tabId;
  renderBottomDockTabs();
  ["terminal", "scope", "spectrum", "dcop"].forEach(id => {
    const p = document.getElementById(`dock-panel-${id}`);
    if (p) p.classList.toggle("active", id === tabId);
  });
  if (tabId === "scope") setTimeout(() => drawOscilloscope(), 20);
  if (tabId === "spectrum") setTimeout(() => drawSpectrumAnalyzer(), 20);
}

function closeBottomDockTab(tabId, ev) {
  if (ev) ev.stopPropagation();
  openDockTabs = openDockTabs.filter(t => t !== tabId);
  if (openDockTabs.length === 0) {
    closeAllBottomDock();
    return;
  }
  if (activeDockTab === tabId) activeDockTab = openDockTabs[openDockTabs.length - 1];
  renderBottomDockTabs();
  switchBottomDockTab(activeDockTab);
}

function closeAllBottomDock() {
  openDockTabs = [];
  activeDockTab = null;
  bottomDockOpen = false;
  document.getElementById("bottom-dock").style.display = "none";
  document.getElementById("bottom-resizer").style.display = "none";
}

function toggleBottomDockCollapse() {
  bottomDockCollapsed = !bottomDockCollapsed;
  const dock = document.getElementById("bottom-dock");
  const body = document.getElementById("bottom-dock-body");
  const btn = document.getElementById("btn-dock-collapse");
  if (bottomDockCollapsed) {
    body.style.display = "none";
    dock.style.height = "34px";
    btn.textContent = "▲";
  } else {
    body.style.display = "flex";
    dock.style.height = "310px";
    btn.textContent = "▼";
    if (activeDockTab === "scope") setTimeout(() => drawOscilloscope(), 20);
    if (activeDockTab === "spectrum") setTimeout(() => drawSpectrumAnalyzer(), 20);
  }
}

function renderBottomDockTabs() {
  const bar = document.getElementById("bottom-dock-tabs");
  if (!bar) return;
  bar.innerHTML = "";
  const labelMap = { terminal: "dock_tab_terminal", scope: "dock_tab_scope", spectrum: "dock_tab_spectrum", dcop: "dock_tab_dcop" };
  openDockTabs.forEach(id => {
    const tab = document.createElement("div");
    tab.className = "dock-tab" + (id === activeDockTab ? " active" : "");
    tab.innerHTML = `<span>${t(labelMap[id], id)}</span><span class="dock-tab-close">✕</span>`;
    tab.onclick = (e) => {
      if (e.target.classList.contains("dock-tab-close")) closeBottomDockTab(id, e);
      else switchBottomDockTab(id);
    };
    bar.appendChild(tab);
  });
}

/* --- 多终端并行管理 (默认路径为当前 HTML 所在路径) --- */
function getHtmlDirectoryPath() {
  try {
    const href = decodeURIComponent(window.location.href);
    if (href.startsWith("file:///")) {
      const p = href.replace(/^file:\/\//, "").replace(/\/[^/]*$/, "");
      return /^\/[A-Za-z]:/.test(p) ? p.slice(1).replace(/\//g, "\\") : p;
    }
    const dir = decodeURIComponent(window.location.pathname).replace(/\/[^/]*$/, "") || "/";
    return dir;
  } catch (e) {
    return "/";
  }
}

let termCwd = getHtmlDirectoryPath();
let terminalInstances = [];
let activeTerminalId = null;

function createNewTerminalInstance() {
  termCwd = getHtmlDirectoryPath();
  const idx = terminalInstances.length + 1;
  const id = `term_${Date.now()}_${idx}`;
  const inst = {
    id,
    title: currentLang === "en" ? `Term ${idx}` : `终端 ${idx}`,
    cwd: termCwd,
    output: `Spectre EDA Shell #${idx} [Working Dir: ${termCwd}]\n输入 "help" 查看可用命令 (支持 ls, pwd, cat, check, run tran, run dc, run ac, open scope, open spectrum, clear)`
  };
  terminalInstances.push(inst);
  activeTerminalId = id;
  renderTerminalTabs();
  switchTerminalInstance(id);
}

function switchTerminalInstance(id) {
  activeTerminalId = id;
  const inst = terminalInstances.find(t => t.id === id);
  if (!inst) return;
  document.getElementById("term-cwd-label").textContent = inst.cwd;
  document.getElementById("term-prompt").textContent = `eda:${inst.cwd}$`;
  const out = document.getElementById("term-output");
  out.textContent = inst.output;
  out.scrollTop = out.scrollHeight;
  renderTerminalTabs();
}

function closeTerminalInstance(id, ev) {
  if (ev) ev.stopPropagation();
  terminalInstances = terminalInstances.filter(t => t.id !== id);
  if (terminalInstances.length === 0) {
    createNewTerminalInstance();
    return;
  }
  if (activeTerminalId === id) activeTerminalId = terminalInstances[terminalInstances.length - 1].id;
  switchTerminalInstance(activeTerminalId);
}

function renderTerminalTabs() {
  const bar = document.getElementById("term-tabs-bar");
  if (!bar) return;
  bar.innerHTML = "";
  terminalInstances.forEach(inst => {
    const el = document.createElement("div");
    el.className = "term-subtab" + (inst.id === activeTerminalId ? " active" : "");
    el.innerHTML = `<span>💻 ${inst.title}</span><span class="term-subtab-x">✕</span>`;
    el.onclick = (e) => {
      if (e.target.classList.contains("term-subtab-x")) closeTerminalInstance(inst.id, e);
      else switchTerminalInstance(inst.id);
    };
    bar.appendChild(el);
  });
}

function openTerminalModal() {
  if (terminalInstances.length === 0) createNewTerminalInstance();
  else switchTerminalInstance(activeTerminalId);
  openBottomDock("terminal");
  setTimeout(() => document.getElementById("term-input")?.focus(), 50);
}

function appendTermLine(txt) {
  const inst = terminalInstances.find(t => t.id === activeTerminalId);
  if (inst) inst.output += (inst.output ? "\n" : "") + txt;
  const out = document.getElementById("term-output");
  if (!out) return;
  out.textContent += (out.textContent ? "\n" : "") + txt;
  out.scrollTop = out.scrollHeight;
}

function copyTerminalCdCmd() {
  const cmd = `cd "${getHtmlDirectoryPath()}"`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(cmd).catch(() => {});
  } else {
    const ta = document.createElement("textarea");
    ta.value = cmd;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    ta.remove();
  }
  appendTermLine(`[已复制系统终端切换目录命令]: ${cmd}`);
}

const termInp = document.getElementById("term-input");
if (termInp) {
  termInp.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const cmd = termInp.value.trim();
    termInp.value = "";
    if (!cmd) return;
    const inst = terminalInstances.find(t => t.id === activeTerminalId);
    const cwd = inst ? inst.cwd : termCwd;
    appendTermLine(`eda:${cwd}$ ${cmd}`);
    const parts = cmd.split(/\s+/);
    const op = parts[0].toLowerCase();
    if (op === "help") {
      appendTermLine("可用命令:\n  pwd            显示当前 HTML 所在目录\n  ls             列出工作区网表文件与当前子电路\n  cat            输出当前活动网表内容\n  check          执行跨层级连线检查\n  run tran|dc|ac 运行瞬态 / 直流扫描 / 交流扫频仿真\n  open scope     打开下方示波器\n  open spectrum  打开下方频谱仪\n  new            新建一个并行终端\n  clear          清空当前终端输出");
    } else if (op === "new") {
      createNewTerminalInstance();
    } else if (op === "pwd") {
      appendTermLine(cwd);
    } else if (op === "ls") {
      appendTermLine(workspaceFiles.map(f => `${f.path}${f.id === activeFileId ? "  [active]" : ""}`).join("\n"));
    } else if (op === "cat") {
      appendTermLine(getActiveFile()?.content || "(空)");
    } else if (op === "clear") {
      if (inst) inst.output = "";
      document.getElementById("term-output").textContent = "";
    } else if (op === "check") {
      runConnectivityCheck();
      appendTermLine("已触发跨层级连线检查，详情请见原理图上方反馈横幅。");
    } else if (op === "run" && ["tran", "dc", "ac"].includes((parts[1] || "").toLowerCase())) {
      const st = parts[1].toLowerCase();
      toWorkbench(st,"scope");
    } else if (op === "open" && parts[1] === "scope") {
      toWorkbench("tran","scope");
    } else if (op === "open" && parts[1] === "spectrum") {
      toWorkbench("tran","spectrum");
    } else {
      appendTermLine(`未知命令: ${cmd} (输入 help 查看支持命令)`);
    }
  });
}

/* --- Tran / DC / AC 仿真引擎 + 激励选择 + 原理图端口联动 --- */
let simDataStore = { tran: null, dc: null, ac: null };
const TRACE_COLORS = ["#38bdf8", "#4ade80", "#fbbf24", "#f472b6", "#a78bfa", "#fb7185"];
let scopeActiveNodes = new Set();
let activeScopeType = "tran";
let pickingSchematicPortMode = null; // 'stim' | 'probe' | null

function collectCircuitSignalNodes() {
  const layout = getCurrentLayout();
  const nets = new Set();
  if (layout && layout.elements) {
    layout.elements.forEach(el => el.pins.forEach(p => {
      if (p.net && !isHighVoltNet(p.net) && !isLowVoltNet(p.net) && !isNegVoltNet(p.net)) {
        nets.add(p.net);
      }
    }));
  }
  if (nets.size === 0) ["vref", "iref", "out", "in"].forEach(n => nets.add(n));
  return Array.from(nets);
}

function populateExcitationNodeSelectors() {
  const nodes = collectCircuitSignalNodes();
  const s1 = document.getElementById("stim-node-select");
  const s2 = document.getElementById("spec-stim-node-select");
  [s1, s2].forEach(sel => {
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = "";
    nodes.forEach(n => {
      const opt = document.createElement("option");
      opt.value = n; opt.textContent = n;
      sel.appendChild(opt);
    });
    if (prev && nodes.includes(prev)) sel.value = prev;
  });
}

function syncStimNodeFromSpec(val) {
  const s1 = document.getElementById("stim-node-select");
  if (s1) s1.value = val;
  onExcitationChanged();
}

function onExcitationChanged() {
  const s1 = document.getElementById("stim-node-select");
  const s2 = document.getElementById("spec-stim-node-select");
  if (s1 && s2) s2.value = s1.value;
  runSpiceSimulation(activeScopeType, true);
  if (activeDockTab === "scope") drawOscilloscope();
  if (activeDockTab === "spectrum") {
    runSpiceSimulation("ac", true);
    drawSpectrumAnalyzer();
  }
}

function startPickSchematicPort(mode) {
  pickingSchematicPortMode = mode;
  document.getElementById("mode-tip").textContent = mode === "stim"
    ? (currentLang === "en" ? "🎯 Click any port/pin on the schematic to set Excitation Location" : "🎯 请点击原理图上的端口或引脚作为【激励注入位置】")
    : (currentLang === "en" ? "🎯 Click any port/pin on the schematic to view its response" : "🎯 请点击原理图上的端口或引脚查看对应响应");
}

function handleSchematicPortPicked(netName) {
  if (!netName) return;
  const mode = pickingSchematicPortMode;
  pickingSchematicPortMode = null;
  if (mode === "stim") {
    populateExcitationNodeSelectors();
    const s1 = document.getElementById("stim-node-select");
    const s2 = document.getElementById("spec-stim-node-select");
    if (s1) s1.value = netName;
    if (s2) s2.value = netName;
    const st = document.getElementById("stim-type-select");
    if (st && st.value === "none") st.value = "sine";
    onExcitationChanged();
    document.getElementById("mode-tip").textContent = currentLang === "en"
      ? `Excitation set to node: ${netName}`
      : `已将激励位置设为端口/网络: ${netName}`;
  } else {
    selectProbePortFromSchematic(netName);
  }
}

function selectProbePortFromSchematic(netName) {
  scopeActiveNodes.add(netName);
  const specSel = document.getElementById("spec-node-select");
  if (specSel) {
    if (!Array.from(specSel.options).some(o => o.value === netName)) {
      const opt = document.createElement("option");
      opt.value = netName; opt.textContent = netName;
      specSel.appendChild(opt);
    }
    specSel.value = netName;
  }
  if (activeDockTab === "scope") openOscilloscopeModal();
  else if (activeDockTab === "spectrum") drawSpectrumAnalyzer();
  document.getElementById("mode-tip").textContent = currentLang === "en"
    ? `Viewing response for port: ${netName}`
    : `已选择原理图端口 ${netName} 查看对应响应`;
}

function runSpiceSimulation(simType, silentModal = false) {
  const f = getActiveFile();
  const layout = getCurrentLayout();
  const elements = layout?.elements || [];
  const nodes = collectCircuitSignalNodes();
  const isRf = (f?.activeSubckt || "").toLowerCase().includes("lna") || (f?.content || "").toLowerCase().includes("nmos_rf");

  const stimType = document.getElementById("stim-type-select")?.value || "none";
  const stimNode = document.getElementById("stim-node-select")?.value || nodes[0];
  const stimAmpl = parseFloat(document.getElementById("stim-ampl-input")?.value || "1.0") || 1.0;
  const stimFreqMhz = parseFloat(document.getElementById("stim-freq-input")?.value || "10") || 10;
  const stimFreqHz = stimFreqMhz * 1e6;
  const pdkOpts = { pdkParams: typeof pdkSimParams !== "undefined" ? pdkSimParams : undefined };

  try {
    if (simType === "tran") {
      const tMax = stimType !== "none" ? Math.max(2e-9, 5 / stimFreqHz) : (isRf ? 10e-9 : 10e-6);
      const res = simulateTran(elements, tMax, {
        ...pdkOpts,
        numSteps: 256,
        stim: { type: stimType, node: stimNode, ampl: stimAmpl, freqHz: stimFreqHz }
      });
      if (res.warnings?.length) showToast(res.warnings[0], "warn", 4000);
      simDataStore.tran = { type: "tran", xLabel: res.xLabel, xScale: res.xScale, xVals: res.xVals, series: res.series };
      activeScopeType = "tran";
      if (!silentModal) openOscilloscopeModal();
    } else if (simType === "dc") {
      const sweepNode = stimNode || nodes[0];
      const res = simulateDC(elements, {
        ...pdkOpts,
        sweepNode,
        vStart: 0,
        vStop: 2.5,
        numPoints: 120
      });
      if (res.warnings?.length) showToast(res.warnings[0], "warn", 4000);
      simDataStore.dc = { type: "dc", xLabel: res.xLabel, xScale: res.xScale, xVals: res.xVals, series: res.series };
      activeScopeType = "dc";
      if (!silentModal) openOscilloscopeModal();
    } else if (simType === "ac") {
      const res = simulateAC(elements, {
        ...pdkOpts,
        stimNode: stimNode || nodes[0],
        stimAmpl,
        fStart: 10,
        fStop: isRf ? 5e9 : 1e9,
        numPoints: 160
      });
      if (res.warnings?.length) showToast(res.warnings[0], "warn", 4000);
      simDataStore.ac = { type: "ac", freqs: res.freqs, seriesDb: res.seriesDb };
      if (!silentModal) openSpectrumModal("ac");
    }
    const modeTip = document.getElementById("mode-tip");
    if (modeTip) {
      modeTip.textContent = currentLang === "en"
        ? `Completed illustrative ${simType.toUpperCase()} estimate (${nodes.length} nodes)`
        : `已完成 ${simType.toUpperCase()} 教学近似仿真 (${nodes.length} 个观测节点)`;
    }
  } catch (err) {
    showToast(`仿真求解失败: ${err.message}`, "err", 5500);
  }
}

function openOscilloscopeModal() {
  populateExcitationNodeSelectors();
  if (!simDataStore[activeScopeType]) runSpiceSimulation("tran", true);
  const data = simDataStore[activeScopeType] || simDataStore.tran;
  if (!data?.series) return;
  const chBox = document.getElementById("scope-channels");
  const nodeNames = Object.keys(data.series);
  if (scopeActiveNodes.size === 0) nodeNames.slice(0, 3).forEach(n => scopeActiveNodes.add(n));
  chBox.innerHTML = "";
  nodeNames.forEach((n, idx) => {
    const color = TRACE_COLORS[idx % TRACE_COLORS.length];
    const lbl = document.createElement("label");
    lbl.style.cssText = `display:inline-flex;align-items:center;gap:4px;cursor:pointer;color:${color};font-weight:600;`;
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = scopeActiveNodes.has(n);
    cb.onchange = () => {
      if (cb.checked) scopeActiveNodes.add(n);
      else scopeActiveNodes.delete(n);
      drawOscilloscope();
    };
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(n));
    chBox.appendChild(lbl);
  });
  openBottomDock("scope");
}

let scopeZoomX = 1, scopeZoomY = 1, scopePanX = 0, scopePanY = 0, scopeHoverPt = null;
let specZoomX = 1, specZoomY = 1, specPanX = 0, specPanY = 0, specHoverPt = null;

function setScopeZoom(zx, zy, anchorFracX = null, anchorFracY = null) {
  const prevZx = scopeZoomX, prevZy = scopeZoomY;
  if (zx !== null) {
    scopeZoomX = Math.max(1, Math.min(12, parseFloat(zx) || 1));
    const el = document.getElementById("scope-xzoom");
    if (el) el.value = scopeZoomX;
    if (anchorFracX !== null) {
      const worldX = scopePanX + anchorFracX / prevZx;
      scopePanX = Math.max(0, Math.min(1 - 1 / scopeZoomX, worldX - anchorFracX / scopeZoomX));
    } else {
      scopePanX = Math.max(0, Math.min(1 - 1 / scopeZoomX, scopePanX));
    }
  }
  if (zy !== null) {
    scopeZoomY = Math.max(0.5, Math.min(10, parseFloat(zy) || 1));
    const el = document.getElementById("scope-yzoom");
    if (el) el.value = scopeZoomY;
    if (anchorFracY !== null) {
      const worldY = scopePanY + (0.5 - anchorFracY) / prevZy;
      scopePanY = worldY - (0.5 - anchorFracY) / scopeZoomY;
    }
  }
  drawOscilloscope(scopeHoverPt);
}

function resetScopeView() {
  scopePanX = 0; scopePanY = 0;
  setScopeZoom(1, 1);
}

function setSpecZoom(zx, zy, anchorFracX = null, anchorFracY = null) {
  const prevZx = specZoomX, prevZy = specZoomY;
  if (zx !== null) {
    specZoomX = Math.max(1, Math.min(12, parseFloat(zx) || 1));
    const el = document.getElementById("spec-xzoom");
    if (el) el.value = specZoomX;
    if (anchorFracX !== null) {
      const worldX = specPanX + anchorFracX / prevZx;
      specPanX = Math.max(0, Math.min(1 - 1 / specZoomX, worldX - anchorFracX / specZoomX));
    } else {
      specPanX = Math.max(0, Math.min(1 - 1 / specZoomX, specPanX));
    }
  }
  if (zy !== null) {
    specZoomY = Math.max(0.5, Math.min(10, parseFloat(zy) || 1));
    const el = document.getElementById("spec-yzoom");
    if (el) el.value = specZoomY;
    if (anchorFracY !== null) {
      const worldY = specPanY + (0.5 - anchorFracY) / prevZy;
      specPanY = worldY - (0.5 - anchorFracY) / specZoomY;
    }
  }
  drawSpectrumAnalyzer(specHoverPt);
}

function resetSpecView() {
  specPanX = 0; specPanY = 0;
  setSpecZoom(1, 1);
}

function drawOscilloscope(hoverPt = null) {
  const canvas = document.getElementById("scope-canvas");
  const data = simDataStore[activeScopeType] || simDataStore.tran;
  if (!canvas || !data) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = Math.max(360, rect.width);
  canvas.height = Math.max(130, rect.height);
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const pad = { l: 54, r: 18, t: 14, b: 36 };
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;

  ctx.fillStyle = "#090d16";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) { const gx = pad.l + (pw * i) / 10; ctx.beginPath(); ctx.moveTo(gx, pad.t); ctx.lineTo(gx, pad.t + ph); ctx.stroke(); }
  for (let j = 0; j <= 6; j++) { const gy = pad.t + (ph * j) / 6; ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(pad.l + pw, gy); ctx.stroke(); }

  const totalLen = data.xVals.length;
  const startIdx = Math.min(totalLen - 2, Math.max(0, Math.floor(scopePanX * (totalLen - 1))));
  const winLen = Math.max(2, Math.floor(totalLen / scopeZoomX));
  const endIdx = Math.min(totalLen, startIdx + winLen);
  const xSub = data.xVals.slice(startIdx, endIdx);
  const activeList = Object.keys(data.series).filter(n => scopeActiveNodes.has(n));

  let yMin = Infinity, yMax = -Infinity;
  activeList.forEach(n => {
    data.series[n].forEach(v => { yMin = Math.min(yMin, v); yMax = Math.max(yMax, v); });
  });
  if (!isFinite(yMin)) { yMin = 0; yMax = 2; }
  if (Math.abs(yMax - yMin) < 0.05) { yMin -= 0.2; yMax += 0.2; }
  const baseSpan = (yMax - yMin) * 1.15;
  const yMid = (yMin + yMax) / 2 + scopePanY * baseSpan;
  const yHalf = (baseSpan / 2) / scopeZoomY;
  yMin = yMid - yHalf; yMax = yMid + yHalf;

  // Y-axis ticks
  ctx.fillStyle = "#94a3b8";
  ctx.font = "11px Consolas, monospace";
  ctx.textAlign = "right";
  for (let j = 0; j <= 4; j++) {
    const val = yMax - ((yMax - yMin) * j) / 4;
    ctx.fillText(val.toFixed(2) + "V", pad.l - 6, pad.t + (ph * j) / 4 + 4);
  }

  // X-axis ticks & numeric labels
  ctx.textAlign = "center";
  for (let i = 0; i <= 5; i++) {
    const idx = Math.min(xSub.length - 1, Math.round(((xSub.length - 1) * i) / 5));
    const gx = pad.l + (pw * i) / 5;
    const xVal = (xSub[idx] * data.xScale).toFixed(2);
    ctx.fillText(xVal, gx, pad.t + ph + 13);
  }
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(data.xLabel, pad.l + pw / 2, H - 4);

  // Traces
  ctx.save();
  ctx.beginPath();
  ctx.rect(pad.l, pad.t, pw, ph);
  ctx.clip();
  const stats = [];
  Object.keys(data.series).forEach((n, idx) => {
    if (!scopeActiveNodes.has(n)) return;
    const ys = data.series[n].slice(startIdx, endIdx);
    const color = TRACE_COLORS[idx % TRACE_COLORS.length];
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ys.forEach((v, i) => {
      const px = pad.l + (i / (ys.length - 1)) * pw;
      const py = pad.t + (1 - (v - yMin) / (yMax - yMin)) * ph;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.stroke();
    const mn = Math.min(...ys), mx = Math.max(...ys);
    stats.push(`${n}: min=${mn.toFixed(3)}V, max=${mx.toFixed(3)}V, Vpp=${(mx - mn).toFixed(3)}V`);
  });

  // Crosshair & Intersection dots
  if (hoverPt && hoverPt.x >= pad.l && hoverPt.x <= pad.l + pw && hoverPt.y >= pad.t && hoverPt.y <= pad.t + ph) {
    ctx.strokeStyle = "rgba(248, 250, 252, 0.45)";
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(hoverPt.x, pad.t); ctx.lineTo(hoverPt.x, pad.t + ph); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad.l, hoverPt.y); ctx.lineTo(pad.l + pw, hoverPt.y); ctx.stroke();
    ctx.setLineDash([]);

    const localIdx = Math.min(xSub.length - 1, Math.max(0, Math.round(((hoverPt.x - pad.l) / pw) * (xSub.length - 1))));
    const idx = startIdx + localIdx;
    const xv = (xSub[localIdx] * data.xScale).toFixed(2);
    const interPairs = [];
    Object.keys(data.series).forEach((n, cIdx) => {
      if (!scopeActiveNodes.has(n)) return;
      const val = data.series[n][idx];
      const py = pad.t + (1 - (val - yMin) / (yMax - yMin)) * ph;
      const px = pad.l + (localIdx / (xSub.length - 1)) * pw;
      ctx.fillStyle = TRACE_COLORS[cIdx % TRACE_COLORS.length];
      ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.2; ctx.stroke();
      interPairs.push(`${n}=${val.toFixed(3)}V`);
    });
    document.getElementById("scope-cursor-info").textContent = `X=${xv} | ${interPairs.slice(0, 2).join(" ")}`;

    // Floating HUD box
    const hudLines = [`X: ${xv} (${data.xLabel})`, ...interPairs];
    const boxW = Math.max(125, ...hudLines.map(l => l.length * 6.8 + 14));
    const boxH = hudLines.length * 15 + 8;
    const bx = hoverPt.x + 12 + boxW > pad.l + pw ? hoverPt.x - boxW - 10 : hoverPt.x + 12;
    const by = Math.max(pad.t + 4, Math.min(pad.t + ph - boxH - 4, hoverPt.y - 10));
    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 1; ctx.strokeRect(bx, by, boxW, boxH);
    ctx.fillStyle = "#f8fafc"; ctx.textAlign = "left"; ctx.font = "11px Consolas, monospace";
    hudLines.forEach((ln, li) => ctx.fillText(ln, bx + 7, by + 15 + li * 15));
  }
  ctx.restore();
  document.getElementById("scope-metrics").textContent = stats.join("  |  ") || (currentLang === "en" ? "Select at least one probe port" : "请勾选至少一个观测端口");
}

let scopeDragSel = null;
const scopeCanvasEl = document.getElementById("scope-canvas");
if (scopeCanvasEl) {
  scopeCanvasEl.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const r = scopeCanvasEl.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const padL = 54, padT = 14;
    if (y <= padT + 26 && x >= padL) {
      scopeDragSel = { axis: "x", startX: x, curX: x, startY: y, curY: y };
    } else if (x <= padL + 22 && y >= padT) {
      scopeDragSel = { axis: "y", startX: x, curX: x, startY: y, curY: y };
    }
  });
  scopeCanvasEl.addEventListener("mousemove", (e) => {
    const r = scopeCanvasEl.getBoundingClientRect();
    scopeHoverPt = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (scopeDragSel) {
      scopeDragSel.curX = scopeHoverPt.x;
      scopeDragSel.curY = scopeHoverPt.y;
    }
    drawOscilloscope(scopeHoverPt);
    if (scopeDragSel) {
      const ctx = scopeCanvasEl.getContext("2d");
      ctx.save();
      ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.2;
      if (scopeDragSel.axis === "x") {
        const sx = Math.min(scopeDragSel.startX, scopeDragSel.curX);
        const sw = Math.abs(scopeDragSel.curX - scopeDragSel.startX);
        ctx.fillRect(sx, 0, sw, scopeCanvasEl.height);
        ctx.strokeRect(sx, 0, sw, scopeCanvasEl.height);
      } else {
        const sy = Math.min(scopeDragSel.startY, scopeDragSel.curY);
        const sh = Math.abs(scopeDragSel.curY - scopeDragSel.startY);
        ctx.fillRect(0, sy, scopeCanvasEl.width, sh);
        ctx.strokeRect(0, sy, scopeCanvasEl.width, sh);
      }
      ctx.restore();
    }
  });
  window.addEventListener("mouseup", () => {
    if (!scopeDragSel) return;
    const sel = scopeDragSel;
    scopeDragSel = null;
    const r = scopeCanvasEl.getBoundingClientRect();
    const padL = 54, padR = 18, padT = 14, padB = 36;
    const pw = Math.max(1, r.width - padL - padR);
    const ph = Math.max(1, r.height - padT - padB);
    if (sel.axis === "x" && Math.abs(sel.curX - sel.startX) > 10) {
      const f1 = Math.max(0, Math.min(1, (Math.min(sel.startX, sel.curX) - padL) / pw));
      const f2 = Math.max(0, Math.min(1, (Math.max(sel.startX, sel.curX) - padL) / pw));
      const span = Math.max(0.02, f2 - f1);
      scopePanX = Math.max(0, Math.min(1 - 1 / (scopeZoomX / span), scopePanX + f1 / scopeZoomX));
      setScopeZoom(Math.min(20, scopeZoomX / span), null);
    } else if (sel.axis === "y" && Math.abs(sel.curY - sel.startY) > 10) {
      const fy1 = Math.max(0, Math.min(1, (Math.min(sel.startY, sel.curY) - padT) / ph));
      const fy2 = Math.max(0, Math.min(1, (Math.max(sel.startY, sel.curY) - padT) / ph));
      const span = Math.max(0.05, fy2 - fy1);
      const midFrac = (fy1 + fy2) / 2;
      scopePanY += (0.5 - midFrac) / scopeZoomY;
      setScopeZoom(null, Math.min(16, scopeZoomY / span));
    } else {
      drawOscilloscope(scopeHoverPt);
    }
  });
  scopeCanvasEl.addEventListener("mouseleave", () => { if (!scopeDragSel) { scopeHoverPt = null; drawOscilloscope(null); } });
  scopeCanvasEl.addEventListener("dblclick", () => resetScopeView());
  scopeCanvasEl.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = scopeCanvasEl.getBoundingClientRect();
    const padL = 54, padR = 18, padT = 14, padB = 36;
    const fx = Math.max(0, Math.min(1, (e.clientX - r.left - padL) / Math.max(1, r.width - padL - padR)));
    const fy = Math.max(0, Math.min(1, (e.clientY - r.top - padT) / Math.max(1, r.height - padT - padB)));
    const factor = e.deltaY < 0 ? 1.22 : 0.82;
    if (e.ctrlKey || e.metaKey || e.shiftKey) setScopeZoom(null, scopeZoomY * factor, null, fy);
    else setScopeZoom(scopeZoomX * factor, null, fx, null);
  }, { passive: false });
}

function computeSimpleFFT(samples) {
  const N = samples.length;
  const half = Math.floor(N / 2);
  const mean = samples.reduce((a, b) => a + b, 0) / N;
  const magsDb = [];
  for (let k = 0; k < half; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const ang = (2 * Math.PI * k * n) / N;
      const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (N - 1));
      const x = (samples[n] - mean) * w;
      re += x * Math.cos(ang);
      im -= x * Math.sin(ang);
    }
    const amp = (2 * Math.hypot(re, im)) / N;
    magsDb.push(20 * Math.log10(Math.max(amp, 1e-6)));
  }
  return magsDb;
}

function openSpectrumModal(forceMode = null) {
  populateExcitationNodeSelectors();
  if (!simDataStore.tran) runSpiceSimulation("tran", true);
  if (!simDataStore.ac) runSpiceSimulation("ac", true);
  const sel = document.getElementById("spec-node-select");
  const modeSel = document.getElementById("spec-mode-select");
  if (forceMode && modeSel) modeSel.value = forceMode;
  const nodes = Object.keys(simDataStore.tran.series);
  const prev = sel.value;
  sel.innerHTML = "";
  nodes.forEach(n => {
    const opt = document.createElement("option");
    opt.value = n; opt.textContent = n;
    sel.appendChild(opt);
  });
  if (prev && nodes.includes(prev)) sel.value = prev;
  openBottomDock("spectrum");
}

function drawSpectrumAnalyzer(hoverPt = null) {
  const canvas = document.getElementById("spectrum-canvas");
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = Math.max(360, rect.width);
  canvas.height = Math.max(130, rect.height);
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const pad = { l: 54, r: 18, t: 14, b: 36 };
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;

  ctx.fillStyle = "#090d16";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#1e293b";
  for (let i = 0; i <= 10; i++) { const gx = pad.l + (pw * i) / 10; ctx.beginPath(); ctx.moveTo(gx, pad.t); ctx.lineTo(gx, pad.t + ph); ctx.stroke(); }
  for (let j = 0; j <= 6; j++) { const gy = pad.t + (ph * j) / 6; ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(pad.l + pw, gy); ctx.stroke(); }

  const mode = document.getElementById("spec-mode-select")?.value || "fft";
  const node = document.getElementById("spec-node-select")?.value || "vref";
  let ysFull = [], xTitle = "", peakTxt = "", xLabels = [];

  if (mode === "ac" && simDataStore.ac) {
    ysFull = simDataStore.ac.seriesDb[node] || Object.values(simDataStore.ac.seriesDb)[0];
    xTitle = currentLang === "en" ? "Frequency (Hz)" : "频率 (Hz)";
    const maxDb = Math.max(...ysFull);
    const f3dbIdx = ysFull.findIndex(v => v <= maxDb - 3);
    const bw = f3dbIdx !== -1 ? simDataStore.ac.freqs[f3dbIdx] : simDataStore.ac.freqs[ysFull.length - 1];
    peakTxt = `${node} AC: DC Gain=${maxDb.toFixed(1)} dB, -3dB BW=${bw >= 1e9 ? (bw / 1e9).toFixed(2) + " GHz" : (bw >= 1e6 ? (bw / 1e6).toFixed(2) + " MHz" : (bw / 1e3).toFixed(1) + " kHz")}`;
    xLabels = simDataStore.ac.freqs.map(f => f >= 1e9 ? (f / 1e9).toFixed(1) + "G" : (f >= 1e6 ? (f / 1e6).toFixed(1) + "M" : (f >= 1e3 ? (f / 1e3).toFixed(0) + "k" : f.toFixed(0))));
  } else if (simDataStore.tran) {
    const samples = simDataStore.tran.series[node] || Object.values(simDataStore.tran.series)[0];
    ysFull = computeSimpleFFT(samples);
    const tArr = simDataStore.tran.xVals;
    const fs = (tArr.length - 1) / (tArr[tArr.length - 1] - tArr[0]);
    xTitle = currentLang === "en" ? "Frequency (MHz)" : "频率 (MHz)";
    let peakK = 1;
    for (let k = 1; k < ysFull.length; k++) if (ysFull[k] > ysFull[peakK]) peakK = k;
    const peakF = (peakK * fs / samples.length / 1e6).toFixed(2);
    peakTxt = `${node} FFT: Peak=${peakF} MHz (Bin ${peakK}), Mag=${ysFull[peakK].toFixed(1)} dBV`;
    xLabels = ysFull.map((_, k) => ((k * fs / samples.length) / 1e6).toFixed(1) + "M");
  }

  const totalLen = ysFull.length;
  const startIdx = Math.min(totalLen - 4, Math.max(0, Math.floor(specPanX * (totalLen - 1))));
  const winLen = Math.max(4, Math.floor(totalLen / specZoomX));
  const endIdx = Math.min(totalLen, startIdx + winLen);
  const ys = ysFull.slice(startIdx, endIdx);
  const xSubLabels = xLabels.slice(startIdx, endIdx);
  let yMin = Math.min(...ysFull, -100), yMax = Math.max(...ysFull, 10) + 5;
  const baseSpan = yMax - yMin;
  const yMid = (yMin + yMax) / 2 + specPanY * baseSpan;
  const yHalf = (baseSpan / 2) / specZoomY;
  yMin = yMid - yHalf; yMax = yMid + yHalf;

  ctx.fillStyle = "#94a3b8";
  ctx.font = "11px Consolas, monospace";
  ctx.textAlign = "right";
  for (let j = 0; j <= 4; j++) {
    const val = yMax - ((yMax - yMin) * j) / 4;
    ctx.fillText(val.toFixed(0) + "dB", pad.l - 6, pad.t + (ph * j) / 4 + 4);
  }
  ctx.textAlign = "center";
  for (let i = 0; i <= 5; i++) {
    const idx = Math.min(ys.length - 1, Math.round(((ys.length - 1) * i) / 5));
    const gx = pad.l + (pw * i) / 5;
    ctx.fillText(xSubLabels[idx] || String(startIdx + idx), gx, pad.t + ph + 13);
  }
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(xTitle, pad.l + pw / 2, H - 4);

  ctx.save();
  ctx.beginPath();
  ctx.rect(pad.l, pad.t, pw, ph);
  ctx.clip();
  ctx.strokeStyle = mode === "ac" ? "#38bdf8" : "#fbbf24";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ys.forEach((v, i) => {
    const px = pad.l + (i / (ys.length - 1)) * pw;
    const py = pad.t + (1 - (v - yMin) / (yMax - yMin)) * ph;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.stroke();

  if (hoverPt && hoverPt.x >= pad.l && hoverPt.x <= pad.l + pw && hoverPt.y >= pad.t && hoverPt.y <= pad.t + ph) {
    ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(hoverPt.x, pad.t); ctx.lineTo(hoverPt.x, pad.t + ph); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad.l, hoverPt.y); ctx.lineTo(pad.l + pw, hoverPt.y); ctx.stroke();
    ctx.setLineDash([]);

    const idx = Math.min(ys.length - 1, Math.max(0, Math.round(((hoverPt.x - pad.l) / pw) * (ys.length - 1))));
    const px = pad.l + (idx / (ys.length - 1)) * pw;
    const py = pad.t + (1 - (ys[idx] - yMin) / (yMax - yMin)) * ph;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.2; ctx.stroke();

    const fLbl = xSubLabels[idx] || `Bin ${startIdx + idx}`;
    const magLbl = `${ys[idx].toFixed(1)} dB`;
    document.getElementById("spec-cursor-info").textContent = `F=${fLbl} | ${magLbl}`;

    const hudLines = [`Freq: ${fLbl}`, `${node}: ${magLbl}`];
    const boxW = Math.max(120, ...hudLines.map(l => l.length * 6.8 + 14));
    const boxH = 40;
    const bx = hoverPt.x + 12 + boxW > pad.l + pw ? hoverPt.x - boxW - 10 : hoverPt.x + 12;
    const by = Math.max(pad.t + 4, Math.min(pad.t + ph - boxH - 4, hoverPt.y - 10));
    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 1; ctx.strokeRect(bx, by, boxW, boxH);
    ctx.fillStyle = "#f8fafc"; ctx.textAlign = "left"; ctx.font = "11px Consolas, monospace";
    hudLines.forEach((ln, li) => ctx.fillText(ln, bx + 7, by + 15 + li * 15));
  }
  ctx.restore();
  document.getElementById("spec-metrics").textContent = peakTxt;
}

let specDragSel = null;
const specCanvasEl = document.getElementById("spectrum-canvas");
if (specCanvasEl) {
  specCanvasEl.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const r = specCanvasEl.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const padL = 54, padT = 14;
    if (y <= padT + 26 && x >= padL) {
      specDragSel = { axis: "x", startX: x, curX: x, startY: y, curY: y };
    } else if (x <= padL + 22 && y >= padT) {
      specDragSel = { axis: "y", startX: x, curX: x, startY: y, curY: y };
    }
  });
  specCanvasEl.addEventListener("mousemove", (e) => {
    const r = specCanvasEl.getBoundingClientRect();
    specHoverPt = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (specDragSel) {
      specDragSel.curX = specHoverPt.x;
      specDragSel.curY = specHoverPt.y;
    }
    drawSpectrumAnalyzer(specHoverPt);
    if (specDragSel) {
      const ctx = specCanvasEl.getContext("2d");
      ctx.save();
      ctx.fillStyle = "rgba(251, 191, 36, 0.25)";
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1.2;
      if (specDragSel.axis === "x") {
        const sx = Math.min(specDragSel.startX, specDragSel.curX);
        const sw = Math.abs(specDragSel.curX - specDragSel.startX);
        ctx.fillRect(sx, 0, sw, specCanvasEl.height);
        ctx.strokeRect(sx, 0, sw, specCanvasEl.height);
      } else {
        const sy = Math.min(specDragSel.startY, specDragSel.curY);
        const sh = Math.abs(specDragSel.curY - specDragSel.startY);
        ctx.fillRect(0, sy, specCanvasEl.width, sh);
        ctx.strokeRect(0, sy, specCanvasEl.width, sh);
      }
      ctx.restore();
    }
  });
  window.addEventListener("mouseup", () => {
    if (!specDragSel) return;
    const sel = specDragSel;
    specDragSel = null;
    const r = specCanvasEl.getBoundingClientRect();
    const padL = 54, padR = 18, padT = 14, padB = 36;
    const pw = Math.max(1, r.width - padL - padR);
    const ph = Math.max(1, r.height - padT - padB);
    if (sel.axis === "x" && Math.abs(sel.curX - sel.startX) > 10) {
      const f1 = Math.max(0, Math.min(1, (Math.min(sel.startX, sel.curX) - padL) / pw));
      const f2 = Math.max(0, Math.min(1, (Math.max(sel.startX, sel.curX) - padL) / pw));
      const span = Math.max(0.02, f2 - f1);
      specPanX = Math.max(0, Math.min(1 - 1 / (specZoomX / span), specPanX + f1 / specZoomX));
      setSpecZoom(Math.min(20, specZoomX / span), null);
    } else if (sel.axis === "y" && Math.abs(sel.curY - sel.startY) > 10) {
      const fy1 = Math.max(0, Math.min(1, (Math.min(sel.startY, sel.curY) - padT) / ph));
      const fy2 = Math.max(0, Math.min(1, (Math.max(sel.startY, sel.curY) - padT) / ph));
      const span = Math.max(0.05, fy2 - fy1);
      const midFrac = (fy1 + fy2) / 2;
      specPanY += (0.5 - midFrac) / specZoomY;
      setSpecZoom(null, Math.min(16, specZoomY / span));
    } else {
      drawSpectrumAnalyzer(specHoverPt);
    }
  });
  specCanvasEl.addEventListener("mouseleave", () => { if (!specDragSel) { specHoverPt = null; drawSpectrumAnalyzer(null); } });
  specCanvasEl.addEventListener("dblclick", () => resetSpecView());
  specCanvasEl.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = specCanvasEl.getBoundingClientRect();
    const padL = 54, padR = 18, padT = 14, padB = 36;
    const fx = Math.max(0, Math.min(1, (e.clientX - r.left - padL) / Math.max(1, r.width - padL - padR)));
    const fy = Math.max(0, Math.min(1, (e.clientY - r.top - padT) / Math.max(1, r.height - padT - padB)));
    const factor = e.deltaY < 0 ? 1.22 : 0.82;
    if (e.ctrlKey || e.metaKey || e.shiftKey) setSpecZoom(null, specZoomY * factor, null, fy);
    else setSpecZoom(specZoomX * factor, null, fx, null);
  }, { passive: false });
}


/* ============================================================================
 * 17. 高级工程能力：Corner/MonteCarlo、DC OP 报表、Lint、剪贴板/对齐、KiCad导出、实验库、URL分享、Sky130/GF180
 * ============================================================================ */
let pdkSimParams = { vth0: 0.50, kpN: 180e-6, lambda: 0.02 };
let copiedDevicesClipboard = [];
let currentLintIssues = [];

function runNetlistLint(fileObj) {
  const issues = [];
  if (!fileObj || !fileObj.parsedDesign) return issues;
  const sub = fileObj.parsedDesign.subckts[fileObj.activeSubckt];
  if (!sub) return issues;
  const seenNames = new Set();
  const netCounts = {};
  sub.elements.forEach(el => {
    if (seenNames.has(el.name)) issues.push(`重复器件名: ${el.name} (Line ${el.line})`);
    seenNames.add(el.name);
    el.pins.forEach(p => {
      if (!p.net || /^NC$/i.test(p.net)) issues.push(`悬空引脚: ${el.name}.${p.name} (Line ${el.line})`);
      else netCounts[p.net] = (netCounts[p.net] || 0) + 1;
    });
  });
  currentLintIssues = issues;
  const badge = document.getElementById("lint-badge");
  if (badge) {
    badge.className = "lint-badge " + (issues.length === 0 ? "ok" : "warn");
    badge.textContent = issues.length === 0 ? "✔ 0 Lint" : `⚠ ${issues.length} Lint`;
  }
  return issues;
}

function showLintToast() {
  if (currentLintIssues.length === 0) showToast("✔ 网表 Lint 检查通过，未发现语法或重复定义问题。", "ok");
  else showToast(`发现 ${currentLintIssues.length} 项 Lint 提示:\n` + currentLintIssues.slice(0, 4).join(" | "), "warn", 5000);
}

function copySelectedDevices() {
  const layout = getCurrentLayout();
  if (!layout || selectedDeviceNames.size === 0) {
    showToast("请先选中要复制的元件", "warn");
    return;
  }
  copiedDevicesClipboard = layout.elements
    .filter(e => selectedDeviceNames.has(e.name))
    .map(e => JSON.parse(JSON.stringify(e)));
  showToast(`已复制 ${copiedDevicesClipboard.length} 个元件到剪贴板`, "ok");
}

function pasteCopiedDevices() {
  const f = getActiveFile(), layout = getCurrentLayout();
  if (!f || !layout || copiedDevicesClipboard.length === 0) return;
  pushUndoSnapshot();
  selectedDeviceNames.clear();
  copiedDevicesClipboard.forEach((orig, idx) => {
    const clone = JSON.parse(JSON.stringify(orig));
    clone.name = `${orig.name}_c${layout.elements.length + idx + 1}`;
    clone.x = snap(orig.x + 60);
    clone.y = snap(orig.y + 60);
    computePinPositions(clone);
    layout.elements.push(clone);
    selectedDeviceNames.add(clone.name);
    const originalLine=f.content.split('\n')[orig.line-1];
    const first=originalLine?.trimStart().split(/[\s(]+/)[0];
    const line=first===orig.name ? originalLine.replace(/^(\s*)[^\s(]+/,(_,space)=>space+clone.name) : classicElementLine(clone,f);
    insertDeviceLineToNetlist(f, line);
  });
  rerenderOnly();
  showToast(`已粘贴 ${copiedDevicesClipboard.length} 个元件`, "ok");
}

function alignSelectedDevices(axis) {
  const layout = getCurrentLayout();
  if (!layout || selectedDeviceNames.size < 2) {
    showToast("请至少选中 2 个元件再进行对齐", "warn");
    return;
  }
  pushUndoSnapshot();
  const sel = layout.elements.filter(e => selectedDeviceNames.has(e.name));
  const ref = axis === "left" ? Math.min(...sel.map(e => e.x)) : Math.min(...sel.map(e => e.y));
  sel.forEach(e => {
    if (axis === "left") e.x = snap(ref);
    else e.y = snap(ref);
    computePinPositions(e);
  });
  rerenderOnly();
}

function exportPrintablePdf() {
  closeAllMenus();
  window.print();
}

function exportKiCadSch() {
  const f = getActiveFile(), layout = getCurrentLayout();
  if (!f || !layout) return;
  const lines = [
    `(kicad_sch (version 20230121) (generator opencircuit_eda)`,
    `  (paper "A4")`,
    `  (title_block (title "${f.activeSubckt}"))`
  ];
  layout.elements.forEach((el, i) => {
    const kx = (el.x * 0.254).toFixed(2), ky = (el.y * 0.254).toFixed(2);
    lines.push(`  (symbol (lib_id "Device:${el.type}") (at ${kx} ${ky} 0) (unit 1) (property "Reference" "${el.name}") (property "Value" "${el.model}"))`);
  });
  lines.push(`)`);
  downloadBlob(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }), `${f.activeSubckt}.kicad_sch`);
  showToast(`已导出 KiCad 兼容原理图 ${f.activeSubckt}.kicad_sch`, "ok");
}

function openDcOpTablePanel() {
  const f = getActiveFile(), layout = getCurrentLayout();
  if (!f || !layout) return;
  const dcOp = computeDcOperatingPoint(layout, f);
  const tbl = document.getElementById("dcop-table");
  if (!tbl) return;
  let rows = `<thead><tr><th>类型</th><th>名称</th><th>直流电压 / 电流</th><th>小信号 / 状态 (gm / ro / Region)</th></tr></thead><tbody>`;
  Object.entries(dcOp.nodeVoltages).forEach(([net, v]) => {
    const iStr = dcOp.wireCurrents?.[net] || "—";
    rows += `<tr><td>Node</td><td><b>${escapeHtml(net)}</b></td><td>${v.toFixed(4)} V</td><td>Branch I ≈ ${iStr}</td></tr>`;
  });
  layout.elements.forEach(el => {
    const op = dcOp.deviceOps[el.name] || "—";
    const mop = dcOp.mosOps?.[el.name];
    const gmStr = (el.type === "nmos" || el.type === "pmos") && mop
      ? `gm=${(mop.gm * 1e3).toFixed(2)}mS, ro=${(mop.ro / 1e3).toFixed(1)}kΩ`
      : `Model: ${el.model}`;
    rows += `<tr><td>${el.type.toUpperCase()}</td><td><b>${escapeHtml(el.name)}</b></td><td>${escapeHtml(op)}</td><td>${escapeHtml(gmStr)}</td></tr>`;
  });
  rows += `</tbody>`;
  tbl.innerHTML = rows;
  openBottomDock("dcop");
}

function exportDcOpCsv() {
  const f = getActiveFile(), layout = getCurrentLayout();
  if (!f || !layout) return;
  const dcOp = computeDcOperatingPoint(layout, f);
  const lines = ["Kind,Name,DC_Value,Detail"];
  Object.entries(dcOp.nodeVoltages).forEach(([n, v]) => lines.push(`Node,${n},${v.toFixed(4)}V,${dcOp.wireCurrents?.[n] || ""}`));
  layout.elements.forEach(el => lines.push(`${el.type},${el.name},${dcOp.deviceOps[el.name] || ""},${el.model}`));
  downloadBlob(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), `${f.activeSubckt}_dcop.csv`);
}

function runCornerSweep() {
  populateExcitationNodeSelectors();
  const layout = getCurrentLayout();
  const elements = layout?.elements || [];
  if (!elements.length) return;
  const nodes = collectCircuitSignalNodes();
  const stimNode = document.getElementById("stim-node-select")?.value || nodes[0];
  const basePdk = typeof pdkSimParams !== "undefined" ? pdkSimParams : { vth0: 0.5, kpN: 180e-6, kpP: 60e-6, lambda: 0.02 };
  const corners = [
    { label: "nominal", pdk: { ...basePdk } },
    { label: "higher Kp", pdk: { ...basePdk, vth0: Math.max(0.25, basePdk.vth0 - 0.08), kpN: basePdk.kpN * 1.18, kpP: basePdk.kpP * 1.18 } },
    { label: "lower Kp", pdk: { ...basePdk, vth0: basePdk.vth0 + 0.08, kpN: basePdk.kpN * 0.84, kpP: basePdk.kpP * 0.84 } }
  ];
  try {
    let xVals = [], series = {};
    const targetNode = nodes.find(n => !isHighVoltNet(n) && !isLowVoltNet(n)) || nodes[0] || "out";
    corners.forEach(c => {
      const res = simulateDC(elements, { pdkParams: c.pdk, sweepNode: stimNode, vStart: 0, vStop: 2.5, numPoints: 80 });
      xVals = res.xVals;
      const trace = res.series[targetNode] || Object.values(res.series)[0] || [];
      series[`${targetNode}_${c.label}`] = trace;
    });
    simDataStore.dc = { type: "dc", xLabel: `Sweep ${stimNode} (V) [illustrative parameter perturbation]`, xScale: 1, xVals, series };
    activeScopeType = "dc";
    scopeActiveNodes = new Set(Object.keys(series));
    openOscilloscopeModal();
    showToast("✔ 教学参数扰动曲线已生成（阈值 ±80 mV，Kp 按比例变化）", "ok");
  } catch (err) {
    showToast(`Corner 扫描失败: ${err.message}`, "err", 4500);
  }
}

function runMonteCarlo() {
  populateExcitationNodeSelectors();
  const layout = getCurrentLayout();
  const elements = layout?.elements || [];
  if (!elements.length) return;
  const nodes = collectCircuitSignalNodes();
  const stimNode = document.getElementById("stim-node-select")?.value || nodes[0];
  const basePdk = typeof pdkSimParams !== "undefined" ? pdkSimParams : { vth0: 0.5, kpN: 180e-6, kpP: 60e-6, lambda: 0.02 };
  const randn = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, Math.random()))) * Math.cos(2 * Math.PI * Math.random());
  try {
    let xVals = [], mcSeries = {};
    const targetNode = nodes.find(n => !isHighVoltNet(n) && !isLowVoltNet(n)) || nodes[0] || "out";
    for (let r = 1; r <= 6; r++) {
      const dvth = randn() * 0.025;
      const dkp = 1 + randn() * 0.04;
      const res = simulateDC(elements, {
        pdkParams: { ...basePdk, vth0: Math.max(0.2, basePdk.vth0 + dvth), kpN: basePdk.kpN * dkp, kpP: basePdk.kpP * dkp },
        sweepNode: stimNode, vStart: 0, vStop: 2.5, numPoints: 80
      });
      xVals = res.xVals;
      mcSeries[`${targetNode}_MC#${r}`] = res.series[targetNode] || Object.values(res.series)[0] || [];
    }
    simDataStore.dc = { type: "dc", xLabel: `Sweep ${stimNode} (V) [illustrative mismatch]`, xScale: 1, xVals, series: mcSeries };
    activeScopeType = "dc";
    scopeActiveNodes = new Set(Object.keys(mcSeries));
    openOscilloscopeModal();
    showToast("✔ 教学随机失配曲线已生成 (6 runs, Vth/Kp 高斯扰动)", "ok");
  } catch (err) {
    showToast(`Monte Carlo 失败: ${err.message}`, "err", 4500);
  }
}

const CIRCUIT_LAB_PRESETS = [
  { id: "cs_amp", title: "共源放大器 (CS Amplifier)", desc: "经典 NMOS 共源极增益级 + 负载电阻", name: "cs_amp.scs", code: "// Common-Source Amplifier\nsimulator lang=spectre\nVdd (vdd 0) vsource dc=1.8\nVin (in 0) vsin dc=0.75 ampl=0.05 freq=10M\nRd (vdd out) resistor r=10k\nM1 (out in 0 0) nch w=20u l=1u\nCload (out 0) capacitor c=500f\n" },
  { id: "diff_pair", title: "差分对放大器 (Diff Pair)", desc: "电流镜有源负载五管 OTA", name: "diff_pair.scs", code: "// Differential Pair OTA\nsimulator lang=spectre\nVdd (vdd 0) vsource dc=1.8\nMP1 (n1 n1 vdd vdd) pch w=20u l=1u\nMP2 (out n1 vdd vdd) pch w=20u l=1u\nMN1 (n1 inp tail 0) nch w=10u l=1u\nMN2 (out inn tail 0) nch w=10u l=1u\nIbias (tail 0) isource dc=100u\n" },
  { id: "rc_lpf", title: "RC 低通滤波器 (RC Filter)", desc: "一阶无源 RC 滤波器与扫频激励", name: "rc_filter.scs", code: "// 1st-Order RC Low-Pass Filter\nsimulator lang=spectre\nVsw (in 0) vsweep fstart=1k fstop=1G ampl=1\nR1 (in out) resistor r=1.59k\nC1 (out 0) capacitor c=100p\n" },
  { id: "wilson_cm", title: "威尔逊电流镜 (Wilson Mirror)", desc: "高输出阻抗 3 管电流镜", name: "wilson_mirror.scs", code: "// Wilson Current Mirror\nsimulator lang=spectre\nIref (vdd in) isource dc=50u\nM1 (in out n1 0) nch w=10u l=1u\nM2 (n1 n1 0 0) nch w=10u l=1u\nM3 (out in 0 0) nch w=10u l=1u\n" }
];

function openLabsModal() {
  const box = document.getElementById("labs-preset-list");
  if (!box) return;
  box.innerHTML = "";
  CIRCUIT_LAB_PRESETS.forEach(lab => {
    const card = document.createElement("div");
    card.style.cssText = "background:#14151b;border:1px solid #3a3d4e;border-radius:6px;padding:10px;cursor:pointer;display:flex;flex-direction:column;gap:4px;";
    card.innerHTML = `<b style="color:#38bdf8;font-size:12.5px;">${lab.title}</b><span style="color:#94a3b8;font-size:11.5px;">${lab.desc}</span>`;
    card.onclick = () => {
      const nf = {
        id: `lab_${Date.now()}`, path: `Labs/${lab.name}`, name: lab.name, content: lab.code,
        dirty: false, parsedDesign: null, activeSubckt: "__TOP__", hierarchyStack: ["__TOP__"],
        layoutsBySubckt: {}, undoStack: [], redoStack: []
      };
      expandedFolders.add("Labs");
      workspaceFiles.push(nf);
      closeModal("labs-modal");
      openFileInTab(nf.id);
      showToast("已打开经典图形示例，可在新版工作台设置测试台与仿真参数", "ok");
    };
    box.appendChild(card);
  });
  document.getElementById("labs-modal").style.display = "flex";
}

function shareProjectUrl() {
  const f = getActiveFile();
  if (!f) return;
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ name: f.name, content: document.getElementById("netlist-input").value }))));
  const url = `${location.origin}${location.pathname}#share=${payload}`;
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).catch(() => {});
  history.replaceState(null, "", `#share=${payload}`);
  showToast("🔗 已生成工程分享链接并写入地址栏/剪贴板！", "ok");
}

function applyPdkParamEdit() {
  pdkSimParams.vth0 = parseFloat(document.getElementById("pdk-edit-vth0")?.value || "0.5");
  pdkSimParams.kpN = (parseFloat(document.getElementById("pdk-edit-kp")?.value || "180")) * 1e-6;
  pdkSimParams.lambda = parseFloat(document.getElementById("pdk-edit-lambda")?.value || "0.02");
  showToast(`✔ 已更新教学近似模型参数 (Vth0=${pdkSimParams.vth0}V, Kp=${(pdkSimParams.kpN*1e6).toFixed(0)}uA/V²)`, "ok");
  rerenderOnly();
}

function aiExplainCurrentSim() {
  const f = getActiveFile(), layout = getCurrentLayout();
  if (!f || !layout) return;
  const dcOp = computeDcOperatingPoint(layout, f);
  const summary = Object.entries(dcOp.nodeVoltages).map(([k, v]) => `${k}=${v.toFixed(2)}V`).join(", ");
  aiQuickPrompt(`请结合当前电路网表与直流经典近似模型工作点估算 (${summary})，解释电路工作原理、关键节点波形特征并给出性能优化建议。`);
}

let classicOrigin=null;
function classicSourceFile(path, content) {
  return {id:crypto.randomUUID(),path,name:path.split('/').at(-1),content,dirty:false,
    parsedDesign:null,activeSubckt:'__TOP__',hierarchyStack:['__TOP__'],layoutsBySubckt:{},undoStack:[],redoStack:[]};
}
function importWorkbenchProject() {
  if (location.hash!=='#workbench') return;
  try {
    const item=sessionStorage.getItem('opencircuit.classic.transfer');
    if (!item) throw Error('此标签页没有可恢复的工作台工程');
    const project=JSON.parse(item);
    if (!Array.isArray(project.files) || !project.files.length) throw Error('工程缺少文件');
    const imported=project.files.map(f=>{
      if (typeof f.path!=='string'||!f.path||typeof f.content!=='string') throw Error('工程包含无效文件');
      return classicSourceFile(f.path,f.content);
    });
    workspaceFiles=imported;
    expandedFolders=new Set();
    for (const f of imported) {
      const parts=f.path.split('/');
      for (let i=1;i<parts.length;i++) expandedFolders.add(parts.slice(0,i).join('/'));
    }
    const active=imported.find(f=>f.path===project.active) || imported.find(f=>f.path===project.entry) || imported[0];
    activeFileId=active.id;
    openTabIds=[activeFileId];
    classicOrigin=project;
  } catch(e) { showToast('打开工作台工程失败：'+e.message,'err'); }
}
function toWorkbench(type=null, tab=null) {
  const active=getActiveFile();
  if (!active) return;
  active.content=document.getElementById('netlist-input').value;
  const originalEntry=workspaceFiles.find(f=>f.path===classicOrigin?.entry);
  const next={schemaVersion:3,title:classicOrigin?.title || active.name,entry:(originalEntry||active).path,
    active:active.path,files:workspaceFiles.map(({path,content})=>({path,content})),custom:classicOrigin?.custom || [],
    workbenchId:classicOrigin?.workbenchId, workbenchRevision:classicOrigin?.workbenchRevision,
    configMode:classicOrigin?.configMode, config:classicOrigin?.config || null, ...(tab ? {classicAction:{type,tab}} : {})};
  try {
    sessionStorage.setItem('opencircuit.from-classic',JSON.stringify(next));
    location.assign('./index.html#from-classic');
  } catch(e) { showToast('当前工程超过标签页传递空间或浏览器存储不可用。请先从文件区保存工程。','err'); }
}

window.addEventListener("DOMContentLoaded", () => {
  importWorkbenchProject();
  applyTheme();
  applyLanguage();
  initMenus();
  renderFileTree();
  renderFileTabs();
  if (location.hash.startsWith("#share=")) {
    try {
      const dec = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(7)))));
      if (dec && dec.content) {
        const sf = { id: `shared_${Date.now()}`, path: `Shared/${dec.name || "shared.scs"}`, name: dec.name || "shared.scs", content: dec.content, dirty: false, parsedDesign: null, activeSubckt: "__TOP__", hierarchyStack: ["__TOP__"], layoutsBySubckt: {}, undoStack: [], redoStack: [] };
        expandedFolders.add("Shared");
        workspaceFiles.push(sf);
        activeFileId = sf.id;
      }
    } catch (e) {}
  }
  openFileInTab(activeFileId);
  startSiteUptimeCounter();
});

// Expose UI handlers to window for inline HTML event attributes
Object.assign(window, {
  addPortFromSelect, aiExplainCurrentSim, aiQuickPrompt, aiSaveCurrentNetlistLocal,
  alignSelectedDevices, applyAiPreset, applyPdkParamEdit, bindAiLocalFolder,
  clearAllAiSessions, clearAllHighlights, closeAiDialog, closeAllBottomDock,
  closeAllMenus, closeModal, confirmCreateSubckt, confirmNewProjectItem,
  confirmPlaceDevice, copySelectedDevices, copyTerminalCdCmd, createNewAiSession,
  createNewTerminalInstance, deleteSelectedDevices, drawSpectrumAnalyzer,
  exportAllAiSessions, exportDcOpCsv, exportKiCadSch, exportPrintablePdf,
  exportProjectState, exportRaster, exportSVG, freezeCurrentSubcktToLib,
  freezePdkToLocal, hideIslandFromModal, importAiSessionsFile, toWorkbench,
  jumpBreadcrumb, minimizeAiDialog, movePane, onExcitationChanged, openAiDialog,
  openContactAuthorModal, openCreateSubcktModal, openDcOpTablePanel, openFileInTab,
  openIslandConfigModal, openLabsModal, openNewProjectItemModal, openOscilloscopeModal,
  openPdkModal, openPlaceDialog, openShortcutModal, openSpectrumModal,
  openTerminalModal, parseAndRender, pasteCopiedDevices, pickPortFromCanvas,
  quickPlaceFirstSubckt, quickPlacePdkMos, redoEdit, resetDefaultShortcuts,
  resetScopeView, resetSpecView, resetZoom, restoreAiDialog, runConnectivityCheck,
  runCornerSweep, runMonteCarlo, runSpiceSimulation, saveAiConfigAndEnter,
  saveAsCurrentFile, saveCurrentFile, saveWorkspaceFolder, selectAllDevices,
  selectSavedPdk, sendAiMessage, setEditMode, setLanguageMode, setPaneOrder,
  setScopeZoom, setSpecZoom, setThemeMode, shareProjectUrl, showLintToast,
  startPickSchematicPort, switchSubckt, syncStimNodeFromSpec, toggleAiConfigView,
  toggleLayerQuickMenu, closeLayerQuickMenu, renderLayerQuickMenu, triggerStandardFormSubmitFallback,
  deleteWorkspaceFile, deleteWorkspaceFolder, saveWorkspaceFileById,
  toggleBottomDockCollapse, toggleFloatingIsland, toggleIslandMinimize, toggleLayer,
  toggleMaximizeAiDialog, togglePaneCollapse, togglePlaceIsland, triggerOpenFile,
  triggerOpenFolder, undoEdit,
  renameWorkspaceFile, renameWorkspaceFolder, confirmRenameItem,
  rotateSelectedDevices, flipSelectedDevices, openVersionModal,
  startInteractivePlace, cancelInteractivePlace,
  compileSchematicToCode, openEditParamModalForSelected, confirmEditParamModal
});
