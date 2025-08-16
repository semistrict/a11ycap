# get_animation_state Tool Proposal

## Overview
A dedicated a11ycap tool to inspect and debug CSS animations, transitions, and Web Animations API states, helping developers understand animation timing and debug animation-related issues.

## Problem Statement
When testing or debugging animated interfaces, developers need to:
- Know when animations complete before taking screenshots
- Understand why elements appear incorrectly (captured mid-animation)
- Debug animation performance issues
- Verify animations are running as expected
- Wait for the right moment to interact with elements

Currently this requires complex `execute_js` calls and manual timing management.

## Proposed API

### Basic Usage
```javascript
get_animation_state({
  sessionId: "...",
  ref: "e147", // Optional: specific element to check
  selector: ".lightbox", // Optional: CSS selector for multiple elements
  includeTransitions: true, // Include CSS transitions
  includeAnimations: true, // Include CSS animations
  includeWebAnimations: true // Include Web Animations API
})
```

## Implementation Details

### Core Algorithm
```javascript
function getAnimationState(element) {
  const computed = getComputedStyle(element);
  
  return {
    // CSS Animations
    animations: element.getAnimations().map(anim => ({
      type: anim.constructor.name, // 'CSSAnimation', 'CSSTransition', 'Animation'
      animationName: anim.animationName || null,
      playState: anim.playState, // 'running', 'paused', 'finished', 'idle'
      currentTime: anim.currentTime,
      duration: anim.effect?.getTiming().duration,
      progress: anim.currentTime / anim.effect?.getTiming().duration,
      iterationCount: anim.effect?.getTiming().iterations,
      direction: anim.effect?.getTiming().direction,
      fill: anim.effect?.getTiming().fill,
      startTime: anim.startTime,
      pending: anim.pending
    })),
    
    // CSS Transition status
    transitions: {
      active: element.getAnimations().filter(a => a instanceof CSSTransition),
      property: computed.transitionProperty,
      duration: computed.transitionDuration,
      timing: computed.transitionTimingFunction,
      delay: computed.transitionDelay
    },
    
    // Element visibility/opacity for fade effects
    visibility: {
      opacity: computed.opacity,
      visibility: computed.visibility,
      display: computed.display,
      transform: computed.transform
    },
    
    // Check if waiting for animations
    isAnimating: element.getAnimations().some(a => a.playState === 'running'),
    isTransitioning: element.getAnimations().some(a => a instanceof CSSTransition && a.playState === 'running')
  };
}
```

## Example Outputs

### Lightbox Opening Animation
```yaml
Element: .lightbox
Status: ANIMATING

CSS Transitions:
  opacity:
    - From: 0
    - To: 1
    - Duration: 300ms
    - Progress: 45% (135ms elapsed)
    - Timing: ease
    - State: running

Element: .lightbox-container
Status: ANIMATING

CSS Transitions:
  transform:
    - From: scale(0.8)
    - To: scale(1)
    - Duration: 300ms
    - Progress: 45% (135ms elapsed)
    - Timing: ease
    - State: running

Timeline:
  0ms    - Transition started
  135ms  - Current position (45%)
  300ms  - Will complete
  
Recommendations:
  - Wait 165ms before capturing screenshot
  - Or use wait_for_animations() helper
```

### Tab Switching Animation
```yaml
Element: .diagram-container
Status: ANIMATING

CSS Animations:
  fadeIn:
    - Duration: 400ms
    - Progress: 25% (100ms elapsed)
    - State: running
    - Keyframes:
      0%: { opacity: 0, transform: translateY(20px) }
      100%: { opacity: 1, transform: translateY(0) }
    - Current values:
      opacity: 0.25
      transform: translateY(15px)

View Transition:
  Type: root transition
  Phase: animating
  Old view: fading out (opacity: 0.75)
  New view: fading in (opacity: 0.25)
  Duration: 300ms
  Progress: 33%

Timeline:
  0ms    - View transition started
  100ms  - Current position
  300ms  - View transition completes
  400ms  - fadeIn animation completes
```

## Advanced Features

### 1. Wait for Completion Helper
```javascript
wait_for_animations({
  sessionId: "...",
  ref: "e147",
  timeout: 1000, // Max wait time
  includeDescendants: true // Wait for child animations too
})

// Returns when all animations complete:
{
  waited: 365,
  completed: [
    { element: ".lightbox", animation: "opacity transition", duration: 300 },
    { element: ".lightbox-container", animation: "transform transition", duration: 300 }
  ]
}
```

### 2. Animation Timeline Visualization
```yaml
Animation Timeline:
  0ms   100ms  200ms  300ms  400ms  500ms
  |------|------|------|------|------|
  
  .lightbox (opacity)
  [████████████████████]
  
  .lightbox-container (transform)  
  [████████████████████]
  
  .diagram-container (fadeIn)
  [██████████████████████████]
  
  .tab.active::after (slideIn)
  [████████████████████]
```

### 3. Performance Metrics
```yaml
Performance Impact:
  - Active animations: 3
  - GPU accelerated: 2 (transform, opacity)
  - CPU bound: 1 (width animation)
  - Repaints triggered: 1
  - Reflows triggered: 0
  - Estimated FPS: 58
  
Warnings:
  ⚠ Animation on 'width' property causes reflows
  ⚠ Multiple animations may impact performance on low-end devices
```

### 4. Debug Mode with Trigger Analysis
```yaml
Why is this element animating?

.lightbox:
  Trigger: Class change
    - Added: "show"
    - CSS Rule: .lightbox.show { opacity: 1 }
    - Transition: opacity 0.3s ease
    
  Call Stack:
    openLightbox() at line 751
    → clicked .screenshot at line 704
    → user interaction at 14:32:15.234

.lightbox-container:
  Trigger: Parent class change
    - Parent (.lightbox) added class "show"
    - CSS Rule: .lightbox.show .lightbox-container { transform: scale(1) }
    - Transition: transform 0.3s ease
```

### 5. Accessibility Checks
```yaml
Accessibility:
  prefers-reduced-motion: no-preference
  
  Animations respecting user preference: ✓
  - All animations wrapped in @media (prefers-reduced-motion: no-preference)
  
  Duration check:
  - .lightbox transition: 300ms ✓ (under 400ms threshold)
  - .diagram-container animation: 400ms ⚠ (at threshold)
  
  Infinite animations: None found ✓
```

## Related Helper Tools

### 1. `wait_for_idle`
Wait for all animations/transitions to complete:
```javascript
wait_for_idle({
  sessionId: "...",
  selector: "body", // Root element to check
  recursive: true, // Check all descendants
  timeout: 5000
})
```

### 2. `pause_animations`
Pause all animations for debugging:
```javascript
pause_animations({
  sessionId: "...",
  selector: "*", // All elements
  timestamp: 150 // Optional: pause at specific time
})
```

### 3. `speed_animations`
Speed up/slow down animations for testing:
```javascript
speed_animations({
  sessionId: "...",
  playbackRate: 0.1, // 10% speed for debugging
  selector: ".lightbox"
})
```

## Use Cases

1. **Screenshot Timing**
   - Know exactly when to capture after animations complete
   - Avoid capturing mid-animation states

2. **Animation Debugging**
   - See actual animation state and progress
   - Understand animation cascade and timing

3. **Performance Testing**
   - Identify expensive animations
   - Find animations causing reflows/repaints

4. **Automated Testing**
   - Verify animations are running as expected
   - Test animation sequences

5. **Accessibility Testing**
   - Check if animations respect prefers-reduced-motion
   - Verify animation durations are reasonable

6. **Interactive Debugging**
   - Pause animations at specific points
   - Step through animation frames

## Benefits

1. **Eliminates Timing Guesswork** - Know exactly when animations complete
2. **Debugging Visibility** - See all animation states in one place
3. **Performance Insights** - Identify performance bottlenecks
4. **Test Reliability** - Consistent animation handling in tests
5. **Accessibility** - Built-in accessibility checks

## Implementation Priority

High priority because:
1. Animation timing issues are common in UI testing
2. Current approach requires manual setTimeout calls
3. Mid-animation captures cause flaky tests
4. Performance debugging requires specialized knowledge
5. Would significantly improve test reliability

## Example Integration

```javascript
// Current approach (unreliable)
click_element({ ref: "e27" });
// Hope animation is done?
await new Promise(r => setTimeout(r, 500));
take_snapshot();

// With get_animation_state (reliable)
click_element({ ref: "e27" });
wait_for_animations({ selector: ".lightbox" });
take_snapshot(); // Guaranteed post-animation
```

## Technical Considerations

1. **Browser Compatibility**
   - Web Animations API support varies
   - Fallback to computed style checking
   - Handle vendor prefixes

2. **Performance**
   - Minimize impact on running animations
   - Efficient animation detection
   - Batch queries when possible

3. **Edge Cases**
   - Infinite animations
   - Paused animations
   - Cancelled animations
   - Nested animation contexts