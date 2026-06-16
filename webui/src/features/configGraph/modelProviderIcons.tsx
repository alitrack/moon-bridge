import Anthropic from "@lobehub/icons/es/Anthropic/components/Mono";
import Baichuan from "@lobehub/icons/es/Baichuan/components/Mono";
import Claude from "@lobehub/icons/es/Claude/components/Mono";
import Cohere from "@lobehub/icons/es/Cohere/components/Mono";
import DeepSeek from "@lobehub/icons/es/DeepSeek/components/Mono";
import Doubao from "@lobehub/icons/es/Doubao/components/Mono";
import Gemini from "@lobehub/icons/es/Gemini/components/Mono";
import Gemma from "@lobehub/icons/es/Gemma/components/Mono";
import Google from "@lobehub/icons/es/Google/components/Mono";
import Grok from "@lobehub/icons/es/Grok/components/Mono";
import Kimi from "@lobehub/icons/es/Kimi/components/Mono";
import Meta from "@lobehub/icons/es/Meta/components/Mono";
import Minimax from "@lobehub/icons/es/Minimax/components/Mono";
import Mistral from "@lobehub/icons/es/Mistral/components/Mono";
import Moonshot from "@lobehub/icons/es/Moonshot/components/Mono";
import OpenAI from "@lobehub/icons/es/OpenAI/components/Mono";
import Perplexity from "@lobehub/icons/es/Perplexity/components/Mono";
import Qwen from "@lobehub/icons/es/Qwen/components/Mono";
import XAI from "@lobehub/icons/es/XAI/components/Mono";
import Yi from "@lobehub/icons/es/Yi/components/Mono";
import Zhipu from "@lobehub/icons/es/Zhipu/components/Mono";
import type { ReactNode } from "react";
import type { ConfigResource, FieldSchema } from "../../rpc/types";

type IconComponent = (props: { className?: string; size?: number | string }) => ReactNode;

const iconSize = 18;

const modelMatchers: Array<{ icon: IconComponent; patterns: RegExp[] }> = [
  { icon: Claude, patterns: [/\bclaude\b/i, /\banthropic\b/i] },
  { icon: OpenAI, patterns: [/\b(gpt|openai|o[1345]|chatgpt)\b/i] },
  { icon: Gemini, patterns: [/\b(gemini|google-genai)\b/i] },
  { icon: Gemma, patterns: [/\bgemma\b/i] },
  { icon: DeepSeek, patterns: [/\bdeepseek\b/i] },
  { icon: Qwen, patterns: [/\b(qwen|qwq|qvq|tongyi)\b/i] },
  { icon: Mistral, patterns: [/\b(mistral|mixtral|codestral)\b/i] },
  { icon: Meta, patterns: [/\b(llama|meta)\b/i] },
  { icon: Grok, patterns: [/\b(grok|xai)\b/i] },
  { icon: XAI, patterns: [/\bx-ai\b/i] },
  { icon: Kimi, patterns: [/\b(kimi|moonshot)\b/i] },
  { icon: Moonshot, patterns: [/\bmoonshot\b/i] },
  { icon: Doubao, patterns: [/\b(doubao|volcengine|bytedance)\b/i] },
  { icon: Baichuan, patterns: [/\bbaichuan\b/i] },
  { icon: Yi, patterns: [/\byi\b/i, /\b01-ai\b/i] },
  { icon: Zhipu, patterns: [/\b(zhipu|glm|chatglm)\b/i] },
  { icon: Minimax, patterns: [/\bminimax\b/i] },
  { icon: Perplexity, patterns: [/\b(perplexity|sonar)\b/i] },
  { icon: Cohere, patterns: [/\b(cohere|command-r)\b/i] }
];

const protocolIcons: Record<string, IconComponent> = {
  anthropic: Anthropic,
  "google-genai": Gemini,
  "openai-chat": OpenAI,
  "openai-response": OpenAI
};

export function protocolIconForValue(protocol: string) {
  const Icon = protocolIcons[protocol];
  return Icon ? <Icon className="lobe-brand-icon" size={iconSize} /> : undefined;
}

export function modelIconForName(name: string | undefined) {
  if (!name) {
    return undefined;
  }
  const normalized = name.trim();
  if (!normalized) {
    return undefined;
  }
  const match = modelMatchers.find((candidate) => candidate.patterns.some((pattern) => pattern.test(normalized)));
  const Icon = match?.icon;
  return Icon ? <Icon className="lobe-brand-icon" size={iconSize} /> : undefined;
}

function modelIconForCandidateNames(...names: Array<string | undefined>) {
  for (const name of names) {
    const icon = modelIconForName(name);
    if (icon) {
      return icon;
    }
  }
  return undefined;
}

export function resourceFieldModelIcon(
  resource: ConfigResource,
  field: FieldSchema,
  modelDisplayNames: Record<string, string> = {}
) {
  const value = resource.value[field.path];
  if (resource.kind === "model" && field.path === "display_name") {
    return modelIconForName(stringValue(value) || resource.id || resource.label);
  }
  if (resource.kind === "route" && routeModelIconFields.has(field.path)) {
    const modelId = stringValue(resource.value.model);
    const fieldValue = stringValue(value);
    if (field.path === "model") {
      return modelIconForCandidateNames(modelDisplayNames[fieldValue], modelDisplayNames[modelId], fieldValue, modelId);
    }
    return modelIconForCandidateNames(fieldValue, modelDisplayNames[modelId], modelId, resource.id, resource.label);
  }
  if (resource.kind === "defaults" && field.path === "model") {
    const modelId = stringValue(value);
    return modelIconForCandidateNames(modelDisplayNames[modelId], modelId);
  }
  return undefined;
}

export function modelSelectOptions(resources: ConfigResource[]) {
  return resources
    .filter((resource) => resource.kind === "model")
    .map((resource) => ({
      label: resource.id,
      leadingIcon: modelIconForName(modelDisplayName(resource)),
      value: resource.id
    }));
}

export function providerSelectOptions(resources: ConfigResource[]) {
  return resources
    .filter((resource) => resource.kind === "provider")
    .map((resource) => ({
      label: resource.id,
      leadingIcon: protocolIconForValue(stringValue(resource.value.protocol)),
      value: resource.id
    }));
}

export function modelDisplayNamesById(resources: ConfigResource[]) {
  const modelNames = Object.fromEntries(resources
    .filter((resource) => resource.kind === "model")
    .map((resource) => [resource.id, modelDisplayName(resource)]));
  const routeNames = resources
    .filter((resource) => resource.kind === "route")
    .map((resource) => {
      const routeModel = stringValue(resource.value.model);
      return [resource.id, modelNames[routeModel] || routeModel || modelDisplayName(resource)] as const;
    });
  return Object.fromEntries([...Object.entries(modelNames), ...routeNames]);
}

const routeModelIconFields = new Set(["model", "to", "display_name"]);

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function modelDisplayName(resource: ConfigResource) {
  return stringValue(resource.value.display_name) || resource.label || resource.id;
}
