const css = `
.bg-red-500 { background-color: color-mix(in oklch, var(--color-red-500) 10%, transparent); }
`;
const replaced = css.replace(/(oklch|oklab|color-mix|hwb)\([^)]+\)/gi, '#cccccc');
console.log(replaced);
