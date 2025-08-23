/**
 * Interaction Recorder UI
 * Dedicated interface for recording user interactions
 */

import { clearEvents, getBufferStats } from './eventBuffer.js';
import {
  getRecordingDuration,
  isRecordingActive,
  startRecording,
  stopRecording,
} from './interactionForwarder.js';

export class InteractionRecorder {
  private recorderElement: HTMLElement;
  private recorderShadow: ShadowRoot;
  private isVisible = false;
  private recordingInterval?: number;
  private escHandler?: (e: KeyboardEvent) => void;

  constructor(private document: Document = window.document) {
    // Create recorder UI element
    this.recorderElement = document.createElement('x-a11ycap-recorder');
    this.recorderElement.classList.add('a11ycap-ui');
    this.recorderElement.style.position = 'fixed';
    this.recorderElement.style.top = '20px';
    this.recorderElement.style.right = '20px';
    this.recorderElement.style.zIndex = '2147483647';
    this.recorderElement.style.pointerEvents = 'none';
    this.recorderElement.style.display = 'none';

    // Create shadow root for style isolation
    this.recorderShadow = this.recorderElement.attachShadow({ mode: 'open' });

    // Add styles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      :host {
        font-family: system-ui, -apple-system, sans-serif;
      }
      
      .recorder-panel {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        pointer-events: all;
        min-width: 240px;
      }
      
      .recorder-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #e5e7eb;
      }
      
      .recorder-title {
        font-size: 14px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 0;
      }
      
      .close-button {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #6b7280;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background-color 0.2s;
      }
      
      .close-button:hover {
        background-color: #f3f4f6;
      }
      
      .recorder-controls {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .control-button {
        padding: 8px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        background: white;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      
      .control-button:hover {
        background: #f3f4f6;
      }
      
      .control-button.primary {
        background: #3b82f6;
        color: white;
        border-color: #3b82f6;
      }
      
      .control-button.primary:hover {
        background: #2563eb;
      }
      
      .control-button.recording {
        background: #ef4444;
        color: white;
        border-color: #ef4444;
        animation: pulse 2s infinite;
      }
      
      .control-button.recording:hover {
        background: #dc2626;
      }
      
      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.8;
        }
      }
      
      .status-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #e5e7eb;
      }
      
      .status-line {
        font-size: 12px;
        color: #6b7280;
        display: flex;
        justify-content: space-between;
      }
      
      .status-line.active {
        color: #10b981;
        font-weight: 500;
      }
      
      .control-row {
        display: flex;
        gap: 8px;
      }
      
      .control-row .control-button {
        flex: 1;
      }
      
      .recording-indicator {
        display: inline-block;
        width: 8px;
        height: 8px;
        background: #ef4444;
        border-radius: 50%;
        animation: pulse 2s infinite;
      }
      
      .shortcut-hint {
        font-size: 11px;
        color: #9ca3af;
        margin-top: 8px;
        text-align: center;
      }
    `;
    this.recorderShadow.appendChild(styleElement);

    // Add recorder content
    const recorderPanel = document.createElement('div');
    recorderPanel.className = 'recorder-panel';
    recorderPanel.innerHTML = `
      <div class="recorder-header">
        <h3 class="recorder-title">
          <span>🔴</span>
          <span>Interaction Recorder</span>
        </h3>
        <button class="close-button" title="Close">×</button>
      </div>
      <div class="recorder-controls">
        <button class="control-button primary record-button">
          <span class="button-icon">▶</span>
          <span class="button-text">Start Recording</span>
        </button>
        <div class="control-row">
          <button class="control-button clear-button">Clear Buffer</button>
          <button class="control-button export-button">Export</button>
        </div>
      </div>
      <div class="status-info">
        <div class="status-line buffer-stats">
          <span>Buffer:</span>
          <span class="buffer-count">0 events</span>
        </div>
        <div class="status-line recording-duration" style="display: none;">
          <span>Duration:</span>
          <span class="duration-text">0:00</span>
        </div>
      </div>
      <div class="shortcut-hint">Press ESC to minimize</div>
    `;
    this.recorderShadow.appendChild(recorderPanel);

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Handle button clicks
    this.recorderShadow.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Close button
      if (
        target.classList.contains('close-button') ||
        target.closest('.close-button')
      ) {
        this.hide();
        return;
      }

      // Record button
      if (
        target.classList.contains('record-button') ||
        target.closest('.record-button')
      ) {
        this.toggleRecording();
        return;
      }

      // Clear button
      if (
        target.classList.contains('clear-button') ||
        target.closest('.clear-button')
      ) {
        this.clearBuffer();
        return;
      }

      // Export button
      if (
        target.classList.contains('export-button') ||
        target.closest('.export-button')
      ) {
        this.exportEvents();
        return;
      }
    });

    // Create ESC handler
    this.escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.isVisible) {
        // Don't prevent default - let it bubble up for triple-ESC
        this.hide();
      }
    };
  }

  private toggleRecording() {
    const recordButton = this.recorderShadow.querySelector(
      '.record-button'
    ) as HTMLElement;
    const buttonIcon = recordButton.querySelector(
      '.button-icon'
    ) as HTMLElement;
    const buttonText = recordButton.querySelector(
      '.button-text'
    ) as HTMLElement;
    const durationLine = this.recorderShadow.querySelector(
      '.recording-duration'
    ) as HTMLElement;
    const durationText = this.recorderShadow.querySelector(
      '.duration-text'
    ) as HTMLElement;

    if (isRecordingActive()) {
      // Stop recording
      stopRecording();
      recordButton.classList.remove('recording');
      buttonIcon.textContent = '▶';
      buttonText.textContent = 'Start Recording';
      durationLine.style.display = 'none';

      if (this.recordingInterval) {
        clearInterval(this.recordingInterval);
        this.recordingInterval = undefined;
      }
    } else {
      // Start recording
      startRecording();
      recordButton.classList.add('recording');
      buttonIcon.textContent = '■';
      buttonText.textContent = 'Stop Recording';
      durationLine.style.display = 'flex';

      // Update duration display
      this.recordingInterval = window.setInterval(() => {
        const duration = getRecordingDuration();
        if (duration !== null) {
          const seconds = Math.floor(duration / 1000);
          const minutes = Math.floor(seconds / 60);
          const remainingSeconds = seconds % 60;
          durationText.textContent = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
        // Also update buffer stats
        this.updateBufferStats();
      }, 100);
    }

    this.updateBufferStats();
  }

  private clearBuffer() {
    clearEvents();
    this.updateBufferStats();
    console.log('[A11yCap] Event buffer cleared');
  }

  private exportEvents() {
    const stats = getBufferStats();
    console.log(`[A11yCap] Exporting ${stats.totalEvents} events...`);
    // TODO: Implement actual export functionality
    alert(
      `Export functionality coming soon!\nCurrently ${stats.totalEvents} events in buffer.`
    );
  }

  private updateBufferStats() {
    const stats = getBufferStats();
    const bufferCount = this.recorderShadow.querySelector(
      '.buffer-count'
    ) as HTMLElement;
    const bufferLine = this.recorderShadow.querySelector(
      '.buffer-stats'
    ) as HTMLElement;

    if (bufferCount) {
      // Count all events except console logs
      const nonConsoleCount = Object.entries(stats.eventTypes)
        .filter(([type]) => type !== 'console')
        .reduce((sum, [, count]) => sum + count, 0);
      
      bufferCount.textContent = `${nonConsoleCount} events`;
    }

    if (bufferLine) {
      if (isRecordingActive()) {
        bufferLine.classList.add('active');
      } else {
        bufferLine.classList.remove('active');
      }
    }
  }

  public show(autoStart = false): void {
    this.isVisible = true;

    // Install recorder UI if not already installed
    if (!document.body.contains(this.recorderElement)) {
      document.body.appendChild(this.recorderElement);
    }

    // Show recorder
    this.recorderElement.style.display = 'block';

    // Add ESC handler
    if (this.escHandler) {
      document.addEventListener('keydown', this.escHandler);
    }

    // Auto-start recording if requested and not already recording
    if (autoStart && !isRecordingActive()) {
      this.toggleRecording();
    } else {
      // Update UI state for current recording status
      const recordButton = this.recorderShadow.querySelector(
        '.record-button'
      ) as HTMLElement;
      const buttonIcon = recordButton.querySelector(
        '.button-icon'
      ) as HTMLElement;
      const buttonText = recordButton.querySelector(
        '.button-text'
      ) as HTMLElement;
      const durationLine = this.recorderShadow.querySelector(
        '.recording-duration'
      ) as HTMLElement;

      if (isRecordingActive()) {
        recordButton.classList.add('recording');
        buttonIcon.textContent = '■';
        buttonText.textContent = 'Stop Recording';
        durationLine.style.display = 'flex';

        // Start updating duration if not already
        if (!this.recordingInterval) {
          this.recordingInterval = window.setInterval(() => {
            const duration = getRecordingDuration();
            if (duration !== null) {
              const seconds = Math.floor(duration / 1000);
              const minutes = Math.floor(seconds / 60);
              const remainingSeconds = seconds % 60;
              const durationText = this.recorderShadow.querySelector(
                '.duration-text'
              ) as HTMLElement;
              durationText.textContent = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
            }
            this.updateBufferStats();
          }, 100);
        }
      } else {
        recordButton.classList.remove('recording');
        buttonIcon.textContent = '▶';
        buttonText.textContent = 'Start Recording';
        durationLine.style.display = 'none';
      }

      this.updateBufferStats();
    }
  }

  public hide(): void {
    this.isVisible = false;
    this.recorderElement.style.display = 'none';

    // Remove ESC handler
    if (this.escHandler) {
      document.removeEventListener('keydown', this.escHandler);
    }

    // Keep interval running if recording
    if (!isRecordingActive() && this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = undefined;
    }
  }

  public isRecorderVisible(): boolean {
    return this.isVisible;
  }
}

// Global instance
let globalRecorder: InteractionRecorder | null = null;

export function getInteractionRecorder(): InteractionRecorder {
  if (!globalRecorder) {
    globalRecorder = new InteractionRecorder();
  }
  return globalRecorder;
}
