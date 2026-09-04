/** 차트 공통 토큰. globals.css 의 의미 기반 색상과 동일하게 유지한다. */
export const CHART = {
  grid: "#222839",
  axis: "#5d657a",
  line: "#6d8cff",
  lineSoft: "#6d8cff33",
  peak: "#ff3b4e",
  bar: "#4b5b8a",
  barActive: "#6d8cff",
  tooltipBg: "#141926",
  tooltipBorder: "#303852",
};

export const AXIS_PROPS = {
  stroke: CHART.axis,
  tick: { fill: CHART.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;
