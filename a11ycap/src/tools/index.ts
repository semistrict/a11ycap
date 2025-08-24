export type { BaseToolMessage, ToolDefinition, ToolHandler } from './base.js';
export {
  captureElementImageDefinition,
  captureElementImageTool,
} from './captureElementImage.js';
export { clickElementDefinition, clickElementTool } from './clickElement.js';
export { doctorDefinition, doctorTool } from './doctor.js';
export { executeJsDefinition, executeJsTool } from './executeJs.js';
export {
  getConsoleLogsDefinition,
  getConsoleLogsTool,
} from './getConsoleLogs.js';
export {
  getElementInfoDefinition,
  getElementInfoTool,
} from './getElementInfo.js';
export {
  getNetworkRequestsDefinition,
  getNetworkRequestsTool,
} from './getNetworkRequests.js';
export {
  getPickedElementsDefinition,
  getPickedElementsTool,
} from './getPickedElements.js';
export {
  getReadabilityDefinition,
  getReadabilityTool,
} from './getReadability.js';
export {
  getUserInteractionsDefinition,
  getUserInteractionsTool,
} from './getUserInteractions.js';
export { hoverElementDefinition, hoverElementTool } from './hoverElement.js';
export { listTabsDefinition, listTabsTool } from './listTabs.js';
export {
  mutateElementDefinition,
  mutateElementTool,
} from './mutateElement.js';
export { pressKeyDefinition, pressKeyTool } from './pressKey.js';
export {
  pressKeyGlobalDefinition,
  pressKeyGlobalTool,
} from './pressKeyGlobal.js';
export { selectOptionDefinition, selectOptionTool } from './selectOption.js';
export {
  showElementPickerDefinition,
  showElementPickerTool,
} from './showElementPicker.js';
export { takeSnapshotDefinition, takeSnapshotTool } from './takeSnapshot.js';
export { typeTextDefinition, typeTextTool } from './typeText.js';
export { waitForDefinition, waitForTool } from './waitFor.js';

import { captureElementImageTool } from './captureElementImage.js';
import { clickElementTool } from './clickElement.js';
import { doctorTool } from './doctor.js';
import { executeJsTool } from './executeJs.js';
import { getConsoleLogsTool } from './getConsoleLogs.js';
import { getElementInfoTool } from './getElementInfo.js';
import { getNetworkRequestsTool } from './getNetworkRequests.js';
import { getPickedElementsTool } from './getPickedElements.js';
import { getReadabilityTool } from './getReadability.js';
import { getUserInteractionsTool } from './getUserInteractions.js';
import { hoverElementTool } from './hoverElement.js';
import { listTabsTool } from './listTabs.js';
import { mutateElementTool } from './mutateElement.js';
import { pressKeyTool } from './pressKey.js';
import { pressKeyGlobalTool } from './pressKeyGlobal.js';
import { selectOptionTool } from './selectOption.js';
import { showElementPickerTool } from './showElementPicker.js';
import { takeSnapshotTool } from './takeSnapshot.js';
import { typeTextTool } from './typeText.js';
import { waitForTool } from './waitFor.js';

export const allTools = [
  takeSnapshotTool,
  clickElementTool,
  doctorTool,
  getNetworkRequestsTool,
  getReadabilityTool,
  getConsoleLogsTool,
  getUserInteractionsTool,
  captureElementImageTool,
  getPickedElementsTool,
  getElementInfoTool,
  mutateElementTool,
  listTabsTool,
  executeJsTool,
  typeTextTool,
  pressKeyTool,
  pressKeyGlobalTool,
  hoverElementTool,
  selectOptionTool,
  waitForTool,
  showElementPickerTool,
];

export const toolDefinitions = allTools.map((tool) => tool.definition);
export const toolHandlers = Object.fromEntries(
  allTools.map((tool) => [tool.definition.name, tool])
);
