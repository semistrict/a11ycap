/**
 * Element Picker Implementation
 * Inspired by Playwright's element inspector
 */

import { type ReactInfo, extractReactInfo } from './reactUtils.js';

export interface PickedElement {
  element: Element;
  selector: string;
  ariaLabel?: string;
  text?: string;
  ref?: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  reactInfo?: ReactInfo;
  snapshot?: string;
}

export interface ElementPickerOptions {
  includeSnapshots?: boolean;
  onElementsPicked?: (elements: PickedElement[]) => void;
}

interface HighlightEntry {
  element: Element;
  color: string;
  tooltipText?: string;
}

interface RenderedHighlightEntry {
  targetElement: Element;
  color: string;
  highlightElement: HTMLElement;
  tooltipElement?: HTMLElement;
  box?: DOMRect;
  tooltipTop?: number;
  tooltipLeft?: number;
  tooltipText?: string;
}

export class ElementPicker {
  private glassPaneElement: HTMLElement;
  private glassPaneShadow: ShadowRoot;
  private renderedEntries: RenderedHighlightEntry[] = [];
  private isActive = false;
  private pickedElements: PickedElement[] = [];
  private resolvePromise?: (elements: PickedElement[]) => void;
  private hoveredElement: Element | null = null;
  private selectedElements = new Set<Element>();
  private currentOptions?: ElementPickerOptions;

  /** Check if the element picker is currently active */
  public isPickerActive(): boolean {
    return this.isActive;
  }

  constructor(private document: Document = window.document) {
    // Create glass pane overlay
    this.glassPaneElement = document.createElement('x-a11ycap-glass');
    this.glassPaneElement.style.position = 'fixed';
    this.glassPaneElement.style.top = '0';
    this.glassPaneElement.style.right = '0';
    this.glassPaneElement.style.bottom = '0';
    this.glassPaneElement.style.left = '0';
    this.glassPaneElement.style.zIndex = '2147483647';
    this.glassPaneElement.style.pointerEvents = 'none';
    this.glassPaneElement.style.display = 'none';
    this.glassPaneElement.style.backgroundColor = 'transparent';
    this.glassPaneElement.style.cursor = 'crosshair';

    // Create shadow root for style isolation
    this.glassPaneShadow = this.glassPaneElement.attachShadow({ mode: 'open' });

    // Add styles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      :host {
        font-family: system-ui, -apple-system, sans-serif;
      }
      
      .highlight {
        position: absolute;
        border: 2px solid;
        pointer-events: none;
        box-sizing: border-box;
      }
      
      .highlight.hovered {
        border-color: #f97316;
        background-color: rgba(249, 115, 22, 0.1);
      }
      
      .highlight.selected {
        border-color: #10b981;
        background-color: rgba(16, 185, 129, 0.2);
      }
      
      .tooltip {
        position: absolute;
        background: #1f2937;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        white-space: nowrap;
        pointer-events: none;
        z-index: 10000;
      }
      
      .controls {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        pointer-events: all;
        z-index: 10001;
      }
      
      .controls h3 {
        margin: 0 0 8px 0;
        font-size: 14px;
        font-weight: 600;
      }
      
      .controls button {
        display: block;
        width: 100%;
        padding: 6px 12px;
        margin: 4px 0;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        background: white;
        font-size: 12px;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      
      .controls button:hover {
        background: #f3f4f6;
      }
      
      .controls button.primary {
        background: #3b82f6;
        color: white;
        border-color: #3b82f6;
      }
      
      .controls button.primary:hover {
        background: #2563eb;
      }
      
      .controls .info {
        font-size: 11px;
        color: #6b7280;
        margin-top: 8px;
      }
    `;
    this.glassPaneShadow.appendChild(styleElement);

    // Add control panel
    const controls = document.createElement('div');
    controls.className = 'controls';
    controls.innerHTML = `
      <h3>Element Picker</h3>
      <div class="info">Click to select/deselect elements</div>
      <button class="done primary">Done (${this.getModifierKey()}+Enter)</button>
      <button class="cancel">Cancel</button>
      <div class="info selected-count">Selected: 0</div>
    `;
    this.glassPaneShadow.appendChild(controls);

    // Setup event handlers
    this.setupEventHandlers();
  }

  private getModifierKey(): string {
    return navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl';
  }

  private setupEventHandlers() {
    // Prevent all events from reaching the page
    const stopEvent = (e: Event) => {
      if (this.isActive) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    // Mouse move for hover effect
    this.glassPaneElement.addEventListener('mousemove', (e) => {
      if (!this.isActive) return;
      stopEvent(e);

      // Temporarily disable pointer events to get element underneath
      this.glassPaneElement.style.pointerEvents = 'none';
      const element = document.elementFromPoint(e.clientX, e.clientY);
      this.glassPaneElement.style.pointerEvents = 'all';

      if (element && element !== this.hoveredElement) {
        this.hoveredElement = element;
        this.updateHighlights();
      }
    });

    // Click to select element
    this.glassPaneElement.addEventListener('click', (e) => {
      if (!this.isActive) return;
      stopEvent(e);

      // Check if click is on control buttons
      const target = e.composedPath()[0] as HTMLElement;
      if (target?.classList?.contains('done')) {
        this.complete();
        return;
      }
      if (target?.classList?.contains('cancel')) {
        this.cancel();
        return;
      }

      if (this.hoveredElement) {
        if (this.selectedElements.has(this.hoveredElement)) {
          this.selectedElements.delete(this.hoveredElement);
        } else {
          this.selectedElements.add(this.hoveredElement);
        }
        this.updateHighlights();
        this.updateSelectedCount();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (!this.isActive) return;

      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        stopEvent(e);
        this.complete();
      }
    });

    // Block all other events
    for (const eventName of [
      'auxclick',
      'dragstart',
      'input',
      'keypress',
      'pointerdown',
      'pointerup',
      'mousedown',
      'mouseup',
      'focus',
      'scroll',
    ]) {
      this.glassPaneElement.addEventListener(eventName, stopEvent);
    }
  }

  private updateSelectedCount() {
    const countElement = this.glassPaneShadow.querySelector('.selected-count');
    if (countElement) {
      countElement.textContent = `Selected: ${this.selectedElements.size}`;
    }
  }

  private updateHighlights() {
    // Clear existing highlights
    for (const entry of this.renderedEntries) {
      entry.highlightElement?.remove();
      entry.tooltipElement?.remove();
    }
    this.renderedEntries = [];

    // Highlight selected elements
    for (const element of this.selectedElements) {
      this.addHighlight(element, 'selected');
    }

    // Highlight hovered element
    if (
      this.hoveredElement &&
      !this.selectedElements.has(this.hoveredElement)
    ) {
      this.addHighlight(this.hoveredElement, 'hovered');
    }
  }

  private addHighlight(element: Element, type: 'hovered' | 'selected') {
    const box = element.getBoundingClientRect();
    if (!box || (box.width === 0 && box.height === 0)) return;

    const highlight = document.createElement('div');
    highlight.className = `highlight ${type}`;
    highlight.style.left = `${box.left}px`;
    highlight.style.top = `${box.top}px`;
    highlight.style.width = `${box.width}px`;
    highlight.style.height = `${box.height}px`;

    this.glassPaneShadow.appendChild(highlight);

    // Add tooltip for hovered element
    if (type === 'hovered') {
      const tooltip = document.createElement('div');
      tooltip.className = 'tooltip';
      tooltip.textContent = this.getElementDescription(element);

      // Position tooltip
      const tooltipTop = box.top > 30 ? box.top - 30 : box.bottom + 5;
      tooltip.style.left = `${box.left}px`;
      tooltip.style.top = `${tooltipTop}px`;

      this.glassPaneShadow.appendChild(tooltip);

      this.renderedEntries.push({
        targetElement: element,
        color: '#f97316',
        highlightElement: highlight,
        tooltipElement: tooltip,
        box,
        tooltipTop,
        tooltipLeft: box.left,
        tooltipText: tooltip.textContent,
      });
    } else {
      this.renderedEntries.push({
        targetElement: element,
        color: '#10b981',
        highlightElement: highlight,
        box,
      });
    }
  }

  private getElementDescription(element: Element): string {
    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const className = element.className
      ? `.${element.className.split(' ').join('.')}`
      : '';
    const ariaLabel = element.getAttribute('aria-label');
    const text = element.textContent?.trim().substring(0, 30);

    // Get React component info if available
    const reactInfo = extractReactInfo(element);

    let desc = `${tag}${id}${className}`;

    // Add React component name if available
    if (reactInfo?.componentName) {
      desc = `[${reactInfo.componentName}] ${desc}`;
    }

    if (ariaLabel) desc += ` [${ariaLabel}]`;
    else if (text) desc += ` "${text}..."`;

    // Add source location if available
    if (reactInfo?.debugSource) {
      desc += ` (${reactInfo.debugSource})`;
    }

    return desc;
  }

  private generateSelector(element: Element): string {
    // Priority 1: data-testid or data-test-id attributes
    const testId =
      element.getAttribute('data-testid') ||
      element.getAttribute('data-test-id') ||
      element.getAttribute('data-test');
    if (testId) {
      return `[data-testid="${testId}"]`;
    }

    // Priority 2: ID selector
    const id = element.id;
    if (id) return `#${id}`;

    // Priority 3: aria-label for interactive elements
    const ariaLabel = element.getAttribute('aria-label');
    if (
      ariaLabel &&
      ['button', 'a', 'input', 'select', 'textarea'].includes(
        element.tagName.toLowerCase()
      )
    ) {
      const selector = `${element.tagName.toLowerCase()}[aria-label="${ariaLabel}"]`;
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }

    // Priority 4: Class-based selector
    const className = element.className;
    if (className && typeof className === 'string') {
      const classes = className.trim().split(/\s+/).join('.');
      if (classes) {
        const selector = `${element.tagName.toLowerCase()}.${classes}`;
        // Check uniqueness
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      }
    }

    // Priority 5: Text content for buttons and links
    const text = element.textContent?.trim();
    if (
      text &&
      text.length < 50 &&
      ['button', 'a'].includes(element.tagName.toLowerCase())
    ) {
      // Try to find by text (simplified)
      const selector = `${element.tagName.toLowerCase()}`;
      const matches = Array.from(document.querySelectorAll(selector));
      const index = matches.findIndex((el) => el.textContent?.trim() === text);
      if (index >= 0 && matches.length > 1) {
        return `${selector}:nth-of-type(${index + 1})`;
      }
    }

    // Fall back to nth-child selector
    const path = [];
    let current: Element | null = element;

    while (current && current !== document.body) {
      const parent: Element | null = current.parentElement;
      if (!parent) break;

      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(current) + 1;

      const tag = current.tagName.toLowerCase();
      const selector = index > 1 ? `${tag}:nth-child(${index})` : tag;
      path.unshift(selector);

      current = parent;
    }

    return path.join(' > ');
  }

  private async complete() {
    const elements: PickedElement[] = Array.from(this.selectedElements).map(
      (element) => {
        const box = element.getBoundingClientRect();

        // Extract React info if available
        const reactInfo = extractReactInfo(element);

        // Get element ref from aria snapshot
        const ref = (element as any)._ariaRef?.ref;

        return {
          element,
          selector: this.generateSelector(element),
          ariaLabel: element.getAttribute('aria-label') || undefined,
          text: element.textContent?.trim() || undefined,
          ref: ref || undefined,
          boundingBox: {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
          },
          reactInfo: reactInfo || undefined,
        };
      }
    );

    // Add snapshots if requested
    if (this.currentOptions?.includeSnapshots) {
      // Import snapshot function dynamically to avoid circular deps
      const { snapshotForAI } = await import('./index.js');

      for (const pickedElement of elements) {
        try {
          const snapshot = await snapshotForAI(pickedElement.element, {
            max_bytes: 1024,
          });
          pickedElement.snapshot = snapshot;
        } catch (error) {
          console.warn(
            'Failed to generate snapshot for picked element:',
            error
          );
        }
      }
    }

    this.cleanup();

    // Call callback if provided
    if (this.currentOptions?.onElementsPicked) {
      this.currentOptions.onElementsPicked(elements);
    }

    if (this.resolvePromise) {
      this.resolvePromise(elements);
      this.resolvePromise = undefined;
    }
  }

  private cancel() {
    this.cleanup();

    if (this.resolvePromise) {
      this.resolvePromise([]);
      this.resolvePromise = undefined;
    }
  }

  private cleanup() {
    this.isActive = false;
    this.glassPaneElement.style.display = 'none';
    this.glassPaneElement.style.pointerEvents = 'none';
    this.selectedElements.clear();
    this.hoveredElement = null;
    this.updateHighlights();
  }

  public enable(options: ElementPickerOptions = {}): void {
    this.currentOptions = options;
    this.isActive = true;
    this.selectedElements.clear();

    // Install glass pane if not already installed
    if (!document.body.contains(this.glassPaneElement)) {
      document.body.appendChild(this.glassPaneElement);
    }

    // Show picker UI
    this.glassPaneElement.style.display = 'block';
    this.glassPaneElement.style.pointerEvents = 'all';

    this.updateHighlights();
    this.updateSelectedCount();
  }

  public async pick(): Promise<PickedElement[]> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.enable();
    });
  }
}

// Global instance
let globalPicker: ElementPicker | null = null;

export function getElementPicker(): ElementPicker {
  if (!globalPicker) {
    globalPicker = new ElementPicker();
  }
  return globalPicker;
}
