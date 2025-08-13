/**
 * Chrome Extension Content Script
 * Injects a11ycap library and sets up transport
 */

// Check if we're already injected
if (!(window as any).__a11ycap_injected) {
  (window as any).__a11ycap_injected = true;

  /**
   * Inject the a11ycap library into the page
   */
  function injectLibrary() {
    const script = document.createElement('script');
    script.type = 'module';
    
    // Use the extension's bundled a11ycap library
    script.src = chrome.runtime.getURL('a11ycap.js');
    
    // Set up configuration for Chrome extension transport
    script.setAttribute('data-transport', 'chrome_extension');
    script.setAttribute('data-extension-id', chrome.runtime.id);
    
    script.onload = () => {
      console.log('a11ycap library injected via Chrome extension');
      
      // Initialize the connection
      const initScript = document.createElement('script');
      initScript.type = 'module';
      initScript.textContent = `
        import { initializeMCPConnection } from '${chrome.runtime.getURL('a11ycap.js')}';
        
        // Initialize with Chrome extension transport
        const client = initializeMCPConnection('chrome-extension://${chrome.runtime.id}');
        
        // Expose to window for debugging
        window.A11yCapClient = client;
      `;
      document.head.appendChild(initScript);
    };
    
    script.onerror = (error) => {
      console.error('Failed to inject a11ycap library:', error);
    };
    
    // Inject at the beginning of head to ensure early loading
    if (document.head) {
      document.head.insertBefore(script, document.head.firstChild);
    } else {
      // If head doesn't exist yet, wait for it
      const observer = new MutationObserver(() => {
        if (document.head) {
          document.head.insertBefore(script, document.head.firstChild);
          observer.disconnect();
        }
      });
      observer.observe(document.documentElement, { childList: true });
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectLibrary();
      setupMessageBridge();
    });
  } else {
    injectLibrary();
    setupMessageBridge();
  }
}