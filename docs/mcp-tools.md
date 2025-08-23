## Detailed Tool Reference

### take_snapshot

Take an accessibility snapshot from a connected browser. This is the RECOMMENDED way to get an overview of the interactivity of a page.

Returns a text representation showing:
- Interactive elements with clickable references [ref=e1, e2, etc.]
- Element roles, labels, and ARIA attributes
- Hierarchical structure with proper indentation
- React component information (when available)

Example output:
```
button "Submit Form" [ref=e1]
  text "Submit"
form [ref=e2]
  textbox "Email" [ref=e3]
  textbox "Password" [ref=e4]
link "Forgot Password?" [ref=e5]
```

IMPORTANT: If snapshot is truncated due to size limits, DO NOT assume missing elements don't exist - they may have been omitted. Use follow-up calls with 'selector' or 'refs' parameters to get specific elements.

---

### click_element

Click an element using its accessibility snapshot reference

---

### doctor

Perform comprehensive accessibility analysis using axe-core. For best results, run without element targeting to analyze the entire document. Element-specific analysis available for debugging individual components.

---

### get_network_requests

Retrieve recent network requests using the Web Performance API. Returns detailed information about HTTP requests made by the page including timing, size, and type data.

Example output:
```
Network requests (8 entries):

FETCH https://api.example.com/users (245ms) [2KB]
SCRIPT https://cdn.example.com/js/analytics.js (156ms) [45KB]
STYLESHEET https://fonts.googleapis.com/css2?family=Inter (89ms) [12KB]
IMAGE https://images.example.com/logo.png (67ms) [8KB]
XMLHTTPREQUEST https://api.example.com/data (423ms) [156KB]
FONT https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2 (234ms) [34KB]
NAVIGATE https://example.com/dashboard (1203ms) [89KB]
OTHER https://example.com/manifest.json (12ms) [1KB]
```

Each entry shows:
- HTTP method/type (FETCH, SCRIPT, STYLESHEET, IMAGE, etc.)
- Full URL of the request
- Duration in milliseconds (if available)
- Transfer size in KB (if available)

Useful for debugging API calls, monitoring performance, analyzing resource loading, and understanding network traffic patterns.

---

### get_readability

Extract readable article content from the current page using Mozilla Readability

---

### get_console_logs

Retrieve console logs from a connected browser

---

### get_user_interactions

Retrieve recorded user interaction events from the buffer. Shows chronological history of user actions on the page.

IMPORTANT: User interactions must be recorded first. The user can start recording by:
1. Press **ESC three times** to open the A11yCap Tools menu
2. Click "🔴 Interaction Recorder" 
3. The recorder will automatically start capturing interactions
4. User can then perform actions (click, type, navigate) which will be recorded

Example output after user clicks, types, and navigates:
```
User Interactions (5 events):
[2023-08-23T15:30:45.123Z] Click on BUTTON[e2] at (150, 200)
[2023-08-23T15:30:46.456Z] Type in INPUT#email (email): "user@example.com"
[2023-08-23T15:30:47.789Z] Key press Tab on INPUT#email
[2023-08-23T15:30:48.012Z] Focus INPUT#password
[2023-08-23T15:30:50.345Z] Navigation (pushstate) to https://example.com/dashboard
```

Interaction types captured:
- **click**: Element clicks with coordinates and modifier keys
- **input/change**: Text input with target element and values
- **keydown**: Keyboard events with keys and modifiers  
- **focus/blur**: Element focus changes
- **navigation**: Page navigation (back/forward, pushstate, etc.)

Each event includes timestamp, target element (with refs when available), and relevant interaction data. Perfect for understanding user behavior patterns, debugging UI interactions, and analyzing user workflows.

---

### capture_element_image

Capture a PNG image of an element using its accessibility snapshot reference. Uses html-to-image library and may not be pixel-perfect compared to browser screenshots.

---

### get_picked_elements

Retrieve elements that were picked using the visual element picker. Returns full element information for previously selected elements.

IMPORTANT: Elements must be picked first using the Element Picker. The user can pick elements by:
1. Press **ESC three times** to open the A11yCap Tools menu
2. Click "🎯 Element Picker" 
3. The picker overlay will activate - user can click on any elements on the page
4. Multiple elements can be selected by clicking different parts of the page
5. Press ESC to exit the picker when done

This tool returns the same detailed ElementInfo data as get_element_info, but only for elements that were previously picked by the user through the visual interface. Each picked element includes:

- Basic properties (tagName, id, className, text content)
- Complete accessibility information (ARIA attributes, computed names, roles)
- Visual styling and geometry data
- Element state and form properties
- Parent/child/sibling relationships
- React component information (when available)
- Event handlers and interaction capabilities

Perfect for getting detailed information about specific elements the user has visually identified and selected, without needing to know refs or write CSS selectors.

---

### get_element_info

Get comprehensive information about one or more elements without including sub-elements. Returns detailed data for debugging, accessibility analysis, and automated testing.

For each element, returns extensive information including:

**Basic Properties:**
- ref: Element reference for other tools
- tagName, id, className: Basic HTML identifiers
- textContent, innerText, value: Content information

**Accessibility (ARIA):**
- All ARIA attributes (role, label, expanded, checked, etc.)
- Computed accessibility name and role
- Keyboard navigation status
- Heading levels and landmarks

**Visual Styling:**
- Computed CSS properties (display, position, colors, fonts, etc.)
- Geometry (x, y, width, height, bounding box)
- Visibility status and viewport intersection
- Z-index and stacking context information

**Element State:**
- Interactive states (focused, disabled, checked, selected)
- Form validation status and properties
- Event listeners attached to element

**Contextual Information:**
- Parent element details (tagName, id, className, role)
- Children summary (count, types, interactive elements)
- Sibling position and adjacent elements

**Specialized Data:**
- Image info: dimensions, scaling, loading status, alt text
- Form info: validation, autocomplete, input constraints
- React info: component name, props, hooks, source location (when available)
- Performance: animations, transitions, render timing

**Content Analysis:**
- Text content analysis and word counts
- Embedded content detection (images, links)
- Content editability and selection properties

This tool is ideal for debugging layout issues, accessibility problems, or understanding element behavior for automation.

---

### mutate_element

Modify attributes, properties, styles, or content of one or more elements

---

### list_tabs

List all connected browser tabs with their URLs and titles. This should be the FIRST tool used to see which browser tabs are available for automation.

Returns information about each connected browser session including:
- sessionId: Unique identifier for each tab connection
- URL: Current page URL
- Title: Page title
- Last seen timestamp

IMPORTANT: Session IDs change when users navigate to different pages. If you get "session not found" errors, re-run list_tabs to get updated session IDs.

If no tabs are connected, this tool provides instructions for connecting browsers via console injection or HTML script tags.

---

### execute_js

Execute JavaScript code in a connected browser. Code MUST be wrapped in an IIFE.

---

### type_text

Type text into an editable element

---

### press_key

Press a key on the keyboard

---

### press_key_global

Press a key globally on the document (not targeting a specific element)

---

### hover_element

Hover over an element

---

### select_option

Select an option in a dropdown

---

### wait_for

Wait for text to appear/disappear or CSS selectors to match/not match on the page

---

### show_element_picker

Show an interactive element picker overlay to visually select elements on the page. Multiple elements can be selected by clicking.

---

