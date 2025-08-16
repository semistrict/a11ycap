/**
 * Chrome Extension Content Script
 * Injects a11ycap library and sets up transport
 */

console.log('[Content Script] a11ycap content script loaded and executing');

// Check if we're already injected
if (!(window as any).__a11ycap_injected) {
  console.log('[Content Script] Starting content script initialization...');
  (window as any).__a11ycap_injected = true;

  /**
   * Inject the a11ycap library into the page
   */
  function injectLibrary() {
    console.log('[Content Script] injectLibrary() called');
    const script = document.createElement('script');
    
    // Use the extension's bundled a11ycap library
    script.src = chrome.runtime.getURL('a11ycap.js');
    
    // Set up configuration for Chrome extension transport
    script.setAttribute('data-transport', 'chrome_extension');
    script.setAttribute('data-extension-id', chrome.runtime.id);
    
    script.onload = () => {
      console.log('[Chrome Extension] a11ycap library script loaded via Chrome extension');
      
      // Initialize the connection after the library loads
      const initScript = document.createElement('script');
      initScript.textContent = `
        (function() {
          console.log('[Page Context] Starting a11ycap initialization...');
          let attempts = 0;
          const maxAttempts = 50; // 5 seconds max
          
          function initializeA11yCap() {
            attempts++;
            console.log('[Page Context] Checking for a11ycap library, attempt:', attempts);
            console.log('[Page Context] window.a11ycap:', typeof window.a11ycap);
            console.log('[Page Context] window.A11yCap:', typeof window.A11yCap);
            
            const scriptTags = Array.from(document.querySelectorAll('script')).filter(s => s.src && s.src.includes('a11ycap.js'));
            console.log('[Page Context] Found a11ycap script tags:', scriptTags.length);
            
            if (typeof window.a11ycap !== 'undefined') {
              console.log('[Page Context] ✅ a11ycap library is available, initializing...');
              console.log('[Page Context] Available functions:', Object.keys(window.a11ycap));
              
              // Initialize MCP connection if available
              if (window.a11ycap.initializeMCPConnection) {
                try {
                  const client = window.a11ycap.initializeMCPConnection('chrome-extension://${chrome.runtime.id}');
                  window.A11yCapClient = client;
                  console.log('[Page Context] MCP connection initialized');
                } catch (error) {
                  console.log('[Page Context] MCP connection failed:', error);
                }
              }
              
              // Expose main functions globally for easy access
              window.getAccessibilitySnapshot = window.a11ycap.snapshotForAI || window.a11ycap.snapshot;
              window.clickElement = window.a11ycap.clickRef;
              window.findElement = window.a11ycap.findElementByRef;
              
              console.log('[Page Context] ✅ a11ycap Chrome extension ready');
              
              window.dispatchEvent(new CustomEvent('a11ycap-ready', { detail: { ready: true } }));
              return;
            } else if (attempts < maxAttempts) {
              console.log('[Page Context] a11ycap not yet available, retrying in 100ms...');
              setTimeout(initializeA11yCap, 100);
            } else {
              console.error('[Page Context] ❌ a11ycap library failed to load after', maxAttempts, 'attempts');
              console.log('[Page Context] Available window properties:', Object.keys(window).filter(k => k.includes('a11y') || k.includes('A11y')));
              console.log('[Page Context] All window properties:', Object.keys(window).slice(0, 20));
            }
          }
          
          initializeA11yCap();
        })();
      `;
      document.head.appendChild(initScript);
    };
    
    script.onerror = (error) => {
      console.error('Failed to inject a11ycap library:', error);
    };
    
    // Inject at the beginning of head to ensure early loading
    if (document.head) {
      document.head.insertBefore(script, document.head.firstChild);
    } else if (document.documentElement) {
      // If head doesn't exist yet, append to documentElement and move to head later
      document.documentElement.appendChild(script);
      const observer = new MutationObserver(() => {
        if (document.head && script.parentNode !== document.head) {
          document.head.insertBefore(script, document.head.firstChild);
          observer.disconnect();
        }
      });
      observer.observe(document.documentElement, { childList: true });
    } else {
      const observer = new MutationObserver(() => {
        if (document.documentElement) {
          document.documentElement.appendChild(script);
          observer.disconnect();
        }
      });
      observer.observe(document, { childList: true });
    }
  }

  /**
   * Set up message bridge between page and extension
   */
  function setupMessageBridge() {
    // Listen for messages from the injected script
    window.addEventListener('message', (event) => {
      // Only accept messages from the same origin
      if (event.source !== window) return;
      
      // Check for a11ycap messages
      if (event.data?.type?.startsWith('a11ycap_')) {
        // Forward to background script
        chrome.runtime.sendMessage(event.data, (response) => {
          // Send response back to page
          window.postMessage({
            type: 'a11ycap_response',
            requestId: event.data.requestId,
            response: response,
          }, '*');
        });
      }
    });

    // Set up long-lived connection for bidirectional communication
    const sessionId = generateSessionId();
    const port = chrome.runtime.connect({ name: `a11ycap_${sessionId}` });

    port.onMessage.addListener((message) => {
      // Forward messages from background to page
      window.postMessage({
        type: 'a11ycap_from_extension',
        message: message,
      }, '*');
    });

    // Listen for messages to send through the port
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      
      if (event.data?.type === 'a11ycap_to_extension') {
        port.postMessage(event.data.message);
      }
    });
  }

  /**
   * Generate a unique session ID
   */
  function generateSessionId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Initialize when DOM is ready
  console.log('[Content Script] Document ready state:', document.readyState);
  if (document.readyState === 'loading') {
    console.log('[Content Script] Waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[Content Script] DOMContentLoaded fired, injecting library...');
      injectLibrary();
      setupMessageBridge();
    });
  } else {
    console.log('[Content Script] DOM already ready, injecting library immediately...');
    injectLibrary();
    setupMessageBridge();
  }
}
