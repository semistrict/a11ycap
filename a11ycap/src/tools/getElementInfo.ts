import { z } from 'zod';
import { box, getElementComputedStyle } from '../domUtils.js';
import { extractReactInfo } from '../reactUtils.js';
import type { ToolHandler } from './base.js';
import {
  getElementByRefOrThrow,
  multiElementToolSchema,
  resolveTargetElements,
} from './common.js';

/*
 * TODO: Additional properties that could be useful to return in future versions:
 *
 * ## DOM Hierarchy & Relationships
 * parent?: {
 *   tagName: string;
 *   id?: string;
 *   className?: string;
 *   role?: string;
 * };
 * children: {
 *   count: number;
 *   tagNames: string[];
 *   interactableCount: number;
 * };
 * siblings: {
 *   total: number;
 *   position: number; // 1-based index among siblings
 *   prev?: { tagName: string; id?: string; };
 *   next?: { tagName: string; id?: string; };
 * };
 *
 * ## Enhanced Accessibility
 * aria: {
 *   // ... existing properties
 *   computedRole?: string; // Actual computed role vs explicit role
 *   computedName?: string; // Full computed accessible name
 *   landmarks?: string[]; // If element is/contains landmarks
 *   headingLevel?: number; // For heading elements
 *   tabIndex?: number;
 *   keyboardNavigable: boolean;
 * };
 *
 * ## Visual & Layout Context
 * visual: {
 *   isInViewport: boolean;
 *   percentVisible: number; // 0-100% of element visible
 *   zIndex: number;
 *   stackingContext: boolean;
 *   hasScrollbars: boolean;
 *   scrollable: boolean;
 *   overflow: { x: string; y: string; };
 *   clipPath?: string;
 *   transform?: string;
 *   opacity: number;
 * };
 *
 * ## Form & Input Specific
 * form?: {
 *   formElement?: string; // ID of parent form
 *   validationMessage?: string;
 *   validity?: {
 *     valid: boolean;
 *     valueMissing: boolean;
 *     typeMismatch: boolean;
 *     patternMismatch: boolean;
 *     tooLong: boolean;
 *     tooShort: boolean;
 *     rangeUnderflow: boolean;
 *     rangeOverflow: boolean;
 *     stepMismatch: boolean;
 *   };
 *   autocomplete?: string;
 *   pattern?: string;
 *   minLength?: number;
 *   maxLength?: number;
 *   min?: string;
 *   max?: string;
 *   step?: string;
 *   placeholder?: string;
 *   accept?: string; // for file inputs
 * };
 *
 * ## Event Listeners & Interactivity
 * events: {
 *   hasClickHandler: boolean;
 *   hasKeyboardHandlers: boolean;
 *   hasMouseHandlers: boolean;
 *   hasFocusHandlers: boolean;
 *   listenerTypes: string[]; // ['click', 'keydown', etc.]
 * };
 *
 * ## Content & Text Analysis
 * content: {
 *   hasText: boolean;
 *   hasImages: boolean;
 *   hasLinks: boolean;
 *   wordCount: number;
 *   languageHints?: string; // lang attribute or detected
 *   contentEditable: boolean;
 *   userSelect: string;
 * };
 *
 * ## Performance & Timing
 * performance?: {
 *   renderTime?: number;
 *   lastModified?: number; // when element or attributes last changed
 *   animating: boolean;
 *   hasTransitions: boolean;
 *   hasAnimations: boolean;
 * };
 *
 * ## Shadow DOM & Web Components
 * shadow?: {
 *   hasShadowRoot: boolean;
 *   shadowMode?: 'open' | 'closed';
 *   isSlotted: boolean;
 *   slotName?: string;
 *   customElement: boolean;
 *   componentName?: string;
 * };
 *
 * ## Data Attributes & Custom Props
 * data: {
 *   dataAttributes: Record<string, string>; // all data-* attributes
 *   customAttributes: Record<string, string>; // non-standard attributes
 *   microdata?: {
 *     itemScope?: boolean;
 *     itemType?: string;
 *     itemProp?: string;
 *     itemId?: string;
 *   };
 * };
 *
 * ## Browser Compatibility Context
 * browser?: {
 *   userAgent: string;
 *   features: {
 *     supportsGrid: boolean;
 *     supportsFlex: boolean;
 *     supportsCustomElements: boolean;
 *     // other relevant feature detections
 *   };
 * };
 *
 * ## Most Valuable Additions (prioritized):
 * 1. Visual context (viewport visibility, z-index, scrollable)
 * 2. Form validation state (validity, validation messages)
 * 3. Event listeners (what interactions are possible)
 * 4. DOM relationships (parent/children context)
 * 5. Computed accessibility (computed role/name vs explicit)
 */

const getElementInfoSchema = multiElementToolSchema
  .omit({ captureSnapshot: true })
  .extend({
    // Support legacy single ref for backward compatibility
    ref: z
      .string()
      .optional()
      .describe(
        'Element reference from snapshot (e.g., "e5") - legacy, use refs instead'
      ),
  });

export const getElementInfoDefinition = {
  name: 'get_element_info',
  description:
    'Get comprehensive information about one or more elements without including sub-elements',
  inputSchema: getElementInfoSchema.shape,
};

const GetElementInfoMessageSchema = z.object({
  id: z.string(),
  type: z.literal('get_element_info'),
  payload: getElementInfoSchema,
});

type GetElementInfoMessage = z.infer<typeof GetElementInfoMessageSchema>;

export interface ElementInfo {
  ref: string;
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  innerText?: string;
  value?: string;
  type?: string;
  image?: {
    src?: string;
    alt?: string;
    naturalWidth?: number;
    naturalHeight?: number;
    complete?: boolean;
    currentSrc?: string;
    loading?: string;
    decoding?: string;
    sizes?: string;
    srcset?: string;
    aspectRatio?: number;
    displayedWidth?: number;
    displayedHeight?: number;
    isScaled?: boolean;
    objectFit?: string;
    objectPosition?: string;
    title?: string;
    isDecorative?: boolean;
    crossOrigin?: string;
    referrerPolicy?: string;
    loadError?: boolean;
  };
  aria: {
    role?: string;
    label?: string;
    labelledby?: string;
    describedby?: string;
    expanded?: boolean;
    checked?: boolean;
    disabled?: boolean;
    hidden?: boolean;
    selected?: boolean;
    pressed?: boolean;
    level?: number;
    valuemin?: number;
    valuemax?: number;
    valuenow?: number;
    valuetext?: string;
    live?: string;
    atomic?: boolean;
    busy?: boolean;
    controls?: string;
    owns?: string;
    computedRole?: string;
    computedName?: string;
    landmarks?: string[];
    headingLevel?: number;
    tabIndex?: number;
    keyboardNavigable: boolean;
  };
  attributes: Record<string, string>;
  computed: {
    display?: string;
    visibility?: string;
    opacity?: string;
    position?: string;
    zIndex?: string;
    transform?: string;
    cursor?: string;
    pointerEvents?: string;
    backgroundColor?: string;
    color?: string;
    fontSize?: string;
    fontFamily?: string;
    fontWeight?: string;
    textAlign?: string;
    border?: string;
    borderRadius?: string;
    margin?: string;
    padding?: string;
    width?: string;
    height?: string;
  };
  state: {
    focused: boolean;
    disabled: boolean;
    readonly: boolean;
    required: boolean;
    checked: boolean;
    selected: boolean;
    visible: boolean;
    hasPointerEvents: boolean;
  };
  geometry: {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  parent?: {
    tagName: string;
    id?: string;
    className?: string;
    role?: string;
  };
  children: {
    count: number;
    tagNames: string[];
    interactableCount: number;
  };
  siblings: {
    total: number;
    position: number;
    prev?: { tagName: string; id?: string };
    next?: { tagName: string; id?: string };
  };
  visual: {
    isInViewport: boolean;
    percentVisible: number;
    zIndex: number;
    stackingContext: boolean;
    hasScrollbars: boolean;
    scrollable: boolean;
    overflow: { x: string; y: string };
    clipPath?: string;
    transform?: string;
    opacity: number;
  };
  form?: {
    formElement?: string;
    validationMessage?: string;
    validity?: {
      valid: boolean;
      valueMissing: boolean;
      typeMismatch: boolean;
      patternMismatch: boolean;
      tooLong: boolean;
      tooShort: boolean;
      rangeUnderflow: boolean;
      rangeOverflow: boolean;
      stepMismatch: boolean;
    };
    autocomplete?: string;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: string;
    max?: string;
    step?: string;
    placeholder?: string;
    accept?: string;
  };
  events: {
    hasClickHandler: boolean;
    hasKeyboardHandlers: boolean;
    hasMouseHandlers: boolean;
    hasFocusHandlers: boolean;
    listenerTypes: string[];
  };
  content: {
    hasText: boolean;
    hasImages: boolean;
    hasLinks: boolean;
    wordCount: number;
    languageHints?: string;
    contentEditable: boolean;
    userSelect: string;
  };
  performance?: {
    renderTime?: number;
    lastModified?: number;
    animating: boolean;
    hasTransitions: boolean;
    hasAnimations: boolean;
  };
  shadow?: {
    hasShadowRoot: boolean;
    shadowMode?: 'open' | 'closed';
    isSlotted: boolean;
    slotName?: string;
    customElement: boolean;
    componentName?: string;
  };
  data: {
    dataAttributes: Record<string, string>;
    customAttributes: Record<string, string>;
    microdata?: {
      itemScope?: boolean;
      itemType?: string;
      itemProp?: string;
      itemId?: string;
    };
  };
  browser?: {
    userAgent: string;
    features: {
      supportsGrid: boolean;
      supportsFlex: boolean;
      supportsCustomElements: boolean;
    };
  };
  react?: {
    componentName?: string;
    props?: Record<string, any>;
    hooks?: Record<string, any>;
    source?: {
      fileName?: string;
      lineNumber?: number;
      columnNumber?: number;
    };
  };
}

function getImageInfo(element: Element): ElementInfo['image'] | undefined {
  if (element.tagName.toLowerCase() !== 'img') {
    return undefined;
  }

  const imgElement = element as HTMLImageElement;
  const rect = imgElement.getBoundingClientRect();
  const style = getComputedStyle(imgElement);

  // Calculate aspect ratio
  const aspectRatio =
    imgElement.naturalWidth && imgElement.naturalHeight
      ? imgElement.naturalWidth / imgElement.naturalHeight
      : undefined;

  // Check if image is scaled
  const isScaled =
    imgElement.naturalWidth && imgElement.naturalHeight
      ? Math.abs(rect.width - imgElement.naturalWidth) > 1 ||
        Math.abs(rect.height - imgElement.naturalHeight) > 1
      : undefined;

  // Check for loading error
  const loadError = imgElement.complete && imgElement.naturalWidth === 0;

  // Check if decorative (empty alt attribute)
  const isDecorative = imgElement.hasAttribute('alt') && imgElement.alt === '';

  return {
    src: imgElement.src || undefined,
    alt: imgElement.alt || undefined,
    naturalWidth: imgElement.naturalWidth || undefined,
    naturalHeight: imgElement.naturalHeight || undefined,
    complete: imgElement.complete,
    currentSrc: imgElement.currentSrc || undefined,
    loading: imgElement.loading || undefined,
    decoding: imgElement.decoding || undefined,
    sizes: imgElement.sizes || undefined,
    srcset: imgElement.srcset || undefined,
    aspectRatio,
    displayedWidth: rect.width || undefined,
    displayedHeight: rect.height || undefined,
    isScaled,
    objectFit: style.objectFit !== 'fill' ? style.objectFit : undefined,
    objectPosition:
      style.objectPosition !== '50% 50%' ? style.objectPosition : undefined,
    title: imgElement.title || undefined,
    isDecorative,
    crossOrigin: imgElement.crossOrigin || undefined,
    referrerPolicy: imgElement.referrerPolicy || undefined,
    loadError,
  };
}

function getDOMHierarchy(element: Element): {
  parent?: ElementInfo['parent'];
  children: ElementInfo['children'];
  siblings: ElementInfo['siblings'];
} {
  // Parent info
  const parentElement = element.parentElement;
  const parent = parentElement
    ? {
        tagName: parentElement.tagName.toLowerCase(),
        id: parentElement.id || undefined,
        className: parentElement.className || undefined,
        role: parentElement.getAttribute('role') || undefined,
      }
    : undefined;

  // Children info
  const children = Array.from(element.children);
  const interactableElements = children.filter((child) => {
    const tagName = child.tagName.toLowerCase();
    return (
      tagName === 'button' ||
      tagName === 'input' ||
      tagName === 'select' ||
      tagName === 'textarea' ||
      tagName === 'a' ||
      child.getAttribute('tabindex') ||
      child.getAttribute('onclick') ||
      child.getAttribute('role')
    );
  });

  const childrenInfo: ElementInfo['children'] = {
    count: children.length,
    tagNames: [
      ...new Set(children.map((child) => child.tagName.toLowerCase())),
    ],
    interactableCount: interactableElements.length,
  };

  // Siblings info
  const siblings = parentElement
    ? Array.from(parentElement.children)
    : [element];
  const siblingIndex = siblings.indexOf(element);
  const siblingsInfo: ElementInfo['siblings'] = {
    total: siblings.length,
    position: siblingIndex + 1,
    prev:
      siblingIndex > 0
        ? {
            tagName: siblings[siblingIndex - 1].tagName.toLowerCase(),
            id: siblings[siblingIndex - 1].id || undefined,
          }
        : undefined,
    next:
      siblingIndex < siblings.length - 1
        ? {
            tagName: siblings[siblingIndex + 1].tagName.toLowerCase(),
            id: siblings[siblingIndex + 1].id || undefined,
          }
        : undefined,
  };

  return { parent, children: childrenInfo, siblings: siblingsInfo };
}

function getAriaProperties(element: Element): ElementInfo['aria'] {
  const aria: ElementInfo['aria'] = {
    keyboardNavigable: false, // Will be set later
  };

  // Basic ARIA attributes
  aria.role = element.getAttribute('role') || undefined;
  aria.label = element.getAttribute('aria-label') || undefined;
  aria.labelledby = element.getAttribute('aria-labelledby') || undefined;
  aria.describedby = element.getAttribute('aria-describedby') || undefined;

  // ARIA states
  const expanded = element.getAttribute('aria-expanded');
  if (expanded !== null) aria.expanded = expanded === 'true';

  const checked = element.getAttribute('aria-checked');
  if (checked !== null) aria.checked = checked === 'true';

  const disabled = element.getAttribute('aria-disabled');
  if (disabled !== null) aria.disabled = disabled === 'true';

  const hidden = element.getAttribute('aria-hidden');
  if (hidden !== null) aria.hidden = hidden === 'true';

  const selected = element.getAttribute('aria-selected');
  if (selected !== null) aria.selected = selected === 'true';

  const pressed = element.getAttribute('aria-pressed');
  if (pressed !== null) aria.pressed = pressed === 'true';

  // ARIA values
  const level = element.getAttribute('aria-level');
  if (level !== null) aria.level = Number.parseInt(level, 10);

  const valuemin = element.getAttribute('aria-valuemin');
  if (valuemin !== null) aria.valuemin = Number.parseFloat(valuemin);

  const valuemax = element.getAttribute('aria-valuemax');
  if (valuemax !== null) aria.valuemax = Number.parseFloat(valuemax);

  const valuenow = element.getAttribute('aria-valuenow');
  if (valuenow !== null) aria.valuenow = Number.parseFloat(valuenow);

  aria.valuetext = element.getAttribute('aria-valuetext') || undefined;

  // ARIA live regions
  aria.live = element.getAttribute('aria-live') || undefined;

  const atomic = element.getAttribute('aria-atomic');
  if (atomic !== null) aria.atomic = atomic === 'true';

  const busy = element.getAttribute('aria-busy');
  if (busy !== null) aria.busy = busy === 'true';

  // ARIA relationships
  aria.controls = element.getAttribute('aria-controls') || undefined;
  aria.owns = element.getAttribute('aria-owns') || undefined;

  // Enhanced accessibility
  try {
    // Computed role (fallback to implicit role)
    const computedRole =
      element.getAttribute('role') || getImplicitRole(element);
    aria.computedRole = computedRole;

    // Computed accessible name
    aria.computedName = getAccessibleName(element);

    // Landmarks
    aria.landmarks = getLandmarks(element);

    // Heading level
    if (element.tagName.match(/^H[1-6]$/)) {
      aria.headingLevel = Number.parseInt(element.tagName.charAt(1), 10);
    } else if (aria.role === 'heading' && aria.level) {
      aria.headingLevel = aria.level;
    }

    // Tab index
    const tabIndex = element.getAttribute('tabindex');
    if (tabIndex !== null) {
      aria.tabIndex = Number.parseInt(tabIndex, 10);
    }

    // Keyboard navigable
    aria.keyboardNavigable = isKeyboardNavigable(element);
  } catch (error) {
    // Enhanced accessibility is optional
  }

  return aria;
}

function getImplicitRole(element: Element): string | undefined {
  const tagName = element.tagName.toLowerCase();
  const type = element.getAttribute('type');

  const roleMap: Record<string, string | undefined> = {
    button: 'button',
    a: element.hasAttribute('href') ? 'link' : undefined,
    input: getInputRole(type),
    select: 'combobox',
    textarea: 'textbox',
    h1: 'heading',
    h2: 'heading',
    h3: 'heading',
    h4: 'heading',
    h5: 'heading',
    h6: 'heading',
    nav: 'navigation',
    main: 'main',
    article: 'article',
    section: 'region',
    aside: 'complementary',
    header: 'banner',
    footer: 'contentinfo',
    ul: 'list',
    ol: 'list',
    li: 'listitem',
    img: element.getAttribute('alt') !== null ? 'img' : 'presentation',
  };

  return roleMap[tagName];
}

function getInputRole(type: string | null): string {
  const inputRoleMap: Record<string, string> = {
    button: 'button',
    checkbox: 'checkbox',
    radio: 'radio',
    range: 'slider',
    search: 'searchbox',
    email: 'textbox',
    tel: 'textbox',
    url: 'textbox',
    password: 'textbox',
    text: 'textbox',
    number: 'spinbutton',
  };

  return inputRoleMap[type || 'text'] || 'textbox';
}

function getAccessibleName(element: Element): string | undefined {
  // Try aria-label first
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();

  // Try aria-labelledby
  const labelledby = element.getAttribute('aria-labelledby');
  if (labelledby) {
    const labels = labelledby
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (labels.length > 0) return labels.join(' ');
  }

  // Try associated label
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label?.textContent) return label.textContent.trim();
  }

  // Try parent label
  const parentLabel = element.closest('label');
  if (parentLabel?.textContent) {
    return parentLabel.textContent
      .replace(element.textContent || '', '')
      .trim();
  }

  // For buttons and links, use text content
  if (['button', 'a'].includes(element.tagName.toLowerCase())) {
    return element.textContent?.trim() || undefined;
  }

  // For images, use alt text
  if (element.tagName.toLowerCase() === 'img') {
    return element.getAttribute('alt') || undefined;
  }

  return undefined;
}

function getLandmarks(element: Element): string[] {
  const landmarks: string[] = [];
  const role = element.getAttribute('role') || getImplicitRole(element);

  const landmarkRoles = [
    'banner',
    'navigation',
    'main',
    'complementary',
    'contentinfo',
    'region',
    'search',
    'form',
  ];
  if (role && landmarkRoles.includes(role)) {
    landmarks.push(role);
  }

  // Check if element contains landmarks
  const landmarkSelectors = `${landmarkRoles.map((r) => `[role="${r}"]`).join(',')},nav,main,aside,header,footer,section[aria-label],section[aria-labelledby],form[aria-label],form[aria-labelledby]`;

  const containedLandmarks = element.querySelectorAll(landmarkSelectors);
  for (const landmark of containedLandmarks) {
    const landmarkRole =
      landmark.getAttribute('role') || getImplicitRole(landmark as Element);
    if (landmarkRole && !landmarks.includes(landmarkRole)) {
      landmarks.push(landmarkRole);
    }
  }

  return landmarks;
}

function isKeyboardNavigable(element: Element): boolean {
  // Elements with tabindex
  const tabIndex = element.getAttribute('tabindex');
  if (tabIndex !== null) {
    return Number.parseInt(tabIndex, 10) >= 0;
  }

  // Naturally focusable elements
  const tagName = element.tagName.toLowerCase();
  const naturallyFocusable = ['a', 'button', 'input', 'select', 'textarea'];

  if (naturallyFocusable.includes(tagName)) {
    // Check if disabled
    const disabled = (element as any).disabled;
    return !disabled;
  }

  // Elements with href
  if (tagName === 'a' && element.hasAttribute('href')) {
    return true;
  }

  // Elements with interactive roles
  const role = element.getAttribute('role');
  const interactiveRoles = [
    'button',
    'link',
    'textbox',
    'combobox',
    'checkbox',
    'radio',
    'slider',
    'tab',
    'menuitem',
  ];
  return role ? interactiveRoles.includes(role) : false;
}

function getElementState(element: Element): ElementInfo['state'] {
  const htmlElement = element as HTMLElement;
  const inputElement = element as HTMLInputElement;
  const selectElement = element as HTMLSelectElement;
  const textareaElement = element as HTMLTextAreaElement;
  const buttonElement = element as HTMLButtonElement;
  const fieldsetElement = element as HTMLFieldSetElement;

  const elementBox = box(element);

  // Check disabled state based on element type
  let disabled = false;
  if ('disabled' in element) {
    disabled = (element as any).disabled;
  }

  return {
    focused: document.activeElement === element,
    disabled,
    readonly: inputElement.readOnly || textareaElement.readOnly || false,
    required:
      inputElement.required ||
      selectElement.required ||
      textareaElement.required ||
      false,
    checked: inputElement.checked || false,
    selected: (element as HTMLOptionElement).selected || false,
    visible: elementBox.visible,
    hasPointerEvents: getComputedStyle(element).pointerEvents !== 'none',
  };
}

function getAllAttributes(element: Element): Record<string, string> {
  const attributes: Record<string, string> = {};

  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    attributes[attr.name] = attr.value;
  }

  return attributes;
}

function getVisualInfo(element: Element): ElementInfo['visual'] {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);

  // Check if element is in viewport
  const isInViewport =
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <=
      (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth);

  // Calculate percentage visible
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth;

  const visibleHeight = Math.max(
    0,
    Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
  );
  const visibleWidth = Math.max(
    0,
    Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0)
  );
  const visibleArea = visibleHeight * visibleWidth;
  const totalArea = rect.height * rect.width;
  const percentVisible =
    totalArea > 0 ? Math.round((visibleArea / totalArea) * 100) : 0;

  // Check for scrollbars
  const hasScrollbars =
    element.scrollHeight > element.clientHeight ||
    element.scrollWidth > element.clientWidth;
  const scrollable =
    style.overflow !== 'visible' &&
    style.overflow !== 'hidden' &&
    hasScrollbars;

  // Check for stacking context
  const stackingContext =
    style.zIndex !== 'auto' ||
    style.position === 'fixed' ||
    style.position === 'sticky' ||
    Number.parseFloat(style.opacity) < 1 ||
    style.transform !== 'none' ||
    style.filter !== 'none';

  return {
    isInViewport,
    percentVisible,
    zIndex: Number.parseInt(style.zIndex, 10) || 0,
    stackingContext,
    hasScrollbars,
    scrollable,
    overflow: {
      x: style.overflowX,
      y: style.overflowY,
    },
    clipPath: style.clipPath !== 'none' ? style.clipPath : undefined,
    transform: style.transform !== 'none' ? style.transform : undefined,
    opacity: Number.parseFloat(style.opacity),
  };
}

function getFormInfo(element: Element): ElementInfo['form'] | undefined {
  const inputElement = element as HTMLInputElement;
  const selectElement = element as HTMLSelectElement;
  const textareaElement = element as HTMLTextAreaElement;
  const buttonElement = element as HTMLButtonElement;

  // Only return form info for form-related elements
  const formElements = ['input', 'select', 'textarea', 'button'];
  if (!formElements.includes(element.tagName.toLowerCase())) {
    return undefined;
  }

  const form = element.closest('form');

  const formInfo: ElementInfo['form'] = {
    formElement: form?.id || undefined,
  };

  // Validation for input elements
  if (inputElement.validity) {
    formInfo.validationMessage = inputElement.validationMessage || undefined;
    formInfo.validity = {
      valid: inputElement.validity.valid,
      valueMissing: inputElement.validity.valueMissing,
      typeMismatch: inputElement.validity.typeMismatch,
      patternMismatch: inputElement.validity.patternMismatch,
      tooLong: inputElement.validity.tooLong,
      tooShort: inputElement.validity.tooShort,
      rangeUnderflow: inputElement.validity.rangeUnderflow,
      rangeOverflow: inputElement.validity.rangeOverflow,
      stepMismatch: inputElement.validity.stepMismatch,
    };
  } else if (selectElement.validity) {
    formInfo.validationMessage = selectElement.validationMessage || undefined;
    formInfo.validity = {
      valid: selectElement.validity.valid,
      valueMissing: selectElement.validity.valueMissing,
      typeMismatch: false,
      patternMismatch: false,
      tooLong: false,
      tooShort: false,
      rangeUnderflow: false,
      rangeOverflow: false,
      stepMismatch: false,
    };
  } else if (textareaElement.validity) {
    formInfo.validationMessage = textareaElement.validationMessage || undefined;
    formInfo.validity = {
      valid: textareaElement.validity.valid,
      valueMissing: textareaElement.validity.valueMissing,
      typeMismatch: false,
      patternMismatch: textareaElement.validity.patternMismatch,
      tooLong: textareaElement.validity.tooLong,
      tooShort: textareaElement.validity.tooShort,
      rangeUnderflow: false,
      rangeOverflow: false,
      stepMismatch: false,
    };
  }

  // Input-specific attributes
  if (element.tagName.toLowerCase() === 'input') {
    formInfo.autocomplete = inputElement.autocomplete || undefined;
    formInfo.pattern = inputElement.pattern || undefined;
    formInfo.minLength =
      inputElement.minLength > 0 ? inputElement.minLength : undefined;
    formInfo.maxLength =
      inputElement.maxLength > 0 ? inputElement.maxLength : undefined;
    formInfo.min = inputElement.min || undefined;
    formInfo.max = inputElement.max || undefined;
    formInfo.step = inputElement.step || undefined;
    formInfo.placeholder = inputElement.placeholder || undefined;
    formInfo.accept = inputElement.accept || undefined;
  }

  return formInfo;
}

function getEventInfo(element: Element): ElementInfo['events'] {
  const listenerTypes: string[] = [];

  // Common event types to check for
  const eventTypes = [
    'click',
    'dblclick',
    'mousedown',
    'mouseup',
    'mouseover',
    'mouseout',
    'mousemove',
    'mouseenter',
    'mouseleave',
    'keydown',
    'keyup',
    'keypress',
    'focus',
    'blur',
    'focusin',
    'focusout',
    'input',
    'change',
    'submit',
    'reset',
    'touchstart',
    'touchmove',
    'touchend',
    'dragstart',
    'drag',
    'dragend',
    'dragover',
    'dragenter',
    'dragleave',
    'drop',
  ];

  // Check for inline event handlers
  for (const eventType of eventTypes) {
    const attribute = `on${eventType}`;
    if (element.hasAttribute(attribute)) {
      listenerTypes.push(eventType);
    }
  }

  // Check for React event props using multiple approaches
  const reactFiberKeys = Object.keys(element).filter(
    (key) =>
      key.startsWith('__reactFiber') ||
      key.startsWith('__reactInternalInstance')
  );

  for (const key of reactFiberKeys) {
    const fiber = (element as any)[key];
    const reactProps = fiber?.memoizedProps || fiber?.pendingProps;

    if (reactProps) {
      for (const prop of Object.keys(reactProps)) {
        if (prop.startsWith('on') && typeof reactProps[prop] === 'function') {
          const eventType = prop.slice(2).toLowerCase();
          if (!listenerTypes.includes(eventType)) {
            listenerTypes.push(eventType);
          }
        }
      }
    }
  }

  // Also check for data attributes that might indicate event handlers
  if (
    element.hasAttribute('data-debug-id') ||
    element.hasAttribute('onclick')
  ) {
    // This is likely an interactive element
    if (!listenerTypes.includes('click')) {
      listenerTypes.push('click');
    }
  }

  const hasClickHandler = listenerTypes.some((type) =>
    ['click', 'dblclick', 'mousedown', 'mouseup'].includes(type)
  );
  const hasKeyboardHandlers = listenerTypes.some((type) =>
    ['keydown', 'keyup', 'keypress'].includes(type)
  );
  const hasMouseHandlers = listenerTypes.some(
    (type) => type.startsWith('mouse') || type.startsWith('drag')
  );
  const hasFocusHandlers = listenerTypes.some((type) =>
    ['focus', 'blur', 'focusin', 'focusout'].includes(type)
  );

  return {
    hasClickHandler,
    hasKeyboardHandlers,
    hasMouseHandlers,
    hasFocusHandlers,
    listenerTypes: [...new Set(listenerTypes)].sort(),
  };
}

function getContentInfo(element: Element): ElementInfo['content'] {
  const textContent = element.textContent || '';
  const hasText = textContent.trim().length > 0;
  const wordCount = textContent
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

  const hasImages = element.querySelectorAll('img').length > 0;
  const hasLinks = element.querySelectorAll('a[href]').length > 0;

  const style = getComputedStyle(element);
  const contentEditable =
    element.getAttribute('contenteditable') === 'true' ||
    (element as HTMLElement).isContentEditable;

  const languageHints =
    element.getAttribute('lang') ||
    element.closest('[lang]')?.getAttribute('lang') ||
    undefined;

  return {
    hasText,
    hasImages,
    hasLinks,
    wordCount,
    languageHints,
    contentEditable,
    userSelect: style.userSelect,
  };
}

function getPerformanceInfo(
  element: Element
): ElementInfo['performance'] | undefined {
  try {
    const style = getComputedStyle(element);

    // Check for animations and transitions
    const hasTransitions =
      style.transition !== 'none' && style.transition !== '';
    const hasAnimations = style.animation !== 'none' && style.animation !== '';

    // Check if currently animating (basic heuristic)
    const animating =
      hasAnimations ||
      (hasTransitions && element.matches(':hover, :focus, :active'));

    return {
      renderTime: performance.now(), // Current timestamp as proxy
      lastModified: Date.now(), // Current timestamp as proxy
      animating,
      hasTransitions,
      hasAnimations,
    };
  } catch (error) {
    return undefined;
  }
}

function getShadowDOMInfo(element: Element): ElementInfo['shadow'] | undefined {
  const hasShadowRoot =
    !!(element as any).shadowRoot || !!(element as any).attachShadow;
  const shadowRoot = (element as any).shadowRoot;

  // Check if element is slotted
  const isSlotted = element.assignedSlot !== undefined;
  const slotName = element.getAttribute('slot') || undefined;

  // Check if custom element
  const customElement =
    element.tagName.includes('-') ||
    !!(element as any).constructor.observedAttributes;
  const componentName = customElement
    ? element.tagName.toLowerCase()
    : undefined;

  if (!hasShadowRoot && !isSlotted && !customElement) {
    return undefined;
  }

  return {
    hasShadowRoot,
    shadowMode: shadowRoot?.mode || undefined,
    isSlotted,
    slotName,
    customElement,
    componentName,
  };
}

function getDataInfo(element: Element): ElementInfo['data'] {
  const dataAttributes: Record<string, string> = {};
  const customAttributes: Record<string, string> = {};

  // Standard HTML attributes
  const standardAttributes = new Set([
    'id',
    'class',
    'style',
    'title',
    'lang',
    'dir',
    'hidden',
    'tabindex',
    'href',
    'src',
    'alt',
    'type',
    'value',
    'name',
    'placeholder',
    'disabled',
    'required',
    'readonly',
    'checked',
    'selected',
    'multiple',
    'size',
    'cols',
    'rows',
    'min',
    'max',
    'step',
    'pattern',
    'autocomplete',
    'autofocus',
    'role',
    'aria-label',
    'aria-labelledby',
    'aria-describedby',
    'aria-expanded',
    'aria-checked',
    'aria-disabled',
    'aria-hidden',
    'aria-selected',
  ]);

  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    if (attr.name.startsWith('data-')) {
      dataAttributes[attr.name] = attr.value;
    } else if (
      !standardAttributes.has(attr.name) &&
      !attr.name.startsWith('aria-')
    ) {
      customAttributes[attr.name] = attr.value;
    }
  }

  // Microdata
  const microdata =
    element.hasAttribute('itemscope') ||
    element.hasAttribute('itemprop') ||
    element.hasAttribute('itemtype') ||
    element.hasAttribute('itemid')
      ? {
          itemScope: element.hasAttribute('itemscope'),
          itemType: element.getAttribute('itemtype') || undefined,
          itemProp: element.getAttribute('itemprop') || undefined,
          itemId: element.getAttribute('itemid') || undefined,
        }
      : undefined;

  return {
    dataAttributes,
    customAttributes,
    microdata,
  };
}

function getBrowserInfo(): ElementInfo['browser'] | undefined {
  try {
    const userAgent = navigator.userAgent;

    // Feature detection
    const supportsGrid = CSS.supports('display', 'grid');
    const supportsFlex = CSS.supports('display', 'flex');
    const supportsCustomElements = 'customElements' in window;

    return {
      userAgent,
      features: {
        supportsGrid,
        supportsFlex,
        supportsCustomElements,
      },
    };
  } catch (error) {
    return undefined;
  }
}

function getKeyComputedStyles(element: Element): ElementInfo['computed'] {
  const style = getElementComputedStyle(element);
  if (!style) return {};

  return {
    display: style.display,
    visibility: style.visibility,
    opacity: style.opacity,
    position: style.position,
    zIndex: style.zIndex,
    transform: style.transform,
    cursor: style.cursor,
    pointerEvents: style.pointerEvents,
    backgroundColor: style.backgroundColor,
    color: style.color,
    fontSize: style.fontSize,
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    textAlign: style.textAlign,
    border: style.border,
    borderRadius: style.borderRadius,
    margin: style.margin,
    padding: style.padding,
    width: style.width,
    height: style.height,
  };
}

/**
 * Generate comprehensive element information for any element
 */
export function generateElementInfo(
  element: Element,
  ref: string
): ElementInfo {
  const htmlElement = element as HTMLElement;
  const inputElement = element as HTMLInputElement;
  const rect = element.getBoundingClientRect();

  // Get DOM hierarchy information
  const hierarchyInfo = getDOMHierarchy(element);

  const elementInfo: ElementInfo = {
    ref,
    tagName: element.tagName.toLowerCase(),
    id: element.id || undefined,
    className: element.className || undefined,
    textContent: element.textContent?.trim() || undefined,
    innerText: htmlElement.innerText?.trim() || undefined,
    value: inputElement.value || undefined,
    type: inputElement.type || undefined,
    image: getImageInfo(element),
    aria: getAriaProperties(element),
    attributes: getAllAttributes(element),
    computed: getKeyComputedStyles(element),
    state: getElementState(element),
    geometry: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
    },

    // New comprehensive properties
    parent: hierarchyInfo.parent,
    children: hierarchyInfo.children,
    siblings: hierarchyInfo.siblings,
    visual: getVisualInfo(element),
    form: getFormInfo(element),
    events: getEventInfo(element),
    content: getContentInfo(element),
    performance: getPerformanceInfo(element),
    shadow: getShadowDOMInfo(element),
    data: getDataInfo(element),
    browser: getBrowserInfo(),
  };

  // Add React information if available
  try {
    const reactInfo = extractReactInfo(element);
    if (reactInfo) {
      elementInfo.react = {
        componentName: reactInfo.componentName,
        props: reactInfo.relevantProps,
        hooks: undefined, // Not available in ReactInfo interface
        source: reactInfo.debugSource
          ? {
              fileName: reactInfo.debugSource.split(':')[0],
              lineNumber: reactInfo.debugSource.split(':')[1]
                ? Number.parseInt(reactInfo.debugSource.split(':')[1])
                : undefined,
              columnNumber: reactInfo.debugSource.split(':')[2]
                ? Number.parseInt(reactInfo.debugSource.split(':')[2])
                : undefined,
            }
          : undefined,
      };
    }
  } catch (error) {
    // React info is optional, continue without it
  }

  return elementInfo;
}

async function executeGetElementInfo(
  message: GetElementInfoMessage
): Promise<ElementInfo | ElementInfo[]> {
  // Handle legacy single ref
  if (message.payload.ref) {
    const element = getElementByRefOrThrow(message.payload.ref);
    return generateElementInfo(element, message.payload.ref);
  }

  // Handle new multi-element targeting
  const elements = resolveTargetElements(message.payload);

  // If only one element, return single object for consistency
  if (elements.length === 1) {
    // Generate ref for elements found via selector/boundingBox
    const ref = message.payload.refs?.[0] || `element_${Date.now()}`;
    return generateElementInfo(elements[0], ref);
  }

  // Multiple elements, return array
  return elements.map((element, index) => {
    const ref =
      message.payload.refs?.[index] || `element_${Date.now()}_${index}`;
    return generateElementInfo(element, ref);
  });
}

export const getElementInfoTool: ToolHandler<GetElementInfoMessage> = {
  definition: getElementInfoDefinition,
  messageSchema: GetElementInfoMessageSchema,
  execute: executeGetElementInfo,
};
