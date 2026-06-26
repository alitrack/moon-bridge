export function expectPanelElementToBeFlat(element: Element) {
  const style = getComputedStyle(element);
  expect(isZeroLength(style.borderTopWidth)).toBe(true);
  expect(isZeroLength(style.borderRightWidth)).toBe(true);
  expect(isZeroLength(style.borderBottomWidth)).toBe(true);
  expect(isZeroLength(style.borderLeftWidth)).toBe(true);
  expect(isZeroLength(style.outlineWidth)).toBe(true);
  expect(style.boxShadow === "" || style.boxShadow === "none").toBe(true);
  expect(style.filter === "" || style.filter === "none").toBe(true);
}

export function expectPanelRuleToAvoidEdges(selector: string) {
  const edgeProperties = [
    "border",
    "border-block",
    "border-inline",
    "border-top",
    "border-right",
    "border-bottom",
    "border-left",
    "border-color",
    "border-width",
    "border-style",
    "outline",
    "outline-color",
    "outline-width",
    "outline-style",
    "box-shadow",
    "filter"
  ];
  const rule = findStyleRule(selector);
  if (!rule) {
    const ruleText = findRawStyleRule(selector);
    for (const property of edgeProperties) {
      expect(ruleText).not.toMatch(new RegExp(`(^|;)\\s*${escapeRegExp(property)}\\s*:`));
    }
    return;
  }
  for (const property of edgeProperties) {
    const value = rule.style.getPropertyValue(property).trim();
    expect(value === "" || value === "0" || value === "0px" || value === "none").toBe(true);
  }
}

export function expectPanelStateRuleToStayFlat(selector: string) {
  expectPanelRuleToAvoidEdges(selector);
  const rule = findStyleRule(selector);
  if (!rule) {
    expect(findRawStyleRule(selector)).not.toMatch(/(^|;)\s*transform\s*:/);
    return;
  }
  expect(rule.style.getPropertyValue("transform").trim()).toBe("");
}

function findStyleRule(selector: string): CSSStyleRule | undefined {
  for (const styleSheet of Array.from(document.styleSheets)) {
    const rule = findStyleRuleInList(styleSheet.cssRules, selector);
    if (rule) {
      return rule;
    }
  }
  return undefined;
}

function findStyleRuleInList(rules: CSSRuleList, selector: string): CSSStyleRule | undefined {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule && selectorList(rule.selectorText).includes(selector)) {
      return rule;
    }
    if (rule instanceof CSSMediaRule) {
      const nestedRule = findStyleRuleInList(rule.cssRules, selector);
      if (nestedRule) {
        return nestedRule;
      }
    }
  }
  return undefined;
}

function selectorList(selectorText: string) {
  return selectorText.split(",").map((selector) => selector.trim());
}

function isZeroLength(value: string) {
  return value === "" || value === "0px";
}

function findRawStyleRule(selector: string) {
  for (const styleElement of Array.from(document.querySelectorAll("style"))) {
    const css = styleElement.textContent ?? "";
    if (!css.includes(selector)) {
      continue;
    }
    const ruleText = findRawStyleRuleInText(css, selector);
    if (ruleText) {
      return ruleText;
    }
  }
  throw new Error(`Expected stylesheet rule for selector "${selector}".`);
}

function findRawStyleRuleInText(css: string, selector: string) {
  let searchFrom = 0;
  while (searchFrom < css.length) {
    const selectorIndex = css.indexOf(selector, searchFrom);
    if (selectorIndex === -1) {
      return undefined;
    }
    const openBrace = css.indexOf("{", selectorIndex);
    if (openBrace === -1) {
      return undefined;
    }
    const selectorTextStart = css.lastIndexOf("}", selectorIndex) + 1;
    const atRuleStart = css.lastIndexOf("@", selectorIndex);
    if (atRuleStart > selectorTextStart) {
      searchFrom = selectorIndex + selector.length;
      continue;
    }
    const selectorText = css.slice(selectorTextStart, openBrace).trim();
    if (selectorList(selectorText).includes(selector)) {
      const closeBrace = css.indexOf("}", openBrace);
      if (closeBrace === -1) {
        return undefined;
      }
      return css.slice(openBrace + 1, closeBrace);
    }
    searchFrom = selectorIndex + selector.length;
  }
  return undefined;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
