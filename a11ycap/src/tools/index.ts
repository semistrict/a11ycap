export { takeSnapshotTool, takeSnapshotDefinition } from './takeSnapshot.js';
export { clickElementTool, clickElementDefinition } from './clickElement.js';
export {
  getNetworkRequestsTool,
  getNetworkRequestsDefinition,
} from './getNetworkRequests.js';
export { listTabsTool, listTabsDefinition } from './listTabs.js';
export { executeJsTool, executeJsDefinition } from './executeJs.js';
export { typeTextTool, typeTextDefinition } from './typeText.js';
export { pressKeyTool, pressKeyDefinition } from './pressKey.js';
export {
  pressKeyGlobalTool,
  pressKeyGlobalDefinition,
} from './pressKeyGlobal.js';
export { hoverElementTool, hoverElementDefinition } from './hoverElement.js';
export { selectOptionTool, selectOptionDefinition } from './selectOption.js';
export { waitForTool, waitForDefinition } from './waitFor.js';
export {
  showElementPickerTool,
  showElementPickerDefinition,
} from './showElementPicker.js';
export {
  getReadabilityTool,
  getReadabilityDefinition,
} from './getReadability.js';
export {
  getConsoleLogsTool,
  getConsoleLogsDefinition,
} from './getConsoleLogs.js';
export {
  getUserInteractionsTool,
  getUserInteractionsDefinition,
} from './getUserInteractions.js';
export {
  captureElementImageTool,
  captureElementImageDefinition,
} from './captureElementImage.js';
export {
  getPickedElementsTool,
  getPickedElementsDefinition,
} from './getPickedElements.js';
export {
  getElementInfoTool,
  getElementInfoDefinition,
} from './getElementInfo.js';
export {
  mutateElementTool,
  mutateElementDefinition,
} from './mutateElement.js';
export { doctorTool, doctorDefinition } from './doctor.js';
export type { ToolDefinition, ToolHandler, BaseToolMessage } from './base.js';

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
