import React from 'react';

export function ClickCoordinates({ step }) {
  if (step.action !== 'click') return null;
  const point = step.coordinates;
  if (!point) return <span>Click coordinates: Not captured</span>;
  if (point.space === 'desktop') return <>
    <span>Desktop click: X={point.x}, Y={point.y} physical px from combined desktop top-left</span>
    <span>Screen position: X={point.screen_x}, Y={point.screen_y}</span>
    <span>Desktop: {point.desktop_width} × {point.desktop_height}; origin: ({point.desktop_left}, {point.desktop_top})</span>
  </>;
  return <>
    <span>Click position: X={point.x}, Y={point.y} CSS px from viewport top-left</span>
    <span>Page position: X={point.page_x}, Y={point.page_y} CSS px</span>
    <span>Viewport: {point.viewport_width} × {point.viewport_height} CSS px; scroll: X={point.scroll_x}, Y={point.scroll_y}</span>
    <span>Device pixel ratio: {point.device_pixel_ratio}</span>
  </>;
}
