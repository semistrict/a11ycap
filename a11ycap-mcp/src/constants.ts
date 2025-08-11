/**
 * Shared constants for the a11ycap MCP server
 */

const PORT = process.env.PORT || "12456";

// Console injection script constant to avoid duplication
export const CONSOLE_INJECTION_SCRIPT = `try{const code=await(await fetch('http://localhost:${PORT}/a11ycap.js?nocache='+Math.random())).text();if(window.trustedTypes){const policy=trustedTypes.createPolicy('a11y',{createScript:s=>s});eval(policy.createScript(code));}else{const s=document.createElement('script');s.textContent=code;document.head.appendChild(s);}}catch(e){console.error('🐱 Failed to load a11ycap:',e);}`;
