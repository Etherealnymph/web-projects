import {format} from './models.mjs';

// Scale selection changes only the view, never the underlying samples.
export function chartDomain(values,{padding=0.12,nonNegative=false}={}){
  const finite=values.filter(Number.isFinite);
  if(!finite.length)throw new RangeError('图表没有有限数据。');
  const dataMin=Math.min(...finite),dataMax=Math.max(...finite),span=dataMax-dataMin;
  const center=dataMin+span/2,magnitude=Math.max(Math.abs(dataMin),Math.abs(dataMax));
  const nearConstant=span<=magnitude*1e-6 || span===0;
  // A ±5% display window makes a near-constant quantity legible without
  // magnifying floating-point residuals into a physical tradeoff.
  const margin=nearConstant?(Math.abs(center)*.05||.05):span*padding;
  let min=nearConstant?center-margin:dataMin-margin;
  let max=nearConstant?center+margin:dataMax+margin;
  if(nonNegative&&dataMin>=0)min=Math.max(0,min);
  if(max<=min)max=min+Math.max(Math.abs(center)*.05,.05);
  return {min,max,center,nearConstant,dataMin,dataMax};
}

export const NONNEGATIVE_UNITS=new Set(['Hz','W','F','Ω','S','A','V','s','MHz','kHz','µA','mA','fF','pF','nH','mS','kΩ']);

export function axisValue(value,unit='',digits=3){
  if(unit==='°C')return `${Number(value.toPrecision(digits))}°C`;
  if(['dB','rad','°'].includes(unit))return `${Number(value.toPrecision(digits))}${unit}`;
  return format(value,unit,digits);
}

export function axisLabels(ticks,unit=''){
  const span=Math.max(...ticks)-Math.min(...ticks);
  const normalized=ticks.map(v=>Math.abs(v)<span*1e-12?0:v);
  for(let digits=3;digits<=12;digits++){
    const labels=normalized.map(v=>axisValue(v,unit,digits));
    if(new Set(labels).size===new Set(normalized).size)return labels;
  }
  return normalized.map(v=>`${v.toExponential(12)}${unit?' '+unit:''}`);
}
