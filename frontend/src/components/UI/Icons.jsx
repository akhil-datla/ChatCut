/**
 * Icons - SVG icon components for ChatCut
 * All icons are 24x24 viewBox, use currentColor for fill
 */
import React from "react";

const IconWrapper = ({ children, size = 18, className = "", ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    className={className}
    aria-hidden="true"
    {...props}
  >
    {children}
  </svg>
);

export const SendIcon = (props) => (
  <IconWrapper {...props}>
    <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
  </IconWrapper>
);

export const UndoIcon = (props) => (
  <IconWrapper {...props}>
    <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
  </IconWrapper>
);

export const PlusIcon = (props) => (
  <IconWrapper {...props}>
    <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z" />
  </IconWrapper>
);

export const CloseIcon = (props) => (
  <IconWrapper {...props} size={props.size || 12}>
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </IconWrapper>
);

export const CheckIcon = (props) => (
  <IconWrapper {...props}>
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
  </IconWrapper>
);

export const ChevronDownIcon = (props) => (
  <IconWrapper {...props}>
    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
  </IconWrapper>
);


