/**
 * MCP WebSocket connection for browser-server communication
 */

import { z } from 'zod';
import { snapshotForAI, findElementByRef, clickRef } from './index.js';
import { toolHandlers } from './tools/index.js';

const TakeSnapshotSchema = z.object({
  id: z.string(),
  type: z.literal('take_snapshot'),
  payload: z.object({
    ref: z.string().optional(),
    mode: z.enum(['ai', 'expect', 'codegen', 'autoexpected']).optional(),
    enableReact: z.boolean().optional(),
    refPrefix: z.string().optional(),
    max_bytes: z.number().optional(),
  })
});

const ExecuteJSSchema = z.object({
  id: z.string(),
  type: z.literal('execute_js'),
  payload: z.object({
    code: z.string(),
    returnValue: z.boolean().optional(),
  })
});

const ClickElementSchema = z.object({
  id: z.string(),
  type: z.literal('click_element'),
  payload: z.object({
    ref: z.string(),
  })
});

const TypeTextSchema = z.object({
  id: z.string(),
  type: z.literal('type_text'),
  payload: z.object({
    ref: z.string(),
    text: z.string(),
    slowly: z.boolean().optional(),
  })
});

const PressKeySchema = z.object({
  id: z.string(),
  type: z.literal('press_key'),
  payload: z.object({
    ref: z.string(),
    key: z.string(),
  })
});

const PressKeyGlobalSchema = z.object({
  id: z.string(),
  type: z.literal('press_key_global'),
  payload: z.object({
    key: z.string(),
  })
});

const HoverElementSchema = z.object({
  id: z.string(),
  type: z.literal('hover_element'),
  payload: z.object({
    ref: z.string(),
  })
});

const SelectOptionSchema = z.object({
  id: z.string(),
  type: z.literal('select_option'),
  payload: z.object({
    ref: z.string(),
    values: z.array(z.string()),
  })
});

const WaitForSchema = z.object({
  id: z.string(),
  type: z.literal('wait_for'),
  payload: z.object({
    text: z.string().optional(),
    textGone: z.string().optional(),
    time: z.number().optional(),
  })
});

type TakeSnapshotMessage = z.infer<typeof TakeSnapshotSchema>;
type ExecuteJSMessage = z.infer<typeof ExecuteJSSchema>;
type ClickElementMessage = z.infer<typeof ClickElementSchema>;
type TypeTextMessage = z.infer<typeof TypeTextSchema>;
type PressKeyMessage = z.infer<typeof PressKeySchema>;
type PressKeyGlobalMessage = z.infer<typeof PressKeyGlobalSchema>;
type HoverElementMessage = z.infer<typeof HoverElementSchema>;
type SelectOptionMessage = z.infer<typeof SelectOptionSchema>;
type WaitForMessage = z.infer<typeof WaitForSchema>;

/**
 * WebSocket connection for MCP server communication
 */
export class MCPWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = Infinity;
  private readonly reconnectInterval = 2000; // 2 seconds
  private readonly wsUrl: string;

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  connect(): void {
    if (typeof window === 'undefined') return;

    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log('🐱 Connected to a11ycap MCP server');
      this.reconnectAttempts = 0;

      // Send page info to server
      this.send({
        type: 'page_info',
        payload: {
          url: window.location.href,
          title: document.title,
          userAgent: navigator.userAgent
        }
      });
    };

    this.ws.onclose = () => {
      console.log('🐱 Disconnected from MCP server');
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`🐱 Attempting to reconnect... (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connect(), this.reconnectInterval);
      }
    };

    this.ws.onerror = () => {
      console.warn('🐱 WebSocket error - will retry connection');
    };

    this.ws.onmessage = this.handleMessage.bind(this);
  }

  private send(message: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private sendResponse(commandId: string, success: boolean, data?: any, error?: string): void {
    this.send({
      commandId,
      success,
      ...(data !== undefined && { data }),
      ...(error && { error })
    });
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    try {
      const rawMessage = JSON.parse(event.data);
      
      // Check if we have a modular tool handler for this message type
      const toolHandler = toolHandlers[rawMessage.type];
      if (toolHandler) {
        try {
          const message = toolHandler.messageSchema.parse(rawMessage);
          const result = await toolHandler.execute(message);
          this.sendResponse(rawMessage.id, true, result);
        } catch (error) {
          this.sendResponse(rawMessage.id, false, undefined, error instanceof Error ? error.message : 'Unknown error');
        }
        return;
      }
      
      // Fall back to legacy message handling for non-modular tools
      switch (rawMessage.type) {
        case 'execute_js': {
          const message = ExecuteJSSchema.parse(rawMessage);
          this.handleExecuteJS(message);
          break;
        }
        case 'type_text': {
          const message = TypeTextSchema.parse(rawMessage);
          await this.handleTypeText(message);
          break;
        }
        case 'press_key': {
          const message = PressKeySchema.parse(rawMessage);
          this.handlePressKey(message);
          break;
        }
        case 'press_key_global': {
          const message = PressKeyGlobalSchema.parse(rawMessage);
          this.handlePressKeyGlobal(message);
          break;
        }
        case 'hover_element': {
          const message = HoverElementSchema.parse(rawMessage);
          this.handleHoverElement(message);
          break;
        }
        case 'select_option': {
          const message = SelectOptionSchema.parse(rawMessage);
          this.handleSelectOption(message);
          break;
        }
        case 'wait_for': {
          const message = WaitForSchema.parse(rawMessage);
          await this.handleWaitFor(message);
          break;
        }
        default:
          console.warn(`Unknown message type: ${rawMessage.type}`);
      }
    } catch (error) {
      console.error('Error handling MCP command:', error);
    }
  }

  private async handleTakeSnapshot(message: TakeSnapshotMessage): Promise<void> {
    const element = message.payload.ref ? 
      findElementByRef(message.payload.ref) : 
      document.body;
    
    if (!element) {
      this.send({
        type: 'snapshot_result',
        error: `Element with ref "${message.payload.ref || 'undefined'}" not found`
      });
      return;
    }
    
    const result = await snapshotForAI(element, message.payload);
    this.send({
      commandId: message.id,
      success: true,
      data: { snapshot: result }
    });
  }

  private handleExecuteJS(message: ExecuteJSMessage): void {
    try {
      const result = eval(message.payload.code);
      this.send({
        commandId: message.id,
        success: true,
        data: result
      });
    } catch (error) {
      this.send({
        commandId: message.id,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private handleClickElement(message: ClickElementMessage): void {
    try {
      clickRef(message.payload.ref);
      this.send({
        commandId: message.id,
        success: true,
        data: { clicked: true }
      });
    } catch (error) {
      this.send({
        commandId: message.id,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async handleTypeText(message: TypeTextMessage): Promise<void> {
    try {
      const element = findElementByRef(message.payload.ref);
      if (!element) {
        this.send({
          commandId: message.id,
          success: false,
          error: `Element with ref "${message.payload.ref || 'undefined'}" not found`
        });
        return;
      }
      
      if (message.payload.slowly) {
        // Type character by character
        for (let i = 0; i < message.payload.text.length; i++) {
          const char = message.payload.text[i];
          element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
          element.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
          
          if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            element.value += char;
          } else if (element.textContent !== null) {
            element.textContent += char;
          }
          
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } else {
        // Fill all at once
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          element.value = message.payload.text;
        } else if (element.textContent !== null) {
          element.textContent = message.payload.text;
        }
        
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      this.send({
        commandId: message.id,
        success: true,
        data: { typed: true }
      });
    } catch (error) {
      this.send({
        commandId: message.id,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private handlePressKey(message: PressKeyMessage): void {
    try {
      const element = findElementByRef(message.payload.ref);
      if (!element) {
        this.send({
          commandId: message.id,
          success: false,
          error: `Element with ref "${message.payload.ref || 'undefined'}" not found`
        });
        return;
      }
      
      const key = message.payload.key;
      element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keypress', { key, bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
      
      this.send({
        commandId: message.id,
        success: true,
        data: { pressed: true }
      });
    } catch (error) {
      this.send({
        commandId: message.id,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private handlePressKeyGlobal(message: PressKeyGlobalMessage): void {
    try {
      const key = message.payload.key;
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keypress', { key, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
      
      this.send({
        commandId: message.id,
        success: true,
        data: { pressed: true }
      });
    } catch (error) {
      this.send({
        commandId: message.id,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private handleHoverElement(message: HoverElementMessage): void {
    try {
      const element = findElementByRef(message.payload.ref);
      if (!element) {
        this.send({
          commandId: message.id,
          success: false,
          error: `Element with ref "${message.payload.ref || 'undefined'}" not found`
        });
        return;
      }
      
      element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      
      this.send({
        commandId: message.id,
        success: true,
        data: { hovered: true }
      });
    } catch (error) {
      this.send({
        commandId: message.id,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private handleSelectOption(message: SelectOptionMessage): void {
    try {
      const element = findElementByRef(message.payload.ref);
      if (!element || !(element instanceof HTMLSelectElement)) {
        this.send({
          commandId: message.id,
          success: false,
          error: `Element with ref "${message.payload.ref || 'undefined'}" not found or is not a select element`
        });
        return;
      }
      
      const values = message.payload.values;
      
      // Clear previous selections if not multiple
      if (!element.multiple) {
        for (let option of element.options) {
          option.selected = false;
        }
      }
      
      // Select the specified options
      let selectedCount = 0;
      for (let value of values) {
        for (let option of element.options) {
          if (option.value === value || option.text === value) {
            option.selected = true;
            selectedCount++;
            break;
          }
        }
      }
      
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      this.send({
        commandId: message.id,
        success: true,
        data: { selected: selectedCount }
      });
    } catch (error) {
      this.send({
        commandId: message.id,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async handleWaitFor(message: WaitForMessage): Promise<void> {
    try {
      const { text, textGone, time } = message.payload;
      
      if (time) {
        await new Promise(resolve => setTimeout(resolve, time * 1000));
        this.send({
          commandId: message.id,
          success: true,
          data: { waited: time }
        });
      } else if (text) {
        const checkForText = () => document.body.textContent?.includes(text) || false;
        
        if (checkForText()) {
          this.send({
            commandId: message.id,
            success: true,
            data: { found: text }
          });
          return;
        }
        
        let attempts = 0;
        const maxAttempts = 100;
        const pollInterval = setInterval(() => {
          attempts++;
          if (checkForText()) {
            clearInterval(pollInterval);
            this.send({
              commandId: message.id,
              success: true,
              data: { found: text }
            });
          } else if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            this.send({
              commandId: message.id,
              success: false,
              error: `Text "${text}" did not appear within 10 seconds`
            });
          }
        }, 100);
      } else if (textGone) {
        const checkTextGone = () => !document.body.textContent?.includes(textGone);
        
        if (checkTextGone()) {
          this.send({
            commandId: message.id,
            success: true,
            data: { gone: textGone }
          });
          return;
        }
        
        let attempts = 0;
        const maxAttempts = 100;
        const pollInterval = setInterval(() => {
          attempts++;
          if (checkTextGone()) {
            clearInterval(pollInterval);
            this.send({
              commandId: message.id,
              success: true,
              data: { gone: textGone }
            });
          } else if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            this.send({
              commandId: message.id,
              success: false,
              error: `Text "${textGone}" did not disappear within 10 seconds`
            });
          }
        }, 100);
      } else {
        this.send({
          commandId: message.id,
          success: false,
          error: 'Must specify either text, textGone, or time parameter'
        });
      }
    } catch (error) {
      this.send({
        commandId: message.id,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  startHeartbeat(): void {
    setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'heartbeat',
          payload: {
            url: window.location.href,
            title: document.title,
            timestamp: Date.now()
          }
        });
      }
    }, 30000);
  }
}

/**
 * Initialize MCP WebSocket connection if wsUrl is provided
 */
export function initializeMCPConnection(wsUrl: string): MCPWebSocketClient | null {
  if (typeof window === 'undefined') return null;
  
  console.log('🐱 A11yCap loaded');
  const client = new MCPWebSocketClient(wsUrl);
  client.connect();
  client.startHeartbeat();
  console.log('🐱 a11ycap initialized! Try: window.A11yCap.snapshotForAI(document.body)');
  return client;
}