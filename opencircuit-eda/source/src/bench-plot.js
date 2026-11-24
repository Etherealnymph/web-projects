import { formatSI, nearestIndex } from './bench-measure.js';

const NS = 'http://www.w3.org/2000/svg';
const colors = ['#67e8c9', '#f5c267'];
function svgElement(name, attrs, text) {
  const node = document.createElementNS(NS,name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key,value);
  if (text !== undefined) node.textContent = text;
  return node;
}

// Retain both extrema of each horizontal pixel bucket. Narrow spikes survive a long capture.
function seriesPath(x, y, toX, toY, xMin, xMax) {
  const a = nearestIndex(x,xMin), b = nearestIndex(x,xMax);
  const first = Math.max(0,Math.min(a,b)-1), last = Math.min(x.length-1,Math.max(a,b)+1);
  const points = [];
  let bucket = null, low = 0, high = 0;
  const emit = i => points.push(`${toX(x[i]).toFixed(2)},${toY(y[i]).toFixed(2)}`);
  function flush() {
    if (bucket === null) return;
    emit(Math.min(low,high));
    if (low !== high) emit(Math.max(low,high));
  }
  for (let i = first; i <= last; i++) {
    const offset = Math.floor(toX(x[i]));
    if (!Number.isFinite(offset) || !Number.isFinite(y[i])) continue;
    if (offset !== bucket) { flush(); bucket = offset; low = high = i; }
    if (y[i] < y[low]) low = i;
    if (y[i] > y[high]) high = i;
  }
  flush();
  return points.join(' ');
}

export function drawPlot(host, { x, channels, xMin, xMax, xUnit, log = false, label, marker, onCoordinate }) {
  const measured = Math.floor(host.getBoundingClientRect().width)-2;
  const chartWidth = Math.min(1280,Math.max(120,measured>0 ? measured : 720));
  const compact = chartWidth < 480;
  const left = 12, right = chartWidth-12, top = 13, bottom = compact ? 133 : 181;
  const width = right-left, height = bottom-top;
  const tickInterval = compact ? 5 : 2;
  const box = document.createElement('div');
  box.className = 'ob-display';
  const svg = svgElement('svg', { viewBox:`0 0 ${chartWidth} ${bottom+26}`, role:'img','aria-label':label });
  const calc = value => log ? Math.log10(value) : value;
  const inv = value => log ? 10**value : value;
  const a = calc(xMin), b = calc(xMax);
  const toX = value => left + width*(calc(value)-a)/(b-a);
  const fromX = px => inv(a+(b-a)*(px-left)/width);
  const yFor = channel => value => bottom - height*(value-channel.min)/(channel.max-channel.min);
  for (let i = 0; i <= 10; i++) {
    const px = left + width*i/10;
    svg.append(svgElement('line',{x1:px,x2:px,y1:top,y2:bottom,class:'ob-grid'}));
    if (i % tickInterval === 0) svg.append(svgElement('text',{x:px,y:bottom+17,'text-anchor':i===0?'start':i===10?'end':'middle',class:'ob-axis'},formatSI(fromX(px),xUnit,3)));
  }
  for (let i = 0; i <= 8; i++) {
    const py = top + height*i/8;
    svg.append(svgElement('line',{x1:left,x2:right,y1:py,y2:py,class:i===4?'ob-axisline':'ob-grid'}));
  }
  const traces = svgElement('svg',{x:left,y:top,width,height,viewBox:`${left} ${top} ${width} ${height}`,overflow:'hidden'});
  channels.forEach((channel,index) => {
    const yMap = yFor(channel);
    const color = colors[index % colors.length];
    const path = seriesPath(x,channel.values,toX,yMap,xMin,xMax);
    if (path) traces.append(svgElement('polyline',{points:path,fill:'none',stroke:color,'stroke-width':1.8,'vector-effect':'non-scaling-stroke'}));
    if (x.length === 1) traces.append(svgElement('circle',{cx:toX(x[0]),cy:yMap(channel.values[0]),r:3,fill:color}));
  });
  svg.append(traces);
  if (Number.isFinite(marker) && marker >= xMin && marker <= xMax) svg.append(svgElement('line',{x1:toX(marker),x2:toX(marker),y1:top,y2:bottom,class:'ob-marker'}));
  const hair = svgElement('line',{y1:top,y2:bottom,visibility:'hidden',class:'ob-cursor'});
  svg.append(hair);
  const legend = document.createElement('div');
  legend.className = 'ob-legend';
  channels.forEach((ch,i) => {
    const info = document.createElement('span');
    info.style.color = colors[i % colors.length];
    info.textContent = `${ch.name}  ${formatSI((ch.max-ch.min)/8,ch.unit,3)}/格  ·  中心 ${formatSI((ch.max+ch.min)/2,ch.unit,3)}`;
    legend.append(info);
  });
  const readout = document.createElement('output');
  readout.className = 'ob-cursor-read';
  function readAt(index) {
    const px = toX(x[index]);
    if (!Number.isFinite(px)) return;
    hair.setAttribute('x1',px); hair.setAttribute('x2',px); hair.setAttribute('visibility','visible');
    readout.textContent = [formatSI(x[index],xUnit),...channels.map(ch=>`${ch.name}  ${formatSI(ch.values[index],ch.unit)}`)].join('   ·   ');
  }
  function pointIndex(event) {
    const matrix = svg.getScreenCTM();
    if (!matrix) return 0;
    const point = svg.createSVGPoint();
    point.x = event.clientX; point.y = event.clientY;
    const px = Math.max(left,Math.min(right,point.matrixTransform(matrix.inverse()).x));
    return nearestIndex(x,fromX(px));
  }
  svg.addEventListener('pointermove',e=>readAt(pointIndex(e)));
  if (onCoordinate) svg.addEventListener('click',e => onCoordinate(x[pointIndex(e)]));
  readAt(nearestIndex(x,Number.isFinite(marker)?marker:xMin));
  box.append(legend,svg,readout);
  host.append(box);
}

export function plotRange(values, scale, center) {
  let min = Infinity, max = -Infinity;
  for (const v of values) if (Number.isFinite(v)) { min = Math.min(min,v); max = Math.max(max,v); }
  if (!Number.isFinite(min)) return {min:-1,max:1};
  const mid = center === '' || center == null ? (min+max)/2 : Number(center);
  const span = Number(scale)>0 ? Number(scale)*8 : ((max-min)*1.16 || Math.max(Math.abs(mid)*0.1,1e-6));
  return { min:mid-span/2, max:mid+span/2 };
}
