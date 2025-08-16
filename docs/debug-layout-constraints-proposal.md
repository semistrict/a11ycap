# debug_layout_constraints Tool Proposal

## Overview
A dedicated a11ycap tool to analyze and debug CSS layout constraints, helping developers understand why elements are sized and positioned the way they are.

## Problem Statement
During debugging sessions, developers often need to use `execute_js` to check computed styles, dimensions, and understand layout constraints. This requires multiple rounds of trial and error to identify what's limiting an element's size.

## Proposed API

### Basic Usage
```javascript
debug_layout_constraints({
  sessionId: "...",
  ref: "e149", // The element reference to analyze
  includeParents: true, // Analyze parent chain (default: true)
  includeComputed: true, // Include computed styles (default: true)
  maxDepth: 10 // How many parent levels to analyze (default: 10)
})
```

## Implementation Details

### Core Algorithm
```javascript
function analyzeConstraints(element) {
  const rect = element.getBoundingClientRect();
  const computed = getComputedStyle(element);
  const parent = element.parentElement;
  
  return {
    // What's limiting the width?
    widthConstraint: {
      source: determineSource(), // 'parent', 'css-rule', 'viewport', 'content'
      limitedBy: {
        rule: computed.maxWidth,
        parentWidth: parent?.clientWidth,
        viewportWidth: window.innerWidth,
        actualWidth: rect.width,
        naturalWidth: element.naturalWidth // for images
      },
      chain: [] // Array of constraints from each parent
    },
    
    // Similar for height
    heightConstraint: { ... },
    
    // Why is it this size?
    reasoning: generateReasoning()
  };
}
```

### Data Collection
1. **Walk up the DOM tree** from target element
2. **Collect for each element**:
   - Dimensions (natural, computed, actual)
   - CSS rules affecting size (width, height, max-*, min-*, overflow)
   - Box model (padding, border, margin)
   - Display and position properties
3. **Identify constraint sources**:
   - Parent container limits
   - CSS rule limits
   - Viewport constraints
   - Content-based sizing

## Example Output

### Structured Output
```yaml
Element: img#lightbox-img (ref: e149)
Natural Size: 750x1334px
Displayed Size: 680x1210px

WIDTH CONSTRAINTS:
  ✗ Limited to 680px (90.67% of natural width)
  
  Constraint Chain:
  1. img#lightbox-img
     - CSS: max-width: 100%
     - Inherited from: .lightbox-container (680px wide)
     
  2. .lightbox-container  ← LIMITING FACTOR
     - CSS: max-width: 90%
     - Actual width: 680px
     - Parent width: 756px
     - Reason: 90% of 756px = 680px
     
  3. .lightbox
     - CSS: width: 100%
     - Actual width: 796px
     - Viewport width: 796px

HEIGHT CONSTRAINTS:
  ✗ Limited to 1210px (90.73% of natural height)
  
  Constraint Chain:
  1. img#lightbox-img
     - CSS: height: auto (scales with width)
     - Aspect ratio maintained: 750:1334
     - Result: 680px width × 1.778 = 1210px height

DIAGNOSIS:
  Image is being scaled down to fit within .lightbox-container
  - Container is limited to 90% of parent width (max-width: 90%)
  - Image maintains aspect ratio, so height scales proportionally
  
SUGGESTED FIXES:
  1. Remove max-width constraint from .lightbox-container
  2. Set image to fixed dimensions: width: 750px; height: 1334px
  3. Allow container to scroll if image exceeds viewport
```

## Additional Features

### 1. CSS Specificity Analysis
Show which CSS rules are winning and why:
```yaml
Conflicting Rules for 'max-width':
- #lightbox-img { max-width: 100% }  [specificity: 0,1,0,0] ← WINNING
- .lightbox-content { max-width: 90vw } [specificity: 0,0,1,0]
- img { max-width: 100% } [specificity: 0,0,0,1]
```

### 2. Visual ASCII Diagram
Provide a visual hierarchy of constraints:
```
viewport (796x772)
└── .lightbox (796x772, 100% width)
    └── .lightbox-container (680x692, max-width: 90%)
        └── img (680x1210, constrained by parent)
                 ↑ 
             Natural: 750x1334 (scaled to 90.67%)
```

### 3. Box Model Visualization
Show how padding/margin affects available space:
```yaml
Box Model Impact:
- .lightbox: padding: 50px → reduces available space
- .lightbox-container: no padding/margin
- img: border-radius: 8px (no size impact)
```

### 4. Overflow Analysis
Identify when content is being clipped:
```yaml
Overflow Issues:
- .container: overflow: hidden → content may be clipped
- .lightbox-container: overflow: visible → no clipping
- Content exceeds container by: 124px vertically
```

## Benefits

1. **Reduces debugging time** - Immediately identifies constraint sources
2. **Educational** - Helps developers understand CSS layout
3. **Actionable** - Provides specific fixes
4. **Comprehensive** - Shows entire constraint chain
5. **Visual** - ASCII diagrams make relationships clear

## Related Tool Ideas

1. **`get_computed_styles`** - Get all computed CSS for an element
2. **`get_element_dimensions`** - Get complete size information
3. **`get_element_hierarchy`** - Show parent/child with styles
4. **`find_style_conflicts`** - Identify conflicting CSS rules
5. **`diff_element_state`** - Compare before/after states

## Use Cases

- Debugging why images are cut off in modals/lightboxes
- Understanding responsive layout issues
- Identifying which parent container is constraining a child
- Finding CSS specificity conflicts
- Debugging flexbox/grid layout problems
- Understanding why overflow is occurring

## Implementation Priority

This tool would be particularly valuable because:
1. Layout debugging is one of the most common CSS challenges
2. Current approach requires multiple `execute_js` calls
3. The constraint chain is not obvious from DevTools
4. Would save significant debugging time in real-world scenarios