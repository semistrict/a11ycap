import axe from 'axe-core';
import { z } from 'zod';
import type { ToolHandler } from './base.js';
import {
  ensureA11yCap,
  multiElementToolSchema,
  resolveTargetElements,
} from './common.js';
import { generateElementInfo } from './getElementInfo.js';

// Import axe-core types
type AxeResults = axe.AxeResults;
type AxeViolation = axe.Result;
type AxeIncomplete = axe.Result;
type AxePass = axe.Result;

/*
 * This tool provides comprehensive accessibility analysis using axe-core.
 *
 * RECOMMENDED USAGE: For most cases, run analysis on the entire document without
 * specifying any element targeting parameters. This provides the most comprehensive
 * accessibility audit including page-level and contextual checks.
 *
 * Element-specific analysis (using refs, selector, or boundingBox) is useful when:
 * - Debugging specific accessibility issues
 * - Testing individual components in isolation
 * - Analyzing dynamic content that was just added to the page
 *
 * Note: Element-specific analysis may miss important contextual accessibility
 * issues that only appear when analyzing the full document structure.
 */

const doctorSchema = multiElementToolSchema
  .omit({ captureSnapshot: true })
  .extend({
    // Support legacy single ref for backward compatibility
    ref: z
      .string()
      .optional()
      .describe(
        'Element reference from snapshot (e.g., "e5") - legacy, use refs instead. Note: omit all element targeting for comprehensive page analysis.'
      ),
    includeElementInfo: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include detailed element information for violations'),
    maxViolations: z
      .number()
      .optional()
      .default(50)
      .describe('Maximum number of violations to return (default: 50)'),
    tags: z
      .array(z.string())
      .optional()
      .describe(
        'Axe tags to filter rules (e.g., ["wcag2a", "wcag21aa", "best-practice"])'
      ),
    excludeRules: z
      .array(z.string())
      .optional()
      .describe('Rule IDs to exclude from analysis'),
    severity: z
      .array(z.enum(['minor', 'moderate', 'serious', 'critical']))
      .optional()
      .describe(
        'Filter violations by severity level (only returns violations matching these levels)'
      ),
    locale: z
      .string()
      .optional()
      .describe(
        'Locale for internationalized results (e.g., "en", "fr", "es")'
      ),
    preset: z
      .enum(['wcag-aa', 'wcag-aaa', 'section508', 'best-practice'])
      .optional()
      .describe(
        'Use predefined configuration preset for common accessibility standards'
      ),
  });

export const doctorDefinition = {
  name: 'doctor',
  description: `Perform comprehensive accessibility analysis using axe-core. For best results, run without element targeting to analyze the entire document. Element-specific analysis available for debugging individual components.

Returns detailed accessibility analysis including:

**Analysis Summary:**
- Total violations count by severity (critical, serious, moderate, minor)
- Incomplete checks that require manual verification
- Passing rules and inapplicable rules
- Analysis scope (page vs elements) and execution time

**Violation Details:**
- Rule ID, description, and help text for each violation
- Impact level (critical, serious, moderate, minor)
- WCAG guideline references and compliance level
- Target selectors and affected DOM nodes
- Suggested fixes and remediation guidance

**Best Practices Analysis:**
- Categorized recommendations by accessibility domain (forms, images, keyboard, etc.)
- WCAG 2.1 Level A/AA/AAA compliance analysis
- User group impact analysis (screen readers, keyboard users, low vision)
- Prioritized action items and next steps

**Configuration Options:**
- Preset configurations for WCAG-AA, WCAG-AAA, Section 508, or best practices
- Severity filtering to focus on critical issues first
- Rule exclusion for custom testing scenarios
- Element information inclusion for detailed debugging

**When to Use:**
- Initial accessibility audit of entire pages or applications
- Validating fixes after addressing accessibility issues
- Component testing during development workflow
- Compliance verification against WCAG or Section 508 standards
- Pre-release accessibility quality assurance

**Output Analysis:**
The tool provides actionable insights organized by priority and user impact, making it easy to identify which issues to fix first for maximum accessibility improvement. Critical and serious violations should always be addressed first as they significantly impact users with disabilities.`,
  inputSchema: doctorSchema.shape,
};

const DoctorMessageSchema = z.object({
  id: z.string(),
  type: z.literal('doctor'),
  payload: doctorSchema,
});

type DoctorMessage = z.infer<typeof DoctorMessageSchema>;

export interface AccessibilityReport {
  summary: {
    violations: number;
    incomplete: number;
    passes: number;
    inapplicable: number;
    executionTime: number;
    analysisScope: 'page' | 'elements';
    elementsAnalyzed?: number;
  };
  violations: Array<
    AxeViolation & {
      nodes: Array<
        AxeViolation['nodes'][0] & {
          element?: any; // Optional element info if includeElementInfo is true
        }
      >;
    }
  >;
  incomplete: Array<
    AxeIncomplete & {
      nodes: Array<
        AxeIncomplete['nodes'][0] & {
          element?: any;
        }
      >;
    }
  >;
  passes: AxePass[];
  bestPractices: {
    recommendations: string[];
    criticalIssues: string[];
  };
}

// Ensure axe-core is available (it's imported above)
async function ensureAxeCore(): Promise<void> {
  if (!axe) {
    throw new Error('axe-core is not available.');
  }
}

// Apply configuration presets for common accessibility standards
function applyPreset(
  preset: string,
  payload: DoctorMessage['payload']
): Partial<DoctorMessage['payload']> {
  const presetConfig: Partial<DoctorMessage['payload']> = {};

  switch (preset) {
    case 'wcag-aa':
      presetConfig.tags = ['wcag2a', 'wcag2aa', 'wcag21aa'];
      presetConfig.severity = ['serious', 'critical'];
      presetConfig.excludeRules = [
        // Exclude AAA-only rules for AA compliance
        'color-contrast-enhanced', // WCAG AAA contrast requirement
        'focus-order-semantics', // Complex AAA requirement
      ];
      break;

    case 'wcag-aaa':
      presetConfig.tags = [
        'wcag2a',
        'wcag2aa',
        'wcag2aaa',
        'wcag21aa',
        'wcag21aaa',
      ];
      presetConfig.severity = ['moderate', 'serious', 'critical'];
      // Don't exclude any rules for AAA - strictest standard
      break;

    case 'section508':
      presetConfig.tags = ['section508', 'wcag2a', 'wcag2aa'];
      presetConfig.severity = ['serious', 'critical'];
      presetConfig.excludeRules = [
        // Section 508 doesn't require some WCAG AA rules
        'focus-order-semantics',
        'scrollable-region-focusable',
      ];
      break;

    case 'best-practice':
      presetConfig.tags = ['best-practice', 'ACT', 'experimental'];
      presetConfig.severity = ['minor', 'moderate', 'serious', 'critical'];
      // Include all best practice rules and experimental features
      break;

    default:
      // Unknown preset - return empty config
      break;
  }

  // Merge with user-provided options (user options take precedence)
  const merged = { ...presetConfig };

  // If user provided tags, combine them with preset tags
  if (payload.tags && presetConfig.tags) {
    merged.tags = [...new Set([...presetConfig.tags, ...payload.tags])];
  } else if (payload.tags) {
    merged.tags = payload.tags;
  }

  // If user provided severity, use their choice
  if (payload.severity) {
    merged.severity = payload.severity;
  }

  // If user provided excludeRules, combine them with preset excludeRules
  if (payload.excludeRules && presetConfig.excludeRules) {
    merged.excludeRules = [
      ...new Set([...presetConfig.excludeRules, ...payload.excludeRules]),
    ];
  } else if (payload.excludeRules) {
    merged.excludeRules = payload.excludeRules;
  }

  return merged;
}

// Helper function to merge multiple axe results
function mergeAxeResults(results: AxeResults[]): AxeResults {
  if (results.length === 0) {
    throw new Error('No results to merge');
  }

  if (results.length === 1) {
    return results[0];
  }

  // Use the first result as base and merge others into it
  const merged = { ...results[0] };

  for (let i = 1; i < results.length; i++) {
    const current = results[i];

    // Merge violations, removing duplicates by id + target
    const existingViolationKeys = new Set(
      merged.violations.map((v) =>
        v.nodes.map((n) => `${v.id}:${n.target.join(',')}`).join('|')
      )
    );

    const newViolations = current.violations.filter(
      (v) =>
        !existingViolationKeys.has(
          v.nodes.map((n) => `${v.id}:${n.target.join(',')}`).join('|')
        )
    );
    merged.violations.push(...newViolations);

    // Merge incomplete results
    const existingIncompleteKeys = new Set(
      merged.incomplete.map((v) =>
        v.nodes.map((n) => `${v.id}:${n.target.join(',')}`).join('|')
      )
    );

    const newIncomplete = current.incomplete.filter(
      (v) =>
        !existingIncompleteKeys.has(
          v.nodes.map((n) => `${v.id}:${n.target.join(',')}`).join('|')
        )
    );
    merged.incomplete.push(...newIncomplete);

    // For passes and inapplicable, we keep unique rule results
    const existingPassIds = new Set(merged.passes.map((p) => p.id));
    const newPasses = current.passes.filter((p) => !existingPassIds.has(p.id));
    merged.passes.push(...newPasses);

    const existingInapplicableIds = new Set(
      merged.inapplicable.map((i) => i.id)
    );
    const newInapplicable = current.inapplicable.filter(
      (i) => !existingInapplicableIds.has(i.id)
    );
    merged.inapplicable.push(...newInapplicable);
  }

  return merged;
}

async function executeDoctor(
  message: DoctorMessage
): Promise<AccessibilityReport> {
  await ensureAxeCore();

  const startTime = performance.now();
  let analysisScope: 'page' | 'elements' = 'page';
  let elementsAnalyzed: number | undefined;

  // Apply preset configuration if specified
  let effectivePayload = { ...message.payload };
  if (message.payload.preset) {
    const presetConfig = applyPreset(message.payload.preset, message.payload);
    effectivePayload = { ...effectivePayload, ...presetConfig };
  }

  // Configure axe options using effective payload (with preset applied)
  const axeOptions: axe.RunOptions = {
    rules: {},
  };

  // Set runOnly only when tags are provided and non-empty
  if (effectivePayload.tags && effectivePayload.tags.length > 0) {
    axeOptions.runOnly = {
      type: 'tag',
      values: effectivePayload.tags,
    };
  }

  // Add locale if specified
  if (effectivePayload.locale) {
    // Note: Locale setting in axe-core requires specific setup
    // For now, we'll store it to potentially use in result processing
    (axeOptions as any).locale = effectivePayload.locale;
  }

  // Validate and exclude specified rules
  if (
    effectivePayload.excludeRules &&
    effectivePayload.excludeRules.length > 0
  ) {
    try {
      // Get list of valid axe rule IDs
      const validRules = axe.getRules().map((rule) => rule.ruleId);
      const invalidRules = effectivePayload.excludeRules.filter(
        (ruleId) => !validRules.includes(ruleId)
      );

      if (invalidRules.length > 0) {
        throw new Error(
          `Invalid rule IDs in excludeRules: ${invalidRules.join(', ')}. Valid rule IDs include: ${validRules.slice(0, 10).join(', ')}${validRules.length > 10 ? '...' : ''}`
        );
      }

      // Apply valid rule exclusions
      if (axeOptions.rules) {
        for (const ruleId of effectivePayload.excludeRules) {
          axeOptions.rules[ruleId] = { enabled: false };
        }
      }
    } catch (error) {
      // If getRules() fails, still try to exclude rules but warn
      console.warn('Could not validate rule IDs:', error);
      if (axeOptions.rules) {
        for (const ruleId of effectivePayload.excludeRules) {
          axeOptions.rules[ruleId] = { enabled: false };
        }
      }
    }
  }

  let axeResults: AxeResults;

  // Handle element-specific analysis
  if (
    message.payload.ref ||
    message.payload.refs ||
    message.payload.selector ||
    message.payload.boundingBox
  ) {
    analysisScope = 'elements';

    let elements: Element[] = [];

    // Handle legacy single ref
    if (message.payload.ref) {
      try {
        const a11y = ensureA11yCap();
        const element = a11y.findElementByRef(message.payload.ref);
        if (!element) {
          throw new Error(
            `Element with ref "${message.payload.ref}" not found. The element may have been removed from the DOM or the snapshot may be outdated.`
          );
        }
        elements = [element];
      } catch (error) {
        throw new Error(
          `Failed to find element with ref "${message.payload.ref}": ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      // Handle new multi-element targeting
      try {
        elements = resolveTargetElements(message.payload);

        if (elements.length === 0) {
          const targetInfo = message.payload.selector
            ? `selector "${message.payload.selector}"`
            : message.payload.refs
              ? `refs [${message.payload.refs.join(', ')}]`
              : message.payload.boundingBox
                ? `bounding box (${message.payload.boundingBox.x}, ${message.payload.boundingBox.y}, ${message.payload.boundingBox.width}x${message.payload.boundingBox.height})`
                : 'specified targeting criteria';

          throw new Error(
            `No elements found matching ${targetInfo}. Please verify the targeting parameters or take a new snapshot if elements have changed.`
          );
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('No elements found')
        ) {
          throw error; // Re-throw our specific error
        }
        throw new Error(
          `Failed to resolve target elements: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your targeting parameters.`
        );
      }
    }

    elementsAnalyzed = elements.length;

    // Analyze each element individually and merge results
    if (elements.length === 1) {
      // Single element analysis
      try {
        axeResults = await axe.run(elements[0], axeOptions);
      } catch (error) {
        throw new Error(
          `Failed to analyze the specified element: ${error instanceof Error ? error.message : 'Unknown error'}. The element may be invalid or incompatible with axe-core.`
        );
      }
    } else {
      // Multi-element analysis: run axe on each element and merge results
      const elementResults = await Promise.all(
        elements.map(async (element, index) => {
          try {
            return await axe.run(element, axeOptions);
          } catch (error) {
            // If an element fails analysis, skip it but continue with others
            console.warn(
              `Failed to analyze element ${index + 1}:`,
              error instanceof Error ? error.message : 'Unknown error'
            );
            return null;
          }
        })
      );

      // Filter out failed analyses and merge the rest
      const validResults = elementResults.filter(
        (result): result is AxeResults => result !== null
      );

      if (validResults.length === 0) {
        throw new Error(
          `Failed to analyze any of the ${elements.length} specified elements. This may be due to invalid elements, restrictive axe configuration, or browser compatibility issues.`
        );
      }

      if (validResults.length < elements.length) {
        console.warn(
          `Successfully analyzed ${validResults.length} out of ${elements.length} elements. Some elements could not be analyzed.`
        );
      }

      axeResults = mergeAxeResults(validResults);

      // Update elements analyzed count to reflect successful analyses
      elementsAnalyzed = validResults.length;
    }
  } else {
    // Run axe analysis on entire document
    try {
      axeResults = await axe.run(document, axeOptions);
    } catch (error) {
      throw new Error(
        `Failed to analyze the document: ${error instanceof Error ? error.message : 'Unknown error'}. This may be due to axe configuration issues or browser compatibility problems.`
      );
    }
  }

  const executionTime = performance.now() - startTime;

  // Apply severity filtering if specified
  let filteredViolations = axeResults.violations;
  if (effectivePayload.severity && effectivePayload.severity.length > 0) {
    filteredViolations = axeResults.violations.filter(
      (violation) =>
        violation.impact &&
        effectivePayload.severity!.includes(violation.impact)
    );
  }

  // Apply severity filtering to incomplete results as well
  let filteredIncomplete = axeResults.incomplete;
  if (effectivePayload.severity && effectivePayload.severity.length > 0) {
    filteredIncomplete = axeResults.incomplete.filter(
      (incomplete) =>
        incomplete.impact &&
        effectivePayload.severity!.includes(incomplete.impact)
    );
  }

  // Process results and limit violations if specified
  const violations = filteredViolations.slice(
    0,
    effectivePayload.maxViolations || 50
  );

  // Add element info if requested
  if (effectivePayload.includeElementInfo) {
    ensureA11yCap();

    for (const violation of violations) {
      for (const node of violation.nodes) {
        try {
          // Try to find the element and get its info
          // node.target can be a complex selector array, so try the first one as a string
          const targetSelector = Array.isArray(node.target[0])
            ? node.target[0][0]
            : node.target[0];

          if (!targetSelector || typeof targetSelector !== 'string') {
            console.warn(
              `Invalid target selector for violation ${violation.id}:`,
              node.target
            );
            continue;
          }

          const element = document.querySelector(targetSelector);
          if (element) {
            // Generate a ref for this element
            const ref = `violation_${violation.id}_${Math.random().toString(36).substr(2, 9)}`;
            (node as any).element = generateElementInfo(element, ref);
          } else {
            console.warn(
              `Element not found for violation ${violation.id} with selector: ${targetSelector}`
            );
          }
        } catch (error) {
          // Skip element info if there's an error
          console.warn(
            `Could not get element info for violation ${violation.id}:`,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }
    }

    for (const incomplete of filteredIncomplete) {
      for (const node of incomplete.nodes) {
        try {
          // node.target can be a complex selector array, so try the first one as a string
          const targetSelector = Array.isArray(node.target[0])
            ? node.target[0][0]
            : node.target[0];

          if (!targetSelector || typeof targetSelector !== 'string') {
            console.warn(
              `Invalid target selector for incomplete ${incomplete.id}:`,
              node.target
            );
            continue;
          }

          const element = document.querySelector(targetSelector);
          if (element) {
            const ref = `incomplete_${incomplete.id}_${Math.random().toString(36).substr(2, 9)}`;
            (node as any).element = generateElementInfo(element, ref);
          } else {
            console.warn(
              `Element not found for incomplete ${incomplete.id} with selector: ${targetSelector}`
            );
          }
        } catch (error) {
          console.warn(
            `Could not get element info for incomplete ${incomplete.id}:`,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }
    }
  }

  // Generate best practices recommendations
  const bestPractices = generateBestPractices(axeResults);

  return {
    summary: {
      violations: filteredViolations.length,
      incomplete: filteredIncomplete.length,
      passes: axeResults.passes.length,
      inapplicable: axeResults.inapplicable.length,
      executionTime: Math.round(executionTime),
      analysisScope,
      elementsAnalyzed,
    },
    violations: violations.map((violation) => ({
      ...violation,
      nodes: violation.nodes.map((node) => {
        const extendedNode = node as typeof node & { element?: any };
        return {
          ...node,
          element: extendedNode.element,
        };
      }),
    })),
    incomplete: filteredIncomplete.map((incomplete) => ({
      ...incomplete,
      nodes: incomplete.nodes.map((node) => {
        const extendedNode = node as typeof node & { element?: any };
        return {
          ...node,
          element: extendedNode.element,
        };
      }),
    })),
    passes: axeResults.passes,
    bestPractices,
  };
}

function generateBestPractices(
  axeResults: AxeResults
): AccessibilityReport['bestPractices'] {
  const recommendations: string[] = [];
  const criticalIssues: string[] = [];

  // Analyze violations by impact level
  const violationsByImpact = axeResults.violations.reduce(
    (acc: Record<string, AxeViolation[]>, violation) => {
      const impact = violation.impact || 'unknown';
      if (!acc[impact]) acc[impact] = [];
      acc[impact].push(violation);
      return acc;
    },
    {}
  );

  // Critical and serious issues
  if (violationsByImpact.critical?.length > 0) {
    criticalIssues.push(
      `Found ${violationsByImpact.critical.length} critical accessibility violations that must be fixed immediately`
    );
    for (const violation of violationsByImpact.critical) {
      criticalIssues.push(`Critical: ${violation.help}`);
    }
  }

  if (violationsByImpact.serious?.length > 0) {
    criticalIssues.push(
      `Found ${violationsByImpact.serious.length} serious accessibility violations that significantly impact users`
    );
  }

  // Enhanced recommendations based on rule categories and tags
  const ruleCategories = categorizeViolations(axeResults.violations);

  // Generate specific recommendations based on rule categories
  if (ruleCategories.colorContrast.length > 0) {
    recommendations.push(
      `Improve color contrast (${ruleCategories.colorContrast.length} issues): Ensure minimum 4.5:1 ratio for normal text, 3:1 for large text, and 3:1 for UI components`
    );
  }

  if (ruleCategories.images.length > 0) {
    recommendations.push(
      `Fix image accessibility (${ruleCategories.images.length} issues): Add descriptive alt text for informative images, use empty alt="" for decorative images`
    );
  }

  if (ruleCategories.forms.length > 0) {
    recommendations.push(
      `Improve form accessibility (${ruleCategories.forms.length} issues): Ensure all form controls have proper labels, fieldsets, and error handling`
    );
  }

  if (ruleCategories.structure.length > 0) {
    recommendations.push(
      `Fix document structure (${ruleCategories.structure.length} issues): Use proper heading hierarchy, landmarks, and semantic HTML elements`
    );
  }

  if (ruleCategories.keyboard.length > 0) {
    recommendations.push(
      `Improve keyboard accessibility (${ruleCategories.keyboard.length} issues): Ensure all interactive elements are keyboard accessible with visible focus indicators`
    );
  }

  if (ruleCategories.aria.length > 0) {
    recommendations.push(
      `Review ARIA usage (${ruleCategories.aria.length} issues): Fix ARIA attributes and prefer semantic HTML when possible`
    );
  }

  if (ruleCategories.language.length > 0) {
    recommendations.push(
      `Fix language and reading issues (${ruleCategories.language.length} issues): Set page language, ensure readable text, and fix reading order`
    );
  }

  // WCAG level analysis
  const wcagAnalysis = analyzeWCAGCompliance(axeResults.violations);
  if (wcagAnalysis.level2A > 0) {
    recommendations.push(
      `WCAG 2.1 Level A: ${wcagAnalysis.level2A} violations found - these are fundamental accessibility requirements`
    );
  }
  if (wcagAnalysis.level2AA > 0) {
    recommendations.push(
      `WCAG 2.1 Level AA: ${wcagAnalysis.level2AA} violations found - these are standard accessibility requirements for most organizations`
    );
  }

  // Priority recommendations based on impact and user groups affected
  const impactAnalysis = analyzeUserImpact(axeResults.violations);
  if (impactAnalysis.screenReaderUsers > 0) {
    recommendations.push(
      `${impactAnalysis.screenReaderUsers} issues particularly affect screen reader users - prioritize fixing semantic markup and ARIA`
    );
  }
  if (impactAnalysis.keyboardUsers > 0) {
    recommendations.push(
      `${impactAnalysis.keyboardUsers} issues affect keyboard navigation - ensure all functionality is keyboard accessible`
    );
  }
  if (impactAnalysis.lowVisionUsers > 0) {
    recommendations.push(
      `${impactAnalysis.lowVisionUsers} issues affect low vision users - focus on color contrast and visual design`
    );
  }

  // Success message and ongoing recommendations
  if (axeResults.violations.length === 0) {
    recommendations.push(
      'Great job! No accessibility violations found in the analyzed content'
    );
    recommendations.push(
      'Continue testing with real assistive technology users for the best experience'
    );
    recommendations.push(
      'Consider implementing accessibility testing in your development workflow'
    );
  } else if (recommendations.length === 0) {
    // Fallback for edge cases
    recommendations.push(
      'Review all accessibility violations and follow WCAG 2.1 AA guidelines'
    );
    recommendations.push(
      'Test with screen readers and keyboard-only navigation'
    );
  }

  // Add actionable next steps
  if (axeResults.violations.length > 0) {
    recommendations.push(
      'Next steps: Fix critical and serious issues first, then address moderate and minor issues'
    );
    recommendations.push(
      'Test fixes with actual assistive technology users when possible'
    );
  }

  return {
    recommendations,
    criticalIssues,
  };
}

// Helper function to categorize violations by type
function categorizeViolations(
  violations: AxeViolation[]
): Record<string, AxeViolation[]> {
  const categories: Record<string, AxeViolation[]> = {
    colorContrast: [],
    images: [],
    forms: [],
    structure: [],
    keyboard: [],
    aria: [],
    language: [],
    other: [],
  };

  for (const violation of violations) {
    const tags = violation.tags || [];
    const ruleId = violation.id;

    // Categorize based on rule ID and tags
    if (ruleId.includes('color-contrast') || tags.includes('cat.color')) {
      categories.colorContrast.push(violation);
    } else if (
      ruleId.includes('image') ||
      ruleId.includes('alt') ||
      tags.includes('cat.text-alternatives')
    ) {
      categories.images.push(violation);
    } else if (
      ruleId.includes('label') ||
      ruleId.includes('form') ||
      tags.includes('cat.forms')
    ) {
      categories.forms.push(violation);
    } else if (
      ruleId.includes('heading') ||
      ruleId.includes('landmark') ||
      ruleId.includes('region') ||
      tags.includes('cat.structure')
    ) {
      categories.structure.push(violation);
    } else if (
      ruleId.includes('focus') ||
      ruleId.includes('keyboard') ||
      ruleId.includes('tabindex') ||
      tags.includes('cat.keyboard')
    ) {
      categories.keyboard.push(violation);
    } else if (ruleId.includes('aria') || tags.includes('cat.aria')) {
      categories.aria.push(violation);
    } else if (
      ruleId.includes('lang') ||
      ruleId.includes('language') ||
      tags.includes('cat.language')
    ) {
      categories.language.push(violation);
    } else {
      categories.other.push(violation);
    }
  }

  return categories;
}

// Helper function to analyze WCAG compliance levels
function analyzeWCAGCompliance(violations: AxeViolation[]): {
  level2A: number;
  level2AA: number;
  level2AAA: number;
} {
  const analysis = { level2A: 0, level2AA: 0, level2AAA: 0 };

  for (const violation of violations) {
    const tags = violation.tags || [];
    if (tags.includes('wcag2a')) {
      analysis.level2A++;
    }
    if (tags.includes('wcag2aa') || tags.includes('wcag21aa')) {
      analysis.level2AA++;
    }
    if (tags.includes('wcag2aaa') || tags.includes('wcag21aaa')) {
      analysis.level2AAA++;
    }
  }

  return analysis;
}

// Helper function to analyze impact on specific user groups
function analyzeUserImpact(violations: AxeViolation[]): {
  screenReaderUsers: number;
  keyboardUsers: number;
  lowVisionUsers: number;
} {
  const impact = { screenReaderUsers: 0, keyboardUsers: 0, lowVisionUsers: 0 };

  for (const violation of violations) {
    const ruleId = violation.id;
    const tags = violation.tags || [];

    // Issues affecting screen reader users
    if (
      tags.includes('cat.text-alternatives') ||
      tags.includes('cat.aria') ||
      tags.includes('cat.structure') ||
      ruleId.includes('label') ||
      ruleId.includes('heading') ||
      ruleId.includes('landmark')
    ) {
      impact.screenReaderUsers++;
    }

    // Issues affecting keyboard users
    if (
      tags.includes('cat.keyboard') ||
      ruleId.includes('focus') ||
      ruleId.includes('tabindex') ||
      ruleId.includes('interactive')
    ) {
      impact.keyboardUsers++;
    }

    // Issues affecting low vision users
    if (
      tags.includes('cat.color') ||
      ruleId.includes('color-contrast') ||
      ruleId.includes('zoom') ||
      ruleId.includes('resize')
    ) {
      impact.lowVisionUsers++;
    }
  }

  return impact;
}

export const doctorTool: ToolHandler<DoctorMessage> = {
  definition: doctorDefinition,
  messageSchema: DoctorMessageSchema,
  execute: executeDoctor,
};
