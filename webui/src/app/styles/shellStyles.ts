import { baseStyles } from "./base";
import { shellLayoutStyles } from "./shellLayout";
import { overviewStyles } from "./overview";
import { sharedResourceStyles } from "./sharedResources";
import { resourceEditorStyles } from "./resourceEditor";
import { formStyles } from "./forms";
import { logStyles } from "./logs";
import { responsiveStyles } from "./responsive";

export const shellStyles = [
  baseStyles,
  shellLayoutStyles,
  overviewStyles,
  sharedResourceStyles,
  resourceEditorStyles,
  formStyles,
  logStyles,
  responsiveStyles
].join("");
