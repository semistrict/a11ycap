/**
 * Main Menu for A11yCap
 * Provides options to launch different tools
 */

import { getElementPicker } from './elementPickerSimple.js';
import { getInteractionRecorder } from './interactionRecorder.js';

export class MainMenu {
  private menuElement: HTMLElement;
  private menuShadow: ShadowRoot;
  private isActive = false;
  private resolvePromise?: (action: string | null) => void;
  private escHandler?: (e: KeyboardEvent) => void;

  constructor(private document: Document = window.document) {
    // Create menu overlay
    this.menuElement = document.createElement('x-a11ycap-menu');
    this.menuElement.classList.add('a11ycap-ui');
    this.menuElement.style.position = 'fixed';
    this.menuElement.style.top = '0';
    this.menuElement.style.right = '0';
    this.menuElement.style.bottom = '0';
    this.menuElement.style.left = '0';
    this.menuElement.style.zIndex = '2147483647';
    this.menuElement.style.pointerEvents = 'none';
    this.menuElement.style.display = 'none';
    this.menuElement.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    this.menuElement.style.backdropFilter = 'blur(2px)';

    // Create shadow root for style isolation
    this.menuShadow = this.menuElement.attachShadow({ mode: 'open' });

    // Add styles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      :host {
        font-family: system-ui, -apple-system, sans-serif;
      }
      
      .menu-container {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
        min-width: 320px;
        pointer-events: all;
      }
      
      .menu-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e5e7eb;
      }
      
      .menu-title {
        font-size: 20px;
        font-weight: 600;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .close-button {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #6b7280;
        padding: 0;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background-color 0.2s;
      }
      
      .close-button:hover {
        background-color: #f3f4f6;
      }
      
      .menu-options {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .menu-option {
        display: flex;
        flex-direction: column;
        padding: 12px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        background: white;
      }
      
      .menu-option:hover {
        background: #f9fafb;
        border-color: #3b82f6;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }
      
      .menu-option-title {
        font-size: 16px;
        font-weight: 500;
        margin-bottom: 4px;
        color: #1f2937;
      }
      
      .menu-option-description {
        font-size: 13px;
        color: #6b7280;
        line-height: 1.4;
      }
      
      .menu-option-icon {
        font-size: 24px;
        margin-right: 12px;
      }
      
      .menu-option-content {
        display: flex;
        align-items: flex-start;
      }
      
      .menu-option-text {
        flex: 1;
      }
      
      .shortcut-hint {
        font-size: 11px;
        color: #9ca3af;
        margin-top: 12px;
        text-align: center;
      }
    `;
    this.menuShadow.appendChild(styleElement);

    // Add menu content
    const menuContainer = document.createElement('div');
    menuContainer.className = 'menu-container';
    menuContainer.innerHTML = `
      <div class="menu-header">
        <h3 class="menu-title">
          <span>🐱</span>
          <span>A11yCap Tools</span>
        </h3>
        <button class="close-button" title="Close (ESC)">×</button>
      </div>
      <div class="menu-options">
        <div class="menu-option" data-action="picker">
          <div class="menu-option-content">
            <span class="menu-option-icon">🎯</span>
            <div class="menu-option-text">
              <div class="menu-option-title">Element Picker</div>
              <div class="menu-option-description">Select elements on the page to inspect their accessibility properties</div>
            </div>
          </div>
        </div>
        <div class="menu-option" data-action="recorder">
          <div class="menu-option-content">
            <span class="menu-option-icon">🔴</span>
            <div class="menu-option-text">
              <div class="menu-option-title">Interaction Recorder</div>
              <div class="menu-option-description">Record user interactions like clicks, typing, and navigation</div>
            </div>
          </div>
        </div>
      </div>
      <div class="shortcut-hint">Press ESC to close • Triple-ESC to reopen</div>
    `;
    this.menuShadow.appendChild(menuContainer);

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Handle option clicks
    this.menuShadow.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Close button
      if (
        target.classList.contains('close-button') ||
        target.closest('.close-button')
      ) {
        this.close();
        return;
      }

      // Menu options
      const option = target.closest('.menu-option') as HTMLElement;
      if (option) {
        const action = option.dataset.action;
        if (action) {
          this.selectOption(action);
        }
      }
    });

    // Create ESC handler
    this.escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.isActive) {
        // Don't stop propagation - let it bubble for triple-ESC detection
        this.close();
      }
    };
  }

  private selectOption(action: string) {
    this.hide();

    switch (action) {
      case 'picker': {
        // Launch element picker
        const picker = getElementPicker();
        picker.enable({
          includeSnapshots: true,
          onElementsPicked: (elements) => {
            console.log(`[A11yCap] Picked ${elements.length} elements`);
          },
        });
        break;
      }

      case 'recorder': {
        // Launch interaction recorder and auto-start recording
        // Small delay to ensure menu is fully hidden first
        setTimeout(() => {
          const recorder = getInteractionRecorder();
          recorder.show(true); // true = autoStart
        }, 50);
        break;
      }
    }

    if (this.resolvePromise) {
      this.resolvePromise(action);
      this.resolvePromise = undefined;
    }
  }

  private close() {
    this.hide();
    if (this.resolvePromise) {
      this.resolvePromise(null);
      this.resolvePromise = undefined;
    }
  }

  private hide() {
    this.isActive = false;
    this.menuElement.style.display = 'none';
    this.menuElement.style.pointerEvents = 'none';

    // Remove ESC handler
    if (this.escHandler) {
      document.removeEventListener('keydown', this.escHandler);
    }
  }

  public show(): void {
    this.isActive = true;

    // Install menu if not already installed
    if (!document.body.contains(this.menuElement)) {
      document.body.appendChild(this.menuElement);
    }

    // Show menu
    this.menuElement.style.display = 'block';
    this.menuElement.style.pointerEvents = 'all';

    // Add ESC handler
    if (this.escHandler) {
      document.addEventListener('keydown', this.escHandler);
    }
  }

  public async open(): Promise<string | null> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.show();
    });
  }

  public isMenuActive(): boolean {
    return this.isActive;
  }
}

// Global instance
let globalMenu: MainMenu | null = null;

export function getMainMenu(): MainMenu {
  if (!globalMenu) {
    globalMenu = new MainMenu();
  }
  return globalMenu;
}
