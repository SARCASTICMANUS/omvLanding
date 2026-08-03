import React from "react";
import { ViewAnnotation } from "./VayyMap";

export function MarkerAnnotation({ id, lngLat, anchor = "center", onSelect, children }) {
  return (
    <ViewAnnotation
      key={id}
      id={id}
      lngLat={lngLat}
      anchor={anchor}
      onSelect={onSelect}
    >
      {children}
    </ViewAnnotation>
  );
}

export default MarkerAnnotation;
